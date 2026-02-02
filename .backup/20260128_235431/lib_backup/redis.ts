/**
 * Redis Connection Manager
 * 
 * Provides centralized Redis connection with:
 * - Connection pooling
 * - Automatic retry logic with exponential backoff
 * - TLS support for production
 * - Health checking
 * 
 * Requirements: 2.1, 2.6, 2.7
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';
import { config } from './config';

let redisClient: RedisClientType | null = null;
let isConnecting = false;

/**
 * Redis connection options
 */
interface RedisConnectionOptions {
  maxRetries?: number;
  retryDelay?: number;
  connectTimeout?: number;
}

/**
 * Initialize Redis connection with retry logic
 */
export async function connectRedis(options: RedisConnectionOptions = {}): Promise<RedisClientType> {
  // Return existing connection if available
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    // Wait for existing connection attempt
    while (isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (redisClient && redisClient.isOpen) {
      return redisClient;
    }
  }

  isConnecting = true;

  try {
    const {
      maxRetries = 10,
      retryDelay = 1000,
      connectTimeout = 10000,
    } = options;

    logger.info('Initializing Redis connection', {
      url: config.redis.url.replace(/:([^:@]+)@/, ':****@'), // Mask password in logs
      maxRetries,
      connectTimeout,
    });

    // Parse Redis URL to determine if TLS is needed
    const useTLS = config.redis.url.startsWith('rediss://');

    // Create Redis client
    redisClient = createClient({
      url: config.redis.url,
      socket: {
        connectTimeout,
        reconnectStrategy: (retries) => {
          if (retries > maxRetries) {
            logger.error('Redis max retries exceeded', new Error('Max retries exceeded'), {
              retries,
              maxRetries,
            });
            return new Error('Max retries exceeded');
          }

          // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s (max)
          const delay = Math.min(retryDelay * Math.pow(2, retries), 32000);
          logger.warn('Redis connection retry', {
            retries,
            delay,
            nextRetryIn: `${delay}ms`,
          });
          return delay;
        },
        ...(useTLS && config.app.nodeEnv === 'production' ? {
          tls: true,
          rejectUnauthorized: true,
        } : {}),
      },
    });

    // Set up event handlers
    redisClient.on('error', (error) => {
      logger.error('Redis client error', error instanceof Error ? error : new Error(String(error)));
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connecting');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting');
    });

    redisClient.on('end', () => {
      logger.info('Redis client connection closed');
    });

    // Connect to Redis
    await redisClient.connect();

    logger.info('Redis connection established successfully');

    return redisClient;
  } catch (error) {
    logger.error('Failed to connect to Redis', error instanceof Error ? error : new Error(String(error)));
    redisClient = null;
    throw error;
  } finally {
    isConnecting = false;
  }
}

/**
 * Get existing Redis connection or create new one
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient || !redisClient.isOpen) {
    return await connectRedis();
  }
  return redisClient;
}

/**
 * Close Redis connection gracefully
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.quit();
      logger.info('Redis connection closed gracefully');
    } catch (error) {
      logger.error('Error closing Redis connection', error instanceof Error ? error : new Error(String(error)));
      // Force close if graceful close fails
      await redisClient.disconnect();
    } finally {
      redisClient = null;
    }
  }
}

/**
 * Check Redis connection health
 */
