#!/bin/bash
# ============================================================================
# deploy.sh — Deploy Resume Generator to AWS (Lambda + S3)
#
# Prerequisites:
#   - AWS CLI installed and configured (aws configure)
#   - Node.js installed (for npm install)
#   - An OpenRouter API key
#
# Usage:
#   bash deploy.sh
#
# What it creates:
#   - Lambda function with Function URL (HTTPS endpoint, no API Gateway needed)
#   - S3 bucket with static website hosting (serves index.html)
#   - IAM role for Lambda execution
#
# Estimated monthly cost: $0-1 (Lambda free tier: 1M requests/mo, S3: pennies)
# ============================================================================

set -e

# ── Configuration ──
# Change these as needed
REGION="${AWS_REGION:-us-east-1}"
FUNCTION_NAME="resume-generator"
S3_BUCKET="resume-generator-site-$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "change-me")"
ROLE_NAME="resume-generator-lambda-role"

echo ""
echo "================================================================"
echo "  RESUME GENERATOR — AWS DEPLOYMENT"
echo "================================================================"
echo ""
echo "  Region:    $REGION"
echo "  Function:  $FUNCTION_NAME"
echo "  S3 Bucket: $S3_BUCKET"
echo ""

# ── Step 0: Collect secrets ──
if [ -z "$OPENROUTER_API_KEY" ]; then
  read -p "  OpenRouter API key (sk-or-...): " OPENROUTER_API_KEY
fi

if [ -z "$SHARED_PASSPHRASE" ]; then
  read -p "  Team passphrase (e.g., team-resume-2026): " SHARED_PASSPHRASE
fi

echo ""

# ── Step 1: Bundle Lambda ──
echo "[1/6] Bundling Lambda function..."
cd lambda
npm install --production --quiet 2>/dev/null
zip -r ../lambda.zip index.js lib/ node_modules/ package.json -q
cd ..
ZIPSIZE=$(du -h lambda.zip | cut -f1)
echo "  Created lambda.zip ($ZIPSIZE)"

# ── Step 2: Create IAM Role ──
echo "[2/6] Creating IAM role..."

TRUST_POLICY='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}'

# Create role (ignore error if already exists)
ROLE_ARN=$(aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document "$TRUST_POLICY" \
  --query 'Role.Arn' --output text 2>/dev/null) || \
ROLE_ARN=$(aws iam get-role \
  --role-name "$ROLE_NAME" \
  --query 'Role.Arn' --output text 2>/dev/null)

# Attach basic execution policy (CloudWatch logs)
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" 2>/dev/null || true

echo "  Role: $ROLE_ARN"

# Wait for role to propagate
echo "  Waiting for IAM role to propagate (10s)..."
sleep 10

# ── Step 3: Create/Update Lambda ──
echo "[3/6] Deploying Lambda function..."

# Try to create; if exists, update
LAMBDA_ARN=$(aws lambda create-function \
  --function-name "$FUNCTION_NAME" \
  --runtime "nodejs22.x" \
  --handler "index.handler" \
  --role "$ROLE_ARN" \
  --zip-file "fileb://lambda.zip" \
  --timeout 60 \
  --memory-size 512 \
  --environment "Variables={OPENROUTER_API_KEY=$OPENROUTER_API_KEY,SHARED_PASSPHRASE=$SHARED_PASSPHRASE}" \
  --region "$REGION" \
  --query 'FunctionArn' --output text 2>/dev/null) || {
  echo "  Function exists, updating..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://lambda.zip" \
    --region "$REGION" --output text --query 'FunctionArn' > /dev/null

  # Wait for update to complete
  aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION" 2>/dev/null || sleep 5

  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --timeout 60 \
    --memory-size 512 \
    --runtime "nodejs22.x" \
    --environment "Variables={OPENROUTER_API_KEY=$OPENROUTER_API_KEY,SHARED_PASSPHRASE=$SHARED_PASSPHRASE}" \
    --region "$REGION" --output text --query 'FunctionArn' > /dev/null

  LAMBDA_ARN=$(aws lambda get-function \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --query 'Configuration.FunctionArn' --output text)
}

