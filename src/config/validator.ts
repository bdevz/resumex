import Joi from 'joi';
import { DeploymentConfig } from '../types/index.js';
import { ConfigValidationResult } from './types.js';

// Joi schema for ApplicationConfig
const applicationConfigSchema = Joi.object({
  name: Joi.string()
    .required()
    .pattern(/^[a-zA-Z0-9-_]+$/)
    .min(1)
    .max(50)
    .messages({
      'string.pattern.base': 'Application name must contain only alphanumeric characters, hyphens, and underscores',
      'string.min': 'Application name must be at least 1 character long',
      'string.max': 'Application name must be no more than 50 characters long'
    }),
  type: Joi.string()
    .valid('frontend', 'backend', 'fullstack')
    .required()
    .messages({
      'any.only': 'Application type must be one of: frontend, backend, fullstack'
    }),
  version: Joi.string()
    .pattern(/^\d+\.\d+\.\d+$/)
    .default('1.0.0')
    .messages({
      'string.pattern.base': 'Version must follow semantic versioning format (e.g., 1.0.0)'
    })
});

// Joi schema for AWSConfig
const awsConfigSchema = Joi.object({
  region: Joi.string()
    .pattern(/^[a-z0-9-]+$/)
    .default('us-east-1')
    .messages({
      'string.pattern.base': 'AWS region must be a valid region identifier'
    }),
  profile: Joi.string()
    .optional()
    .messages({
      'string.base': 'AWS profile must be a string'
    })
});

// Joi schema for FrontendConfig
const frontendConfigSchema = Joi.object({
  source_dir: Joi.string()
    .required()
    .messages({
      'any.required': 'Frontend source directory is required when application type includes frontend'
    }),
  index_file: Joi.string()
    .default('index.html')
    .messages({
      'string.base': 'Index file must be a string'
    }),
  custom_domain: Joi.string()
    .domain()
    .optional()
    .messages({
      'string.domain': 'Custom domain must be a valid domain name'
    }),
  build_command: Joi.string()
    .optional()
    .messages({
      'string.base': 'Build command must be a string'
    })
});

// Joi schema for BackendConfig
const backendConfigSchema = Joi.object({
  source_dir: Joi.string()
    .required()
    .messages({
      'any.required': 'Backend source directory is required when application type includes backend'
    }),
  handler: Joi.string()
    .required()
    .pattern(/^[a-zA-Z0-9_.-]+\.[a-zA-Z0-9_]+$/)
    .messages({
      'any.required': 'Handler is required for backend applications',
      'string.pattern.base': 'Handler must be in format "file.function" (e.g., "index.handler")'
    }),
  runtime: Joi.string()
    .valid('nodejs18.x', 'nodejs20.x', 'nodejs22.x', 'python3.9', 'python3.10', 'python3.11', 'python3.12')
    .default('nodejs22.x')
    .messages({
      'any.only': 'Runtime must be a supported Lambda runtime'
    }),
  timeout: Joi.number()
    .integer()
    .min(1)
    .max(900)
    .default(60)
    .messages({
      'number.min': 'Timeout must be at least 1 second',
      'number.max': 'Timeout must be no more than 900 seconds (15 minutes)'
    }),
  memory: Joi.number()
    .integer()
    .min(128)
    .max(10240)
    .default(512)
    .messages({
      'number.min': 'Memory must be at least 128 MB',
      'number.max': 'Memory must be no more than 10240 MB'
    }),
  environment_variables: Joi.object()
    .pattern(Joi.string(), Joi.string())
    .optional()
    .messages({
      'object.pattern.match': 'Environment variables must be key-value pairs of strings'
    })
});

// Joi schema for DeploymentSettings
const deploymentSettingsSchema = Joi.object({
  stack_name: Joi.string()
    .pattern(/^[a-zA-Z][a-zA-Z0-9-]*$/)
    .min(1)
    .max(128)
    .optional()
    .messages({
      'string.pattern.base': 'Stack name must start with a letter and contain only alphanumeric characters and hyphens',
      'string.min': 'Stack name must be at least 1 character long',
      'string.max': 'Stack name must be no more than 128 characters long'
    }),
  tags: Joi.object()
    .pattern(Joi.string(), Joi.string())
    .optional()
    .messages({
      'object.pattern.match': 'Tags must be key-value pairs of strings'
    }),
  enable_monitoring: Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'Enable monitoring must be a boolean value'
    })
});

// Main DeploymentConfig schema
const deploymentConfigSchema = Joi.object({
  application: applicationConfigSchema.required(),
  aws: awsConfigSchema.optional(),
  frontend: frontendConfigSchema.when('application.type', {
    is: Joi.valid('frontend', 'fullstack'),
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),
  backend: backendConfigSchema.when('application.type', {
    is: Joi.valid('backend', 'fullstack'),
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),
  deployment: deploymentSettingsSchema.optional()
}).unknown(false);

/**
 * Validates a deployment configuration object against the schema
 * @param config - The configuration object to validate
 * @returns ConfigValidationResult with validation status and any errors
 */
export function validateConfig(config: any): ConfigValidationResult {
  // Apply defaults for missing sections
  const configWithDefaults = {
    ...config,
    aws: config.aws || {},
    deployment: config.deployment || {}
  };

  const { error, value } = deploymentConfigSchema.validate(configWithDefaults, {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: false
  });

  if (error) {
    const errors = error.details.map(detail => detail.message);
    return {
      valid: false,
      errors
    };
  }

  return {
    valid: true,
    errors: []
  };
}

/**
 * Validates and normalizes a deployment configuration
 * @param config - The configuration object to validate and normalize
 * @returns The validated and normalized configuration with defaults applied
 * @throws Error if validation fails
 */
export function validateAndNormalizeConfig(config: any): DeploymentConfig {
  // Apply defaults for missing sections
  const configWithDefaults = {
    ...config,
    aws: config.aws || {},
    deployment: config.deployment || {}
  };

  const { error, value } = deploymentConfigSchema.validate(configWithDefaults, {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: false
  });

  if (error) {
    const errors = error.details.map(detail => detail.message);
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  return value as DeploymentConfig;
}

/**
 * Gets the Joi schema for deployment configuration (useful for testing)
 * @returns The Joi schema object
 */
export function getConfigSchema() {
  return deploymentConfigSchema;
}