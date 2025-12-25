import 'server-only';

/**
 * AWS S3 Service
 * 
 * Provides S3 integration for the CDK-created buckets
 * Handles both firewall configurations and reports storage
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import { getS3Client } from './client-factory';

// Use optimized client from factory
const s3Client = getS3Client();

const FIREWALL_CONFIG_BUCKET = process.env.S3_FIREWALL_CONFIG_BUCKET;
const REPORTS_BUCKET = process.env.S3_REPORTS_BUCKET;

export interface S3UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  storageClass?: 'STANDARD' | 'STANDARD_IA' | 'GLACIER';
}

export interface S3Object {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
}

export class S3Service {
  /**
   * Upload file to firewall config bucket
   */
  static async uploadFirewallConfig(
    key: string,
    data: Buffer | string,
    options: S3UploadOptions = {}
  ): Promise<string> {
    if (!FIREWALL_CONFIG_BUCKET) {
      throw new Error('Firewall config bucket not configured');
    }

    return await this.uploadFile(FIREWALL_CONFIG_BUCKET, key, data, {
      contentType: 'application/json',
      ...options,
    });
  }

  /**
   * Upload file to reports bucket
   */
  static async uploadReport(
    key: string,
    data: Buffer | string,
    options: S3UploadOptions = {}
  ): Promise<string> {
    if (!REPORTS_BUCKET) {
      throw new Error('Reports bucket not configured');
    }

    return await this.uploadFile(REPORTS_BUCKET, key, data, {
      contentType: 'application/pdf',
      storageClass: 'STANDARD_IA',
      ...options,
    });
  }

  /**
   * Generic file upload
   */
  private static async uploadFile(
    bucket: string,
    key: string,
    data: Buffer | string,
    options: S3UploadOptions = {}
  ): Promise<string> {
    const body = typeof data === 'string' ? Buffer.from(data) : data;
    const checksum = crypto.createHash('sha256').update(body).digest('hex');

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: options.contentType || 'application/octet-stream',
      ContentLength: body.length,
      Metadata: {
        checksum,
        'uploaded-at': new Date().toISOString(),
        ...options.metadata,
      },
      StorageClass: options.storageClass || 'STANDARD',
      // Encryption handled by bucket default encryption policy
    });

    await s3Client.send(command);
    return key;
  }

  /**
   * Download file from firewall config bucket
   */
  static async downloadFirewallConfig(key: string): Promise<Buffer> {
    if (!FIREWALL_CONFIG_BUCKET) {
      throw new Error('Firewall config bucket not configured');
    }

    return await this.downloadFile(FIREWALL_CONFIG_BUCKET, key);
  }

  /**
   * Download file from reports bucket
   */
  static async downloadReport(key: string): Promise<Buffer> {
    if (!REPORTS_BUCKET) {
      throw new Error('Reports bucket not configured');
    }

    return await this.downloadFile(REPORTS_BUCKET, key);
  }

  /**
   * Generic file download
   */
  private static async downloadFile(bucket: string, key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('File not found or empty');
    }

    const chunks: Uint8Array[] = [];
    const reader = response.Body.transformToWebStream().getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    return Buffer.concat(chunks);
  }

  /**
   * Delete file from firewall config bucket
   */
  static async deleteFirewallConfig(key: string): Promise<void> {
    if (!FIREWALL_CONFIG_BUCKET) {
      throw new Error('Firewall config bucket not configured');
    }

    await this.deleteFile(FIREWALL_CONFIG_BUCKET, key);
  }

  /**
   * Delete file from reports bucket
   */
  static async deleteReport(key: string): Promise<void> {
    if (!REPORTS_BUCKET) {
      throw new Error('Reports bucket not configured');
    }

    await this.deleteFile(REPORTS_BUCKET, key);
  }

  /**
   * Generic file deletion
   */
  private static async deleteFile(bucket: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await s3Client.send(command);
  }

  /**
   * List files in firewall config bucket
   */
  static async listFirewallConfigs(prefix?: string): Promise<S3Object[]> {
    if (!FIREWALL_CONFIG_BUCKET) {
      throw new Error('Firewall config bucket not configured');
    }

    return await this.listFiles(FIREWALL_CONFIG_BUCKET, prefix);
  }

  /**
   * List files in reports bucket
   */
  static async listReports(prefix?: string): Promise<S3Object[]> {
    if (!REPORTS_BUCKET) {
      throw new Error('Reports bucket not configured');
    }

    return await this.listFiles(REPORTS_BUCKET, prefix);
  }

  /**
   * Generic file listing
   */
  private static async listFiles(bucket: string, prefix?: string): Promise<S3Object[]> {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    });

    const response = await s3Client.send(command);
    
    return (response.Contents || []).map(obj => ({
      key: obj.Key!,
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
      etag: obj.ETag || '',
    }));
  }

  /**
   * Generate presigned URL for firewall config download
   */
  static async getFirewallConfigDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!FIREWALL_CONFIG_BUCKET) {
      throw new Error('Firewall config bucket not configured');
    }

    return await this.getDownloadUrl(FIREWALL_CONFIG_BUCKET, key, expiresIn);
  }

  /**
   * Generate presigned URL for report download
   */
  static async getReportDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!REPORTS_BUCKET) {
      throw new Error('Reports bucket not configured');
    }

    return await this.getDownloadUrl(REPORTS_BUCKET, key, expiresIn);
  }

  /**
   * Generic presigned URL generation
   */
  private static async getDownloadUrl(bucket: string, key: string, expiresIn: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  }

  /**
   * Check if file exists
   */
  static async fileExists(bucket: string, key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get bucket names for reference
   */
  static getBucketNames(): { firewallConfig: string | undefined; reports: string | undefined } {
    return {
      firewallConfig: FIREWALL_CONFIG_BUCKET,
      reports: REPORTS_BUCKET,
    };
  }
}

// Legacy compatibility - export the reports bucket as AWS_S3_BUCKET
export const getReportsBucket = (): string => {
  if (!REPORTS_BUCKET) {
    throw new Error('Reports bucket not configured');
  }
  return REPORTS_BUCKET;
};
