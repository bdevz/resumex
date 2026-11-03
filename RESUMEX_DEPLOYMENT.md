# ResumeX Deployment Guide

## Compatible provider routing

The deployed runtime uses `lambda/` and `frontend/index.html`. Root-level
`index.js` and `index.html` are legacy copies.

Configure `OPENAI_BASE_URL` and `OPENAI_API_KEY` for OpenAI-compatible models,
including GPT-5.6 and GPT-6. Configure `ANTHROPIC_BASE_URL` and
`ANTHROPIC_API_KEY` for Claude. Base URLs accept a service root or `/v1` suffix;
when omitted, the standard OpenAI and Anthropic endpoints remain the defaults.
These routes cover generation, optimization, review, revision, and streaming.

The current production path uses an authenticated HTTPS relay that forwards to
EasyCLIProxyAPI on a separate Mac over a private network. Verify the catalog on
the actual upstream host: different proxy instances can expose different models.
A private network address alone is not reachable by a Lambda without network
connectivity to it. Keep credentials out of source and frontend code.

### Restricted relay

Run `scripts/proxy-relay.js` using Node 22 as a persistent user service. It binds
to `127.0.0.1:8318` and defaults to the local proxy on port 8317. It reads the
client key from EasyCLIProxyAPI's existing configuration (`CPA_CONFIG_PATH` can
override the path), or accepts `RELAY_API_KEY` from the service environment.

For a remote proxy, configure:

- `RELAY_UPSTREAM_URL`: an HTTP(S) origin; use HTTPS for remote hosts.
- `RELAY_UPSTREAM_KEY_FILE`: an owner-only file in the host's credential store
  containing the upstream key. Keep its directory mode 0700 and file mode 0600.

The relay validates the client key before replacing upstream authentication.
TLS certificate verification remains enabled. Restart after rotating credentials.
Only these exact authenticated routes are exposed:

- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/messages`

Management routes, arbitrary targets, query strings and unsupported methods are
blocked. Request bodies are limited to 6 MiB; streaming and upstream errors are
preserved. Expose the relay, not the full proxy, through the existing HTTPS
entrypoint. Both proxy hosts and their private network must remain online.

### Validation and recovery

Run `node --test scripts/proxy-relay.test.js lambda/lib/__tests__/*.test.js`.
Verify the authenticated upstream catalog, missing/wrong key rejection,
management-route rejection, and one synthetic resume through the public UI.

Save the active service configuration before changing the upstream. Restoring
that configuration and restarting only the relay restores its previous route.
For Lambda changes, save the current version, use a targeted code update and
merge environment values. `deploy.sh` replaces the environment and can wipe
existing keys. Do not use it for a routing-only repair.

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
  timeout: 900
  memory: 512
  environment_variables:
    NODE_ENV: production
    # Add ANTHROPIC_API_KEY, OPENAI_API_KEY and SHARED_PASSPHRASE during deployment

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
    ANTHROPIC_API_KEY=sk-ant-your-key-here,
    OPENAI_API_KEY=sk-your-openai-key,
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
Slow thinking models (Claude Fable 5 / 5.1) can take several minutes. The function
deploys with a 900s timeout (the Lambda maximum); the per-request LLM abort is 840s:
```bash
aws lambda update-function-configuration \
  --function-name resume-generator \
  --timeout 900
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
