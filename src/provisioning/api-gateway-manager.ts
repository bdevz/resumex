import { 
  APIGatewayClient, 
  CreateRestApiCommand,
  CreateResourceCommand,
  PutMethodCommand,
  PutIntegrationCommand,
  CreateDeploymentCommand,
  GetRestApisCommand,
  GetResourcesCommand,
  PutMethodResponseCommand,
  PutIntegrationResponseCommand
} from '@aws-sdk/client-api-gateway';
import { ResourceManager, ProvisioningResult } from './types';

export interface APIGatewayConfig {
  apiName: string;
  description?: string;
  endpointConfiguration?: {
    types: ('EDGE' | 'REGIONAL' | 'PRIVATE')[];
  };
  routes: RouteConfig[];
  corsConfiguration?: CorsConfig;
  stageName?: string;
  stageDescription?: string;
  tags?: { [key: string]: string };
}

export interface RouteConfig {
  path: string;
  method: string;
  integration: {
    type: 'AWS_PROXY' | 'AWS' | 'HTTP' | 'HTTP_PROXY' | 'MOCK';
    lambdaFunctionArn?: string;
    httpMethod?: string;
    uri?: string;
  };
  authorizationType?: 'NONE' | 'AWS_IAM' | 'CUSTOM' | 'COGNITO_USER_POOLS';
  requestParameters?: { [key: string]: boolean };
}

export interface CorsConfig {
  allowOrigins: string[];
  allowMethods: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
  maxAge?: number;
  allowCredentials?: boolean;
}

export interface APIGatewayResult extends ProvisioningResult {
  apiId: string;
  apiArn: string;
  apiUrl: string;
  stageName: string;
}

export class APIGatewayManager implements ResourceManager {
  private client: APIGatewayClient;

  constructor(region?: string) {
    this.client = new APIGatewayClient({ region });
  }

  async create(config: APIGatewayConfig): Promise<APIGatewayResult> {
    try {
      // Check if API already exists
      const existingApi = await this.getApiIfExists(config.apiName);
      if (existingApi) {
        return this.updateApi(config, existingApi);
      }

      // Create the REST API
      const createApiCommand = new CreateRestApiCommand({
        name: config.apiName,
        description: config.description,
        endpointConfiguration: config.endpointConfiguration || {
          types: ['REGIONAL']
        },
        tags: config.tags
      });

      const apiResult = await this.client.send(createApiCommand);
      const apiId = apiResult.id!;

      // Get the root resource
      const rootResource = await this.getRootResource(apiId);

      // Create routes
      for (const route of config.routes) {
        await this.createRoute(apiId, rootResource.id!, route);
      }

      // Configure CORS if specified
      if (config.corsConfiguration) {
        await this.configureCors(apiId, rootResource.id!, config.corsConfiguration);
      }

      // Deploy the API
      const stageName = config.stageName || 'prod';
      await this.deployApi(apiId, stageName, config.stageDescription);

      const region = await this.getRegion();
      const apiUrl = `https://${apiId}.execute-api.${region}.amazonaws.com/${stageName}`;

      return {
        resourceId: apiId,
        resourceArn: `arn:aws:apigateway:${region}::/restapis/${apiId}`,
        apiId,
        apiArn: `arn:aws:apigateway:${region}::/restapis/${apiId}`,
        apiUrl,
        stageName,
        status: 'created'
      };
    } catch (error) {
      throw new Error(`Failed to create API Gateway ${config.apiName}: ${error}`);
    }
  }

  async update(config: APIGatewayConfig): Promise<APIGatewayResult> {
    try {
      const existingApi = await this.getApiIfExists(config.apiName);
      if (!existingApi) {
        return this.create(config);
      }

      return this.updateApi(config, existingApi);
    } catch (error) {
      throw new Error(`Failed to update API Gateway ${config.apiName}: ${error}`);
    }
  }

  async delete(apiId: string): Promise<void> {
    try {
      // Note: This is a simplified delete - in production, you'd need to:
      // 1. Delete all stages
      // 2. Delete all resources and methods
      // 3. Delete the API
      console.warn(`API Gateway deletion not fully implemented. API ID: ${apiId}`);
    } catch (error) {
      throw new Error(`Failed to delete API Gateway ${apiId}: ${error}`);
    }
  }

