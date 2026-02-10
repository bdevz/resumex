import { describe, it, expect } from 'vitest';
import { validateConfig, validateAndNormalizeConfig, getConfigSchema } from '../validator.js';
import { DeploymentConfig } from '../../types/index.js';

describe('Configuration Validator', () => {
  describe('validateConfig', () => {
    it('should validate a complete valid frontend configuration', () => {
      const config = {
        application: {
          name: 'my-frontend-app',
          type: 'frontend',
          version: '1.2.3'
        },
        aws: {
          region: 'us-west-2',
          profile: 'default'
        },
        frontend: {
          source_dir: './dist',
          index_file: 'index.html',
          custom_domain: 'example.com'
        },
        deployment: {
          stack_name: 'my-frontend-stack',
          tags: {
            Environment: 'production',
            Project: 'MyApp'
          },
          enable_monitoring: true
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a complete valid backend configuration', () => {
      const config = {
        application: {
          name: 'my-backend-app',
          type: 'backend'
        },
        aws: {
          region: 'eu-west-1'
        },
        backend: {
          source_dir: './src',
          handler: 'index.handler',
          runtime: 'nodejs20.x',
          timeout: 30,
          memory: 256,
          environment_variables: {
            NODE_ENV: 'production',
            API_KEY: 'secret'
          }
        },
        deployment: {
          enable_monitoring: false
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a complete valid fullstack configuration', () => {
      const config = {
        application: {
          name: 'my-fullstack-app',
          type: 'fullstack',
          version: '2.0.0'
        },
        aws: {
          region: 'ap-southeast-1'
        },
        frontend: {
          source_dir: './build',
          index_file: 'app.html',
          build_command: 'npm run build'
        },
        backend: {
          source_dir: './api',
          handler: 'app.lambda',
          runtime: 'nodejs18.x',
          timeout: 120,
          memory: 1024
        },
        deployment: {
          stack_name: 'fullstack-app',
          tags: {
            Team: 'DevOps'
          }
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should apply defaults for optional fields', () => {
      const config = {
        application: {
          name: 'minimal-app',
          type: 'frontend'
        },
        frontend: {
          source_dir: './dist'
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should reject configuration with missing required fields', () => {
      const config = {
        application: {
          type: 'frontend'
          // missing name
        },
        frontend: {
          // missing source_dir
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"application.name" is required');
      expect(result.errors).toContain('Frontend source directory is required when application type includes frontend');
    });

    it('should reject invalid application name patterns', () => {
      const config = {
        application: {
          name: 'invalid name with spaces',
          type: 'frontend'
        },
        frontend: {
          source_dir: './dist'
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Application name must contain only alphanumeric characters, hyphens, and underscores');
    });

    it('should reject invalid application type', () => {
      const config = {
        application: {
          name: 'test-app',
          type: 'invalid-type'
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Application type must be one of: frontend, backend, fullstack');
    });

    it('should reject invalid version format', () => {
      const config = {
        application: {
          name: 'test-app',
          type: 'frontend',
          version: '1.0'
        },
        frontend: {
          source_dir: './dist'
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Version must follow semantic versioning format (e.g., 1.0.0)');
    });

    it('should reject invalid AWS region format', () => {
      const config = {
        application: {
          name: 'test-app',
          type: 'frontend'
        },
        aws: {
          region: 'INVALID_REGION'
        },
        frontend: {
          source_dir: './dist'
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('AWS region must be a valid region identifier');
    });

    it('should reject invalid custom domain', () => {
      const config = {
        application: {
          name: 'test-app',
          type: 'frontend'
        },
        frontend: {
          source_dir: './dist',
          custom_domain: 'not-a-valid-domain!'
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Custom domain must be a valid domain name');
    });

    it('should reject invalid handler format', () => {
      const config = {
        application: {
          name: 'test-app',
          type: 'backend'
        },
        backend: {
          source_dir: './src',
          handler: 'invalid-handler-format'
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Handler must be in format "file.function" (e.g., "index.handler")');
    });

    it('should reject invalid runtime', () => {
      const config = {
        application: {
          name: 'test-app',
          type: 'backend'
        },
        backend: {
          source_dir: './src',
          handler: 'index.handler',
          runtime: 'invalid-runtime'
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Runtime must be a supported Lambda runtime');
    });

    it('should reject timeout values outside valid range', () => {
      const config = {
        application: {
          name: 'test-app',
          type: 'backend'
        },
        backend: {
          source_dir: './src',
          handler: 'index.handler',
          timeout: 1000 // exceeds 900 second limit
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Timeout must be no more than 900 seconds (15 minutes)');
    });

    it('should reject memory values outside valid range', () => {
      const config = {
        application: {
          name: 'test-app',
          type: 'backend'
        },
        backend: {
          source_dir: './src',
          handler: 'index.handler',
          memory: 64 // below 128 MB minimum
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Memory must be at least 128 MB');
    });

    it('should reject invalid stack name format', () => {
      const config = {
        application: {
          name: 'test-app',
          type: 'frontend'
        },
        frontend: {
          source_dir: './dist'
        },
        deployment: {
          stack_name: '123-invalid-start'
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Stack name must start with a letter and contain only alphanumeric characters and hyphens');
    });

    it('should reject frontend config when type is backend', () => {
      const config = {
        application: {
          name: 'test-app',
          type: 'backend'
        },
        frontend: {
          source_dir: './dist'
        },
        backend: {
          source_dir: './src',
          handler: 'index.handler'
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"frontend" is not allowed');
    });

    it('should reject backend config when type is frontend', () => {
      const config = {
        application: {
          name: 'test-app',
          type: 'frontend'
        },
        frontend: {
          source_dir: './dist'
        },
        backend: {
          source_dir: './src',
          handler: 'index.handler'
        }
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"backend" is not allowed');
    });

    it('should require both frontend and backend config for fullstack type', () => {
      const config = {
        application: {
          name: 'test-app',
          type: 'fullstack'
        },
        frontend: {
          source_dir: './dist'
        }
        // missing backend config
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"backend" is required');
    });

    it('should reject unknown properties', () => {
      const config = {
        application: {
          name: 'test-app',
          type: 'frontend'
        },
        frontend: {
          source_dir: './dist'
        },
        unknown_property: 'should be rejected'
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('"unknown_property" is not allowed');
    });
  });

  describe('validateAndNormalizeConfig', () => {
    it('should return normalized config with defaults applied', () => {
      const config = {
        application: {
          name: 'test-app',
          type: 'frontend'
        },
        frontend: {
          source_dir: './dist'
        }
      };

      const normalized = validateAndNormalizeConfig(config);
      
      expect(normalized.application.version).toBe('1.0.0');
      expect(normalized.aws?.region).toBe('us-east-1');
      expect(normalized.frontend?.index_file).toBe('index.html');
      expect(normalized.deployment?.enable_monitoring).toBe(true);
    });

    it('should throw error for invalid configuration', () => {
      const config = {
        application: {
          name: 'test-app',
          type: 'invalid-type'
        }
      };

      expect(() => validateAndNormalizeConfig(config)).toThrow('Configuration validation failed');
    });

    it('should preserve provided values over defaults', () => {
      const config = {
        application: {
          name: 'test-app',
          type: 'backend',
          version: '2.1.0'
        },
        aws: {
          region: 'eu-central-1'
        },
        backend: {
          source_dir: './api',
          handler: 'app.handler',
          runtime: 'python3.11',
          timeout: 45,
          memory: 768
        },
        deployment: {
          enable_monitoring: false
        }
      };

      const normalized = validateAndNormalizeConfig(config);
      
      expect(normalized.application.version).toBe('2.1.0');
      expect(normalized.aws.region).toBe('eu-central-1');
      expect(normalized.backend?.runtime).toBe('python3.11');
      expect(normalized.backend?.timeout).toBe(45);
      expect(normalized.backend?.memory).toBe(768);
      expect(normalized.deployment.enable_monitoring).toBe(false);
    });
  });

  describe('getConfigSchema', () => {
    it('should return the Joi schema object', () => {
      const schema = getConfigSchema();
      expect(schema).toBeDefined();
      expect(typeof schema.validate).toBe('function');
    });
  });
});