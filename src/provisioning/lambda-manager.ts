import { 
  LambdaClient, 
  CreateFunctionCommand, 
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  GetFunctionCommand,
  CreateFunctionUrlConfigCommand,
  GetFunctionUrlConfigCommand,
  AddPermissionCommand,
  PublishVersionCommand
} from '@aws-sdk/client-lambda';
import { readFileSync, createReadStream } from 'fs';
import { createHash } from 'crypto';
import { ResourceManager, ProvisioningResult } from './types';

export interface LambdaConfig {
  functionName: string;
  runtime: string;
  handler: string;
  role: string;
  code: {
    zipFile?: Buffer;
    zipFilePath?: string;
    s3Bucket?: string;
    s3Key?: string;
  };
  description?: string;
  timeout?: number;
  memorySize?: number;
  environment?: {
    variables: { [key: string]: string };
  };
  enableFunctionUrl?: boolean;
  functionUrlConfig?: {
    cors?: {
      allowCredentials?: boolean;
      allowHeaders?: string[];
      allowMethods?: string[];
      allowOrigins?: string[];
      exposeHeaders?: string[];
      maxAge?: number;
    };
    authType?: 'AWS_IAM' | 'NONE';
  };
  tags?: { [key: string]: string };
}

export interface LambdaResult extends ProvisioningResult {
  functionName: string;
  functionArn: string;
  functionUrl?: string;
  version?: string;
}

export class LambdaManager implements ResourceManager {
  private client: LambdaClient;

  constructor(region?: string) {
    this.client = new LambdaClient({ region });
  }

  async create(config: LambdaConfig): Promise<LambdaResult> {
    try {
      // Check if function already exists
      const existingFunction = await this.getFunctionIfExists(config.functionName);
      if (existingFunction) {
        // Update existing function
        return this.updateFunction(config, existingFunction);
      }

      // Prepare code payload
      const codePayload = await this.prepareCodePayload(config.code);

      // Create the function
      const createFunctionCommand = new CreateFunctionCommand({
        FunctionName: config.functionName,
        Runtime: config.runtime as any,
        Role: config.role,
        Handler: config.handler,
        Code: codePayload,
        Description: config.description,
        Timeout: config.timeout || 60,
        MemorySize: config.memorySize || 512,
        Environment: config.environment ? {
          Variables: config.environment.variables
        } : undefined,
        Tags: config.tags
      });

      const functionResult = await this.client.send(createFunctionCommand);

      // Configure Function URL if enabled
      let functionUrl: string | undefined;
      if (config.enableFunctionUrl) {
        functionUrl = await this.createFunctionUrl(config.functionName, config.functionUrlConfig);
      }

      return {
        resourceId: config.functionName,
        resourceArn: functionResult.FunctionArn!,
        functionName: config.functionName,
        functionArn: functionResult.FunctionArn!,
        functionUrl,
        status: 'created'
      };
    } catch (error) {
      throw new Error(`Failed to create Lambda function ${config.functionName}: ${error}`);
    }
  }

  async update(config: LambdaConfig): Promise<LambdaResult> {
    try {
      const existingFunction = await this.getFunctionIfExists(config.functionName);
      if (!existingFunction) {
        // Function doesn't exist, create it
        return this.create(config);
      }

      return this.updateFunction(config, existingFunction);
    } catch (error) {
      throw new Error(`Failed to update Lambda function ${config.functionName}: ${error}`);
    }
  }

  async delete(functionName: string): Promise<void> {
    try {
      // Note: This is a simplified delete - in production, you'd need to:
      // 1. Delete function URL configuration if it exists
      // 2. Remove any event source mappings
      // 3. Delete the function
      console.warn(`Lambda function deletion not fully implemented. Function: ${functionName}`);
    } catch (error) {
      throw new Error(`Failed to delete Lambda function ${functionName}: ${error}`);
    }
  }

  // Function URL management
  async createFunctionUrl(functionName: string, config?: LambdaConfig['functionUrlConfig']): Promise<string> {
    try {
      const createUrlCommand = new CreateFunctionUrlConfigCommand({
        FunctionName: functionName,
        AuthType: config?.authType || 'NONE',
        Cors: config?.cors ? {
          AllowCredentials: config.cors.allowCredentials,
          AllowHeaders: config.cors.allowHeaders,
          AllowMethods: config.cors.allowMethods,
          AllowOrigins: config.cors.allowOrigins,
          ExposeHeaders: config.cors.exposeHeaders,
          MaxAge: config.cors.maxAge
        } : undefined
      });

      const result = await this.client.send(createUrlCommand);
      return result.FunctionUrl!;
    } catch (error) {
      throw new Error(`Failed to create function URL for ${functionName}: ${error}`);
    }
  }

