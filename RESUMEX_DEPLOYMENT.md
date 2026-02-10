# ResumeX Deployment Guide

Deploy ResumeX using the AWS Deployment Template system.

## Prerequisites

1. **AWS CLI** installed and configured (`aws configure`)
2. **Node.js** installed (v18+)
3. **OpenRouter API key** from https://openrouter.ai/keys

## Quick Deployment

### 1. Install Dependencies

```bash
# Install deployment template dependencies
npm install

# Install Lambda dependencies
cd lambda && npm install && cd ..

# Build the deployment template
npm run build
```

### 2. Configure Environment Variables

You'll need to set these during deployment:
- `OPENROUTER_API_KEY`: Your OpenRouter API key (sk-or-...)
- `SHARED_PASSPHRASE`: Team passphrase for accessing the app

### 3. Deploy

```bash
# Test configuration (dry run)
node dist/cli.js deploy --config resumex-deploy.yml --dry-run

# Deploy to AWS (when ready)
node dist/cli.js deploy --config resumex-deploy.yml
```

## What Gets Deployed

### Infrastructure
- **S3 Bucket**: Static website hosting for the frontend
- **Lambda Function**: Backend API with Function URL
- **IAM Role**: Execution role for Lambda with minimal permissions
- **CloudFormation Stack**: Infrastructure as code

### Application Components
- **Frontend**: Single-page HTML app with embedded CSS/JS
- **Backend**: Node.js Lambda function handling:
  - `/analyze` - Job description analysis using LLM
  - `/build` - DOCX resume generation
  - `/models` - Available AI models

## Configuration

The deployment is configured in `resumex-deploy.yml`:

```yaml
application:
  name: resumex
  type: fullstack
  version: 1.0.0

aws:
  region: us-east-1

frontend:
  source_dir: ./frontend
  index_file: index.html

backend:
  source_dir: ./lambda
  handler: index.handler
  runtime: nodejs18.x
  timeout: 60
  memory: 512
  environment_variables:
    NODE_ENV: production
    # Add OPENROUTER_API_KEY and SHARED_PASSPHRASE during deployment

deployment:
  stack_name: resumex-stack
  enable_monitoring: true
  tags:
    Environment: production
    Project: ResumeX
```

## Post-Deployment

After deployment, you'll get:
- **Website URL**: S3 static website endpoint
- **API URL**: Lambda Function URL
- **Stack Name**: CloudFormation stack for management

The frontend will automatically be configured to use the Lambda API endpoint.

## Environment Variables Setup

After deployment, update the Lambda function with your secrets:

```bash
aws lambda update-function-configuration \
  --function-name resumex-function \
  --environment 'Variables={
    NODE_ENV=production,
    OPENROUTER_API_KEY=sk-or-your-key-here,
    SHARED_PASSPHRASE=your-team-passphrase
  }'
```

## Usage

1. Share the website URL and passphrase with your team
2. Users enter the passphrase to unlock the app
3. Paste job descriptions to generate ATS-optimized resumes
4. Download resumes as DOCX files

## Costs

- **AWS Lambda**: Free tier covers ~10,000 resume generations/month
- **S3**: Pennies per month for static hosting
- **OpenRouter**: ~$0.01-0.03 per resume depending on model choice

## Monitoring

The deployment includes CloudWatch logging for the Lambda function. Check logs in the AWS Console under CloudWatch > Log Groups.

## Cleanup

To remove all resources:

```bash
node dist/cli.js destroy --config resumex-deploy.yml
```

Or manually delete the CloudFormation stack from the AWS Console.

## Troubleshooting

### Lambda Timeout
If resume generation takes too long, increase timeout:
```bash
aws lambda update-function-configuration \
  --function-name resumex-function \
  --timeout 90
```

### CORS Issues
The deployment automatically configures CORS for cross-origin requests.

### Cold Starts
First request after inactivity may take 2-3 seconds extra. This is normal for Lambda.

## Architecture

```
Browser → S3 (Frontend) → Lambda Function URL → OpenRouter → LLM
                     ↓
                DOCX Generation
```

- **Frontend**: Single HTML file with embedded JavaScript
- **Backend**: Serverless Lambda function
- **AI**: OpenRouter proxy to multiple LLM providers
- **Output**: ATS-compliant DOCX resumes