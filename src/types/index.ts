// Core type definitions for AWS Deployment Template

export interface ApplicationConfig {
  name: string;
  type: 'frontend' | 'backend' | 'fullstack';
  version?: string;
}

export interface AWSConfig {
  region?: string;
  profile?: string;
}

export interface FrontendConfig {
  source_dir: string;
  index_file?: string;
  custom_domain?: string;
  build_command?: string;
}

export interface BackendConfig {
  source_dir: string;
  handler: string;
  runtime?: string;
  timeout?: number;
  memory?: number;
  environment_variables?: Record<string, string>;
}

export interface DeploymentSettings {
  stack_name?: string;
  tags?: Record<string, string>;
  enable_monitoring?: boolean;
}

export interface DeploymentConfig {
  application: ApplicationConfig;
  aws: AWSConfig;
  frontend?: FrontendConfig;
  backend?: BackendConfig;
  deployment: DeploymentSettings;
}

export interface DeployedResource {
  type: string;
  name: string;
  arn: string;
  status: 'created' | 'updated' | 'failed';
}

export interface Endpoint {
  type: 'website' | 'api' | 'function_url';
  url: string;
  description: string;
}

export interface DeploymentError {
  code: string;
  message: string;
  details?: any;
  remediation?: string;
}

export interface DeploymentMetadata {
  deploymentId: string;
  timestamp: Date;
  duration?: number;
  region: string;
  stackName: string;
}

export interface DeploymentResult {
  success: boolean;
  resources: DeployedResource[];
  endpoints: Endpoint[];
  errors?: DeploymentError[];
  metadata: DeploymentMetadata;
}