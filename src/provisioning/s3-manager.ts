import { 
  S3Client, 
  CreateBucketCommand, 
  PutBucketWebsiteCommand, 
  PutBucketPolicyCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  HeadBucketCommand,
  GetBucketLocationCommand,
  PutPublicAccessBlockCommand
} from '@aws-sdk/client-s3';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { ResourceManager, ProvisioningResult } from './types';

export interface S3Config {
  bucketName: string;
  region?: string;
  enableWebsiteHosting?: boolean;
  indexDocument?: string;
  errorDocument?: string;
  corsConfiguration?: CorsConfiguration;
  publicReadAccess?: boolean;
  tags?: { [key: string]: string };
}

export interface CorsConfiguration {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders?: string[];
  maxAgeSeconds?: number;
}

export interface S3Result extends ProvisioningResult {
  bucketName: string;
  bucketArn: string;
  websiteUrl?: string;
  region: string;
}

export interface UploadResult {
  key: string;
  etag: string;
  url: string;
}

export class S3Manager implements ResourceManager {
  private client: S3Client;
  private region: string;

  constructor(region: string = 'us-east-1') {
    this.region = region;
    this.client = new S3Client({ region });
  }

  async create(config: S3Config): Promise<S3Result> {
    try {
      const bucketRegion = config.region || this.region;
      
      // Check if bucket already exists
      const existingBucket = await this.getBucketIfExists(config.bucketName);
      if (existingBucket) {
        return {
          resourceId: config.bucketName,
          resourceArn: `arn:aws:s3:::${config.bucketName}`,
          bucketName: config.bucketName,
          bucketArn: `arn:aws:s3:::${config.bucketName}`,
          region: existingBucket.region,
          status: 'updated',
          websiteUrl: config.enableWebsiteHosting ? 
            `http://${config.bucketName}.s3-website-${existingBucket.region}.amazonaws.com` : undefined
        };
      }

      // Create the bucket
      const createBucketCommand = new CreateBucketCommand({
        Bucket: config.bucketName,
        CreateBucketConfiguration: bucketRegion !== 'us-east-1' ? {
          LocationConstraint: bucketRegion as any
        } : undefined
      });

      await this.client.send(createBucketCommand);

      // Configure public access block (disable for website hosting if needed)
      if (config.enableWebsiteHosting || config.publicReadAccess) {
        await this.configurePublicAccess(config.bucketName, false);
      }

      // Configure website hosting if enabled
      let websiteUrl: string | undefined;
      if (config.enableWebsiteHosting) {
        websiteUrl = await this.configureWebsiteHosting(
          config.bucketName, 
          config.indexDocument || 'index.html',
          config.errorDocument || 'error.html'
        );
      }

      // Configure CORS if provided
      if (config.corsConfiguration) {
        await this.configureCors(config.bucketName, config.corsConfiguration);
      }

      // Configure bucket policy for public read access if needed
      if (config.publicReadAccess || config.enableWebsiteHosting) {
        await this.configurePublicReadPolicy(config.bucketName);
      }

      return {
        resourceId: config.bucketName,
        resourceArn: `arn:aws:s3:::${config.bucketName}`,
        bucketName: config.bucketName,
        bucketArn: `arn:aws:s3:::${config.bucketName}`,
        region: bucketRegion,
        status: 'created',
        websiteUrl
      };
    } catch (error) {
      throw new Error(`Failed to create S3 bucket ${config.bucketName}: ${error}`);
    }
  }

  async update(config: S3Config): Promise<S3Result> {
    // For S3 buckets, update is essentially the same as create (idempotent)
    return this.create(config);
  }

  async delete(bucketName: string): Promise<void> {
    try {
      // Note: This is a simplified delete - in production, you'd need to:
      // 1. Delete all objects in the bucket
      // 2. Delete all versions if versioning is enabled
      // 3. Delete the bucket
      console.warn(`S3 bucket deletion not fully implemented. Bucket: ${bucketName}`);
    } catch (error) {
      throw new Error(`Failed to delete S3 bucket ${bucketName}: ${error}`);
    }
  }

