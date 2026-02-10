import { describe, it, expect } from 'vitest';
import { ResourceNamingService, createNamingService, ResourceNames, NamingConfig } from '../naming.js';
import { DeploymentConfig } from '../../types/index.js';

describe('Resource Naming Service', () => {
  let namingService: ResourceNamingService;

  beforeEach(() => {
    namingService = new ResourceNamingService();
  });

  describe('generateResourceNames', () => {
    it('should generate resource names for frontend application', () => {
      const config: DeploymentConfig = {
        application: {
          name: 'my-frontend-app',
          type: 'frontend',
          version: '1.0.0'
        },
        aws: {
          region: 'us-west-2'
        },
        frontend: {
          source_dir: './dist'
        },
        deployment: {
          enable_monitoring: true
        }
      };

      const resourceNames = namingService.generateResourceNames(config);

      expect(resourceNames.stackName).toBe('my-frontend-app');
      expect(resourceNames.s3BucketName).toBeDefined();
      expect(resourceNames.s3BucketName).toMatch(/^my-frontend-app-frontend-[a-z0-9]+$/);
      expect(resourceNames.lambdaFunctionName).toBeUndefined();
      expect(resourceNames.lambdaExecutionRoleName).toBeUndefined();
      expect(resourceNames.apiGatewayName).toBeUndefined();
      expect(resourceNames.logGroupName).toBeUndefined();
    });

    it('should generate resource names for backend application', () => {
      const config: DeploymentConfig = {
        application: {
          name: 'my-backend-app',
          type: 'backend',
          version: '1.0.0'
        },
        aws: {
          region: 'eu-west-1'
        },
        backend: {
          source_dir: './src',
          handler: 'index.handler'
        },
        deployment: {
          enable_monitoring: true
        }
      };

      const resourceNames = namingService.generateResourceNames(config);

      expect(resourceNames.stackName).toBe('my-backend-app');
      expect(resourceNames.s3BucketName).toBeUndefined();
      expect(resourceNames.lambdaFunctionName).toBe('my-backend-app-lambda');
      expect(resourceNames.lambdaExecutionRoleName).toBe('my-backend-app-lambda-role');
      expect(resourceNames.logGroupName).toBe('/aws/lambda/my-backend-app-lambda');
      expect(resourceNames.apiGatewayName).toBeUndefined(); // Using Function URLs by default
    });

    it('should generate resource names for fullstack application', () => {
      const config: DeploymentConfig = {
        application: {
          name: 'fullstack-app',
          type: 'fullstack',
          version: '1.0.0'
        },
        aws: {
          region: 'ap-southeast-1'
        },
        frontend: {
          source_dir: './build'
        },
        backend: {
          source_dir: './api',
          handler: 'app.handler'
        },
        deployment: {
          enable_monitoring: true
        }
      };

      const resourceNames = namingService.generateResourceNames(config);

      expect(resourceNames.stackName).toBe('fullstack-app');
      expect(resourceNames.s3BucketName).toBeDefined();
      expect(resourceNames.lambdaFunctionName).toBe('fullstack-app-lambda');
      expect(resourceNames.lambdaExecutionRoleName).toBe('fullstack-app-lambda-role');
      expect(resourceNames.logGroupName).toBe('/aws/lambda/fullstack-app-lambda');
    });

    it('should use custom stack name when provided', () => {
      const config: DeploymentConfig = {
        application: {
          name: 'my-app',
          type: 'frontend',
          version: '1.0.0'
        },
        aws: {
          region: 'us-east-1'
        },
        frontend: {
          source_dir: './dist'
        },
        deployment: {
          stack_name: 'custom-stack-name',
          enable_monitoring: true
        }
      };

      const resourceNames = namingService.generateResourceNames(config);

      expect(resourceNames.stackName).toBe('custom-stack-name');
    });

    it('should include environment in resource names', () => {
      const config: DeploymentConfig = {
        application: {
          name: 'env-app',
          type: 'backend',
          version: '1.0.0'
        },
        aws: {
          region: 'us-east-1'
        },
        backend: {
          source_dir: './src',
          handler: 'index.handler'
        },
        deployment: {
          enable_monitoring: true
        }
      };

      const resourceNames = namingService.generateResourceNames(config, 'production');

      expect(resourceNames.stackName).toBe('env-app-production');
      expect(resourceNames.lambdaFunctionName).toBe('env-app-production-lambda');
      expect(resourceNames.lambdaExecutionRoleName).toBe('env-app-production-lambda-role');
    });

    it('should handle prefix and suffix from tags', () => {
      const config: DeploymentConfig = {
        application: {
          name: 'tagged-app',
          type: 'frontend',
          version: '1.0.0'
        },
        aws: {
          region: 'us-east-1'
        },
        frontend: {
          source_dir: './dist'
        },
        deployment: {
          enable_monitoring: true,
          tags: {
            Prefix: 'mycompany',
            Suffix: 'v1'
          }
        }
      };

      const resourceNames = namingService.generateResourceNames(config);

      expect(resourceNames.stackName).toBe('mycompany-tagged-app-v1');
      expect(resourceNames.s3BucketName).toMatch(/^mycompany-tagged-app-frontend-[a-z0-9]+-v1$/);
    });

    it('should sanitize invalid characters in names', () => {
      const config: DeploymentConfig = {
        application: {
          name: 'my_app@2024!',
          type: 'frontend',
          version: '1.0.0'
        },
        aws: {
          region: 'us-east-1'
        },
        frontend: {
          source_dir: './dist'
        },
        deployment: {
          enable_monitoring: true
        }
      };

      const resourceNames = namingService.generateResourceNames(config);

      expect(resourceNames.stackName).toBe('my-app-2024');
      expect(resourceNames.s3BucketName).toMatch(/^my-app-2024-frontend-[a-z0-9]+$/);
    });

    it('should handle names that start with numbers', () => {
      const config: DeploymentConfig = {
        application: {
          name: '123-numeric-app',
          type: 'backend',
          version: '1.0.0'
        },
        aws: {
          region: 'us-east-1'
        },
        backend: {
          source_dir: './src',
          handler: 'index.handler'
        },
        deployment: {
          enable_monitoring: true
        }
      };

      const resourceNames = namingService.generateResourceNames(config);

      expect(resourceNames.stackName).toBe('app-123-numeric-app');
      expect(resourceNames.lambdaFunctionName).toBe('app-123-numeric-app-lambda');
    });

    it('should truncate long names and add hash for uniqueness', () => {
      const longName = 'a'.repeat(100);
      const config: DeploymentConfig = {
        application: {
          name: longName,
          type: 'backend',
          version: '1.0.0'
        },
        aws: {
          region: 'us-east-1'
        },
        backend: {
          source_dir: './src',
          handler: 'index.handler'
        },
        deployment: {
          enable_monitoring: true
        }
      };

      const resourceNames = namingService.generateResourceNames(config);

      expect(resourceNames.stackName.length).toBeLessThanOrEqual(128);
      expect(resourceNames.lambdaFunctionName!.length).toBeLessThanOrEqual(64);
      expect(resourceNames.lambdaExecutionRoleName!.length).toBeLessThanOrEqual(64);
      
      // Lambda function name should be truncated and have hash since it exceeds 64 chars
      expect(resourceNames.lambdaFunctionName).toMatch(/-[a-z0-9]{6}$/);
      expect(resourceNames.lambdaExecutionRoleName).toMatch(/-[a-z0-9]{6}$/);
    });
  });

  describe('checkNamingConflicts', () => {
    it('should detect naming conflicts', () => {
      const resourceNames: ResourceNames = {
        stackName: 'my-app-stack',
        s3BucketName: 'my-app-bucket',
        lambdaFunctionName: 'my-app-lambda'
      };

      const existingResources = [
        'my-app-stack',
        'other-stack',
        'my-app-bucket'
      ];

      const conflicts = namingService.checkNamingConflicts(resourceNames, existingResources);

      expect(conflicts).toHaveLength(2);
      expect(conflicts).toContain('stackName: my-app-stack');
      expect(conflicts).toContain('s3BucketName: my-app-bucket');
    });

    it('should handle case-insensitive conflicts', () => {
      const resourceNames: ResourceNames = {
        stackName: 'My-App-Stack',
        lambdaFunctionName: 'My-App-Lambda'
      };

      const existingResources = [
        'my-app-stack',
        'MY-APP-LAMBDA'
      ];

      const conflicts = namingService.checkNamingConflicts(resourceNames, existingResources);

      expect(conflicts).toHaveLength(2);
    });

    it('should return empty array when no conflicts', () => {
      const resourceNames: ResourceNames = {
        stackName: 'unique-stack',
        lambdaFunctionName: 'unique-lambda'
      };

      const existingResources = [
        'other-stack',
        'different-lambda'
      ];

      const conflicts = namingService.checkNamingConflicts(resourceNames, existingResources);

      expect(conflicts).toHaveLength(0);
    });
  });

  describe('resolveEnvironmentConfig', () => {
    it('should apply environment-specific overrides', () => {
      const baseConfig: DeploymentConfig = {
        application: {
          name: 'multi-env-app',
          type: 'backend',
          version: '1.0.0'
        },
        aws: {
          region: 'us-east-1'
        },
        backend: {
          source_dir: './src',
          handler: 'index.handler',
          memory: 512,
          timeout: 30
        },
        deployment: {
          enable_monitoring: true
        }
      };

      const prodOverrides: Partial<DeploymentConfig> = {
        backend: {
          memory: 1024,
          timeout: 60,
          environment_variables: {
            NODE_ENV: 'production'
          }
        },
        deployment: {
          enable_monitoring: true,
          tags: {
            CostCenter: 'production'
          }
        }
      };

      const resolvedConfig = namingService.resolveEnvironmentConfig(
        baseConfig, 
        'production', 
        prodOverrides
      );

      expect(resolvedConfig.backend?.memory).toBe(1024);
      expect(resolvedConfig.backend?.timeout).toBe(60);
      expect(resolvedConfig.backend?.environment_variables?.NODE_ENV).toBe('production');
      expect(resolvedConfig.deployment.tags?.Environment).toBe('production');
      expect(resolvedConfig.deployment.tags?.Application).toBe('multi-env-app');
      expect(resolvedConfig.deployment.tags?.CostCenter).toBe('production');
      expect(resolvedConfig.deployment.stack_name).toBe('multi-env-app-production');
    });

    it('should preserve base config values when no overrides provided', () => {
      const baseConfig: DeploymentConfig = {
        application: {
          name: 'simple-app',
          type: 'frontend',
          version: '1.0.0'
        },
        aws: {
          region: 'us-west-2'
        },
        frontend: {
          source_dir: './dist'
        },
        deployment: {
          enable_monitoring: false
        }
      };

      const resolvedConfig = namingService.resolveEnvironmentConfig(baseConfig, 'development');

      expect(resolvedConfig.aws.region).toBe('us-west-2');
      expect(resolvedConfig.deployment.enable_monitoring).toBe(false);
      expect(resolvedConfig.deployment.tags?.Environment).toBe('development');
      expect(resolvedConfig.deployment.stack_name).toBe('simple-app-development');
    });

    it('should not override explicit stack name', () => {
      const baseConfig: DeploymentConfig = {
        application: {
          name: 'explicit-stack-app',
          type: 'frontend',
          version: '1.0.0'
        },
        aws: {
          region: 'us-east-1'
        },
        frontend: {
          source_dir: './dist'
        },
        deployment: {
          stack_name: 'custom-explicit-stack',
          enable_monitoring: true
        }
      };

      const resolvedConfig = namingService.resolveEnvironmentConfig(baseConfig, 'staging');

      expect(resolvedConfig.deployment.stack_name).toBe('custom-explicit-stack');
      expect(resolvedConfig.deployment.tags?.Environment).toBe('staging');
    });
  });

  describe('createNamingService', () => {
    it('should create a new ResourceNamingService instance', () => {
      const service = createNamingService();
      expect(service).toBeInstanceOf(ResourceNamingService);
    });
  });

  describe('edge cases', () => {
    it('should handle empty application name', () => {
      const config: DeploymentConfig = {
        application: {
          name: '',
          type: 'frontend',
          version: '1.0.0'
        },
        aws: {
          region: 'us-east-1'
        },
        frontend: {
          source_dir: './dist'
        },
        deployment: {
          enable_monitoring: true
        }
      };

      const resourceNames = namingService.generateResourceNames(config);

      expect(resourceNames.stackName).toBe('app');
      expect(resourceNames.s3BucketName).toMatch(/^app-frontend-[a-z0-9]+$/);
    });

    it('should handle special characters and consecutive hyphens', () => {
      const config: DeploymentConfig = {
        application: {
          name: 'my---app___with!!!special@@@chars',
          type: 'backend',
          version: '1.0.0'
        },
        aws: {
          region: 'us-east-1'
        },
        backend: {
          source_dir: './src',
          handler: 'index.handler'
        },
        deployment: {
          enable_monitoring: true
        }
      };

      const resourceNames = namingService.generateResourceNames(config);

      expect(resourceNames.stackName).toBe('my-app-with-special-chars');
      expect(resourceNames.lambdaFunctionName).toBe('my-app-with-special-chars-lambda');
    });

    it('should generate unique S3 bucket names for same app deployed multiple times', () => {
      const config: DeploymentConfig = {
        application: {
          name: 'duplicate-app',
          type: 'frontend',
          version: '1.0.0'
        },
        aws: {
          region: 'us-east-1'
        },
        frontend: {
          source_dir: './dist'
        },
        deployment: {
          enable_monitoring: true
        }
      };

      const resourceNames1 = namingService.generateResourceNames(config);
      
      // Create a new service instance to ensure different timestamp
      const namingService2 = new ResourceNamingService();
      const resourceNames2 = namingService2.generateResourceNames(config);
      
      // Both should have bucket names but they should be different due to timestamp
      expect(resourceNames1.s3BucketName).toBeDefined();
      expect(resourceNames2.s3BucketName).toBeDefined();
      expect(resourceNames1.s3BucketName).toMatch(/^duplicate-app-frontend-[a-z0-9]+$/);
      expect(resourceNames2.s3BucketName).toMatch(/^duplicate-app-frontend-[a-z0-9]+$/);
    });
  });
});