  // Route management
  private async createRoute(apiId: string, parentResourceId: string, route: RouteConfig): Promise<void> {
    let resourceId = parentResourceId;

    // Create resource if path is not root
    if (route.path !== '/') {
      const pathParts = route.path.split('/').filter(part => part);
      let currentPath = '';
      let currentResourceId = parentResourceId;

      for (const part of pathParts) {
        currentPath += `/${part}`;
        const existingResource = await this.getResourceByPath(apiId, currentPath);
        
        if (!existingResource) {
          const createResourceCommand = new CreateResourceCommand({
            restApiId: apiId,
            parentId: currentResourceId,
            pathPart: part
          });
          
          const resourceResult = await this.client.send(createResourceCommand);
          currentResourceId = resourceResult.id!;
        } else {
          currentResourceId = existingResource.id!;
        }
      }
      
      resourceId = currentResourceId;
    }

    // Create method
    const putMethodCommand = new PutMethodCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: route.method.toUpperCase(),
      authorizationType: route.authorizationType || 'NONE',
      requestParameters: route.requestParameters
    });

    await this.client.send(putMethodCommand);

    // Create method response
    const putMethodResponseCommand = new PutMethodResponseCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: route.method.toUpperCase(),
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': false
      }
    });

    await this.client.send(putMethodResponseCommand);

    // Create integration
    const integrationUri = this.buildIntegrationUri(route.integration);
    
    const putIntegrationCommand = new PutIntegrationCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: route.method.toUpperCase(),
      type: route.integration.type,
      integrationHttpMethod: route.integration.httpMethod || 'POST',
      uri: integrationUri
    });

    await this.client.send(putIntegrationCommand);

    // Create integration response
    const putIntegrationResponseCommand = new PutIntegrationResponseCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: route.method.toUpperCase(),
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': "'*'"
      }
    });

    await this.client.send(putIntegrationResponseCommand);
  }

  private async configureCors(apiId: string, resourceId: string, corsConfig: CorsConfig): Promise<void> {
    // Create OPTIONS method for CORS preflight
    const putOptionsMethodCommand = new PutMethodCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'OPTIONS',
      authorizationType: 'NONE'
    });

    await this.client.send(putOptionsMethodCommand);

    // Create OPTIONS method response
    const putOptionsMethodResponseCommand = new PutMethodResponseCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'OPTIONS',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': false,
        'method.response.header.Access-Control-Allow-Methods': false,
        'method.response.header.Access-Control-Allow-Headers': false
      }
    });

    await this.client.send(putOptionsMethodResponseCommand);

    // Create OPTIONS integration (MOCK)
    const putOptionsIntegrationCommand = new PutIntegrationCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'OPTIONS',
      type: 'MOCK',
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      }
    });

    await this.client.send(putOptionsIntegrationCommand);

    // Create OPTIONS integration response
    const putOptionsIntegrationResponseCommand = new PutIntegrationResponseCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'OPTIONS',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': `'${corsConfig.allowOrigins.join(',')}'`,
        'method.response.header.Access-Control-Allow-Methods': `'${corsConfig.allowMethods.join(',')}'`,
        'method.response.header.Access-Control-Allow-Headers': `'${(corsConfig.allowHeaders || ['Content-Type', 'X-Amz-Date', 'Authorization']).join(',')}'`
      }
    });

    await this.client.send(putOptionsIntegrationResponseCommand);
  }

  private async deployApi(apiId: string, stageName: string, description?: string): Promise<void> {
    const createDeploymentCommand = new CreateDeploymentCommand({
      restApiId: apiId,
      stageName,
      description: description || `Deployment to ${stageName}`
    });

    await this.client.send(createDeploymentCommand);
  }

  // Helper methods
  private async getApiIfExists(apiName: string): Promise<any> {
    try {
      const getApisCommand = new GetRestApisCommand({});
      const result = await this.client.send(getApisCommand);
      
      return result.items?.find(api => api.name === apiName) || null;
    } catch (error) {
      return null;
    }
  }

  private async getRootResource(apiId: string): Promise<any> {
    const getResourcesCommand = new GetResourcesCommand({
      restApiId: apiId
    });

    const result = await this.client.send(getResourcesCommand);
    return result.items?.find(resource => resource.path === '/');
  }

  private async getResourceByPath(apiId: string, path: string): Promise<any> {
    const getResourcesCommand = new GetResourcesCommand({
      restApiId: apiId
    });

    const result = await this.client.send(getResourcesCommand);
    return result.items?.find(resource => resource.path === path) || null;
  }

  private buildIntegrationUri(integration: RouteConfig['integration']): string {
    if (integration.type === 'AWS_PROXY' && integration.lambdaFunctionArn) {
      const region = this.extractRegionFromArn(integration.lambdaFunctionArn);
      return `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${integration.lambdaFunctionArn}/invocations`;
    }

    if (integration.uri) {
      return integration.uri;
    }

    throw new Error('Invalid integration configuration: missing URI or Lambda function ARN');
  }

  private extractRegionFromArn(arn: string): string {
    const parts = arn.split(':');
    return parts[3] || 'us-east-1';
  }

  private async getRegion(): Promise<string> {
    // This is a simplified way to get region - in practice you'd get it from the client config
    return 'us-east-1';
  }

  private async updateApi(config: APIGatewayConfig, existingApi: any): Promise<APIGatewayResult> {
    const apiId = existingApi.id;
    
    // For simplicity, we'll just redeploy the API
    // In production, you'd want to compare and update only changed resources
    const stageName = config.stageName || 'prod';
    await this.deployApi(apiId, stageName, config.stageDescription);

    const region = await this.getRegion();
    const apiUrl = `https://${apiId}.execute-api.${region}.amazonaws.com/${stageName}`;

    return {
      resourceId: apiId,
      resourceArn: `arn:aws:apigateway:${region}::/restapis/${apiId}`,
      apiId,
      apiArn: `arn:aws:apigateway:${region}::/restapis/${apiId}`,
      apiUrl,
      stageName,
      status: 'updated'
    };
  }
}