  // File upload and deployment methods
  async uploadFile(bucketName: string, key: string, filePath: string, contentType?: string): Promise<UploadResult> {
    try {
      const fileContent = readFileSync(filePath);
      
      const putObjectCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: fileContent,
        ContentType: contentType || this.getContentType(filePath)
      });

      const result = await this.client.send(putObjectCommand);

      return {
        key,
        etag: result.ETag || '',
        url: `https://${bucketName}.s3.amazonaws.com/${key}`
      };
    } catch (error) {
      throw new Error(`Failed to upload file ${filePath} to S3: ${error}`);
    }
  }

  async uploadDirectory(bucketName: string, localPath: string, s3Prefix: string = ''): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    
    try {
      const files = this.getFilesRecursively(localPath);
      
      for (const filePath of files) {
        const relativePath = relative(localPath, filePath);
        const s3Key = s3Prefix ? `${s3Prefix}/${relativePath}` : relativePath;
        
        const result = await this.uploadFile(bucketName, s3Key, filePath);
        results.push(result);
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to upload directory ${localPath} to S3: ${error}`);
    }
  }

  async deployFrontendAssets(bucketName: string, buildPath: string): Promise<UploadResult[]> {
    try {
      // Upload all files from the build directory
      const results = await this.uploadDirectory(bucketName, buildPath);
      
      console.log(`Deployed ${results.length} files to S3 bucket ${bucketName}`);
      return results;
    } catch (error) {
      throw new Error(`Failed to deploy frontend assets to ${bucketName}: ${error}`);
    }
  }

  // Configuration methods
  private async configureWebsiteHosting(bucketName: string, indexDocument: string, errorDocument: string): Promise<string> {
    const websiteCommand = new PutBucketWebsiteCommand({
      Bucket: bucketName,
      WebsiteConfiguration: {
        IndexDocument: { Suffix: indexDocument },
        ErrorDocument: { Key: errorDocument }
      }
    });

    await this.client.send(websiteCommand);
    
    // Return the website URL
    const bucketLocation = await this.getBucketLocation(bucketName);
    const region = bucketLocation || 'us-east-1';
    return `http://${bucketName}.s3-website-${region}.amazonaws.com`;
  }

  private async configureCors(bucketName: string, corsConfig: CorsConfiguration): Promise<void> {
    const corsCommand = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: corsConfig.allowedOrigins,
            AllowedMethods: corsConfig.allowedMethods,
            AllowedHeaders: corsConfig.allowedHeaders || ['*'],
            MaxAgeSeconds: corsConfig.maxAgeSeconds || 3000
          }
        ]
      }
    });

    await this.client.send(corsCommand);
  }

  private async configurePublicAccess(bucketName: string, blockPublicAccess: boolean): Promise<void> {
    const publicAccessCommand = new PutPublicAccessBlockCommand({
      Bucket: bucketName,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: blockPublicAccess,
        IgnorePublicAcls: blockPublicAccess,
        BlockPublicPolicy: blockPublicAccess,
        RestrictPublicBuckets: blockPublicAccess
      }
    });

    await this.client.send(publicAccessCommand);
  }

  private async configurePublicReadPolicy(bucketName: string): Promise<void> {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${bucketName}/*`
        }
      ]
    };

    const policyCommand = new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: JSON.stringify(policy)
    });

    await this.client.send(policyCommand);
  }

  // Helper methods
  private async getBucketIfExists(bucketName: string): Promise<{ region: string } | null> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucketName }));
      const location = await this.getBucketLocation(bucketName);
      return { region: location || 'us-east-1' };
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  private async getBucketLocation(bucketName: string): Promise<string | undefined> {
    try {
      const locationCommand = new GetBucketLocationCommand({ Bucket: bucketName });
      const result = await this.client.send(locationCommand);
      return result.LocationConstraint || 'us-east-1';
    } catch (error) {
      return undefined;
    }
  }

  private getFilesRecursively(dir: string): string[] {
    const files: string[] = [];
    const items = readdirSync(dir);

    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...this.getFilesRecursively(fullPath));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  private getContentType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    const contentTypes: { [key: string]: string } = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'txt': 'text/plain',
      'pdf': 'application/pdf'
    };

    return contentTypes[ext || ''] || 'application/octet-stream';
  }
}