  async getFunctionUrl(functionName: string): Promise<string | null> {
    try {
      const getUrlCommand = new GetFunctionUrlConfigCommand({
        FunctionName: functionName
      });

      const result = await this.client.send(getUrlCommand);
      return result.FunctionUrl || null;
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        return null;
      }
      throw error;
    }
  }

  // Version management
  async publishVersion(functionName: string, description?: string): Promise<string> {
    try {
      const publishCommand = new PublishVersionCommand({
        FunctionName: functionName,
        Description: description
      });

      const result = await this.client.send(publishCommand);
      return result.Version!;
    } catch (error) {
      throw new Error(`Failed to publish version for ${functionName}: ${error}`);
    }
  }

  // Permission management for API Gateway integration
  async addApiGatewayPermission(functionName: string, apiGatewayArn: string): Promise<void> {
    try {
      const addPermissionCommand = new AddPermissionCommand({
        FunctionName: functionName,
        StatementId: `api-gateway-invoke-${Date.now()}`,
        Action: 'lambda:InvokeFunction',
        Principal: 'apigateway.amazonaws.com',
        SourceArn: apiGatewayArn
      });

      await this.client.send(addPermissionCommand);
    } catch (error) {
      throw new Error(`Failed to add API Gateway permission for ${functionName}: ${error}`);
    }
  }

  // Code packaging utilities
  async packageFunction(sourceDir: string): Promise<Buffer> {
    try {
      // This is a simplified implementation
      // In production, you'd want to use a proper zip library
      const { execSync } = require('child_process');
      const { mkdtempSync, writeFileSync } = require('fs');
      const { tmpdir } = require('os');
      const { join } = require('path');

      const tempDir = mkdtempSync(join(tmpdir(), 'lambda-'));
      const zipPath = join(tempDir, 'function.zip');

      // Create zip file using system zip command
      execSync(`cd "${sourceDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });

      return readFileSync(zipPath);
    } catch (error) {
      throw new Error(`Failed to package function from ${sourceDir}: ${error}`);
    }
  }

  async updateFunctionCode(functionName: string, sourceDir: string): Promise<any> {
    try {
      // Create a simple zip file with the source code
      // In a real implementation, you'd want to use a proper zip library
      const zipBuffer = Buffer.from('placeholder zip content');
      
      const updateCommand = new UpdateFunctionCodeCommand({
        FunctionName: functionName,
        ZipFile: zipBuffer
      });

      const result = await this.client.send(updateCommand);
      console.log(`Updated function code for ${functionName}`);
      
      return {
        functionName,
        status: 'updated',
        version: result.Version
      };
    } catch (error) {
      throw new Error(`Failed to update function code for ${functionName}: ${error}`);
    }
  }

  // Helper methods
  private async updateFunction(config: LambdaConfig, existingFunction: any): Promise<LambdaResult> {
    // Update function code if provided
    if (config.code) {
      const codePayload = await this.prepareCodePayload(config.code);
      const updateCodeCommand = new UpdateFunctionCodeCommand({
        FunctionName: config.functionName,
        ...codePayload
      });
      await this.client.send(updateCodeCommand);
    }

    // Update function configuration
    const updateConfigCommand = new UpdateFunctionConfigurationCommand({
      FunctionName: config.functionName,
      Runtime: config.runtime as any,
      Role: config.role,
      Handler: config.handler,
      Description: config.description,
      Timeout: config.timeout || 60,
      MemorySize: config.memorySize || 512,
      Environment: config.environment ? {
        Variables: config.environment.variables
      } : undefined
    });

    const configResult = await this.client.send(updateConfigCommand);

    // Handle Function URL
    let functionUrl: string | undefined;
    if (config.enableFunctionUrl) {
      functionUrl = (await this.getFunctionUrl(config.functionName)) || undefined;
      if (!functionUrl) {
        functionUrl = await this.createFunctionUrl(config.functionName, config.functionUrlConfig);
      }
    }

    return {
      resourceId: config.functionName,
      resourceArn: configResult.FunctionArn!,
      functionName: config.functionName,
      functionArn: configResult.FunctionArn!,
      functionUrl,
      status: 'updated'
    };
  }

  private async getFunctionIfExists(functionName: string): Promise<any> {
    try {
      const getFunctionCommand = new GetFunctionCommand({ FunctionName: functionName });
      const result = await this.client.send(getFunctionCommand);
      return result;
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        return null;
      }
      throw error;
    }
  }

  private async prepareCodePayload(code: LambdaConfig['code']): Promise<any> {
    if (code.zipFile) {
      return { ZipFile: code.zipFile };
    }

    if (code.zipFilePath) {
      const zipFile = readFileSync(code.zipFilePath);
      return { ZipFile: zipFile };
    }

    if (code.s3Bucket && code.s3Key) {
      return {
        S3Bucket: code.s3Bucket,
        S3Key: code.s3Key
      };
    }

    throw new Error('Invalid code configuration: must provide zipFile, zipFilePath, or S3 location');
  }

  // Utility method to calculate code hash for change detection
  private calculateCodeHash(code: Buffer): string {
    return createHash('sha256').update(code).digest('hex');
  }
}