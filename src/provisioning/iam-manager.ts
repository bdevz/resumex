import { IAMClient, CreateRoleCommand, AttachRolePolicyCommand, CreatePolicyCommand, GetRoleCommand, PutRolePolicyCommand } from '@aws-sdk/client-iam';
import { ResourceManager, ProvisioningResult } from './types';

export interface IAMConfig {
  roleName: string;
  servicePrincipal: string;
  policyArns?: string[];
  inlinePolicies?: { [key: string]: any };
  tags?: { [key: string]: string };
}

export interface IAMRoleResult extends ProvisioningResult {
  roleName: string;
  roleArn: string;
}

export class IAMManager implements ResourceManager {
  private client: IAMClient;

  constructor(region?: string) {
    this.client = new IAMClient({ region });
  }

  async create(config: IAMConfig): Promise<IAMRoleResult> {
    try {
      // Check if role already exists
      const existingRole = await this.getRoleIfExists(config.roleName);
      if (existingRole) {
        return {
          resourceId: config.roleName,
          resourceArn: existingRole.Arn!,
          roleName: config.roleName,
          roleArn: existingRole.Arn!,
          status: 'updated'
        };
      }

      // Create the role
      const trustPolicy = this.createTrustPolicy(config.servicePrincipal);
      const createRoleCommand = new CreateRoleCommand({
        RoleName: config.roleName,
        AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
        Tags: config.tags ? Object.entries(config.tags).map(([Key, Value]) => ({ Key, Value })) : undefined
      });

      const roleResult = await this.client.send(createRoleCommand);

      // Attach managed policies if provided
      if (config.policyArns) {
        for (const policyArn of config.policyArns) {
          await this.attachManagedPolicy(config.roleName, policyArn);
        }
      }

      // Add inline policies if provided
      if (config.inlinePolicies) {
        for (const [policyName, policyDocument] of Object.entries(config.inlinePolicies)) {
          await this.attachInlinePolicy(config.roleName, policyName, policyDocument);
        }
      }

      return {
        resourceId: config.roleName,
        resourceArn: roleResult.Role!.Arn!,
        roleName: config.roleName,
        roleArn: roleResult.Role!.Arn!,
        status: 'created'
      };
    } catch (error) {
      throw new Error(`Failed to create IAM role ${config.roleName}: ${error}`);
    }
  }

  async update(config: IAMConfig): Promise<IAMRoleResult> {
    // For IAM roles, update is essentially the same as create (idempotent)
    return this.create(config);
  }

  async delete(roleName: string): Promise<void> {
    try {
      // Get the role to check if it exists
      const role = await this.getRoleIfExists(roleName);
      if (!role) {
        console.log(`Role ${roleName} does not exist, skipping deletion`);
        return;
      }

      // TODO: Implement complete role deletion
      // This would require:
      // 1. List and detach all managed policies
      // 2. List and delete all inline policies  
      // 3. Delete the role
      // For now, we'll just log a warning
      console.warn(`IAM role deletion not fully implemented. Role: ${roleName}`);
      console.warn('To manually delete, you need to:');
      console.warn('1. Detach all managed policies');
      console.warn('2. Delete all inline policies');
      console.warn('3. Delete the role');
    } catch (error) {
      throw new Error(`Failed to delete IAM role ${roleName}: ${error}`);
    }
  }

  // Service-specific role creation methods
  async createLambdaExecutionRole(roleName: string, additionalPolicies?: string[], tags?: { [key: string]: string }): Promise<IAMRoleResult> {
    const config: IAMConfig = {
      roleName,
      servicePrincipal: 'lambda.amazonaws.com',
      policyArns: [
        'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        ...(additionalPolicies || [])
      ],
      tags: {
        Purpose: 'LambdaExecution',
        ManagedBy: 'AWS-Deployment-Template',
        ...tags
      }
    };
    return this.create(config);
  }

