import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LambdaManager, LambdaConfig } from '../lambda-manager';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { readFileSync } from 'fs';

// Mock the AWS SDK and fs modules
vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: vi.fn(),
  CreateFunctionCommand: vi.fn(),
  UpdateFunctionCodeCommand: vi.fn(),
  UpdateFunctionConfigurationCommand: vi.fn(),
  GetFunctionCommand: vi.fn(),
  CreateFunctionUrlConfigCommand: vi.fn(),
  GetFunctionUrlConfigCommand: vi.fn(),
  AddPermissionCommand: vi.fn(),
  PublishVersionCommand: vi.fn()
}));

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  createReadStream: vi.fn()
}));

vi.mock('crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'mockedhash')
  }))
}));

describe('LambdaManager', () => {
  let lambdaManager: LambdaManager;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      send: vi.fn()
    };
    (LambdaClient as any).mockImplementation(() => mockClient);
    lambdaManager = new LambdaManager('us-east-1');
  });

  describe('create', () => {
    it('should create a new Lambda function successfully', async () => {
      const config: LambdaConfig = {
        functionName: 'test-function',
        runtime: 'nodejs22.x',
        handler: 'index.handler',
        role: 'arn:aws:iam::123456789012:role/lambda-role',
        code: {
          zipFile: Buffer.from('test code')
        },
        timeout: 30,
        memorySize: 256
      };

      // Mock function doesn't exist
      mockClient.send.mockResolvedValueOnce(
        Promise.reject({ name: 'ResourceNotFoundException' })
      );

      // Mock successful function creation
      mockClient.send.mockResolvedValueOnce({
        FunctionName: 'test-function',
        FunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function'
      });

      const result = await lambdaManager.create(config);

      expect(result).toEqual({
        resourceId: 'test-function',
        resourceArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
        functionName: 'test-function',
        functionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
        status: 'created'
      });

      expect(mockClient.send).toHaveBeenCalledTimes(2); // GetFunction, CreateFunction
    });

    it('should create function with Function URL when enabled', async () => {
      const config: LambdaConfig = {
        functionName: 'test-function-url',
        runtime: 'nodejs22.x',
        handler: 'index.handler',
        role: 'arn:aws:iam::123456789012:role/lambda-role',
        code: {
          zipFile: Buffer.from('test code')
        },
        enableFunctionUrl: true,
        functionUrlConfig: {
          authType: 'NONE'
        }
      };

      // Mock function doesn't exist
      mockClient.send.mockResolvedValueOnce(
        Promise.reject({ name: 'ResourceNotFoundException' })
      );

      // Mock successful function creation
      mockClient.send.mockResolvedValueOnce({
        FunctionName: 'test-function-url',
        FunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function-url'
      });

      // Mock function URL creation
      mockClient.send.mockResolvedValueOnce({
        FunctionUrl: 'https://abc123.lambda-url.us-east-1.on.aws/'
      });

      const result = await lambdaManager.create(config);

      expect(result.functionUrl).toBe('https://abc123.lambda-url.us-east-1.on.aws/');
      expect(result.status).toBe('created');
      expect(mockClient.send).toHaveBeenCalledTimes(3); // GetFunction, CreateFunction, CreateFunctionUrl
    });

    it('should update existing function when it already exists', async () => {
      const config: LambdaConfig = {
        functionName: 'existing-function',
        runtime: 'nodejs22.x',
        handler: 'index.handler',
        role: 'arn:aws:iam::123456789012:role/lambda-role',
        code: {
          zipFile: Buffer.from('updated code')
        }
      };

      // Mock existing function
      mockClient.send.mockResolvedValueOnce({
        Configuration: {
          FunctionName: 'existing-function',
          FunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:existing-function'
        }
      });

      // Mock function code update
      mockClient.send.mockResolvedValueOnce({});

      // Mock function configuration update
      mockClient.send.mockResolvedValueOnce({
        FunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:existing-function'
      });

      const result = await lambdaManager.create(config);

      expect(result.status).toBe('updated');
      expect(mockClient.send).toHaveBeenCalledTimes(3); // GetFunction, UpdateCode, UpdateConfig
    });

    it('should handle function creation errors', async () => {
      const config: LambdaConfig = {
        functionName: 'error-function',
        runtime: 'nodejs22.x',
        handler: 'index.handler',
        role: 'arn:aws:iam::123456789012:role/lambda-role',
        code: {
          zipFile: Buffer.from('test code')
        }
      };

      // Mock function doesn't exist
      mockClient.send.mockResolvedValueOnce(
        Promise.reject({ name: 'ResourceNotFoundException' })
      );

      // Mock function creation error
      mockClient.send.mockRejectedValueOnce(new Error('Access denied'));

      await expect(lambdaManager.create(config)).rejects.toThrow('Failed to create Lambda function error-function');
    });
  });

  describe('code payload preparation', () => {
    it('should handle zip file from buffer', async () => {
      const config: LambdaConfig = {
        functionName: 'buffer-function',
        runtime: 'nodejs22.x',
        handler: 'index.handler',
        role: 'arn:aws:iam::123456789012:role/lambda-role',
        code: {
          zipFile: Buffer.from('zip content')
        }
      };

      // Mock function doesn't exist
      mockClient.send.mockResolvedValueOnce(
        Promise.reject({ name: 'ResourceNotFoundException' })
      );

      // Mock successful function creation
      mockClient.send.mockResolvedValueOnce({
        FunctionName: 'buffer-function',
        FunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:buffer-function'
      });

      const result = await lambdaManager.create(config);

      expect(result.status).toBe('created');
    });

    it('should handle zip file from file path', async () => {
      const config: LambdaConfig = {
        functionName: 'file-function',
        runtime: 'nodejs22.x',
        handler: 'index.handler',
        role: 'arn:aws:iam::123456789012:role/lambda-role',
        code: {
          zipFilePath: '/path/to/function.zip'
        }
      };

      (readFileSync as any).mockReturnValue(Buffer.from('zip content'));

      // Mock function doesn't exist
      mockClient.send.mockResolvedValueOnce(
        Promise.reject({ name: 'ResourceNotFoundException' })
      );

      // Mock successful function creation
      mockClient.send.mockResolvedValueOnce({
        FunctionName: 'file-function',
        FunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:file-function'
      });

      const result = await lambdaManager.create(config);

      expect(result.status).toBe('created');
      expect(readFileSync).toHaveBeenCalledWith('/path/to/function.zip');
    });

    it('should handle S3 code location', async () => {
      const config: LambdaConfig = {
        functionName: 's3-function',
        runtime: 'nodejs22.x',
        handler: 'index.handler',
        role: 'arn:aws:iam::123456789012:role/lambda-role',
        code: {
          s3Bucket: 'my-bucket',
          s3Key: 'functions/my-function.zip'
        }
      };

      // Mock function doesn't exist
      mockClient.send.mockResolvedValueOnce(
        Promise.reject({ name: 'ResourceNotFoundException' })
      );

      // Mock successful function creation
      mockClient.send.mockResolvedValueOnce({
        FunctionName: 's3-function',
        FunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:s3-function'
      });

      const result = await lambdaManager.create(config);

      expect(result.status).toBe('created');
    });
  });

  describe('function URL management', () => {
    it('should create function URL successfully', async () => {
      const functionName = 'test-function';
      const config = {
        authType: 'NONE' as const,
        cors: {
          allowOrigins: ['*'],
          allowMethods: ['GET', 'POST']
        }
      };

      mockClient.send.mockResolvedValueOnce({
        FunctionUrl: 'https://abc123.lambda-url.us-east-1.on.aws/'
      });

      const result = await lambdaManager.createFunctionUrl(functionName, config);

      expect(result).toBe('https://abc123.lambda-url.us-east-1.on.aws/');
    });

    it('should get existing function URL', async () => {
      const functionName = 'test-function';

      mockClient.send.mockResolvedValueOnce({
        FunctionUrl: 'https://existing.lambda-url.us-east-1.on.aws/'
      });

      const result = await lambdaManager.getFunctionUrl(functionName);

      expect(result).toBe('https://existing.lambda-url.us-east-1.on.aws/');
    });

    it('should return null when function URL does not exist', async () => {
      const functionName = 'test-function';

      mockClient.send.mockRejectedValueOnce({ name: 'ResourceNotFoundException' });

      const result = await lambdaManager.getFunctionUrl(functionName);

      expect(result).toBeNull();
    });
  });

  describe('version management', () => {
    it('should publish function version successfully', async () => {
      const functionName = 'test-function';
      const description = 'Version 1.0';

      mockClient.send.mockResolvedValueOnce({
        Version: '1'
      });

      const result = await lambdaManager.publishVersion(functionName, description);

      expect(result).toBe('1');
    });
  });

  describe('API Gateway integration', () => {
    it('should add API Gateway permission successfully', async () => {
      const functionName = 'test-function';
      const apiGatewayArn = 'arn:aws:execute-api:us-east-1:123456789012:abc123/*/*/*';

      mockClient.send.mockResolvedValueOnce({});

      await expect(lambdaManager.addApiGatewayPermission(functionName, apiGatewayArn))
        .resolves.not.toThrow();

      expect(mockClient.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('should update existing function', async () => {
      const config: LambdaConfig = {
        functionName: 'update-function',
        runtime: 'nodejs22.x',
        handler: 'index.handler',
        role: 'arn:aws:iam::123456789012:role/lambda-role',
        code: {
          zipFile: Buffer.from('updated code')
        }
      };

      // Mock existing function
      mockClient.send.mockResolvedValueOnce({
        Configuration: {
          FunctionName: 'update-function'
        }
      });

      // Mock updates
      mockClient.send.mockResolvedValue({
        FunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:update-function'
      });

      const result = await lambdaManager.update(config);

      expect(result.status).toBe('updated');
    });

    it('should create function if it does not exist during update', async () => {
      const config: LambdaConfig = {
        functionName: 'new-function',
        runtime: 'nodejs22.x',
        handler: 'index.handler',
        role: 'arn:aws:iam::123456789012:role/lambda-role',
        code: {
          zipFile: Buffer.from('new code')
        }
      };

      // Mock function doesn't exist (first call in update)
      mockClient.send.mockResolvedValueOnce(
        Promise.reject({ name: 'ResourceNotFoundException' })
      );

      // Mock function doesn't exist (second call in create)
      mockClient.send.mockResolvedValueOnce(
        Promise.reject({ name: 'ResourceNotFoundException' })
      );

      // Mock successful function creation
      mockClient.send.mockResolvedValueOnce({
        FunctionName: 'new-function',
        FunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:new-function'
      });

      const result = await lambdaManager.update(config);

      expect(result.status).toBe('created');
    });
  });
});