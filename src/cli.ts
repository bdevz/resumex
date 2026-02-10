#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { load as loadYaml } from 'js-yaml';
import * as packageJson from '../package.json';
import { DeploymentOrchestrator } from './orchestration';
import { DeploymentConfig } from './types';

const program = new Command();

program
  .name('aws-deploy')
  .description('AWS Deployment Template - Deploy web applications to AWS')
  .version(packageJson.version);

program
  .command('deploy')
  .description('Deploy application to AWS')
  .option('-c, --config <path>', 'Path to configuration file', 'deploy.yml')
  .option('-e, --environment <env>', 'Deployment environment', 'production')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Show what would be deployed without making changes')
  .action(async (options) => {
    const spinner = ora('Starting AWS deployment...').start();
    
    try {
      // Load configuration
      const configPath = join(process.cwd(), options.config);
      if (!existsSync(configPath)) {
        throw new Error(`Configuration file not found: ${configPath}`);
      }

      const configContent = readFileSync(configPath, 'utf8');
      const config: DeploymentConfig = loadYaml(configContent) as DeploymentConfig;

      if (options.dryRun) {
        spinner.text = 'Validating configuration (dry run)...';
        console.log(chalk.blue('\n📋 Deployment Configuration:'));
        console.log(JSON.stringify(config, null, 2));
        spinner.succeed('Dry run completed - configuration is valid');
        return;
      }

      // Deploy using orchestrator
      spinner.text = 'Deploying to AWS...';
      const orchestrator = new DeploymentOrchestrator(config.aws.region);
      const result = await orchestrator.deploy(config);

      if (result.success) {
        spinner.succeed('Deployment completed successfully!');
        
        console.log(chalk.green('\n✅ Deployment Results:'));
        console.log(`📦 Resources deployed: ${result.resources.length}`);
        
        if (result.endpoints.length > 0) {
          console.log(chalk.blue('\n🌐 Endpoints:'));
          result.endpoints.forEach(endpoint => {
            console.log(`  ${endpoint.type}: ${chalk.underline(endpoint.url)}`);
            console.log(`    ${endpoint.description}`);
          });
        }

        console.log(chalk.gray(`\n⏱️  Deployment took ${result.metadata.duration}ms`));
        console.log(chalk.gray(`🆔 Deployment ID: ${result.metadata.deploymentId}`));
      } else {
        spinner.fail('Deployment failed');
        
        if (result.errors) {
          console.log(chalk.red('\n❌ Errors:'));
          result.errors.forEach(error => {
            console.log(`  ${error.code}: ${error.message}`);
            if (error.remediation) {
              console.log(chalk.yellow(`  💡 ${error.remediation}`));
            }
          });
        }
        process.exit(1);
      }
    } catch (error) {
      spinner.fail('Deployment failed');
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
      if (options.verbose) {
        console.error(error);
      }
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check deployment status')
  .option('-s, --stack <name>', 'CloudFormation stack name')
  .option('-c, --config <path>', 'Path to configuration file', 'deploy.yml')
  .action(async (options) => {
    const spinner = ora('Checking deployment status...').start();
    
    try {
      // Load configuration to get stack name if not provided
      let stackName = options.stack;
      if (!stackName) {
        const configPath = join(process.cwd(), options.config);
        if (existsSync(configPath)) {
          const configContent = readFileSync(configPath, 'utf8');
          const config: DeploymentConfig = loadYaml(configContent) as DeploymentConfig;
          stackName = config.deployment.stack_name || `${config.application.name}-stack`;
        }
      }

      if (!stackName) {
        throw new Error('Stack name not provided and could not be determined from configuration');
      }

      spinner.succeed(`Status check completed for stack: ${stackName}`);
      console.log(chalk.yellow('⚠️  Detailed status check logic not yet implemented'));
    } catch (error) {
      spinner.fail('Status check failed');
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('destroy')
  .description('Remove deployed resources')
  .option('-s, --stack <name>', 'CloudFormation stack name')
  .option('-c, --config <path>', 'Path to configuration file', 'deploy.yml')
  .option('-f, --force', 'Skip confirmation prompts')
  .action(async (options) => {
    const spinner = ora('Preparing to destroy deployment...').start();
    
    try {
      // Load configuration to get stack name if not provided
      let stackName = options.stack;
      if (!stackName) {
        const configPath = join(process.cwd(), options.config);
        if (existsSync(configPath)) {
          const configContent = readFileSync(configPath, 'utf8');
          const config: DeploymentConfig = loadYaml(configContent) as DeploymentConfig;
          stackName = config.deployment.stack_name || `${config.application.name}-stack`;
        }
      }

      if (!stackName) {
        throw new Error('Stack name not provided and could not be determined from configuration');
      }

      spinner.warn(`Destroy prepared for stack: ${stackName}`);
      console.log(chalk.red('🗑️  Resource destruction logic not yet implemented'));
      console.log(chalk.yellow('💡 You can manually delete the CloudFormation stack from the AWS console'));
    } catch (error) {
      spinner.fail('Destroy preparation failed');
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize a new deployment configuration')
  .option('-t, --type <type>', 'Application type (frontend|backend|fullstack)', 'fullstack')
  .option('-n, --name <name>', 'Application name')
  .option('-o, --output <path>', 'Output configuration file path', 'deploy.yml')
  .action(async (options) => {
    const spinner = ora('Initializing deployment configuration...').start();
    
    try {
      const appName = options.name || 'my-app';
      const appType = options.type;

      const config: DeploymentConfig = {
        application: {
          name: appName,
          type: appType,
          version: '1.0.0'
        },
        aws: {
          region: 'us-east-1'
        },
        deployment: {
          stack_name: `${appName}-stack`,
          enable_monitoring: true,
          tags: {
            Environment: 'production',
            Project: appName
          }
        }
      };

      // Add type-specific configuration
      if (appType === 'frontend' || appType === 'fullstack') {
        config.frontend = {
          source_dir: './dist',
          index_file: 'index.html',
          build_command: 'npm run build'
        };
      }

      if (appType === 'backend' || appType === 'fullstack') {
        config.backend = {
          source_dir: './src',
          handler: 'index.handler',
          runtime: 'nodejs18.x',
          timeout: 30,
          memory: 128,
          environment_variables: {
            NODE_ENV: 'production'
          }
        };
      }

      // Write configuration file
      const yamlContent = `# AWS Deployment Template Configuration
# Generated on ${new Date().toISOString()}

application:
  name: ${config.application.name}
  type: ${config.application.type}
  version: ${config.application.version}

aws:
  region: ${config.aws.region}
  # profile: default  # Uncomment to use a specific AWS profile

${config.frontend ? `frontend:
  source_dir: ${config.frontend.source_dir}
  index_file: ${config.frontend.index_file}
  build_command: ${config.frontend.build_command}
  # custom_domain: example.com  # Uncomment to use a custom domain

` : ''}${config.backend ? `backend:
  source_dir: ${config.backend.source_dir}
  handler: ${config.backend.handler}
  runtime: ${config.backend.runtime}
  timeout: ${config.backend.timeout}
  memory: ${config.backend.memory}
  environment_variables:
    NODE_ENV: production
    # Add your environment variables here

` : ''}deployment:
  stack_name: ${config.deployment.stack_name}
  enable_monitoring: ${config.deployment.enable_monitoring}
  tags:
    Environment: production
    Project: ${config.application.name}
    # Add your custom tags here
`;

      writeFileSync(options.output, yamlContent);
      
      spinner.succeed(`Configuration file created: ${options.output}`);
      console.log(chalk.green('\n✅ Next steps:'));
      console.log('1. Review and customize the configuration file');
      console.log('2. Ensure your AWS credentials are configured');
      console.log(`3. Run: ${chalk.cyan('aws-deploy deploy')}`);
    } catch (error) {
      spinner.fail('Initialization failed');
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Error handling for unknown commands
program.on('command:*', () => {
  console.error(chalk.red('❌ Invalid command. See --help for available commands.'));
  process.exit(1);
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}