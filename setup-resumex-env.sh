#!/bin/bash
# Setup script for ResumeX environment variables

set -e

echo "🔧 ResumeX Environment Setup"
echo "================================"

# Get function name from CloudFormation stack
STACK_NAME="resumex-stack"
FUNCTION_NAME=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`FunctionName`].OutputValue' \
  --output text 2>/dev/null || echo "resumex-function")

echo "Lambda Function: $FUNCTION_NAME"
echo ""

# Collect environment variables
if [ -z "$OPENROUTER_API_KEY" ]; then
  read -p "OpenRouter API Key (sk-or-...): " OPENROUTER_API_KEY
fi

if [ -z "$SHARED_PASSPHRASE" ]; then
  read -p "Team Passphrase: " SHARED_PASSPHRASE
fi

echo ""
echo "🚀 Updating Lambda environment variables..."

# Update Lambda function configuration
aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --environment "Variables={
    NODE_ENV=production,
    OPENROUTER_API_KEY=$OPENROUTER_API_KEY,
    SHARED_PASSPHRASE=$SHARED_PASSPHRASE
  }" \
  --output table \
  --query 'Environment.Variables'

echo ""
echo "✅ Environment variables updated successfully!"
echo ""
echo "Your ResumeX app is now ready to use."
echo "Share the website URL and passphrase with your team."