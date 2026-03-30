#!/bin/bash
# ============================================================================
# deploy.sh — Deploy Resume Generator to AWS (Lambda + S3)
#
# Prerequisites:
#   - AWS CLI installed and configured (aws configure)
#   - Node.js installed (for npm install)
#   - An Anthropic API key
#
# Usage:
#   bash deploy.sh
#
# What it creates:
#   - Lambda function with HTTP API Gateway endpoint
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
S3_BUCKET="resumex-$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "change-me")"
CF_DISTRIBUTION_ID="${CF_DISTRIBUTION_ID:-EQ7652SZRP8TB}"
SITE_URL="https://resumex.okyte.com"
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
if [ -z "$ANTHROPIC_API_KEY" ]; then
  read -p "  Anthropic API key (sk-ant-...): " ANTHROPIC_API_KEY
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

# Inline policy for S3 job results + Lambda self-invoke (needed for async job pattern)
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
INLINE_POLICY=$(cat <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::resumex-${ACCOUNT_ID}/jobs/*"
    },
    {
      "Effect": "Allow",
      "Action": "lambda:InvokeFunction",
      "Resource": "arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}"
    }
  ]
}
POLICY
)
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "resumex-async-jobs" \
  --policy-document "$INLINE_POLICY" 2>/dev/null || true

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
  --timeout 300 \
  --memory-size 512 \
  --environment "Variables={ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY,SHARED_PASSPHRASE=$SHARED_PASSPHRASE}" \
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
    --timeout 300 \
    --memory-size 512 \
    --runtime "nodejs22.x" \
    --environment "Variables={ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY,SHARED_PASSPHRASE=$SHARED_PASSPHRASE}" \
    --region "$REGION" --output text --query 'FunctionArn' > /dev/null

  LAMBDA_ARN=$(aws lambda get-function \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --query 'Configuration.FunctionArn' --output text)
}

echo "  Lambda: $LAMBDA_ARN"

# ── Step 4: Create HTTP API Gateway ──
echo "[4/6] Creating HTTP API Gateway..."

API_NAME="${FUNCTION_NAME}-api"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Try to find existing API; create if not found
API_ID=$(aws apigatewayv2 get-apis --region "$REGION" \
  --query "Items[?Name=='${API_NAME}'].ApiId | [0]" --output text 2>/dev/null)

if [ "$API_ID" = "None" ] || [ -z "$API_ID" ]; then
  echo "  Creating new HTTP API..."
  API_ID=$(aws apigatewayv2 create-api \
    --name "$API_NAME" \
    --protocol-type HTTP \
    --cors-configuration '{
      "AllowOrigins": ["*"],
      "AllowMethods": ["GET", "POST", "OPTIONS"],
      "AllowHeaders": ["Content-Type", "X-Passphrase"],
      "MaxAge": 86400
    }' \
    --region "$REGION" \
    --query 'ApiId' --output text)

  # Create Lambda integration
  INTEGRATION_ID=$(aws apigatewayv2 create-integration \
    --api-id "$API_ID" \
    --integration-type AWS_PROXY \
    --integration-uri "$LAMBDA_ARN" \
    --payload-format-version "2.0" \
    --region "$REGION" \
    --query 'IntegrationId' --output text)

  # Create default route
  aws apigatewayv2 create-route \
    --api-id "$API_ID" \
    --route-key '$default' \
    --target "integrations/$INTEGRATION_ID" \
    --region "$REGION" > /dev/null

  # Create default stage with auto-deploy
  aws apigatewayv2 create-stage \
    --api-id "$API_ID" \
    --stage-name '$default' \
    --auto-deploy \
    --region "$REGION" > /dev/null

  # Grant API Gateway permission to invoke Lambda
  aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id "apigateway-invoke" \
    --action "lambda:InvokeFunction" \
    --principal "apigateway.amazonaws.com" \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*" \
    --region "$REGION" 2>/dev/null || true
else
  echo "  Using existing API: $API_ID"
fi

API_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com"
echo "  API URL: $API_URL"

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

# Inject API URL into frontend
sed "s|%%API_URL%%|${API_URL}|g" frontend/index.html > /tmp/index.html

# Upload HTML
aws s3 cp /tmp/index.html "s3://$S3_BUCKET/index.html" \
  --content-type "text/html" --cache-control "max-age=300" --quiet

# Upload template preview images
if [ -d "frontend/templates" ]; then
  aws s3 sync frontend/templates/ "s3://$S3_BUCKET/templates/" \
    --content-type "image/jpeg" --cache-control "max-age=86400" --quiet
  echo "  Uploaded $(ls frontend/templates/*.jpg 2>/dev/null | wc -l | tr -d ' ') template previews"
fi

S3_URL="http://$S3_BUCKET.s3-website-$REGION.amazonaws.com"
echo "  S3 Website: $S3_URL"

# Invalidate CloudFront cache if distribution ID is set
if [ -n "$CF_DISTRIBUTION_ID" ]; then
  echo "  Invalidating CloudFront cache..."
  aws cloudfront create-invalidation \
    --distribution-id "$CF_DISTRIBUTION_ID" \
    --paths "/*" \
    --query 'Invalidation.Id' --output text 2>/dev/null || echo "  (CloudFront invalidation failed — check distribution ID)"
fi

# ── Step 6: Verify ──
echo "[6/6] Verifying deployment..."

# Test API health
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/" 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  echo "  API health check: OK"
else
  echo "  API health check: $HTTP_STATUS (may need a moment to warm up)"
fi

# Verify the deployed HTML points to the API Gateway (not a stale Lambda URL)
DEPLOYED_API=$(curl -s "$S3_URL" 2>/dev/null | grep -o 'API_BASE = "[^"]*"' | head -1)
if echo "$DEPLOYED_API" | grep -q "execute-api"; then
  echo "  Frontend API check: OK ($DEPLOYED_API)"
elif echo "$DEPLOYED_API" | grep -q "lambda-url"; then
  echo "  WARNING: Frontend still points to a Lambda Function URL!"
  echo "  $DEPLOYED_API"
  echo "  This will cause 403 errors. Check the S3 bucket and CloudFront cache."
fi

# Wait for CloudFront invalidation to propagate, then verify the live site
if [ -n "$CF_DISTRIBUTION_ID" ]; then
  echo "  Waiting for CloudFront invalidation (30s)..."
  sleep 30
  LIVE_API=$(curl -s "$SITE_URL" 2>/dev/null | grep -o 'API_BASE = "[^"]*"' | head -1)
  LIVE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL" 2>/dev/null || echo "000")
  if [ "$LIVE_STATUS" = "200" ] && echo "$LIVE_API" | grep -q "execute-api"; then
    echo "  Live site check: OK ($SITE_URL)"
  else
    echo ""
    echo "  ⚠ WARNING: $SITE_URL may be serving stale content!"
    echo "  HTTP status: $LIVE_STATUS"
    echo "  API_BASE: ${LIVE_API:-not found}"
    echo "  CloudFront may need more time. Run:"
    echo "    curl -s $SITE_URL | grep API_BASE"
  fi
fi

# Clean up
rm -f lambda.zip /tmp/index.html

echo ""
echo "================================================================"
echo "  DEPLOYMENT COMPLETE"
echo ""
echo "  Live Site:   $SITE_URL"
echo "  S3 Origin:   $S3_URL"
echo "  API:         $API_URL"
echo "  Passphrase:  $SHARED_PASSPHRASE"
echo ""
echo "  Share $SITE_URL and the passphrase with your team."
echo "  That's all they need."
echo "================================================================"
echo ""
echo "  To update later:"
echo "    - Code changes:  bash deploy.sh"
echo "    - Passphrase:    aws lambda update-function-configuration \\"
echo "                       --function-name $FUNCTION_NAME \\"
echo "                       --environment 'Variables={ANTHROPIC_API_KEY=...,SHARED_PASSPHRASE=new-phrase}'"
echo ""
echo "  To tear down:"
echo "    aws lambda delete-function --function-name $FUNCTION_NAME"
echo "    aws s3 rb s3://$S3_BUCKET --force"
echo "    aws iam detach-role-policy --role-name $ROLE_NAME --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
echo "    aws iam delete-role --role-name $ROLE_NAME"
echo ""
