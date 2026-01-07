/**
 * Rate Limiter
 * 
 * Implements rate limiting using Redis with:
 * - Sliding window algorithm
 * - Multiple rate limit policies (login, API, registration, password reset)
 * - Exponential backoff for repeated violations
 * - Distributed rate limiting across multiple instances
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

import { getRedisClient } from './redis';
import { logger } from './logger';

/**
 * Rate limit policy configuration
 */
export interface RateLimitPolicy {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests allowed in window
  blockDurationMs?: number; // How long to block after exceeding limit
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds until retry allowed
}

/**
 * Rate limit policies
 */
export const RateLimitPolicies = {
  LOGIN: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    blockDurationMs: 30 * 60 * 1000, // 30 minutes
  },
  API: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 100,
  },
  REGISTRATION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    blockDurationMs: 60 * 60 * 1000, // 1 hour
  },
  PASSWORD_RESET: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    blockDurationMs: 60 * 60 * 1000, // 1 hour
  },
  EMAIL_VERIFICATION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
  },
} as const;

export class RateLimiter {
  private static readonly RATE_LIMIT_PREFIX = 'ratelimit:';
  private static readonly BLOCK_PREFIX = 'ratelimit:block:';
  private static readonly VIOLATION_PREFIX = 'ratelimit:violations:';

  /**
   * Check if request is allowed under rate limit
   * Requirements: 8.1, 8.2, 8.3
   */
  static async checkRateLimit(
    identifier: string,
    policy: RateLimitPolicy,
    policyName: string = 'default'
  ): Promise<RateLimitResult> {
    try {
      const client = await getRedisClient();
      const now = Date.now();
      const windowStart = now - policy.windowMs;

      // Check if identifier is currently blocked
      const blockKey = this.getBlockKey(identifier, policyName);
      const blockExpiry = await client.get(blockKey);
      
      if (blockExpiry) {
        const retryAfter = Math.ceil((parseInt(blockExpiry) - now) / 1000);
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(parseInt(blockExpiry)),
          retryAfter: Math.max(0, retryAfter),
        };
      }

      // Use sorted set for sliding window
      const key = this.getRateLimitKey(identifier, policyName);

      // Remove old entries outside the window
      await client.zRemRangeByScore(key, 0, windowStart);

      // Count requests in current window
      const requestCount = await client.zCard(key);

      // Check if limit exceeded
      if (requestCount >= policy.maxRequests) {
        // Log violation
        await this.logViolation(identifier, policyName);

        // Check for repeated violations and apply exponential backoff
        const violations = await this.getViolationCount(identifier, policyName);
        const blockDuration = this.calculateBlockDuration(policy, violations);

        if (blockDuration > 0) {
          const blockUntil = now + blockDuration;
          await client.setEx(
            blockKey,
            Math.ceil(blockDuration / 1000),
            blockUntil.toString()
          );

          logger.warn('Rate limit exceeded, user blocked', {
            identifier,
            policyName,
            violations,
            blockDurationMs: blockDuration,
          });
        }

        const resetAt = new Date(now + policy.windowMs);
        // If no block duration, retryAfter is time until window resets
        const retryAfter = blockDuration > 0 
          ? Math.ceil(blockDuration / 1000)
          : Math.ceil(policy.windowMs / 1000);
        
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfter,
        };
      }

      // Add current request to window
      await client.zAdd(key, {
        score: now,
        value: `${now}-${Math.random()}`, // Unique value for each request
      });

      // Set expiration on the key
      await client.expire(key, Math.ceil(policy.windowMs / 1000));

      const remaining = policy.maxRequests - requestCount - 1;
      const resetAt = new Date(now + policy.windowMs);

