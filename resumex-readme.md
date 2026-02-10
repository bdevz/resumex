# Resume Generator — AWS Deployment

Generates ATS-optimized resumes from job descriptions. Runs on AWS Lambda + S3 for near-zero cost.

---

## Architecture

```
Browser                           AWS
  │
  │  index.html ◄──── S3 (static website hosting)
  │
  │  POST /analyze ──► Lambda Function URL ──► OpenRouter ──► LLM
  │  ◄── resume JSON ─┘                        (Claude/GPT/etc.)
  │
  │  POST /build ────► Lambda Function URL
  │  ◄── .docx file ──┘
```

**S3**: hosts `index.html` (the entire UI in one file)
**Lambda**: single function with a Function URL (direct HTTPS, no API Gateway)
**OpenRouter**: routes to Claude, GPT-4o, Gemini, DeepSeek, or any other model

---

## Deploying (10 minutes, one-time)

### Prerequisites

1. **AWS CLI** installed and configured (`aws configure`)
2. **Node.js** installed (for `npm install` during bundling)
3. **OpenRouter API key** from https://openrouter.ai/keys

### Deploy

```bash
bash deploy.sh
```

The script will:
1. Ask for your OpenRouter API key and a team passphrase
2. Bundle the Lambda function with dependencies
3. Create an IAM role for Lambda
4. Deploy the Lambda function with a Function URL
5. Create an S3 bucket with static website hosting
6. Inject the Lambda URL into the frontend and upload to S3
7. Print the final URLs

Output:
```
================================================================
  DEPLOYMENT COMPLETE

  Web App:     http://resume-generator-site-123456.s3-website-us-east-1.amazonaws.com
  Lambda API:  https://abc123xyz.lambda-url.us-east-1.on.aws
  Passphrase:  team-resume-2026
================================================================
```

Share the **Web App URL** and **passphrase** with your team. That's all they need.

---

## Using the app

1. Open the Web App URL in any browser
2. Enter the team passphrase
3. Paste a job description
4. Enter the target company name (optional but recommended)
5. Pick a model (Claude Sonnet is the default and most reliable)
6. Click **Generate Resume** — wait 15-30 seconds
7. Review the preview with quality scores for each bullet
8. Click **Download .docx**
9. Open in Word, replace the placeholder name/contact info, done

---

## Costs

### AWS costs
- **Lambda**: free tier covers 1M requests/month and 400,000 GB-seconds. You'd need to generate ~10,000 resumes/month to exceed this.
- **S3**: pennies/month for a single HTML file
- **Total AWS cost**: effectively $0 for normal usage

### LLM costs (OpenRouter)
| Model | Cost per resume | Speed |
|-------|----------------|-------|
| Claude Sonnet | ~$0.03 | 15-25s |
| Claude Haiku | ~$0.01 | 8-15s |
| GPT-4o | ~$0.03 | 15-25s |
| GPT-4o Mini | ~$0.005 | 8-12s |
| DeepSeek V3 | ~$0.002 | 10-20s |

Monitor at https://openrouter.ai/activity

---

## Updating

### Update code
```bash
bash deploy.sh
```
Re-running the script updates the Lambda function and re-uploads the frontend.

### Change passphrase
```bash
aws lambda update-function-configuration \
  --function-name resume-generator \
  --environment 'Variables={OPENROUTER_API_KEY=sk-or-...,SHARED_PASSPHRASE=new-passphrase}'
```

### Add new models
1. Edit `lambda/lib/config.js` — add to the `API.models` object
2. Edit `frontend/index.html` — add an `<option>` to the model dropdown
3. Re-run `bash deploy.sh`

---

## Tearing down

```bash
aws lambda delete-function --function-name resume-generator
aws s3 rb s3://YOUR-BUCKET-NAME --force
aws iam detach-role-policy --role-name resume-generator-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam delete-role --role-name resume-generator-lambda-role
```

---

## Troubleshooting

### Lambda timeout
The default timeout is 60 seconds. Most LLM calls finish in 15-30s. If you see timeouts:
```bash
aws lambda update-function-configuration \
  --function-name resume-generator \
  --timeout 90
```

### CORS errors in browser
The deploy script configures CORS on both Lambda Function URL and S3. If you still see CORS errors, check that the Lambda Function URL has CORS enabled:
```bash
aws lambda get-function-url-config --function-name resume-generator
```

### "Invalid passphrase"
The passphrase in the browser must exactly match `SHARED_PASSPHRASE` in Lambda environment variables.

### S3 website not loading
Make sure public access is enabled on the bucket. The deploy script handles this, but some AWS accounts have organization-level blocks:
```bash
aws s3api get-public-access-block --bucket YOUR-BUCKET-NAME
```

### Cold starts
First request after inactivity takes 2-3 seconds extra (Lambda cold start). Subsequent requests are fast. Not a real issue since the LLM call itself takes 15-30s.

---

## Files

```
resume-aws/
  deploy.sh                 One-command deployment script
  frontend/
    index.html              Web UI (single file, no build step)
  lambda/
    index.js                Lambda handler (routes /analyze, /build, /models)
    package.json            Dependencies (just docx-js)
    lib/
      config.js             All rules, models, scoring heuristics
      prompts.js            System prompt + bullet scoring
      docx-builder.js       DOCX generation (ATS-compliant)
```

---

## Security notes

- The passphrase is a simple shared secret — it prevents random internet users from spending your OpenRouter credits
- Lambda Function URL with `auth-type NONE` means anyone with the URL can call it, but the passphrase check in the code blocks unauthorized use
- S3 bucket is public-read (needed for website hosting) — it only contains the HTML frontend, no secrets
- The OpenRouter API key is stored in Lambda environment variables, never exposed to the browser
- For stronger security, use CloudFront + WAF in front of both S3 and Lambda
