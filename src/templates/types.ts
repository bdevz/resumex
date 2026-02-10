// Template-specific types
export interface TemplateGenerator {
  generate(config: any): Promise<string>;
}

export interface CloudFormationTemplate {
  AWSTemplateFormatVersion: string;
  Description: string;
  Parameters?: Record<string, any>;
  Resources: Record<string, any>;
  Outputs?: Record<string, any>;
}