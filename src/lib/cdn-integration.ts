// import { logger } from './logger';
import { monitoring } from './monitoring';

export interface CDNConfig {
  baseUrl: string;
  apiKey?: string;
  region?: string;
  cacheTTL?: number;
  enableCompression?: boolean;
  enableWebP?: boolean;
}

export interface AssetUploadOptions {
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
  compress?: boolean;
  optimize?: boolean;
}

export interface AssetInfo {
  url: string;
  size: number;
  contentType: string;
  etag: string;
  lastModified: Date;
  cacheControl?: string;
}

class CDNService {
  private config: CDNConfig;
  private uploadQueue: Array<{ file: File; options: AssetUploadOptions; resolve: Function; reject: Function }> = [];
  private isProcessingQueue = false;

  constructor(config: CDNConfig) {
    this.config = config;
  }

  /**
   * Upload file to CDN
   */
  async uploadFile(file: File, options: AssetUploadOptions = {}): Promise<AssetInfo> {
    const span = monitoring.startSpan('cdn.upload');
    monitoring.tagSpan(span.spanId, { 
      fileName: file.name, 
      fileSize: file.size,
      contentType: file.type 
    });

    try {
      // In a real implementation, this would upload to actual CDN (AWS S3, Cloudflare, etc.)
      const mockUpload = await this.simulateUpload(file, options);
      
      monitoring.recordMetric('cdn_upload_size_bytes', file.size, {
        contentType: file.type,
      });

      monitoring.recordMetric('cdn_uploads_total', 1, {
        contentType: file.type,
        success: 'true',
      });

      logger.info('File uploaded to CDN', {
        fileName: file.name,
        fileSize: file.size,
        url: mockUpload.url,
      });

      monitoring.finishSpan(span.spanId);
      return mockUpload;
    } catch (error) {
      monitoring.tagSpan(span.spanId, { 
        error: error instanceof Error ? error.message : 'unknown' 
      });

      monitoring.recordMetric('cdn_uploads_total', 1, {
        contentType: file.type,
        success: 'false',
      });

      logger.error('CDN upload failed', error instanceof Error ? error : undefined, {
        fileName: file.name,
        fileSize: file.size,
      });

      monitoring.finishSpan(span.spanId);
      throw error;
    }
  }

  /**
   * Upload multiple files with queue management
   */
  async uploadFiles(files: File[], options: AssetUploadOptions = {}): Promise<AssetInfo[]> {
    const uploadPromises = files.map(file => this.queueUpload(file, options));
    return Promise.all(uploadPromises);
  }

  /**
   * Queue file upload for batch processing
   */
  private queueUpload(file: File, options: AssetUploadOptions): Promise<AssetInfo> {
    return new Promise((resolve, reject) => {
      this.uploadQueue.push({ file, options, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process upload queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.uploadQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.uploadQueue.length > 0) {
      const batch = this.uploadQueue.splice(0, 5); // Process 5 at a time
      
      await Promise.all(
        batch.map(async ({ file, options, resolve, reject }) => {
          try {
            const _result = await this.uploadFile(file, options);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        })
      );
    }

    this.isProcessingQueue = false;
  }

  /**
   * Generate optimized image URL
   */
  generateImageUrl(
    path: string, 
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'webp' | 'jpeg' | 'png';
      fit?: 'cover' | 'contain' | 'fill';
    } = {}
  ): string {
    const params = new URLSearchParams();
    
    if (options.width) params.set('w', options.width.toString());
    if (options.height) params.set('h', options.height.toString());
    if (options.quality) params.set('q', options.quality.toString());
    if (options.format) params.set('f', options.format);
    if (options.fit) params.set('fit', options.fit);

    const queryString = params.toString();
    const separator = path.includes('?') ? '&' : '?';
    
    return `${this.config.baseUrl}/${path}${queryString ? separator + queryString : ''}`;
  }

  /**
   * Generate responsive image srcSet
   */
  generateResponsiveSrcSet(
    path: string,
    sizes: number[] = [320, 640, 768, 1024, 1280, 1920],
    options: { quality?: number; format?: 'webp' | 'jpeg' | 'png' } = {}
  ): string {
    return sizes
      .map(size => {
        const url = this.generateImageUrl(path, { ...options, width: size });
        return `${url} ${size}w`;
      })
      .join(', ');
  }

  /**
   * Preload critical assets
   */
  preloadAssets(assets: Array<{ url: string; type: 'image' | 'script' | 'style' }>): void {
    assets.forEach(asset => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = asset.url;
      
      switch (asset.type) {
        case 'image':
          link.as = 'image';
          break;
        case 'script':
          link.as = 'script';
          break;
        case 'style':
          link.as = 'style';
          break;
      }
      
      document.head.appendChild(link);
    });

    logger.info('Assets preloaded', { count: assets.length });
  }

  /**
   * Purge CDN cache
   */
  async purgeCache(paths: string[]): Promise<void> {
    const span = monitoring.startSpan('cdn.purge');
    monitoring.tagSpan(span.spanId, { pathCount: paths.length });

    try {
      // In a real implementation, this would call CDN purge API
      await this.simulatePurge(paths);
      
      monitoring.recordMetric('cdn_purge_requests_total', 1, {
        pathCount: paths.length.toString(),
      });

      logger.info('CDN cache purged', { paths });
      monitoring.finishSpan(span.spanId);
    } catch (error) {
      monitoring.tagSpan(span.spanId, { 
        error: error instanceof Error ? error.message : 'unknown' 
      });

      logger.error('CDN cache purge failed', error instanceof Error ? error : undefined, { paths });
      monitoring.finishSpan(span.spanId);
      throw error;
    }
  }

  /**
   * Get CDN analytics
   */
  async getAnalytics(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<{
    bandwidth: number;
    requests: number;
    cacheHitRate: number;
    topAssets: Array<{ path: string; requests: number; bandwidth: number }>;
  }> {
    // In a real implementation, this would fetch from CDN analytics API
    return {
      bandwidth: Math.floor(Math.random() * 1000000000), // Random GB
      requests: Math.floor(Math.random() * 1000000), // Random requests
      cacheHitRate: 0.85 + Math.random() * 0.1, // 85-95%
      topAssets: [
        { path: '/images/logo.png', requests: 50000, bandwidth: 25000000 },
        { path: '/js/main.js', requests: 45000, bandwidth: 90000000 },
        { path: '/css/styles.css', requests: 45000, bandwidth: 15000000 },
      ],
    };
  }

  /**
   * Simulate file upload (mock implementation)
   */
  private async simulateUpload(file: File, options: AssetUploadOptions): Promise<AssetInfo> {
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 500));
    
    const fileExtension = file.name.split('.').pop() || '';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
    
    return {
      url: `${this.config.baseUrl}/uploads/${fileName}`,
      size: file.size,
      contentType: file.type,
      etag: `"${Math.random().toString(36).substring(7)}"`,
      lastModified: new Date(),
      cacheControl: options.cacheControl || 'public, max-age=31536000',
    };
  }

  /**
   * Simulate cache purge (mock implementation)
   */
  private async simulatePurge(paths: string[]): Promise<void> {
    // Simulate purge delay
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
  }
}

/**
 * Asset optimization utilities
 */
export class AssetOptimizer {
  /**
   * Compress image file
   */
  static async compressImage(
    file: File, 
    options: { quality?: number; maxWidth?: number; maxHeight?: number } = {}
  ): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        const { maxWidth = 1920, maxHeight = 1080, quality = 0.8 } = options;
        