echo "  Lambda: $LAMBDA_ARN"

# ── Step 4: Create Function URL ──
echo "[4/6] Creating Lambda Function URL..."

LAMBDA_URL=$(aws lambda create-function-url-config \
  --function-name "$FUNCTION_NAME" \
  --auth-type "NONE" \
  --cors '{
    "AllowOrigins": ["*"],
    "AllowMethods": ["GET", "POST"],
    "AllowHeaders": ["Content-Type", "X-Passphrase"],
    "MaxAge": 86400
  }' \
  --region "$REGION" \
  --query 'FunctionUrl' --output text 2>/dev/null) || \
LAMBDA_URL=$(aws lambda get-function-url-config \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --query 'FunctionUrl' --output text 2>/dev/null)

# Remove trailing slash
LAMBDA_URL="${LAMBDA_URL%/}"

# Grant public invoke permission for Function URL
aws lambda add-permission \
  --function-name "$FUNCTION_NAME" \
  --statement-id "FunctionURLAllowPublicAccess" \
  --action "lambda:InvokeFunctionUrl" \
  --principal "*" \
  --function-url-auth-type "NONE" \
  --region "$REGION" 2>/dev/null || true

echo "  URL: $LAMBDA_URL"

# ── Step 5: Update frontend with Lambda URL and upload to S3 ──
echo "[5/6] Setting up S3 static website..."

# Create bucket (ignore if exists)
if [ "$REGION" = "us-east-1" ]; then
  aws s3api create-bucket --bucket "$S3_BUCKET" --region "$REGION" 2>/dev/null || true
else
  aws s3api create-bucket --bucket "$S3_BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION" 2>/dev/null || true
fi

# Disable block public access
aws s3api put-public-access-block \
  --bucket "$S3_BUCKET" \
  --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" 2>/dev/null

# Set bucket policy for public read
BUCKET_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::$S3_BUCKET/*"
  }]
}
EOF
)
aws s3api put-bucket-policy --bucket "$S3_BUCKET" --policy "$BUCKET_POLICY" 2>/dev/null

# Enable static website hosting
aws s3 website "s3://$S3_BUCKET" --index-document index.html 2>/dev/null

# Inject Lambda URL into frontend
sed "s|%%LAMBDA_URL%%|${LAMBDA_URL}|g" frontend/index.html > /tmp/index.html

# Upload
aws s3 cp /tmp/index.html "s3://$S3_BUCKET/index.html" \
  --content-type "text/html" --cache-control "max-age=300" --quiet

S3_URL="http://$S3_BUCKET.s3-website-$REGION.amazonaws.com"
echo "  S3 Website: $S3_URL"

# ── Step 6: Verify ──
echo "[6/6] Verifying deployment..."

# Test Lambda health
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$LAMBDA_URL/" 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  echo "  Lambda health check: OK"
else
  echo "  Lambda health check: $HTTP_STATUS (may need a moment to warm up)"
fi

# Clean up
rm -f lambda.zip /tmp/index.html

echo ""
echo "================================================================"
echo "  DEPLOYMENT COMPLETE"
echo ""
echo "  Web App:     $S3_URL"
echo "  Lambda API:  $LAMBDA_URL"
echo "  Passphrase:  $SHARED_PASSPHRASE"
echo ""
echo "  Share the Web App URL and passphrase with your team."
echo "  That's all they need."
echo "================================================================"
echo ""
echo "  To update later:"
echo "    - Code changes:  bash deploy.sh"
echo "    - Passphrase:    aws lambda update-function-configuration \\"
echo "                       --function-name $FUNCTION_NAME \\"
echo "                       --environment 'Variables={OPENROUTER_API_KEY=...,SHARED_PASSPHRASE=new-phrase}'"
echo ""
echo "  To tear down:"
echo "    aws lambda delete-function --function-name $FUNCTION_NAME"
echo "    aws s3 rb s3://$S3_BUCKET --force"
echo "    aws iam detach-role-policy --role-name $ROLE_NAME --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
echo "    aws iam delete-role --role-name $ROLE_NAME"
echo ""
