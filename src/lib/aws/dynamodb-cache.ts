/**
 * DynamoDB Cache Service
 * 
 * Replaces Redis-based caching with DynamoDB integration
 * Uses the sessions table with a different partition key pattern for cache entries
 */

import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  DeleteItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { logger } from '../logger';

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const SESSIONS_TABLE = process.env.DYNAMODB_SESSIONS_TABLE || 'avian-sessions-dev';

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

interface CacheItem {
  sessionId: string; // Using sessionId as partition key with cache: prefix
  userId?: string; // For GSI compatibility
  data: any;
  expiresAt: number; // Unix timestamp for TTL
  tags?: string[];
  createdAt: string;
}

class DynamoCacheService {
  private static readonly DEFAULT_TTL = 3600; // 1 hour
  private static readonly CACHE_PREFIX = 'cache:';
  private static readonly TAG_PREFIX = 'tag:';

  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
  };

  /**
   * Get cache key with prefix
   */
  private getCacheKey(key: string): string {
    return `${this.CACHE_PREFIX}${key}`;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = this.getCacheKey(key);
      
      const command = new GetItemCommand({
        TableName: SESSIONS_TABLE,
        Key: marshall({ sessionId: cacheKey }),
      });

      const response = await dynamoClient.send(command);
      
      if (!response.Item) {
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      const cacheItem = unmarshall(response.Item) as CacheItem;
      
      // Check if cache item is expired
      if (cacheItem.expiresAt < Math.floor(Date.now() / 1000)) {
        await this.delete(key);
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();
      
      return cacheItem.data as T;
    } catch (error) {
      logger.error('Cache get failed:', { key, error });
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(key);
      const ttl = options.ttl || this.DEFAULT_TTL;
      const expiresAt = Math.floor(Date.now() / 1000) + ttl;

      const cacheItem: CacheItem = {
        sessionId: cacheKey,
        userId: 'cache', // For GSI compatibility
        data: value,
        expiresAt,
        tags: options.tags,
        createdAt: new Date().toISOString(),
      };

      const command = new PutItemCommand({
        TableName: SESSIONS_TABLE,
        Item: marshall(cacheItem),
      });

      await dynamoClient.send(command);
      this.stats.sets++;
    } catch (error) {
      logger.error('Cache set failed:', { key, error });
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(key);
      
      const command = new DeleteItemCommand({
        TableName: SESSIONS_TABLE,
        Key: marshall({ sessionId: cacheKey }),
      });

      await dynamoClient.send(command);
      this.stats.deletes++;
    } catch (error) {
      logger.error('Cache delete failed:', { key, error });
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const results: (T | null)[] = [];
    
    for (const key of keys) {
      const value = await this.get<T>(key);
      results.push(value);
    }
    
    return results;
  }

  /**
   * Set multiple values in cache
   */
  async mset<T>(entries: Array<{ key: string; value: T; options?: CacheOptions }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.options);
    }
  }

  /**
   * Delete multiple values from cache
   */
  async mdel(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.delete(key);
    }
  }

  /**
   * Increment a numeric value in cache
   */
  async incr(key: string, increment: number = 1): Promise<number> {
    try {
      const cacheKey = this.getCacheKey(key);
      const currentValue = await this.get<number>(key) || 0;
      const newValue = currentValue + increment;
      
      await this.set(key, newValue);
      return newValue;
    } catch (error) {
      logger.error('Cache incr failed:', { key, error });
      return 0;
    }
  }

  /**
   * Set value with expiration time
   */
  async setex<T>(key: string, seconds: number, value: T): Promise<void> {
    await this.set(key, value, { ttl: seconds });
  }

  /**
   * Get and delete value (atomic operation simulation)
   */
  async getdel<T>(key: string): Promise<T | null> {
    const value = await this.get<T>(key);
    if (value !== null) {
      await this.delete(key);
    }
    return value;
  }

  /**
   * Update cache statistics
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clear cache statistics
   */
  clearStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
    };
  }

  /**
   * Flush all cache entries (use with caution)
   * Note: This is a simplified implementation that doesn't actually clear all cache entries
   * In a production environment, you might want to implement a more sophisticated approach
   */
  async flush(): Promise<void> {
    logger.warn('Cache flush requested - this is a no-op in DynamoDB implementation');
    // In DynamoDB, we can't easily flush all cache entries without scanning the entire table
    // This would be expensive and is not recommended
    // Instead, rely on TTL to expire cache entries naturally
  }

  /**
   * Get cache key pattern for debugging
   */
  getCacheKeyPattern(): string {
    return `${this.CACHE_PREFIX}*`;
  }
}

// Export singleton instance
export const cache = new DynamoCacheService();
export default cache;
