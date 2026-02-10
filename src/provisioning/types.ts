// Provisioning-specific types
export interface ResourceManager {
  create(config: any): Promise<any>;
  update(config: any): Promise<any>;
  delete(resourceId: string): Promise<void>;
}

export interface ProvisioningResult {
  resourceId: string;
  resourceArn: string;
  status: 'created' | 'updated' | 'failed';
  metadata?: Record<string, any>;
}