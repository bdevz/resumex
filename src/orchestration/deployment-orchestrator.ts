import { 
  DeploymentConfig, 
  DeploymentResult, 
  DeployedResource, 
  Endpoint, 
  DeploymentError,
  DeploymentMetadata 
} from '../types';
import { TemplateEngine } from '../templates';
import { S3Manager } from '../provisioning/s3-manager';
import { LambdaManager } from '../provisioning/lambda-manager';
import { IAMManager } from '../provisioning/iam-manager';
import { CloudFormationClient, CreateStackCommand, UpdateStackCommand, DescribeStacksCommand, StackStatus } from '@aws-sdk/client-cloudformation';
import { v4 as uuidv4 } from 'uuid';

export class DeploymentOrchestrator {
  private cloudFormationClient: CloudFormationClient;
  private templateEngine: TemplateEngine;
  private s3Manager: S3Manager;
  private lambdaManager: LambdaManager;
  private iamManager: IAMManager;

  constructor(region: string = 'us-east-1') {
    this.cloudFormationClient = new CloudFormationClient({ region });
    this.templateEngine = new TemplateEngine();
    this.s3Manager = new S3Manager(region);
    this.lambdaManager = new LambdaManager(region);
    this.iamManager = new IAMManager(region);
  }

  async deploy(config: DeploymentConfig): Promise<DeploymentResult> {
    const deploymentId = uuidv4();
    const startTime = Date.now();
    const stackName = config.deployment.stack_name || `${config.application.name}-stack`;
    
    const metadata: DeploymentMetadata = {
      deploymentId,
      timestamp: new Date(),
      region: config.aws.region || 'us-east-1',
      stackName
    };

    try {
      // Step 1: Pre-deployment validation
      await this.validateDeployment(config);

      // Step 2: Generate CloudFormation template
      const template = await this.templateEngine.generateTemplate(config);

      // Step 3: Deploy infrastructure using CloudFormation
      const stackResult = await this.deployStack(stackName, template, config);

      // Step 4: Deploy application code
      const codeDeploymentResults = await this.deployApplicationCode(config, stackResult);

      // Step 5: Post-deployment verification
      const endpoints = await this.verifyDeployment(config, stackResult);

      const resources = this.extractResources(stackResult);
      
      metadata.duration = Date.now() - startTime;

      return {
        success: true,
        resources,
        endpoints,
        metadata
      };

    } catch (error) {
      metadata.duration = Date.now() - startTime;
      
      const deploymentError: DeploymentError = {
        code: 'DEPLOYMENT_FAILED',
        message: error instanceof Error ? error.message : 'Unknown deployment error',
        details: error,
        remediation: 'Check AWS CloudFormation console for detailed error information'
      };

      return {
        success: false,
        resources: [],
        endpoints: [],
        errors: [deploymentError],
        metadata
      };
    }
  }

  private async validateDeployment(config: DeploymentConfig): Promise<void> {
    // Validate configuration
    if (!config.application.name) {
      throw new Error('Application name is required');
    }

    if (!['frontend', 'backend', 'fullstack'].includes(config.application.type)) {
      throw new Error('Invalid application type. Must be frontend, backend, or fullstack');
    }

    // Validate frontend config if needed
    if ((config.application.type === 'frontend' || config.application.type === 'fullstack') && !config.frontend) {
      throw new Error('Frontend configuration is required for frontend/fullstack applications');
    }

    // Validate backend config if needed
    if ((config.application.type === 'backend' || config.application.type === 'fullstack') && !config.backend) {
      throw new Error('Backend configuration is required for backend/fullstack applications');
    }
  }

  private async deployStack(stackName: string, template: string, config: DeploymentConfig): Promise<any> {
    const parameters = [
      {
        ParameterKey: 'ApplicationName',
        ParameterValue: config.application.name
      }
    ];

    try {
      // Check if stack exists
      const existingStack = await this.getStackIfExists(stackName);
      
      if (existingStack) {
        // Update existing stack
        const updateCommand = new UpdateStackCommand({
          StackName: stackName,
          TemplateBody: template,
          Parameters: parameters,
          Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM']
        });

        await this.cloudFormationClient.send(updateCommand);
        console.log(`Updating CloudFormation stack: ${stackName}`);
      } else {
        // Create new stack
        const createCommand = new CreateStackCommand({
          StackName: stackName,
          TemplateBody: template,
          Parameters: parameters,
          Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
          Tags: this.createStackTags(config)
        });

        await this.cloudFormationClient.send(createCommand);
        console.log(`Creating CloudFormation stack: ${stackName}`);
      }

      // Wait for stack operation to complete
      return await this.waitForStackOperation(stackName);

    } catch (error: any) {
      if (error.message?.includes('No updates are to be performed')) {
        console.log('No changes detected in CloudFormation stack');
        return await this.getStackIfExists(stackName);
      }
      throw error;
    }
  }

