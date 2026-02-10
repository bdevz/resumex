import { DeploymentConfig } from '../types/index.js';

/**
 * Configuration for resource naming
 */
export interface NamingConfig {
  /** Application name from configuration */
  applicationName: string;
  /** Environment name (e.g., dev, staging, prod) */
  environment?: string;
  /** AWS region */
  region: string;
  /** Custom prefix for all resources */
  prefix?: string;
  /** Custom suffix for all resources */
  suffix?: string;
}

/**
 * Generated resource names for AWS resources
 */
export interface ResourceNames {
  /** CloudFormation stack name */
  stackName: string;
  /** S3 bucket name for frontend assets */
  s3BucketName?: string;
  /** Lambda function name */
  lambdaFunctionName?: string;
  /** IAM role name for Lambda execution */
  lambdaExecutionRoleName?: string;
  /** API Gateway name */
  apiGatewayName?: string;
  /** CloudWatch log group name */
  logGroupName?: string;
}

/**
 * Resource naming utility class
 */
export class ResourceNamingService {
  private readonly maxStackNameLength = 128;
  private readonly maxS3BucketNameLength = 63;
  private readonly maxLambdaNameLength = 64;
  private readonly maxRoleNameLength = 64;

  /**
   * Generate all resource names for a deployment
   * @param config - Deployment configuration
   * @param environment - Optional environment name
   * @returns Generated resource names
   */
  generateResourceNames(config: DeploymentConfig, environment?: string): ResourceNames {
    const namingConfig: NamingConfig = {
      applicationName: config.application.name,
      environment,
      region: config.aws.region || 'us-east-1',
      prefix: this.extractPrefix(config),
      suffix: this.extractSuffix(config)
    };

    const baseStackName = config.deployment.stack_name || this.generateStackName(namingConfig);
    
    return {
      stackName: this.validateAndTruncate(baseStackName, this.maxStackNameLength, 'stack'),
      s3BucketName: this.needsS3Bucket(config) ? this.generateS3BucketName(namingConfig) : undefined,
      lambdaFunctionName: this.needsLambda(config) ? this.generateLambdaFunctionName(namingConfig) : undefined,
      lambdaExecutionRoleName: this.needsLambda(config) ? this.generateLambdaRoleName(namingConfig) : undefined,
      apiGatewayName: this.needsApiGateway(config) ? this.generateApiGatewayName(namingConfig) : undefined,
      logGroupName: this.needsLambda(config) ? this.generateLogGroupName(namingConfig) : undefined
    };
  }

  /**
   * Check for naming conflicts with existing resources
   * @param resourceNames - Generated resource names
   * @param existingResources - List of existing resource names to check against
   * @returns Array of conflicts found
   */
  checkNamingConflicts(resourceNames: ResourceNames, existingResources: string[]): string[] {
    const conflicts: string[] = [];
    const existingSet = new Set(existingResources.map(name => name.toLowerCase()));

    // Check each resource name for conflicts
    Object.entries(resourceNames).forEach(([resourceType, name]) => {
      if (name && existingSet.has(name.toLowerCase())) {
        conflicts.push(`${resourceType}: ${name}`);
      }
    });

    return conflicts;
  }

  /**
   * Resolve environment-specific configuration
   * @param config - Base deployment configuration
   * @param environment - Environment name
   * @param environmentOverrides - Environment-specific overrides
   * @returns Configuration with environment-specific values applied
   */
  resolveEnvironmentConfig(
    config: DeploymentConfig, 
    environment: string,
    environmentOverrides: Partial<DeploymentConfig> = {}
  ): DeploymentConfig {
    // Deep merge environment overrides with base config
    const resolvedConfig = this.deepMerge(config, environmentOverrides);
    
    // Apply environment-specific naming if not explicitly set
    if (!resolvedConfig.deployment.stack_name) {
      const namingConfig: NamingConfig = {
        applicationName: resolvedConfig.application.name,
        environment,
        region: resolvedConfig.aws.region || 'us-east-1'
      };
      resolvedConfig.deployment.stack_name = this.generateStackName(namingConfig);
    }

    // Apply environment-specific tags
    resolvedConfig.deployment.tags = {
      Environment: environment,
      Application: resolvedConfig.application.name,
      ...resolvedConfig.deployment.tags
    };

    return resolvedConfig;
  }

  /**
   * Generate a unique stack name
   */
  private generateStackName(config: NamingConfig): string {
    const parts = [
      config.prefix,
      config.applicationName,
      config.environment,
      config.suffix
    ].filter(Boolean);

    const name = this.sanitizeName(parts.join('-'));
    return this.validateAndTruncate(name, this.maxStackNameLength, 'stack');
  }