export async function checkRedisHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const client = await getRedisClient();
    
    // Ping Redis to check connectivity
    const pong = await client.ping();
    
    if (pong !== 'PONG') {
      return {
        healthy: false,
        error: 'Redis ping returned unexpected response',
      };
    }

    const latency = Date.now() - startTime;
    return {
      healthy: true,
      latency,
    };
  } catch (error) {
    logger.error('Redis health check failed', error instanceof Error ? error : new Error(String(error)));
    return {
      healthy: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute Redis command with automatic retry
 */
export async function executeRedisCommand<T>(
  command: (client: RedisClientType) => Promise<T>,
  retries = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const client = await getRedisClient();
      return await command(client);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn('Redis command failed, retrying', {
        attempt: attempt + 1,
        maxRetries: retries,
        error: lastError.message,
      });

      if (attempt < retries - 1) {
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  logger.error('Redis command failed after all retries', lastError!);
  throw lastError;
}

/**
 * Session Service for managing user sessions, rate limiting, and authentication state
 */
export class SessionService {
  /**
   * Store session data
   */
  static async storeSession(userId: string, sessionData: any, ttlSeconds: number = 3600): Promise<void> {
    await executeRedisCommand(async (client) => {
      const key = `session:${userId}`;
      await client.setEx(key, ttlSeconds, JSON.stringify(sessionData));
    });
  }

  /**
   * Store enhanced session with options
   */
  static async storeEnhancedSession(
    userId: string,
    sessionData: any,
    options: { extendedSession?: boolean; rememberMe?: boolean } = {}
  ): Promise<void> {
    const ttl = options.extendedSession ? 86400 : options.rememberMe ? 2592000 : 3600; // 24h, 30d, or 1h
    await this.storeSession(userId, sessionData, ttl);
  }

  /**
   * Get session data
   */
  static async getSession(userId: string): Promise<any | null> {
    return await executeRedisCommand(async (client) => {
      const key = `session:${userId}`;
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    });
  }

  /**
   * Delete session
   */
  static async deleteSession(userId: string): Promise<void> {
    await executeRedisCommand(async (client) => {
      const key = `session:${userId}`;
      await client.del(key);
    });
  }

  /**
   * Store refresh token
   */
  static async storeRefreshToken(userId: string, token: string, ttlSeconds: number = 604800): Promise<void> {
    await executeRedisCommand(async (client) => {
      const key = `refresh_token:${userId}`;
      await client.setEx(key, ttlSeconds, token);
    });
  }

  /**
   * Verify refresh token
   */
  static async verifyRefreshToken(userId: string, token: string): Promise<boolean> {
    return await executeRedisCommand(async (client) => {
      const key = `refresh_token:${userId}`;
      const storedToken = await client.get(key);
      return storedToken === token;
    });
  }

  /**
   * Delete refresh token
   */
  static async deleteRefreshToken(userId: string): Promise<void> {
    await executeRedisCommand(async (client) => {
      const key = `refresh_token:${userId}`;
      await client.del(key);
    });
  }

  /**
   * Check rate limit
   */
  static async checkRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    return await executeRedisCommand(async (client) => {
      const now = Date.now();
      const windowStart = now - windowSeconds * 1000;
      const rateLimitKey = `rate_limit:${key}`;

      // Remove old entries
      await client.zRemRangeByScore(rateLimitKey, 0, windowStart);

      // Count current requests
      const count = await client.zCard(rateLimitKey);

      if (count >= maxRequests) {
        // Get oldest entry to calculate reset time
        const oldest = await client.zRange(rateLimitKey, 0, 0, { REV: false });
        const resetTime = oldest.length > 0 ? parseInt(oldest[0]) + windowSeconds * 1000 : now + windowSeconds * 1000;

        return {
          allowed: false,
          remaining: 0,
          resetTime,
        };
      }

      // Add current request
      await client.zAdd(rateLimitKey, { score: now, value: `${now}` });
      await client.expire(rateLimitKey, windowSeconds);

      return {
        allowed: true,
        remaining: maxRequests - count - 1,
        resetTime: now + windowSeconds * 1000,
      };
    });
  }

  /**
   * Clear rate limit
   */
  static async clearRateLimit(key: string): Promise<void> {
    await executeRedisCommand(async (client) => {
      const rateLimitKey = `rate_limit:${key}`;
      await client.del(rateLimitKey);
    });
  }

  /**
   * Track failed login attempt
   */
  static async trackFailedAttempt(key: string, attemptData: any): Promise<void> {
    await executeRedisCommand(async (client) => {
      const failedKey = `failed_attempts:${key}`;
      const now = Date.now();

      // Add attempt to sorted set
      await client.zAdd(failedKey, { score: now, value: JSON.stringify({ ...attemptData, timestamp: now }) });

      // Set expiry (30 minutes)
      await client.expire(failedKey, 1800);

      // Check if account should be locked (5 failed attempts in 15 minutes)
      const fifteenMinutesAgo = now - 900000;
      const recentAttempts = await client.zCount(failedKey, fifteenMinutesAgo, now);

      if (recentAttempts >= 5) {
        // Lock account for 30 minutes
        const lockKey = `locked:${key}`;
        await client.setEx(lockKey, 1800, JSON.stringify({ lockedAt: now, attemptCount: recentAttempts }));
      }
    });
  }

  /**
   * Clear failed attempts
   */
  static async clearFailedAttempts(key: string): Promise<void> {
    await executeRedisCommand(async (client) => {
      const failedKey = `failed_attempts:${key}`;
      const lockKey = `locked:${key}`;
      await client.del(failedKey);
      await client.del(lockKey);
    });
  }

  /**
   * Check if account is locked
   */
  static async isLocked(key: string): Promise<{ isLocked: boolean; attemptCount?: number; timeRemaining?: number }> {
    return await executeRedisCommand(async (client) => {
      const lockKey = `locked:${key}`;
      const lockData = await client.get(lockKey);

      if (!lockData) {
        return { isLocked: false };
      }

      const { lockedAt, attemptCount } = JSON.parse(lockData);
      const now = Date.now();
      const timeRemaining = 1800000 - (now - lockedAt); // 30 minutes in ms

      if (timeRemaining <= 0) {
        // Lock expired, clean up
        await client.del(lockKey);
        return { isLocked: false };
      }

      return {
        isLocked: true,
        attemptCount,
        timeRemaining: Math.ceil(timeRemaining / 1000), // Convert to seconds
      };
    });
  }

  /**
   * Store MFA code
   */
  static async storeMFACode(userId: string, code: string, ttlSeconds: number = 300): Promise<void> {
    await executeRedisCommand(async (client) => {
      const key = `mfa_code:${userId}`;
      await client.setEx(key, ttlSeconds, code);
    });
  }

  /**
   * Verify MFA code
   */
  static async verifyMFACode(userId: string, code: string): Promise<boolean> {
    return await executeRedisCommand(async (client) => {
      const key = `mfa_code:${userId}`;
      const storedCode = await client.get(key);
      return storedCode === code;
    });
  }

  /**
   * Store authentication status
   */
  static async storeAuthStatus(userId: string, status: string, metadata: any = {}): Promise<void> {
    await executeRedisCommand(async (client) => {
      const key = `auth_status:${userId}`;
      const data = { status, metadata, timestamp: Date.now() };
      await client.setEx(key, 3600, JSON.stringify(data));
    });
  }

  /**
   * Get authentication status
   */
  static async getAuthStatus(userId: string): Promise<{ status: string; metadata: any; timestamp: number }> {
    return await executeRedisCommand(async (client) => {
      const key = `auth_status:${userId}`;
      const data = await client.get(key);
      return data ? JSON.parse(data) : { status: 'unknown', metadata: {}, timestamp: 0 };
    });
  }

  /**
   * Check session idle timeout
   */
  static async checkSessionIdleTimeout(userId: string): Promise<{ isValid: boolean; lastActivity?: number; idleTime?: number }> {
    return await executeRedisCommand(async (client) => {
      const key = `session_activity:${userId}`;
      const lastActivity = await client.get(key);

      if (!lastActivity) {
        return { isValid: false };
      }

      const lastActivityTime = parseInt(lastActivity);
      const now = Date.now();
      const idleTime = now - lastActivityTime;
      const maxIdleTime = 1800000; // 30 minutes in ms

      if (idleTime > maxIdleTime) {
        return {
          isValid: false,
          lastActivity: lastActivityTime,
          idleTime: Math.ceil(idleTime / 1000),
        };
      }

      return {
        isValid: true,
        lastActivity: lastActivityTime,
        idleTime: Math.ceil(idleTime / 1000),
      };
    });
  }

  /**
   * Update session activity
   */
  static async updateSessionActivity(userId: string): Promise<boolean> {
    return await executeRedisCommand(async (client) => {
      const key = `session_activity:${userId}`;
      const now = Date.now();
      await client.setEx(key, 3600, now.toString());
      return true;
    });
  }
}

// Export client type for use in other modules
export type { RedisClientType };