  async createS3AccessRole(roleName: string, bucketName: string, tags?: { [key: string]: string }): Promise<IAMRoleResult> {
    const s3Policy = this.createS3BucketPolicy(bucketName);
    const config: IAMConfig = {
      roleName,
      servicePrincipal: 'lambda.amazonaws.com',
      policyArns: ['arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
      inlinePolicies: {
        'S3BucketAccess': s3Policy
      },
      tags: {
        Purpose: 'S3Access',
        BucketName: bucketName,
        ManagedBy: 'AWS-Deployment-Template',
        ...tags
      }
    };
    return this.create(config);
  }

  async createApiGatewayRole(roleName: string, tags?: { [key: string]: string }): Promise<IAMRoleResult> {
    const config: IAMConfig = {
      roleName,
      servicePrincipal: 'apigateway.amazonaws.com',
      policyArns: [
        'arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs'
      ],
      tags: {
        Purpose: 'APIGateway',
        ManagedBy: 'AWS-Deployment-Template',
        ...tags
      }
    };
    return this.create(config);
  }

  // Enhanced security methods for least-privilege access
  async createLambdaRoleWithSpecificPermissions(
    roleName: string, 
    permissions: {
      s3Buckets?: string[];
      dynamoTables?: string[];
      snsTopics?: string[];
      sqsQueues?: string[];
    },
    tags?: { [key: string]: string }
  ): Promise<IAMRoleResult> {
    const inlinePolicies: { [key: string]: any } = {};

    // Add S3 permissions if specified
    if (permissions.s3Buckets && permissions.s3Buckets.length > 0) {
      inlinePolicies['S3Access'] = this.createMultiS3BucketPolicy(permissions.s3Buckets);
    }

    // Add DynamoDB permissions if specified
    if (permissions.dynamoTables && permissions.dynamoTables.length > 0) {
      inlinePolicies['DynamoDBAccess'] = this.createDynamoDBPolicy(permissions.dynamoTables);
    }

    // Add SNS permissions if specified
    if (permissions.snsTopics && permissions.snsTopics.length > 0) {
      inlinePolicies['SNSAccess'] = this.createSNSPolicy(permissions.snsTopics);
    }

    // Add SQS permissions if specified
    if (permissions.sqsQueues && permissions.sqsQueues.length > 0) {
      inlinePolicies['SQSAccess'] = this.createSQSPolicy(permissions.sqsQueues);
    }

    const config: IAMConfig = {
      roleName,
      servicePrincipal: 'lambda.amazonaws.com',
      policyArns: ['arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
      inlinePolicies,
      tags: {
        Purpose: 'LambdaWithSpecificPermissions',
        ManagedBy: 'AWS-Deployment-Template',
        ...tags
      }
    };

    return this.create(config);
  }

  // Policy template methods
  createLambdaExecutionPolicy(): any {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ],
          Resource: 'arn:aws:logs:*:*:*'
        }
      ]
    };
  }

  createS3BucketPolicy(bucketName: string): any {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject'
          ],
          Resource: `arn:aws:s3:::${bucketName}/*`
        },
        {
          Effect: 'Allow',
          Action: [
            's3:ListBucket'
          ],
          Resource: `arn:aws:s3:::${bucketName}`
        }
      ]
    };
  }

  createApiGatewayInvokePolicy(functionArn: string): any {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: 'lambda:InvokeFunction',
          Resource: functionArn
        }
      ]
    };
  }

  // Additional policy templates for enhanced security
  createMultiS3BucketPolicy(bucketNames: string[]): any {
    const statements = [];
    
    for (const bucketName of bucketNames) {
      statements.push(
        {
          Effect: 'Allow',
          Action: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject'
          ],
          Resource: `arn:aws:s3:::${bucketName}/*`
        },
        {
          Effect: 'Allow',
          Action: [
            's3:ListBucket'
          ],
          Resource: `arn:aws:s3:::${bucketName}`
        }
      );
    }

    return {
      Version: '2012-10-17',
      Statement: statements
    };
  }

  createDynamoDBPolicy(tableNames: string[]): any {
    const resources = tableNames.map(tableName => `arn:aws:dynamodb:*:*:table/${tableName}`);
    
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
            'dynamodb:Query',
            'dynamodb:Scan'
          ],
          Resource: resources
        }
      ]
    };
  }

  createSNSPolicy(topicArns: string[]): any {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'sns:Publish'
          ],
          Resource: topicArns
        }
      ]
    };
  }

  createSQSPolicy(queueArns: string[]): any {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'sqs:SendMessage',
            'sqs:ReceiveMessage',
            'sqs:DeleteMessage',
            'sqs:GetQueueAttributes'
          ],
          Resource: queueArns
        }
      ]
    };
  }

  // Security validation methods
  validatePolicyCompliance(policy: any): { isCompliant: boolean; issues: string[] } {
    const issues: string[] = [];
    
    if (!policy.Version || policy.Version !== '2012-10-17') {
      issues.push('Policy should use version 2012-10-17');
    }

    if (!policy.Statement || !Array.isArray(policy.Statement)) {
      issues.push('Policy must have a Statement array');
      return { isCompliant: false, issues };
    }

    for (const statement of policy.Statement) {
      // Check for overly broad permissions
      if (statement.Resource === '*' && statement.Action.includes('*')) {
        issues.push('Statement grants overly broad permissions (Action: *, Resource: *)');
      }

      // Check for admin-level permissions
      const adminActions = ['iam:*', 'ec2:*', 'rds:*', 's3:*'];
      if (Array.isArray(statement.Action)) {
        for (const action of statement.Action) {
          if (adminActions.includes(action)) {
            issues.push(`Statement includes admin-level action: ${action}`);
          }
        }
      }
    }

    return {
      isCompliant: issues.length === 0,
      issues
    };
  }

  // Private helper methods
  private createTrustPolicy(servicePrincipal: string): any {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            Service: servicePrincipal
          },
          Action: 'sts:AssumeRole'
        }
      ]
    };
  }

  private async getRoleIfExists(roleName: string): Promise<any> {
    try {
      const getRoleCommand = new GetRoleCommand({ RoleName: roleName });
      const result = await this.client.send(getRoleCommand);
      return result.Role;
    } catch (error: any) {
      if (error.name === 'NoSuchEntityException') {
        return null;
      }
      throw error;
    }
  }

  private async attachManagedPolicy(roleName: string, policyArn: string): Promise<void> {
    const attachPolicyCommand = new AttachRolePolicyCommand({
      RoleName: roleName,
      PolicyArn: policyArn
    });
    await this.client.send(attachPolicyCommand);
  }

  private async attachInlinePolicy(roleName: string, policyName: string, policyDocument: any): Promise<void> {
    const putRolePolicyCommand = new PutRolePolicyCommand({
      RoleName: roleName,
      PolicyName: policyName,
      PolicyDocument: JSON.stringify(policyDocument)
    });
    await this.client.send(putRolePolicyCommand);
  }
}