  private async deployApplicationCode(config: DeploymentConfig, stackResult: any): Promise<any[]> {
    const results: any[] = [];

    // Deploy frontend assets if needed
    if (config.application.type === 'frontend' || config.application.type === 'fullstack') {
      if (config.frontend?.source_dir) {
        const bucketName = this.extractBucketName(stackResult);
        if (bucketName) {
          const uploadResults = await this.s3Manager.deployFrontendAssets(bucketName, config.frontend.source_dir);
          results.push({ type: 'frontend', results: uploadResults });
        }
      }
    }

    // Deploy backend code if needed
    if (config.application.type === 'backend' || config.application.type === 'fullstack') {
      if (config.backend?.source_dir) {
        const functionName = this.extractFunctionName(stackResult);
        if (functionName) {
          const updateResult = await this.lambdaManager.updateFunctionCode(functionName, config.backend.source_dir);
          results.push({ type: 'backend', results: updateResult });
        }
      }
    }

    return results;
  }

  private async verifyDeployment(config: DeploymentConfig, stackResult: any): Promise<Endpoint[]> {
    const endpoints: Endpoint[] = [];

    // Extract endpoints from stack outputs
    if (stackResult.Outputs) {
      for (const output of stackResult.Outputs) {
        if (output.OutputKey === 'WebsiteURL') {
          endpoints.push({
            type: 'website',
            url: output.OutputValue,
            description: 'Static website URL'
          });
        } else if (output.OutputKey === 'FunctionURL') {
          endpoints.push({
            type: 'function_url',
            url: output.OutputValue,
            description: 'Lambda function URL'
          });
        }
      }
    }

    return endpoints;
  }

  private async getStackIfExists(stackName: string): Promise<any | null> {
    try {
      const describeCommand = new DescribeStacksCommand({ StackName: stackName });
      const result = await this.cloudFormationClient.send(describeCommand);
      return result.Stacks?.[0] || null;
    } catch (error: any) {
      if (error.name === 'ValidationError' && error.message.includes('does not exist')) {
        return null;
      }
      throw error;
    }
  }

  private async waitForStackOperation(stackName: string, maxWaitTime: number = 1800000): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const stack = await this.getStackIfExists(stackName);
      
      if (!stack) {
        throw new Error(`Stack ${stackName} not found`);
      }

      const status = stack.StackStatus as StackStatus;
      
      if (status.endsWith('_COMPLETE')) {
        if (status.includes('FAILED') || status.includes('ROLLBACK')) {
          throw new Error(`Stack operation failed with status: ${status}`);
        }
        return stack;
      }

      if (status.endsWith('_FAILED')) {
        throw new Error(`Stack operation failed with status: ${status}`);
      }

      // Wait 10 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    throw new Error(`Stack operation timed out after ${maxWaitTime / 1000} seconds`);
  }

  private extractResources(stackResult: any): DeployedResource[] {
    const resources: DeployedResource[] = [];
    
    // This would typically come from CloudFormation stack resources
    // For now, we'll extract from stack outputs and make educated guesses
    if (stackResult.Outputs) {
      for (const output of stackResult.Outputs) {
        if (output.OutputKey === 'WebsiteURL') {
          resources.push({
            type: 'S3::Bucket',
            name: 'Frontend Bucket',
            arn: `arn:aws:s3:::${this.extractBucketName(stackResult)}`,
            status: 'created'
          });
        } else if (output.OutputKey === 'FunctionURL') {
          resources.push({
            type: 'Lambda::Function',
            name: 'Backend Function',
            arn: `arn:aws:lambda:${stackResult.Region}:${stackResult.AccountId}:function:${this.extractFunctionName(stackResult)}`,
            status: 'created'
          });
        }
      }
    }

    return resources;
  }

  private extractBucketName(stackResult: any): string | null {
    // Extract bucket name from stack resources or outputs
    // This is a simplified implementation
    return `${stackResult.StackName}-frontend-bucket`.toLowerCase();
  }

  private extractFunctionName(stackResult: any): string | null {
    // Extract function name from stack resources or outputs
    // This is a simplified implementation
    return `${stackResult.StackName}-function`;
  }

  private createStackTags(config: DeploymentConfig): Array<{ Key: string; Value: string }> {
    const tags = [
      { Key: 'Application', Value: config.application.name },
      { Key: 'ManagedBy', Value: 'AWS-Deployment-Template' }
    ];

    if (config.deployment.tags) {
      Object.entries(config.deployment.tags).forEach(([key, value]) => {
        tags.push({ Key: key, Value: value });
      });
    }

    return tags;
  }
}

// Convenience function for backward compatibility
export async function deploy(config: DeploymentConfig): Promise<DeploymentResult> {
  const orchestrator = new DeploymentOrchestrator(config.aws.region);
  return orchestrator.deploy(config);
}