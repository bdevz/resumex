import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIGatewayManager, APIGatewayConfig, RouteConfig, CorsConfig } from '../api-gateway-manager';
import { APIGatewayClient } from '@aws-sdk/client-api-gateway';

// Mock the AWS SDK
vi.mock('@aws-sdk/client-api-gateway', () => ({
  APIGatewayClient: vi.fn(),
  CreateRestApiCommand: vi.fn(),
  CreateResourceCommand: vi.fn(),
  PutMethodCommand: vi.fn(),
  PutIntegrationCommand: vi.fn(),
  CreateDeploymentCommand: vi.fn(),
  GetRestApisCommand: vi.fn(),
  GetResourcesCommand: vi.fn(),
  PutMethodResponseCommand: vi.fn(),
  PutIntegrationResponseCommand: vi.fn()
}));

describe('APIGatewayManager', () => {
  let apiGatewayManager: APIGatewayManager;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      send: vi.fn()
    };
    (APIGatewayClient as any).mockImplementation(() => mockClient);
    apiGatewayManager = new APIGatewayManager('us-east-1');
  });

  describe('create', () => {
    it('should create a new API Gateway successfully', async () => {
      const route: RouteConfig = {
        path: '/hello',
        method: 'GET',
        integration: {
          type: 'AWS_PROXY',
          lambdaFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:hello-function'
        }
      };

      const config: APIGatewayConfig = {
        apiName: 'test-api',
        description: 'Test API',
        routes: [route],
        stageName: 'dev'
      };

      // Mock API doesn't exist
      mockClient.send.mockResolvedValueOnce({ items: [] }); // GetRestApis

      // Mock API creation
      mockClient.send.mockResolvedValueOnce({
        id: 'abc123',
        name: 'test-api'
      }); // CreateRestApi

      // Mock get root resource
      mockClient.send.mockResolvedValueOnce({
        items: [{ id: 'root123', path: '/' }]
      }); // GetResources

      // Mock get resources for path check
      mockClient.send.mockResolvedValueOnce({
        items: [{ id: 'root123', path: '/' }]
      }); // GetResources for path check

      // Mock resource creation
      mockClient.send.mockResolvedValueOnce({
        id: 'resource123'
      }); // CreateResource

      // Mock method and integration setup
      mockClient.send.mockResolvedValue({}); // All subsequent calls

      const result = await apiGatewayManager.create(config);

      expect(result).toEqual({
        resourceId: 'abc123',
        resourceArn: 'arn:aws:apigateway:us-east-1::/restapis/abc123',
        apiId: 'abc123',
        apiArn: 'arn:aws:apigateway:us-east-1::/restapis/abc123',
        apiUrl: 'https://abc123.execute-api.us-east-1.amazonaws.com/dev',
        stageName: 'dev',
        status: 'created'
      });

      expect(mockClient.send).toHaveBeenCalled();
    });

    it('should return existing API if it already exists', async () => {
      const config: APIGatewayConfig = {
        apiName: 'existing-api',
        routes: [],
        stageName: 'prod'
      };

      // Mock existing API
      mockClient.send.mockResolvedValueOnce({
        items: [{ id: 'existing123', name: 'existing-api' }]
      }); // GetRestApis

      // Mock deployment
      mockClient.send.mockResolvedValueOnce({}); // CreateDeployment

      const result = await apiGatewayManager.create(config);

      expect(result).toEqual({
        resourceId: 'existing123',
        resourceArn: 'arn:aws:apigateway:us-east-1::/restapis/existing123',
        apiId: 'existing123',
        apiArn: 'arn:aws:apigateway:us-east-1::/restapis/existing123',
        apiUrl: 'https://existing123.execute-api.us-east-1.amazonaws.com/prod',
        stageName: 'prod',
        status: 'updated'
      });
    });

    it('should configure CORS when provided', async () => {
      const corsConfig: CorsConfig = {
        allowOrigins: ['https://example.com'],
        allowMethods: ['GET', 'POST'],
        allowHeaders: ['Content-Type', 'Authorization']
      };

      const config: APIGatewayConfig = {
        apiName: 'cors-api',
        routes: [],
        corsConfiguration: corsConfig
      };

      // Mock API doesn't exist
      mockClient.send.mockResolvedValueOnce({ items: [] }); // GetRestApis

      // Mock API creation
      mockClient.send.mockResolvedValueOnce({
        id: 'cors123',
        name: 'cors-api'
      }); // CreateRestApi

      // Mock get root resource
      mockClient.send.mockResolvedValueOnce({
        items: [{ id: 'root123', path: '/' }]
      }); // GetResources

      // Mock all subsequent calls for CORS setup
      mockClient.send.mockResolvedValue({});

      const result = await apiGatewayManager.create(config);

      expect(result.status).toBe('created');
      expect(mockClient.send).toHaveBeenCalled();
    });

    it('should handle API creation errors', async () => {
      const config: APIGatewayConfig = {
        apiName: 'error-api',
        routes: []
      };

      // Mock API doesn't exist
      mockClient.send.mockResolvedValueOnce({ items: [] }); // GetRestApis

      // Mock API creation error
      mockClient.send.mockRejectedValueOnce(new Error('Access denied'));

      await expect(apiGatewayManager.create(config)).rejects.toThrow('Failed to create API Gateway error-api');
    });
  });

  describe('route creation', () => {
    it('should handle root path routes', async () => {
      const route: RouteConfig = {
        path: '/',
        method: 'GET',
        integration: {
          type: 'AWS_PROXY',
          lambdaFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:root-function'
        }
      };

      const config: APIGatewayConfig = {
        apiName: 'root-api',
        routes: [route]
      };

      // Mock API doesn't exist
      mockClient.send.mockResolvedValueOnce({ items: [] }); // GetRestApis

      // Mock API creation
      mockClient.send.mockResolvedValueOnce({
        id: 'root123',
        name: 'root-api'
      }); // CreateRestApi

      // Mock get root resource
      mockClient.send.mockResolvedValueOnce({
        items: [{ id: 'root123', path: '/' }]
      }); // GetResources

      // Mock all subsequent calls
      mockClient.send.mockResolvedValue({});

      const result = await apiGatewayManager.create(config);

      expect(result.status).toBe('created');
    });

    it('should handle nested path routes', async () => {
      const route: RouteConfig = {
        path: '/api/v1/users',
        method: 'POST',
        integration: {
          type: 'AWS_PROXY',
          lambdaFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:users-function'
        }
      };

      const config: APIGatewayConfig = {
        apiName: 'nested-api',
        routes: [route]
      };

      // Mock API doesn't exist
      mockClient.send.mockResolvedValueOnce({ items: [] }); // GetRestApis

      // Mock API creation
      mockClient.send.mockResolvedValueOnce({
        id: 'nested123',
        name: 'nested-api'
      }); // CreateRestApi

      // Mock get root resource
      mockClient.send.mockResolvedValueOnce({
        items: [{ id: 'root123', path: '/' }]
      }); // GetResources

      // Mock resource path checks and creation
      mockClient.send.mockResolvedValue({
        items: [] // No existing resources
      }); // GetResources for path checks

      // Mock resource creation for each path segment
      mockClient.send.mockResolvedValue({
        id: 'resource123'
      }); // CreateResource calls

      const result = await apiGatewayManager.create(config);

      expect(result.status).toBe('created');
    });
  });

  describe('integration types', () => {
    it('should handle AWS_PROXY integration with Lambda', async () => {
      const route: RouteConfig = {
        path: '/lambda',
        method: 'POST',
        integration: {
          type: 'AWS_PROXY',
          lambdaFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:my-function'
        }
      };

      const config: APIGatewayConfig = {
        apiName: 'lambda-api',
        routes: [route]
      };

      // Mock successful API creation flow
      mockClient.send.mockResolvedValue({});

      // Override specific mocks
      mockClient.send.mockResolvedValueOnce({ items: [] }); // GetRestApis
      mockClient.send.mockResolvedValueOnce({ id: 'api123' }); // CreateRestApi
      mockClient.send.mockResolvedValueOnce({ items: [{ id: 'root123', path: '/' }] }); // GetResources

      const result = await apiGatewayManager.create(config);

      expect(result.status).toBe('created');
    });

    it('should handle custom URI integration', async () => {
      const route: RouteConfig = {
        path: '/custom',
        method: 'GET',
        integration: {
          type: 'HTTP',
          uri: 'https://example.com/api'
        }
      };

      const config: APIGatewayConfig = {
        apiName: 'custom-api',
        routes: [route]
      };

      // Mock successful API creation flow
      mockClient.send.mockResolvedValue({});

      // Override specific mocks
      mockClient.send.mockResolvedValueOnce({ items: [] }); // GetRestApis
      mockClient.send.mockResolvedValueOnce({ id: 'api123' }); // CreateRestApi
      mockClient.send.mockResolvedValueOnce({ items: [{ id: 'root123', path: '/' }] }); // GetResources

      const result = await apiGatewayManager.create(config);

      expect(result.status).toBe('created');
    });
  });

  describe('update', () => {
    it('should update existing API', async () => {
      const config: APIGatewayConfig = {
        apiName: 'update-api',
        routes: []
      };

      // Mock existing API
      mockClient.send.mockResolvedValueOnce({
        items: [{ id: 'update123', name: 'update-api' }]
      }); // GetRestApis

      // Mock deployment
      mockClient.send.mockResolvedValueOnce({}); // CreateDeployment

      const result = await apiGatewayManager.update(config);

      expect(result.status).toBe('updated');
      expect(result.apiId).toBe('update123');
    });

    it('should create API if it does not exist during update', async () => {
      const config: APIGatewayConfig = {
        apiName: 'new-api',
        routes: []
      };

      // Mock API doesn't exist (first call in update)
      mockClient.send.mockResolvedValueOnce({ items: [] }); // GetRestApis in update

      // Mock API doesn't exist (second call in create)
      mockClient.send.mockResolvedValueOnce({ items: [] }); // GetRestApis in create

      // Mock API creation
      mockClient.send.mockResolvedValueOnce({
        id: 'new123',
        name: 'new-api'
      }); // CreateRestApi

      // Mock get root resource
      mockClient.send.mockResolvedValueOnce({
        items: [{ id: 'root123', path: '/' }]
      }); // GetResources

      // Mock deployment
      mockClient.send.mockResolvedValueOnce({}); // CreateDeployment

      const result = await apiGatewayManager.update(config);

      expect(result.status).toBe('created');
    });
  });
});