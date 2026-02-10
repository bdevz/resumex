import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IAMManager, IAMConfig } from '../iam-manager';
import { IAMClient } from '@aws-sdk/client-iam';

// Mock the AWS SDK
vi.mock('@aws-sdk/client-iam', () => ({
  IAMClient: vi.fn(),
  CreateRoleCommand: vi.fn(),
  AttachRolePolicyCommand: vi.fn(),
  CreatePolicyCommand: vi.fn(),
  GetRoleCommand: vi.fn(),
  PutRolePolicyCommand: vi.fn()
}));

describe('IAMManager', () => {
  let iamManager: IAMManager;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      send: vi.fn()
    };
    (IAMClient as any).mockImplementation(() => mockClient);
    iamManager = new IAMManager('us-east-1');
  });

  describe('create', () => {
    it('should create a new IAM role successfully', async () => {
      const config: IAMConfig = {
        roleName: 'test-role',
        servicePrincipal: 'lambda.amazonaws.com',
        policyArns: ['arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']
      };

      // Mock role doesn't exist
      mockClient.send.mockResolvedValueOnce(
        Promise.reject({ name: 'NoSuchEntityException' })
      );

      // Mock successful role creation
      mockClient.send.mockResolvedValueOnce({
        Role: {
          RoleName: 'test-role',
          Arn: 'arn:aws:iam::123456789012:role/test-role'
        }
      });

      // Mock policy attachment
      mockClient.send.mockResolvedValueOnce({});

      const result = await iamManager.create(config);

      expect(result).toEqual({
        resourceId: 'test-role',
        resourceArn: 'arn:aws:iam::123456789012:role/test-role',
        roleName: 'test-role',
        roleArn: 'arn:aws:iam::123456789012:role/test-role',
        status: 'created'
      });

      expect(mockClient.send).toHaveBeenCalledTimes(3); // GetRole, CreateRole, AttachRolePolicy
    });

    it('should return existing role if it already exists', async () => {
      const config: IAMConfig = {
        roleName: 'existing-role',
        servicePrincipal: 'lambda.amazonaws.com'
      };

      // Mock existing role
      mockClient.send.mockResolvedValueOnce({
        Role: {
          RoleName: 'existing-role',
          Arn: 'arn:aws:iam::123456789012:role/existing-role'
        }
      });

      const result = await iamManager.create(config);

      expect(result).toEqual({
        resourceId: 'existing-role',
        resourceArn: 'arn:aws:iam::123456789012:role/existing-role',
        roleName: 'existing-role',
        roleArn: 'arn:aws:iam::123456789012:role/existing-role',
        status: 'updated'
      });

      expect(mockClient.send).toHaveBeenCalledTimes(1); // Only GetRole
    });

    it('should attach inline policies when provided', async () => {
      const config: IAMConfig = {
        roleName: 'test-role-inline',
        servicePrincipal: 'lambda.amazonaws.com',
        inlinePolicies: {
          'CustomPolicy': {
            Version: '2012-10-17',
            Statement: [{ Effect: 'Allow', Action: 's3:GetObject', Resource: '*' }]
          }
        }
      };

      // Mock role doesn't exist
      mockClient.send.mockResolvedValueOnce(
        Promise.reject({ name: 'NoSuchEntityException' })
      );

      // Mock successful role creation
      mockClient.send.mockResolvedValueOnce({
        Role: {
          RoleName: 'test-role-inline',
          Arn: 'arn:aws:iam::123456789012:role/test-role-inline'
        }
      });

      // Mock inline policy attachment
      mockClient.send.mockResolvedValueOnce({});

      const result = await iamManager.create(config);

      expect(result.status).toBe('created');
      expect(mockClient.send).toHaveBeenCalledTimes(3); // GetRole, CreateRole, PutRolePolicy
    });

    it('should handle role creation errors', async () => {
      const config: IAMConfig = {
        roleName: 'error-role',
        servicePrincipal: 'lambda.amazonaws.com'
      };

      // Mock role doesn't exist
      mockClient.send.mockResolvedValueOnce(
        Promise.reject({ name: 'NoSuchEntityException' })
      );

      // Mock role creation error
      mockClient.send.mockRejectedValueOnce(new Error('Access denied'));

      await expect(iamManager.create(config)).rejects.toThrow('Failed to create IAM role error-role');
    });
  });

  describe('service-specific role creation', () => {
    it('should create Lambda execution role with correct configuration', async () => {
      // Mock role doesn't exist
      mockClient.send.mockResolvedValueOnce(
        Promise.reject({ name: 'NoSuchEntityException' })
      );

      // Mock successful role creation
      mockClient.send.mockResolvedValueOnce({
        Role: {
          RoleName: 'lambda-execution-role',
          Arn: 'arn:aws:iam::123456789012:role/lambda-execution-role'
        }
      });

      // Mock policy attachment
      mockClient.send.mockResolvedValueOnce({});

      const result = await iamManager.createLambdaExecutionRole('lambda-execution-role');

      expect(result.status).toBe('created');
      expect(result.roleName).toBe('lambda-execution-role');
    });

    it('should create S3 access role with bucket-specific policy', async () => {
      const bucketName = 'test-bucket';

      // Mock role doesn't exist
      mockClient.send.mockResolvedValueOnce(
        Promise.reject({ name: 'NoSuchEntityException' })
      );

      // Mock successful role creation
      mockClient.send.mockResolvedValueOnce({
        Role: {
          RoleName: 's3-access-role',
          Arn: 'arn:aws:iam::123456789012:role/s3-access-role'
        }
      });

      // Mock policy attachment (managed policy)
      mockClient.send.mockResolvedValueOnce({});

      // Mock inline policy attachment
      mockClient.send.mockResolvedValueOnce({});

      const result = await iamManager.createS3AccessRole('s3-access-role', bucketName);

      expect(result.status).toBe('created');
      expect(mockClient.send).toHaveBeenCalledTimes(4); // GetRole, CreateRole, AttachRolePolicy, PutRolePolicy
    });

    it('should create API Gateway role with correct configuration', async () => {
      // Mock role doesn't exist
      mockClient.send.mockResolvedValueOnce(
        Promise.reject({ name: 'NoSuchEntityException' })
      );

      // Mock successful role creation
      mockClient.send.mockResolvedValueOnce({
        Role: {
          RoleName: 'api-gateway-role',
          Arn: 'arn:aws:iam::123456789012:role/api-gateway-role'
        }
      });

      // Mock policy attachment
      mockClient.send.mockResolvedValueOnce({});

      const result = await iamManager.createApiGatewayRole('api-gateway-role');

      expect(result.status).toBe('created');
      expect(result.roleName).toBe('api-gateway-role');
    });

    it('should create Lambda role with specific permissions', async () => {
      const permissions = {
        s3Buckets: ['test-bucket-1', 'test-bucket-2'],
        dynamoTables: ['test-table']
      };

      // Mock role doesn't exist
      mockClient.send.mockResolvedValueOnce(
        Promise.reject({ name: 'NoSuchEntityException' })
      );

      // Mock successful role creation
      mockClient.send.mockResolvedValueOnce({
        Role: {
          RoleName: 'lambda-specific-role',
          Arn: 'arn:aws:iam::123456789012:role/lambda-specific-role'
        }
      });

      // Mock policy attachments (managed policy + 2 inline policies)
      mockClient.send.mockResolvedValueOnce({}); // AttachRolePolicy
      mockClient.send.mockResolvedValueOnce({}); // PutRolePolicy for S3
      mockClient.send.mockResolvedValueOnce({}); // PutRolePolicy for DynamoDB

      const result = await iamManager.createLambdaRoleWithSpecificPermissions(
        'lambda-specific-role',
        permissions
      );

      expect(result.status).toBe('created');
      expect(mockClient.send).toHaveBeenCalledTimes(5); // GetRole, CreateRole, AttachRolePolicy, 2x PutRolePolicy
    });
  });

  describe('policy templates', () => {
    it('should create correct Lambda execution policy', () => {
      const policy = iamManager.createLambdaExecutionPolicy();

      expect(policy).toEqual({
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
      });
    });

    it('should create correct S3 bucket policy', () => {
      const bucketName = 'test-bucket';
      const policy = iamManager.createS3BucketPolicy(bucketName);

      expect(policy).toEqual({
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
      });
    });

    it('should create correct API Gateway invoke policy', () => {
      const functionArn = 'arn:aws:lambda:us-east-1:123456789012:function:test-function';
      const policy = iamManager.createApiGatewayInvokePolicy(functionArn);

      expect(policy).toEqual({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: 'lambda:InvokeFunction',
            Resource: functionArn
          }
        ]
      });
    });

    it('should create correct multi-S3 bucket policy', () => {
      const bucketNames = ['bucket1', 'bucket2'];
      const policy = iamManager.createMultiS3BucketPolicy(bucketNames);

      expect(policy.Version).toBe('2012-10-17');
      expect(policy.Statement).toHaveLength(4); // 2 buckets × 2 statements each
      expect(policy.Statement[0].Resource).toBe('arn:aws:s3:::bucket1/*');
      expect(policy.Statement[1].Resource).toBe('arn:aws:s3:::bucket1');
      expect(policy.Statement[2].Resource).toBe('arn:aws:s3:::bucket2/*');
      expect(policy.Statement[3].Resource).toBe('arn:aws:s3:::bucket2');
    });

    it('should create correct DynamoDB policy', () => {
      const tableNames = ['table1', 'table2'];
      const policy = iamManager.createDynamoDBPolicy(tableNames);

      expect(policy).toEqual({
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
            Resource: [
              'arn:aws:dynamodb:*:*:table/table1',
              'arn:aws:dynamodb:*:*:table/table2'
            ]
          }
        ]
      });
    });

    it('should validate policy compliance', () => {
      const compliantPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: 'arn:aws:s3:::specific-bucket/*'
          }
        ]
      };

      const nonCompliantPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['*'],
            Resource: '*'
          }
        ]
      };

      const compliantResult = iamManager.validatePolicyCompliance(compliantPolicy);
      expect(compliantResult.isCompliant).toBe(true);
      expect(compliantResult.issues).toHaveLength(0);

      const nonCompliantResult = iamManager.validatePolicyCompliance(nonCompliantPolicy);
      expect(nonCompliantResult.isCompliant).toBe(false);
      expect(nonCompliantResult.issues).toContain('Statement grants overly broad permissions (Action: *, Resource: *)');
    });
  });

  describe('update', () => {
    it('should call create method for updates', async () => {
      const config: IAMConfig = {
        roleName: 'update-role',
        servicePrincipal: 'lambda.amazonaws.com'
      };

      // Mock existing role
      mockClient.send.mockResolvedValueOnce({
        Role: {
          RoleName: 'update-role',
          Arn: 'arn:aws:iam::123456789012:role/update-role'
        }
      });

      const result = await iamManager.update(config);

      expect(result.status).toBe('updated');
      expect(result.roleName).toBe('update-role');
    });
  });
});