import { CloudFormationTemplate, TemplateGenerator } from './types';
import { DeploymentConfig } from '../types';

export class CloudFormationGenerator implements TemplateGenerator {
  async generate(config: DeploymentConfig): Promise<string> {
    const template = this.createBaseTemplate(config);
    
    // Add resources based on application type
    switch (config.application.type) {
      case 'frontend':
        this.addFrontendResources(template, config);
        break;
      case 'backend':
        this.addBackendResources(template, config);
        break;
      case 'fullstack':
        this.addFrontendResources(template, config);
        this.addBackendResources(template, config);
        break;
    }

    return JSON.stringify(template, null, 2);
  }

  private createBaseTemplate(config: DeploymentConfig): CloudFormationTemplate {
    return {
      AWSTemplateFormatVersion: '2010-09-09',
      Description: `AWS Deployment Template for ${config.application.name}`,
      Parameters: {
        ApplicationName: {
          Type: 'String',
          Default: config.application.name,
          Description: 'Name of the application'
        },
        Environment: {
          Type: 'String',
          Default: 'production',
          Description: 'Deployment environment'
        }
      },
      Resources: {},
      Outputs: {}
    };
  }

  private addFrontendResources(template: CloudFormationTemplate, config: DeploymentConfig): void {
    const bucketName = `${config.application.name}-frontend-bucket`;
    
    // S3 Bucket for static website hosting
    template.Resources[bucketName] = {
      Type: 'AWS::S3::Bucket',
      Properties: {
        BucketName: { 'Fn::Sub': `\${ApplicationName}-frontend-\${AWS::AccountId}` },
        WebsiteConfiguration: {
          IndexDocument: config.frontend?.index_file || 'index.html',
          ErrorDocument: 'error.html'
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: false,
          BlockPublicPolicy: false,
          IgnorePublicAcls: false,
          RestrictPublicBuckets: false
        },
        Tags: this.createTags(config)
      }
    };

    // S3 Bucket Policy for public read access
    template.Resources[`${bucketName}Policy`] = {
      Type: 'AWS::S3::BucketPolicy',
      Properties: {
        Bucket: { Ref: bucketName },
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'PublicReadGetObject',
              Effect: 'Allow',
              Principal: '*',
              Action: 's3:GetObject',
              Resource: { 'Fn::Sub': `\${${bucketName}}/*` }
            }
          ]
        }
      }
    };

    // Output the website URL
    template.Outputs!.WebsiteURL = {
      Description: 'URL of the static website',
      Value: { 'Fn::GetAtt': [bucketName, 'WebsiteURL'] },
      Export: { Name: { 'Fn::Sub': '${AWS::StackName}-WebsiteURL' } }
    };
  }

  private addBackendResources(template: CloudFormationTemplate, config: DeploymentConfig): void {
    const functionName = `${config.application.name}-function`;
    const roleName = `${config.application.name}-execution-role`;

    // IAM Role for Lambda execution
    template.Resources[roleName] = {
      Type: 'AWS::IAM::Role',
      Properties: {
        RoleName: { 'Fn::Sub': `\${ApplicationName}-execution-role` },
        AssumeRolePolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { Service: 'lambda.amazonaws.com' },
              Action: 'sts:AssumeRole'
            }
          ]
        },
        ManagedPolicyArns: [
          'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
        ],
        Tags: this.createTags(config)
      }
    };

    // Lambda Function
    template.Resources[functionName] = {
      Type: 'AWS::Lambda::Function',
      Properties: {
        FunctionName: { 'Fn::Sub': `\${ApplicationName}-function` },
        Runtime: config.backend?.runtime || 'nodejs18.x',
        Handler: config.backend?.handler || 'index.handler',
        Role: { 'Fn::GetAtt': [roleName, 'Arn'] },
        Code: {
          ZipFile: 'exports.handler = async (event) => { return { statusCode: 200, body: "Hello World" }; };'
        },
        Timeout: config.backend?.timeout || 30,
        MemorySize: config.backend?.memory || 128,
        Environment: {
          Variables: config.backend?.environment_variables || {}
        },
        Tags: this.createTags(config)
      }
    };

    // Lambda Function URL
    template.Resources[`${functionName}Url`] = {
      Type: 'AWS::Lambda::Url',
      Properties: {
        TargetFunctionArn: { Ref: functionName },
        AuthType: 'NONE',
        Cors: {
          AllowCredentials: false,
          AllowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          AllowOrigins: ['*'],
          AllowHeaders: ['Content-Type', 'Authorization']
        }
      }
    };

    // Permission for Function URL
    template.Resources[`${functionName}UrlPermission`] = {
      Type: 'AWS::Lambda::Permission',
      Properties: {
        FunctionName: { Ref: functionName },
        Action: 'lambda:InvokeFunctionUrl',
        Principal: '*',
        FunctionUrlAuthType: 'NONE'
      }
    };

    // Output the function URL
    template.Outputs!.FunctionURL = {
      Description: 'URL of the Lambda function',
      Value: { 'Fn::GetAtt': [`${functionName}Url`, 'FunctionUrl'] },
      Export: { Name: { 'Fn::Sub': '${AWS::StackName}-FunctionURL' } }
    };
  }

  private createTags(config: DeploymentConfig): Array<{ Key: string; Value: string }> {
    const baseTags = [
      { Key: 'Application', Value: config.application.name },
      { Key: 'ManagedBy', Value: 'AWS-Deployment-Template' }
    ];

    if (config.deployment.tags) {
      Object.entries(config.deployment.tags).forEach(([key, value]) => {
        baseTags.push({ Key: key, Value: value });
      });
    }

    return baseTags;
  }
}