        // Calculate new dimensions
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Image compression failed'));
            }
          },
          file.type,
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Generate WebP version of image
   */
  static async convertToWebP(file: File, quality: number = 0.8): Promise<File> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx?.drawImage(img, 0, 0);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const webpFile = new File(
                [blob], 
                file.name.replace(/\.[^/.]+$/, '.webp'),
                { type: 'image/webp', lastModified: Date.now() }
              );
              resolve(webpFile);
            } else {
              reject(new Error('WebP conversion failed'));
            }
          },
          'image/webp',
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Calculate optimal image dimensions for responsive design
   */
  static calculateResponsiveSizes(
    originalWidth: number,
    originalHeight: number,
    breakpoints: number[] = [320, 640, 768, 1024, 1280, 1920]
  ): Array<{ width: number; height: number; breakpoint: number }> {
    const aspectRatio = originalHeight / originalWidth;
    
    return breakpoints.map(breakpoint => ({
      width: Math.min(breakpoint, originalWidth),
      height: Math.round(Math.min(breakpoint, originalWidth) * aspectRatio),
      breakpoint,
    }));
  }
}

/**
 * CDN configuration for different environments
 */
export const CDNConfigs = {
  development: {
    baseUrl: 'http://localhost:3000/static',
    cacheTTL: 300, // 5 minutes
    enableCompression: false,
    enableWebP: false,
  },
  staging: {
    baseUrl: 'https://staging-cdn.avian.com',
    cacheTTL: 3600, // 1 hour
    enableCompression: true,
    enableWebP: true,
  },
  production: {
    baseUrl: 'https://cdn.avian.com',
    cacheTTL: 86400, // 24 hours
    enableCompression: true,
    enableWebP: true,
  },
};

// Create CDN service instance
const environment = (process.env.NODE_ENV as keyof typeof CDNConfigs) || 'development';
export const cdn = new CDNService(CDNConfigs[environment]);

/**
 * React hook for CDN asset management
 */
export const useCDNAsset = (path: string, options: Parameters<CDNService['generateImageUrl']>[1] = {}) => {
  const [url, setUrl] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  
  React.useEffect(() => {
    try {
      const assetUrl = cdn.generateImageUrl(path, options);
      setUrl(assetUrl);
      setLoading(false);
    } catch (error) {
      setError(err instanceof Error ? err : new Error('Failed to generate asset URL'));
      setLoading(false);
    }
  }, [path, JSON.stringify(options)]);
  
  return { url, loading, error };
};

// Re-export React for convenience
import * as React from 'react';
export { React };