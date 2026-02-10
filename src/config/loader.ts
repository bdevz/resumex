// Configuration loading logic
import { readFile } from 'fs/promises';
import { parse as parseYaml } from 'yaml';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { DeploymentConfig } from '../types/index.js';
import { ConfigLoader, ConfigValidationResult } from './types.js';
import { validateAndNormalizeConfig, validateConfig } from './validator.js';

/**
 * Configuration loader that supports YAML and JSON files with environment variable substitution
 */
export class DeploymentConfigLoader implements ConfigLoader {
  
  /**
   * Load and parse configuration from a file
   * @param path - Path to the configuration file (YAML or JSON)
   * @returns Promise resolving to validated and normalized DeploymentConfig
   */
  async load(path: string): Promise<DeploymentConfig> {
    try {
      // Check if file exists
      if (!existsSync(path)) {
        throw new Error(`Configuration file not found: ${path}`);
      }

      // Read file content
      const content = await readFile(path, 'utf-8');
      
      // Parse based on file extension
      let rawConfig: any;
      if (path.endsWith('.json')) {
        rawConfig = JSON.parse(content);
      } else if (path.endsWith('.yml') || path.endsWith('.yaml')) {
        rawConfig = parseYaml(content);
      } else {
        throw new Error(`Unsupported file format. Only .json, .yml, and .yaml files are supported.`);
      }

      // Resolve environment variables
      const configWithEnvVars = this.resolveEnvironmentVariables(rawConfig);
      
      // Apply defaults and merge configurations
      const mergedConfig = this.applyDefaults(configWithEnvVars);
      
      // Validate and normalize
      const normalizedConfig = validateAndNormalizeConfig(mergedConfig);
      
      return normalizedConfig;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load configuration from ${path}: ${error.message}`);
      }
      throw new Error(`Failed to load configuration from ${path}: ${String(error)}`);
    }
  }

  /**
   * Validate configuration without loading from file
   * @param config - Configuration object to validate
   * @returns ConfigValidationResult with validation status and errors
   */
  validate(config: any): ConfigValidationResult {
    return validateConfig(config);
  }

  /**
   * Load configuration from multiple possible locations
   * @param searchPaths - Array of paths to search for configuration files
   * @returns Promise resolving to validated DeploymentConfig
   */
  async loadFromPaths(searchPaths: string[]): Promise<DeploymentConfig> {
    const errors: string[] = [];
    
    for (const path of searchPaths) {
      try {
        return await this.load(path);
      } catch (error) {
        errors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    throw new Error(`Could not load configuration from any of the specified paths:\n${errors.join('\n')}`);
  }

  /**
   * Recursively resolve environment variables in configuration object
   * Supports ${VAR_NAME} and ${VAR_NAME:-default_value} syntax
   * @param obj - Object to process
   * @returns Object with environment variables resolved
   */
  private resolveEnvironmentVariables(obj: any): any {
    if (typeof obj === 'string') {
      return this.substituteEnvironmentVariables(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveEnvironmentVariables(item));
    }
    
    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.resolveEnvironmentVariables(value);
      }
      return result;
    }
    
    return obj;
  }

  /**
   * Substitute environment variables in a string
   * Supports ${VAR_NAME} and ${VAR_NAME:-default_value} syntax
   * @param str - String to process
   * @returns String with environment variables substituted
   */
  private substituteEnvironmentVariables(str: string): string {
    return str.replace(/\$\{([^}]+)\}/g, (match, varExpression) => {
      const [varName, defaultValue] = varExpression.split(':-');
      const envValue = process.env[varName];
      
      if (envValue !== undefined) {
        return envValue;
      }
      
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      
      // If no default value and environment variable is not set, keep the original placeholder
      return match;
    });
  }

  /**
   * Apply default values and merge configurations
   * @param config - Raw configuration object
   * @returns Configuration with defaults applied
   */
  private applyDefaults(config: any): any {
    const defaults = {
      application: {
        version: '1.0.0'
      },
      aws: {
        region: 'us-east-1'
      },
      deployment: {
        enable_monitoring: true
      }
    };

    return this.deepMerge(defaults, config);
  }

  /**
   * Deep merge two objects, with the second object taking precedence
   * @param target - Target object (defaults)
   * @param source - Source object (user config)
   * @returns Merged object
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }
}

/**
 * Convenience function to create a new configuration loader
 * @returns New DeploymentConfigLoader instance
 */
export function createConfigLoader(): DeploymentConfigLoader {
  return new DeploymentConfigLoader();
}

/**
 * Load configuration from standard locations
 * Searches for deploy.yml, deploy.yaml, deploy.json in current directory
 * @returns Promise resolving to validated DeploymentConfig
 */
export async function loadDefaultConfig(): Promise<DeploymentConfig> {
  const loader = createConfigLoader();
  const defaultPaths = [
    './deploy.yml',
    './deploy.yaml', 
    './deploy.json',
    './deployment.yml',
    './deployment.yaml',
    './deployment.json'
  ];
  
  return loader.loadFromPaths(defaultPaths);
}