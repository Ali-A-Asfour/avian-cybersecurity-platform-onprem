import { cache as dynamoCache } from './aws/dynamodb-cache';
import { logger } from './logger';
import { monitoring } from './monitoring';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
  compress?: boolean; // Enable compression for large values
  serialize?: boolean; // Enable JSON serialization
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
}

class CacheService {
  private static readonly DEFAULT_TTL = 3600; // 1 hour

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const span = monitoring.startSpan('cache.get');
    monitoring.tagSpan(span.spanId, { key });

    try {
      const startTime = Date.now();
      const value = await dynamoCache.get<T>(key);
      const duration = Date.now() - startTime;

      monitoring.recordMetric('cache_operation_duration_ms', duration, { operation: 'get' });

      if (value !== null) {
        logger.debug('Cache hit', { key });
        monitoring.recordMetric('cache_hit', 1, { key });
      } else {
        logger.debug('Cache miss', { key });
        monitoring.recordMetric('cache_miss', 1, { key });
      }

      return value;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      monitoring.recordMetric('cache_error', 1, { operation: 'get', key });
      return null;
    } finally {
      monitoring.endSpan(span.spanId);
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const span = monitoring.startSpan('cache.set');
    monitoring.tagSpan(span.spanId, { key });

    try {
      const client = await connectRedis();
      const cacheKey = this.getCacheKey(key);
      const ttl = options.ttl || CacheService.DEFAULT_TTL;

      let serializedValue: string;
      if (options.serialize !== false && typeof value === 'object') {
        serializedValue = JSON.stringify(value);
      } else {
        serializedValue = String(value);
      }

      const startTime = Date.now();
      await client.setEx(cacheKey, ttl, serializedValue);
      const duration = Date.now() - startTime;

      monitoring.recordMetric('cache_operation_duration_ms', duration, { operation: 'set' });

      // Store cache tags for invalidation
      if (options.tags && options.tags.length > 0) {
        await this.addCacheTags(key, options.tags, ttl);
      }

      this.stats.sets++;
      monitoring.recordMetric('cache_sets_total', 1, { key });

      logger.debug('Cache set', { key, ttl, duration, tags: options.tags });
      monitoring.finishSpan(span.spanId);
    } catch {
      monitoring.tagSpan(span.spanId, { error: error instanceof Error ? error.message : 'unknown' });
      logger.error('Cache set error', error instanceof Error ? error : undefined, { key });
      monitoring.finishSpan(span.spanId);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    const span = monitoring.startSpan('cache.delete');
    monitoring.tagSpan(span.spanId, { key });

    try {
      const client = await connectRedis();
      const cacheKey = this.getCacheKey(key);

      const startTime = Date.now();
      await client.del(cacheKey);
      const duration = Date.now() - startTime;

      monitoring.recordMetric('cache_operation_duration_ms', duration, { operation: 'delete' });

      this.stats.deletes++;
      monitoring.recordMetric('cache_deletes_total', 1, { key });

      logger.debug('Cache delete', { key, duration });
      monitoring.finishSpan(span.spanId);
    } catch {
      monitoring.tagSpan(span.spanId, { error: error instanceof Error ? error.message : 'unknown' });
      logger.error('Cache delete error', error instanceof Error ? error : undefined, { key });
      monitoring.finishSpan(span.spanId);
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = await connectRedis();
      const cacheKey = this.getCacheKey(key);
      const exists = await client.exists(cacheKey);
      return exists === 1;
    } catch {
      logger.error('Cache exists error', error instanceof Error ? error : undefined, { key });
      return false;
    }
  }

  /**
   * Get or set pattern - get from cache, or compute and cache if not found
   */
  async getOrSet<T>(
    key: string,
    computeFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const span = monitoring.startSpan('cache.getOrSet');
    monitoring.tagSpan(span.spanId, { key });

    try {
      // Try to get from cache first
      const cached = await this.get<T>(key);
      if (cached !== null) {
        monitoring.tagSpan(span.spanId, { fromCache: true });
        monitoring.finishSpan(span.spanId);
        return cached;
      }

      // Compute value
      const startTime = Date.now();
      const value = await computeFn();
      const computeDuration = Date.now() - startTime;

      monitoring.recordMetric('cache_compute_duration_ms', computeDuration, { key });
      monitoring.tagSpan(span.spanId, { fromCache: false, computeDuration });

      // Store in cache
      await this.set(key, value, options);

      logger.debug('Cache computed and stored', { key, computeDuration });
      monitoring.finishSpan(span.spanId);
      return value;
    } catch {
      monitoring.tagSpan(span.spanId, { error: error instanceof Error ? error.message : 'unknown' });
      logger.error('Cache getOrSet error', error instanceof Error ? error : undefined, { key });
      monitoring.finishSpan(span.spanId);
      throw error;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    const span = monitoring.startSpan('cache.invalidateByTags');
    monitoring.tagSpan(span.spanId, { tags });

    try {
      const client = await connectRedis();
      const keysToDelete: string[] = [];

      for (const tag of tags) {
        const tagKey = this.getTagKey(tag);
        const keys = await client.sMembers(tagKey);
        keysToDelete.push(...keys.map(key => this.getCacheKey(key)));

        // Delete the tag set
        await client.del(tagKey);
      }

      if (keysToDelete.length > 0) {
        await client.del(keysToDelete);
        monitoring.recordMetric('cache_invalidated_keys_total', keysToDelete.length, { tags: tags.join(',') });
      }

      logger.info('Cache invalidated by tags', { tags, keysDeleted: keysToDelete.length });
      monitoring.finishSpan(span.spanId);
    } catch {
      monitoring.tagSpan(span.spanId, { error: error instanceof Error ? error.message : 'unknown' });
      logger.error('Cache invalidation error', error instanceof Error ? error : undefined, { tags });
      monitoring.finishSpan(span.spanId);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      const client = await connectRedis();
      const keys = await client.keys(`${CacheService.CACHE_PREFIX}*`);

      if (keys.length > 0) {
        await client.del(keys);
        monitoring.recordMetric('cache_cleared_keys_total', keys.length);
      }

      logger.info('Cache cleared', { keysDeleted: keys.length });
    } catch {
      logger.error('Cache clear error', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
    };
  }

  /**
   * Get cache info (keys, memory usage, etc.)
   */
  async getInfo(): Promise<{
    keyCount: number;
    memoryUsage: string;
    stats: CacheStats;
  }> {
    try {
      const client = await connectRedis();
      const keys = await client.keys(`${CacheService.CACHE_PREFIX}*`);
      const info = await client.info('memory');

      // Parse memory usage from Redis info
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'Unknown';

      return {
        keyCount: keys.length,
        memoryUsage,
        stats: this.getStats(),
      };
    } catch {
      logger.error('Cache info error', error instanceof Error ? error : undefined);
      return {
        keyCount: 0,
        memoryUsage: 'Unknown',
        stats: this.getStats(),
      };
    }
  }

  /**
   * Warm up cache with predefined data
   */
  async warmUp(warmUpData: Array<{ key: string; value: any; options?: CacheOptions }>): Promise<void> {
    logger.info('Starting cache warm-up', { itemCount: warmUpData.length });

    const promises = warmUpData.map(({ key, value, options }) =>
      this.set(key, value, options).catch(error =>
        logger.error('Cache warm-up error', error instanceof Error ? error : undefined, { key })
      )
    );

    await Promise.all(promises);
    logger.info('Cache warm-up completed');
  }

  private getCacheKey(key: string): string {
    return `${CacheService.CACHE_PREFIX}${key}`;
  }

  private getTagKey(tag: string): string {
    return `${CacheService.TAG_PREFIX}${tag}`;
  }

  private async addCacheTags(key: string, tags: string[], ttl: number): Promise<void> {
    try {
      const client = await connectRedis();

      for (const tag of tags) {
        const tagKey = this.getTagKey(tag);
        await client.sAdd(tagKey, key);
        await client.expire(tagKey, ttl);
      }
    } catch {
      logger.error('Cache tag error', error instanceof Error ? error : undefined, { key, tags });
    }
  }
}

// Singleton instance
export const cache = new CacheService();

/**
 * Cache decorator for methods
 */
export function cached(keyPrefix: string, options: CacheOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${keyPrefix}:${JSON.stringify(args)}`;

      return cache.getOrSet(
        cacheKey,
        () => originalMethod.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}

/**
 * Tenant-specific cache utilities
 */
export class TenantCache {
  constructor(private tenantId: string) { }

  async get<T>(key: string): Promise<T | null> {
    return cache.get(`tenant:${this.tenantId}:${key}`);
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const tenantOptions = {
      ...options,
      tags: [...(options.tags || []), `tenant:${this.tenantId}`],
    };
    return cache.set(`tenant:${this.tenantId}:${key}`, value, tenantOptions);
  }

  async delete(key: string): Promise<void> {
    return cache.delete(`tenant:${this.tenantId}:${key}`);
  }

  async invalidateAll(): Promise<void> {
    return cache.invalidateByTags([`tenant:${this.tenantId}`]);
  }
}

/**
 * Common cache patterns
 */
export class CachePatterns {
  /**
   * Cache dashboard data
   */
  static async cacheDashboardData(tenantId: string, data: any): Promise<void> {
    await cache.set(`dashboard:${tenantId}`, data, {
      ttl: 300, // 5 minutes
      tags: [`tenant:${tenantId}`, 'dashboard'],
    });
  }

  /**
   * Cache user session data
   */
  static async cacheUserSession(userId: string, sessionData: any): Promise<void> {
    await cache.set(`session:${userId}`, sessionData, {
      ttl: 3600, // 1 hour
      tags: [`user:${userId}`, 'session'],
    });
  }

  /**
   * Cache API responses
   */
  static async cacheApiResponse(endpoint: string, params: any, response: any): Promise<void> {
    const key = `api:${endpoint}:${JSON.stringify(params)}`;
    await cache.set(key, response, {
      ttl: 600, // 10 minutes
      tags: ['api', endpoint],
    });
  }

  /**
   * Cache database query results
   */
  static async cacheQueryResult(query: string, params: any, result: any): Promise<void> {
    const key = `query:${Buffer.from(query).toString('base64')}:${JSON.stringify(params)}`;
    await cache.set(key, result, {
      ttl: 1800, // 30 minutes
      tags: ['database', 'query'],
    });
  }
}