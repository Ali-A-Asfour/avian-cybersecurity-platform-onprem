/**
 * Rate Limiting Utility
 * Provides rate limiting for API endpoints
 * Part of production authentication system (Task 4.2)
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  keyGenerator?: (req: NextRequest) => string; // Custom key generator
}

/**
 * Rate limit record
 */
interface RateLimitRecord {
  count: number;
  resetAt: number;
  requests: Array<{ timestamp: number; success?: boolean }>;
}

/**
 * In-memory rate limit store
 * In production, replace with Redis for distributed rate limiting
 */
class RateLimitStore {
  private store: Map<string, RateLimitRecord> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired records every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Get or create rate limit record
   */
  get(key: string, windowMs: number): RateLimitRecord {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now > record.resetAt) {
      const newRecord: RateLimitRecord = {
        count: 0,
        resetAt: now + windowMs,
        requests: [],
      };
      this.store.set(key, newRecord);
      return newRecord;
    }

    return record;
  }

  /**
   * Increment request count
   */
  increment(key: string, windowMs: number, success?: boolean): RateLimitRecord {
    const record = this.get(key, windowMs);
    record.count++;
    record.requests.push({ timestamp: Date.now(), success });
    return record;
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clean up expired records
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get store size (for monitoring)
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Clear all records (for testing)
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Destroy store and cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// Global rate limit store
const globalStore = new RateLimitStore();

/**
 * Get client identifier from request
 */
function getClientIdentifier(req: NextRequest): string {
  // Try to get real IP from headers (for proxied requests)
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to connection IP (may not be available in all environments)
  return 'unknown';
}

/**
 * Create a rate limiter middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = getClientIdentifier,
  } = config;

  return async (
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> => {
    // Generate rate limit key
    const key = keyGenerator(req);

    // Get current rate limit record
    const record = globalStore.get(key, windowMs);

    // Check if limit exceeded
    if (record.count >= maxRequests) {
      const retryAfter = Math.ceil((record.resetAt - Date.now()) / 1000);

      return NextResponse.json(
        {
          error: message,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(record.resetAt).toISOString(),
          },
        }
      );
    }

    // Increment counter (before request if not skipping)
    if (!skipSuccessfulRequests && !skipFailedRequests) {
      globalStore.increment(key, windowMs);
    }

    // Execute handler
    const response = await handler(req);

    // Increment counter based on response (if skipping certain types)
    if (skipSuccessfulRequests || skipFailedRequests) {
      const isSuccess = response.status >= 200 && response.status < 400;

      if (
        (!skipSuccessfulRequests || !isSuccess) &&
        (!skipFailedRequests || isSuccess)
      ) {
        globalStore.increment(key, windowMs, isSuccess);
      }
    }

    // Add rate limit headers to response
    const updatedRecord = globalStore.get(key, windowMs);
    const remaining = Math.max(0, maxRequests - updatedRecord.count);

    response.headers.set('X-RateLimit-Limit', maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(updatedRecord.resetAt).toISOString());

    return response;
  };
}

/**
 * Predefined rate limiters for common use cases
 */

// Strict rate limiter for sensitive endpoints (login, password reset)
export const strictRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many attempts. Please try again in 15 minutes.',
  skipSuccessfulRequests: true, // Only count failed attempts
});

// Standard rate limiter for auth endpoints
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 20,
  message: 'Too many requests. Please try again later.',
});

// Lenient rate limiter for general API endpoints
export const apiRateLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 100,
  message: 'Rate limit exceeded. Please slow down.',
});

// Very strict rate limiter for password reset
export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  message: 'Too many password reset requests. Please try again in 1 hour.',
});

/**
 * User-based rate limiter (requires authentication)
 */
export function createUserRateLimiter(config: RateLimitConfig) {
  return createRateLimiter({
    ...config,
    keyGenerator: (req: NextRequest) => {
      // Try to extract user ID from token/session
      // This is a simplified version - adjust based on your auth implementation
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        // Extract user ID from token (you'll need to decode JWT here)
        return `user:${authHeader.substring(0, 20)}`;
      }

      // Fallback to IP-based
      return `ip:${getClientIdentifier(req)}`;
    },
  });
}

/**
 * Combined IP and user rate limiter
 */
export function createCombinedRateLimiter(
  ipConfig: RateLimitConfig,
  userConfig: RateLimitConfig
) {
  const ipLimiter = createRateLimiter(ipConfig);
  const userLimiter = createUserRateLimiter(userConfig);

  return async (
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> => {
    // Check IP rate limit first
    return ipLimiter(req, async (req) => {
      // Then check user rate limit
      return userLimiter(req, handler);
    });
  };
}

/**
 * Reset rate limit for a specific key (admin function)
 */
export function resetRateLimit(key: string): void {
  globalStore.reset(key);
}

/**
 * Get rate limit info for a key
 */
export function getRateLimitInfo(key: string, windowMs: number): {
  count: number;
  remaining: number;
  resetAt: Date;
} {
  const record = globalStore.get(key, windowMs);
  return {
    count: record.count,
    remaining: Math.max(0, 100 - record.count), // Assuming max 100
    resetAt: new Date(record.resetAt),
  };
}

/**
 * Get store statistics (for monitoring)
 */
export function getRateLimitStats(): {
  totalKeys: number;
  storeSize: number;
} {
  return {
    totalKeys: globalStore.size(),
    storeSize: globalStore.size(),
  };
}

/**
 * Clear all rate limits (for testing)
 */
export function clearAllRateLimits(): void {
  globalStore.clear();
}

/**
 * Cleanup function (call on app shutdown)
 */
export function destroyRateLimiter(): void {
  globalStore.destroy();
}

// Export store for advanced usage
export { globalStore as rateLimitStore };

/**
 * Simple rate limit check (returns error response if rate limited)
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    keyGenerator = getClientIdentifier,
  } = config;

  const key = keyGenerator(request);
  const record = globalStore.get(key, windowMs);

  if (record.count >= maxRequests) {
    const retryAfter = Math.ceil((record.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: message, retryAfter },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(record.resetAt).toISOString(),
        },
      }
    );
  }

  globalStore.increment(key, windowMs);
  return null;
}
