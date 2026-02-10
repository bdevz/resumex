import { CloudFormationGenerator } from './cloudformation-generator';
import { DeploymentConfig } from '../types';
import { TemplateGenerator } from './types';

export interface TemplateOptions {
  format: 'cloudformation' | 'terraform' | 'pulumi';
  minify?: boolean;
  validate?: boolean;
}

export class TemplateEngine {
  private generators: Map<string, TemplateGenerator> = new Map();

  constructor() {
    // Register built-in generators
    this.generators.set('cloudformation', new CloudFormationGenerator());
  }

  async generateTemplate(
    config: DeploymentConfig, 
    options: TemplateOptions = { format: 'cloudformation' }
  ): Promise<string> {
    const generator = this.generators.get(options.format);
    if (!generator) {
      throw new Error(`Unsupported template format: ${options.format}`);
    }

    let template = await generator.generate(config);

    if (options.minify) {
      template = this.minifyTemplate(template, options.format);
    }

    if (options.validate) {
      await this.validateTemplate(template, options.format);
    }

    return template;
  }

  registerGenerator(format: string, generator: TemplateGenerator): void {
    this.generators.set(format, generator);
  }

  getSupportedFormats(): string[] {
    return Array.from(this.generators.keys());
  }

  async validateTemplate(template: string, format: string): Promise<boolean> {
    switch (format) {
      case 'cloudformation':
        return this.validateCloudFormationTemplate(template);
      default:
        console.warn(`Validation not implemented for format: ${format}`);
        return true;
    }
  }

  private validateCloudFormationTemplate(template: string): boolean {
    try {
      const parsed = JSON.parse(template);
      
      // Basic CloudFormation template validation
      if (!parsed.AWSTemplateFormatVersion) {
        throw new Error('Missing AWSTemplateFormatVersion');
      }
      
      if (!parsed.Resources || Object.keys(parsed.Resources).length === 0) {
        throw new Error('Template must contain at least one resource');
      }

      // Validate resource types (basic check)
      for (const [resourceName, resource] of Object.entries(parsed.Resources)) {
        if (!resource || typeof resource !== 'object') {
          throw new Error(`Invalid resource definition: ${resourceName}`);
        }
        
        const resourceObj = resource as any;
        if (!resourceObj.Type) {
          throw new Error(`Resource ${resourceName} missing Type property`);
        }
      }

      return true;
    } catch (error) {
      throw new Error(`CloudFormation template validation failed: ${error}`);
    }
  }

  private minifyTemplate(template: string, format: string): string {
    switch (format) {
      case 'cloudformation':
        // Remove whitespace from JSON
        return JSON.stringify(JSON.parse(template));
      default:
        return template;
    }
  }

  async generateDeploymentArtifacts(config: DeploymentConfig): Promise<{
    template: string;
    parameters: Record<string, any>;
    metadata: Record<string, any>;
  }> {
    const template = await this.generateTemplate(config);
    
    const parameters = {
      ApplicationName: config.application.name,
      Environment: 'production'
    };

    const metadata = {
      generatedAt: new Date().toISOString(),
      templateFormat: 'cloudformation',
      applicationName: config.application.name,
      applicationType: config.application.type,
      region: config.aws.region || 'us-east-1'
    };

    return { template, parameters, metadata };
  }
}