      return {
        allowed: true,
        remaining,
        resetAt,
      };
    } catch (error) {
      logger.error('Rate limit check failed', error instanceof Error ? error : new Error(String(error)), {
        identifier,
        policyName,
      });
      
      // Fail open - allow request if rate limiting fails
      return {
        allowed: true,
        remaining: 0,
        resetAt: new Date(Date.now() + policy.windowMs),
      };
    }
  }

  /**
   * Calculate block duration with exponential backoff
   * Requirements: 8.6
   */
  private static calculateBlockDuration(
    policy: RateLimitPolicy,
    violations: number
  ): number {
    if (!policy.blockDurationMs || violations === 0) {
      return 0;
    }

    // Exponential backoff: base * 2^(violations-1)
    // First violation: 1x, second: 2x, third: 4x, etc.
    const multiplier = Math.pow(2, violations - 1);
    const duration = policy.blockDurationMs * multiplier;

    // Cap at 24 hours
    return Math.min(duration, 24 * 60 * 60 * 1000);
  }

  /**
   * Log rate limit violation
   * Requirements: 8.7
   */
  private static async logViolation(
    identifier: string,
    policyName: string
  ): Promise<void> {
    try {
      const client = await getRedisClient();
      const violationKey = this.getViolationKey(identifier, policyName);
      const now = Date.now();

      // Add violation timestamp
      await client.zAdd(violationKey, {
        score: now,
        value: now.toString(),
      });

      // Keep violations for 24 hours
      await client.expire(violationKey, 24 * 60 * 60);

      // Remove violations older than 24 hours
      const dayAgo = now - (24 * 60 * 60 * 1000);
      await client.zRemRangeByScore(violationKey, 0, dayAgo);

      logger.warn('Rate limit violation logged', {
        identifier,
        policyName,
        timestamp: new Date(now).toISOString(),
      });
    } catch (error) {
      logger.error('Failed to log violation', error instanceof Error ? error : new Error(String(error)), {
        identifier,
        policyName,
      });
    }
  }

  /**
   * Get violation count in last 24 hours
   */
  private static async getViolationCount(
    identifier: string,
    policyName: string
  ): Promise<number> {
    try {
      const client = await getRedisClient();
      const violationKey = this.getViolationKey(identifier, policyName);
      const dayAgo = Date.now() - (24 * 60 * 60 * 1000);

      return await client.zCount(violationKey, dayAgo, '+inf');
    } catch (error) {
      logger.error('Failed to get violation count', error instanceof Error ? error : new Error(String(error)), {
        identifier,
        policyName,
      });
      return 0;
    }
  }

  /**
   * Reset rate limit for identifier
   */
  static async resetRateLimit(
    identifier: string,
    policyName: string = 'default'
  ): Promise<void> {
    try {
      const client = await getRedisClient();
      const key = this.getRateLimitKey(identifier, policyName);
      const blockKey = this.getBlockKey(identifier, policyName);
      const violationKey = this.getViolationKey(identifier, policyName);

      await Promise.all([
        client.del(key),
        client.del(blockKey),
        client.del(violationKey),
      ]);

      logger.info('Rate limit reset', {
        identifier,
        policyName,
      });
    } catch (error) {
      logger.error('Failed to reset rate limit', error instanceof Error ? error : new Error(String(error)), {
        identifier,
        policyName,
      });
    }
  }

  /**
   * Get current rate limit status
   */
  static async getRateLimitStatus(
    identifier: string,
    policy: RateLimitPolicy,
    policyName: string = 'default'
  ): Promise<{
    requestCount: number;
    remaining: number;
    resetAt: Date;
    isBlocked: boolean;
    blockExpiresAt?: Date;
  }> {
    try {
      const client = await getRedisClient();
      const now = Date.now();
      const windowStart = now - policy.windowMs;

      // Check if blocked
      const blockKey = this.getBlockKey(identifier, policyName);
      const blockExpiry = await client.get(blockKey);
      const isBlocked = !!blockExpiry;

      // Get request count
      const key = this.getRateLimitKey(identifier, policyName);
      await client.zRemRangeByScore(key, 0, windowStart);
      const requestCount = await client.zCard(key);

      const remaining = Math.max(0, policy.maxRequests - requestCount);
      const resetAt = new Date(now + policy.windowMs);

      return {
        requestCount,
        remaining,
        resetAt,
        isBlocked,
        blockExpiresAt: blockExpiry ? new Date(parseInt(blockExpiry)) : undefined,
      };
    } catch (error) {
      logger.error('Failed to get rate limit status', error instanceof Error ? error : new Error(String(error)), {
        identifier,
        policyName,
      });
      
      return {
        requestCount: 0,
        remaining: policy.maxRequests,
        resetAt: new Date(Date.now() + policy.windowMs),
        isBlocked: false,
      };
    }
  }

  /**
   * Get rate limit key for Redis
   */
  private static getRateLimitKey(identifier: string, policyName: string): string {
    return `${this.RATE_LIMIT_PREFIX}${policyName}:${identifier}`;
  }

  /**
   * Get block key for Redis
   */
  private static getBlockKey(identifier: string, policyName: string): string {
    return `${this.BLOCK_PREFIX}${policyName}:${identifier}`;
  }

  /**
   * Get violation key for Redis
   */
  private static getViolationKey(identifier: string, policyName: string): string {
    return `${this.VIOLATION_PREFIX}${policyName}:${identifier}`;
  }
}

/**
 * Express/Next.js middleware helper for rate limiting
 */
export function createRateLimitMiddleware(
  policy: RateLimitPolicy,
  policyName: string,
  getIdentifier: (req: any) => string = (req) => req.ip || 'unknown'
) {
  return async (req: any, res: any, next: any) => {
    try {
      const identifier = getIdentifier(req);
      const result = await RateLimiter.checkRateLimit(identifier, policy, policyName);

      // Set rate limit headers (Requirements: 8.5)
      res.setHeader('X-RateLimit-Limit', policy.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

      if (!result.allowed) {
        if (result.retryAfter) {
          res.setHeader('Retry-After', result.retryAfter.toString());
        }

        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: result.retryAfter,
          resetAt: result.resetAt.toISOString(),
        });
      }

      next();
    } catch (error) {
      logger.error('Rate limit middleware error', error instanceof Error ? error : new Error(String(error)));
      // Fail open - allow request if middleware fails
      next();
    }
  };
}