  /**
   * Generate S3 bucket name (must be globally unique)
   */
  private generateS3BucketName(config: NamingConfig): string {
    const timestamp = Date.now().toString(36);
    const parts = [
      config.prefix,
      config.applicationName || 'app', // Ensure we have a name for S3 bucket
      config.environment,
      'frontend',
      timestamp,
      config.suffix
    ].filter(Boolean);

    const name = this.sanitizeName(parts.join('-')).toLowerCase();
    return this.validateAndTruncate(name, this.maxS3BucketNameLength, 's3-bucket');
  }

  /**
   * Generate Lambda function name
   */
  private generateLambdaFunctionName(config: NamingConfig): string {
    const parts = [
      config.prefix,
      config.applicationName || 'app', // Ensure we have a name
      config.environment,
      'lambda',
      config.suffix
    ].filter(Boolean);

    const name = this.sanitizeName(parts.join('-'));
    return this.validateAndTruncate(name, this.maxLambdaNameLength, 'lambda');
  }

  /**
   * Generate IAM role name for Lambda execution
   */
  private generateLambdaRoleName(config: NamingConfig): string {
    const parts = [
      config.prefix,
      config.applicationName || 'app', // Ensure we have a name
      config.environment,
      'lambda-role',
      config.suffix
    ].filter(Boolean);

    const name = this.sanitizeName(parts.join('-'));
    return this.validateAndTruncate(name, this.maxRoleNameLength, 'iam-role');
  }

  /**
   * Generate API Gateway name
   */
  private generateApiGatewayName(config: NamingConfig): string {
    const parts = [
      config.prefix,
      config.applicationName || 'app', // Ensure we have a name
      config.environment,
      'api',
      config.suffix
    ].filter(Boolean);

    return this.sanitizeName(parts.join('-'));
  }

  /**
   * Generate CloudWatch log group name
   */
  private generateLogGroupName(config: NamingConfig): string {
    const lambdaName = this.generateLambdaFunctionName(config);
    return `/aws/lambda/${lambdaName}`;
  }

  /**
   * Check if S3 bucket is needed based on application type
   */
  private needsS3Bucket(config: DeploymentConfig): boolean {
    return config.application.type === 'frontend' || config.application.type === 'fullstack';
  }

  /**
   * Check if Lambda function is needed based on application type
   */
  private needsLambda(config: DeploymentConfig): boolean {
    return config.application.type === 'backend' || config.application.type === 'fullstack';
  }

  /**
   * Check if API Gateway is needed (currently optional, depends on Lambda setup)
   */
  private needsApiGateway(config: DeploymentConfig): boolean {
    // For now, we'll use Function URLs by default, but this could be configurable
    return false;
  }

  /**
   * Extract custom prefix from configuration
   */
  private extractPrefix(config: DeploymentConfig): string | undefined {
    return config.deployment.tags?.Prefix;
  }

  /**
   * Extract custom suffix from configuration
   */
  private extractSuffix(config: DeploymentConfig): string | undefined {
    return config.deployment.tags?.Suffix;
  }

  /**
   * Sanitize name to be AWS-compliant
   * - Remove invalid characters
   * - Ensure it starts with a letter
   * - Replace consecutive hyphens with single hyphen
   */
  private sanitizeName(name: string): string {
    // Remove invalid characters and replace with hyphens
    let sanitized = name.replace(/[^a-zA-Z0-9-]/g, '-');
    
    // Replace consecutive hyphens with single hyphen
    sanitized = sanitized.replace(/-+/g, '-');
    
    // Remove leading/trailing hyphens
    sanitized = sanitized.replace(/^-+|-+$/g, '');
    
    // Ensure it starts with a letter
    if (sanitized && !/^[a-zA-Z]/.test(sanitized)) {
      sanitized = 'app-' + sanitized;
    }
    
    // Fallback if empty
    if (!sanitized) {
      sanitized = 'app';
    }
    
    return sanitized;
  }

  /**
   * Validate and truncate name to fit AWS limits
   */
  private validateAndTruncate(name: string, maxLength: number, resourceType: string): string {
    if (name.length <= maxLength) {
      return name;
    }

    // Truncate and add hash to maintain uniqueness
    const hash = this.generateShortHash(name);
    const truncatedLength = maxLength - hash.length - 1; // -1 for hyphen
    const truncated = name.substring(0, truncatedLength) + '-' + hash;
    
    return truncated;
  }

  /**
   * Generate a short hash for uniqueness
   */
  private generateShortHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 6);
  }

  /**
   * Deep merge two objects
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
 * Convenience function to create a new resource naming service
 */
export function createNamingService(): ResourceNamingService {
  return new ResourceNamingService();
}