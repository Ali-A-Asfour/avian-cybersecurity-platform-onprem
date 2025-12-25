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
      const startTime = Date.now();
      await dynamoCache.set(key, value, options);
      const duration = Date.now() - startTime;

      monitoring.recordMetric('cache_operation_duration_ms', duration, { operation: 'set' });
      monitoring.recordMetric('cache_set', 1, { key });
      
      logger.debug('Cache set', { key, ttl: options.ttl });
    } catch (error) {
      logger.error('Cache set error', { key, error });
      monitoring.recordMetric('cache_error', 1, { operation: 'set', key });
    } finally {
      monitoring.endSpan(span.spanId);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    const span = monitoring.startSpan('cache.delete');
    monitoring.tagSpan(span.spanId, { key });

    try {
      const startTime = Date.now();
      await dynamoCache.delete(key);
      const duration = Date.now() - startTime;

      monitoring.recordMetric('cache_operation_duration_ms', duration, { operation: 'delete' });
      monitoring.recordMetric('cache_delete', 1, { key });
      
      logger.debug('Cache delete', { key });
    } catch (error) {
      logger.error('Cache delete error', { key, error });
      monitoring.recordMetric('cache_error', 1, { operation: 'delete', key });
    } finally {
      monitoring.endSpan(span.spanId);
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    return await dynamoCache.has(key);
  }

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    return await dynamoCache.mget<T>(keys);
  }

  /**
   * Set multiple values in cache
   */
  async mset<T>(entries: Array<{ key: string; value: T; options?: CacheOptions }>): Promise<void> {
    await dynamoCache.mset(entries);
  }

  /**
   * Delete multiple values from cache
   */
  async mdel(keys: string[]): Promise<void> {
    await dynamoCache.mdel(keys);
  }

  /**
   * Increment a numeric value in cache
   */
  async incr(key: string, increment: number = 1): Promise<number> {
    return await dynamoCache.incr(key, increment);
  }

  /**
   * Set value with expiration time
   */
  async setex<T>(key: string, seconds: number, value: T): Promise<void> {
    await dynamoCache.setex(key, seconds, value);
  }

  /**
   * Get and delete value (atomic operation simulation)
   */
  async getdel<T>(key: string): Promise<T | null> {
    return await dynamoCache.getdel<T>(key);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return dynamoCache.getStats();
  }

  /**
   * Clear cache statistics
   */
  clearStats(): void {
    dynamoCache.clearStats();
  }

  /**
   * Flush all cache entries
   */
  async flush(): Promise<void> {
    await dynamoCache.flush();
  }
}

// Export singleton instance
export const cache = new CacheService();
export default cache;
