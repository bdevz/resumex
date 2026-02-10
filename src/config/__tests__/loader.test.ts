import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { DeploymentConfigLoader, createConfigLoader, loadDefaultConfig } from '../loader.js';
import { DeploymentConfig } from '../../types/index.js';

describe('Configuration Loader', () => {
  const testDir = './test-configs';
  let loader: DeploymentConfigLoader;

  beforeEach(async () => {
    loader = new DeploymentConfigLoader();
    
    // Create test directory if it doesn't exist
    if (!existsSync(testDir)) {
      await mkdir(testDir, { recursive: true });
    }
  });

  afterEach(async () => {
    // Clean up test files
    const testFiles = [
      `${testDir}/test-config.json`,
      `${testDir}/test-config.yml`,
      `${testDir}/test-config.yaml`,
      `${testDir}/invalid-config.json`,
      `${testDir}/env-config.yml`,
      `${testDir}/minimal-config.json`,
      './deploy.yml',
      './deploy.json'
    ];

    for (const file of testFiles) {
      try {
        if (existsSync(file)) {
          await unlink(file);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('load', () => {
    it('should load and validate a JSON configuration file', async () => {
      const config = {
        application: {
          name: 'test-app',
          type: 'frontend'
        },
        frontend: {
          source_dir: './dist'
        }
      };

      await writeFile(`${testDir}/test-config.json`, JSON.stringify(config, null, 2));
      
      const result = await loader.load(`${testDir}/test-config.json`);
      
      expect(result.application.name).toBe('test-app');
      expect(result.application.type).toBe('frontend');
      expect(result.application.version).toBe('1.0.0'); // default applied
      expect(result.aws.region).toBe('us-east-1'); // default applied
      expect(result.frontend?.source_dir).toBe('./dist');
    });

    it('should load and validate a YAML configuration file', async () => {
      const yamlConfig = `
application:
  name: yaml-app
  type: backend
  version: 2.0.0

aws:
  region: eu-west-1
  profile: production

backend:
  source_dir: ./src
  handler: index.handler
  runtime: nodejs20.x
  timeout: 30
  memory: 256
  environment_variables:
    NODE_ENV: production
    API_URL: https://api.example.com

deployment:
  stack_name: my-backend-stack
  enable_monitoring: false
  tags:
    Environment: production
    Team: backend
`;

      await writeFile(`${testDir}/test-config.yml`, yamlConfig);
      
      const result = await loader.load(`${testDir}/test-config.yml`);
      
      expect(result.application.name).toBe('yaml-app');
      expect(result.application.type).toBe('backend');
      expect(result.application.version).toBe('2.0.0');
      expect(result.aws.region).toBe('eu-west-1');
      expect(result.aws.profile).toBe('production');
      expect(result.backend?.handler).toBe('index.handler');
      expect(result.backend?.runtime).toBe('nodejs20.x');
      expect(result.backend?.environment_variables?.NODE_ENV).toBe('production');
      expect(result.deployment.enable_monitoring).toBe(false);
    });

    it('should load YAML files with .yaml extension', async () => {
      const config = {
        application: {
          name: 'yaml-ext-app',
          type: 'frontend'
        },
        frontend: {
          source_dir: './build'
        }
      };

      // Convert to YAML format
      const yamlContent = `
application:
  name: yaml-ext-app
  type: frontend
frontend:
  source_dir: ./build
`;

      await writeFile(`${testDir}/test-config.yaml`, yamlContent);
      
      const result = await loader.load(`${testDir}/test-config.yaml`);
      
      expect(result.application.name).toBe('yaml-ext-app');
      expect(result.frontend?.source_dir).toBe('./build');
    });

    it('should resolve environment variables in configuration', async () => {
      // Set test environment variables
      process.env.TEST_APP_NAME = 'env-test-app';
      process.env.TEST_REGION = 'ap-southeast-1';
      process.env.TEST_MEMORY = '1024';
      
      // Store original NODE_ENV and unset it for this test
      const originalNodeEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      const config = {
        application: {
          name: '${TEST_APP_NAME}',
          type: 'backend'
        },
        aws: {
          region: '${TEST_REGION}',
          profile: '${UNDEFINED_VAR:-default-profile}'
        },
        backend: {
          source_dir: './src',
          handler: 'index.handler',
          memory: '${TEST_MEMORY}',
          environment_variables: {
            NODE_ENV: '${NODE_ENV:-development}',
            API_KEY: '${API_KEY}'
          }
        }
      };

      await writeFile(`${testDir}/env-config.yml`, 
        `application:
  name: \${TEST_APP_NAME}
  type: backend
aws:
  region: \${TEST_REGION}
  profile: \${UNDEFINED_VAR:-default-profile}
backend:
  source_dir: ./src
  handler: index.handler
  memory: \${TEST_MEMORY}
  environment_variables:
    NODE_ENV: \${NODE_ENV:-development}
    API_KEY: \${API_KEY}`
      );
      
      const result = await loader.load(`${testDir}/env-config.yml`);
      
      expect(result.application.name).toBe('env-test-app');
      expect(result.aws.region).toBe('ap-southeast-1');
      expect(result.aws.profile).toBe('default-profile'); // default value used
      expect(result.backend?.memory).toBe(1024); // converted to number by validation
      expect(result.backend?.environment_variables?.NODE_ENV).toBe('development'); // default used
      expect(result.backend?.environment_variables?.API_KEY).toBe('${API_KEY}'); // undefined var kept as-is

      // Clean up environment variables
      delete process.env.TEST_APP_NAME;
      delete process.env.TEST_REGION;
      delete process.env.TEST_MEMORY;
      
      // Restore original NODE_ENV
      if (originalNodeEnv !== undefined) {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('should apply default values for missing optional fields', async () => {
      const minimalConfig = {
        application: {
          name: 'minimal-app',
          type: 'frontend'
        },
        frontend: {
          source_dir: './dist'
        }
      };

      await writeFile(`${testDir}/minimal-config.json`, JSON.stringify(minimalConfig));
      
      const result = await loader.load(`${testDir}/minimal-config.json`);
      
      // Check that defaults are applied
      expect(result.application.version).toBe('1.0.0');
      expect(result.aws.region).toBe('us-east-1');
      expect(result.frontend?.index_file).toBe('index.html');
      expect(result.deployment.enable_monitoring).toBe(true);
    });

    it('should throw error for non-existent file', async () => {
      await expect(loader.load('./non-existent-config.json'))
        .rejects.toThrow('Configuration file not found');
    });

    it('should throw error for unsupported file format', async () => {
      await writeFile(`${testDir}/config.txt`, 'invalid format');
      
      await expect(loader.load(`${testDir}/config.txt`))
        .rejects.toThrow('Unsupported file format');
      
      await unlink(`${testDir}/config.txt`);
    });

    it('should throw error for invalid JSON', async () => {
      await writeFile(`${testDir}/invalid-config.json`, '{ invalid json }');
      
      await expect(loader.load(`${testDir}/invalid-config.json`))
        .rejects.toThrow('Failed to load configuration');
    });

    it('should throw error for invalid configuration', async () => {
      const invalidConfig = {
        application: {
          name: 'test-app',
          type: 'invalid-type' // invalid type
        }
      };

      await writeFile(`${testDir}/invalid-config.json`, JSON.stringify(invalidConfig));
      
      await expect(loader.load(`${testDir}/invalid-config.json`))
        .rejects.toThrow('Configuration validation failed');
    });
  });

  describe('validate', () => {
    it('should validate a valid configuration', () => {
      const config = {
        application: {
          name: 'test-app',
          type: 'frontend'
        },
        frontend: {
          source_dir: './dist'
        }
      };

      const result = loader.validate(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid configuration', () => {
      const config = {
        application: {
          name: 'test-app',
          type: 'invalid-type'
        }
      };

      const result = loader.validate(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('loadFromPaths', () => {
    it('should load from the first available path', async () => {
      const config = {
        application: {
          name: 'multi-path-app',
          type: 'frontend'
        },
        frontend: {
          source_dir: './dist'
        }
      };

      await writeFile(`${testDir}/second-config.json`, JSON.stringify(config));
      
      const paths = [
        `${testDir}/non-existent.json`,
        `${testDir}/second-config.json`,
        `${testDir}/third-config.json`
      ];
      
      const result = await loader.loadFromPaths(paths);
      
      expect(result.application.name).toBe('multi-path-app');
    });

    it('should throw error if no paths are available', async () => {
      const paths = [
        `${testDir}/non-existent-1.json`,
        `${testDir}/non-existent-2.json`
      ];
      
      await expect(loader.loadFromPaths(paths))
        .rejects.toThrow('Could not load configuration from any of the specified paths');
    });
  });

  describe('createConfigLoader', () => {
    it('should create a new DeploymentConfigLoader instance', () => {
      const loader = createConfigLoader();
      expect(loader).toBeInstanceOf(DeploymentConfigLoader);
    });
  });

  describe('loadDefaultConfig', () => {
    it('should load from default deploy.yml location', async () => {
      const config = {
        application: {
          name: 'default-app',
          type: 'frontend'
        },
        frontend: {
          source_dir: './dist'
        }
      };

      const yamlContent = `
application:
  name: default-app
  type: frontend
frontend:
  source_dir: ./dist
`;

      await writeFile('./deploy.yml', yamlContent);
      
      const result = await loadDefaultConfig();
      
      expect(result.application.name).toBe('default-app');
    });

    it('should load from default deploy.json location if yml not found', async () => {
      const config = {
        application: {
          name: 'default-json-app',
          type: 'backend'
        },
        backend: {
          source_dir: './src',
          handler: 'index.handler'
        }
      };

      await writeFile('./deploy.json', JSON.stringify(config, null, 2));
      
      const result = await loadDefaultConfig();
      
      expect(result.application.name).toBe('default-json-app');
    });

    it('should throw error if no default config files found', async () => {
      await expect(loadDefaultConfig())
        .rejects.toThrow('Could not load configuration from any of the specified paths');
    });
  });

  describe('environment variable resolution', () => {
    it('should handle nested environment variables', async () => {
      process.env.TEST_NESTED_VAR = 'nested-value';
      process.env.TEST_TAG_VALUE = 'tag-from-env';
      
      const config = {
        application: {
          name: 'nested-env-app',
          type: 'fullstack'
        },
        frontend: {
          source_dir: './dist'
        },
        backend: {
          source_dir: './src',
          handler: 'index.handler',
          environment_variables: {
            NESTED_VALUE: '${TEST_NESTED_VAR}',
            FALLBACK_VALUE: '${UNDEFINED_VAR:-fallback-value}'
          }
        },
        deployment: {
          tags: {
            Environment: '${TEST_TAG_VALUE}',
            Project: '${PROJECT_NAME:-default-project}'
          }
        }
      };

      await writeFile(`${testDir}/nested-env.json`, JSON.stringify(config));
      
      const result = await loader.load(`${testDir}/nested-env.json`);
      
      expect(result.backend?.environment_variables?.NESTED_VALUE).toBe('nested-value');
      expect(result.backend?.environment_variables?.FALLBACK_VALUE).toBe('fallback-value');
      expect(result.deployment.tags?.Environment).toBe('tag-from-env');
      expect(result.deployment.tags?.Project).toBe('default-project');

      delete process.env.TEST_NESTED_VAR;
      delete process.env.TEST_TAG_VALUE;
    });

    it('should handle arrays with environment variables', async () => {
      process.env.TEST_ARRAY_VAR = 'array-value';
      
      const config = {
        application: {
          name: 'array-env-app',
          type: 'frontend'
        },
        frontend: {
          source_dir: './dist',
          build_command: 'npm run build -- --env=${BUILD_ENV:-production}'
        },
        deployment: {
          tags: {
            BuildEnv: '${TEST_ARRAY_VAR}',
            Version: '${VERSION:-1.0.0}',
            StaticValue: 'static-value'
          }
        }
      };

      await writeFile(`${testDir}/array-env.json`, JSON.stringify(config));
      
      const result = await loader.load(`${testDir}/array-env.json`);
      
      expect(result.frontend?.build_command).toBe('npm run build -- --env=production');
      expect(result.deployment.tags?.BuildEnv).toBe('array-value');
      expect(result.deployment.tags?.Version).toBe('1.0.0');
      expect(result.deployment.tags?.StaticValue).toBe('static-value');

      delete process.env.TEST_ARRAY_VAR;
    });
  });
});