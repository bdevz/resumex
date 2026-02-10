# AWS Deployment Template

A reusable AWS deployment template system that can deploy web applications to AWS infrastructure. The template provides a standardized, configurable deployment process that abstracts away AWS complexity while maintaining flexibility for different application types.

## Features

- **Multi-Architecture Support**: Deploy frontend-only, backend-only, or full-stack applications
- **CloudFormation Integration**: Uses AWS CloudFormation for infrastructure as code
- **Automated Resource Management**: Handles S3 buckets, Lambda functions, IAM roles, and API Gateway
- **Configuration-Driven**: Simple YAML configuration files
- **CLI Interface**: Easy-to-use command-line interface
- **Security Best Practices**: Implements least-privilege IAM policies and secure configurations

## Quick Start

### 1. Installation

```bash
npm install
npm run build
```

### 2. Initialize Configuration

```bash
npm run dev init --name my-app --type fullstack
```

This creates a `deploy.yml` configuration file.

### 3. Configure AWS Credentials

Ensure your AWS credentials are configured:

```bash
aws configure
```

### 4. Deploy

```bash
npm run dev deploy
```

## Configuration

The deployment is configured through a YAML file (default: `deploy.yml`). Here's an example:

```yaml
application:
  name: my-web-app
  type: fullstack  # frontend | backend | fullstack
  version: 1.0.0

aws:
  region: us-east-1

frontend:
  source_dir: ./dist
  index_file: index.html
  build_command: npm run build

backend:
  source_dir: ./src
  handler: index.handler
  runtime: nodejs18.x
  timeout: 30
  memory: 128
  environment_variables:
    NODE_ENV: production

deployment:
  stack_name: my-web-app-stack
  enable_monitoring: true
  tags:
    Environment: production
    Project: my-web-app
```

## Application Types

### Frontend Only
Deploys static websites to S3 with website hosting enabled.

```yaml
application:
  type: frontend
frontend:
  source_dir: ./build
  index_file: index.html
```

### Backend Only
Deploys serverless functions using AWS Lambda with Function URLs.

```yaml
application:
  type: backend
backend:
  source_dir: ./src
  handler: index.handler
  runtime: nodejs18.x
```

### Full-Stack
Deploys both frontend and backend components with proper integration.

```yaml
application:
  type: fullstack
frontend:
  source_dir: ./dist
backend:
  source_dir: ./src
  handler: index.handler
```

## CLI Commands

### Deploy
```bash
npm run dev deploy [options]

Options:
  -c, --config <path>     Path to configuration file (default: deploy.yml)
  -e, --environment <env> Deployment environment (default: production)
  -v, --verbose          Enable verbose logging
  --dry-run              Show what would be deployed without making changes
```

### Initialize
```bash
npm run dev init [options]

Options:
  -t, --type <type>      Application type (frontend|backend|fullstack)
  -n, --name <name>      Application name
  -o, --output <path>    Output configuration file path (default: deploy.yml)
```

### Status
```bash
npm run dev status [options]

Options:
  -s, --stack <name>     CloudFormation stack name
  -c, --config <path>    Path to configuration file (default: deploy.yml)
```

### Destroy
```bash
npm run dev destroy [options]

Options:
  -s, --stack <name>     CloudFormation stack name
  -c, --config <path>    Path to configuration file (default: deploy.yml)
  -f, --force           Skip confirmation prompts
```

## Development

### Building
```bash
npm run build
```

### Testing
```bash
npm test
```

### Development Mode
```bash
npm run dev
```

## Architecture

The deployment template consists of several key components:

- **Configuration Manager**: Handles loading and validation of deployment configurations
- **Template Engine**: Generates CloudFormation templates based on application type
- **Resource Managers**: Manage specific AWS services (S3, Lambda, IAM, etc.)
- **Deployment Orchestrator**: Coordinates the entire deployment process
- **CLI Interface**: Provides user-friendly command-line interface

## Security

The template implements AWS security best practices:

- Least-privilege IAM policies
- Secure S3 bucket configurations
- Proper CORS settings
- Environment variable security
- Resource isolation through unique naming

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.