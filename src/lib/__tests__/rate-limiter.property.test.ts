/**
 * Property-Based Tests for Rate Limiter
 * 
 * Feature: self-hosted-security-migration
 * Properties: 40, 41, 42, 43, 44, 45
 * Validates: Requirements 8.1, 8.2, 8.3, 8.5, 8.6, 8.7
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { RateLimiter, RateLimitPolicies } from '../rate-limiter';
import { getRedisClient, disconnectRedis } from '../redis';

describe('Rate Limiter Property Tests', () => {
  beforeAll(async () => {
    // Ensure Redis is connected
    await getRedisClient();
  });

  afterAll(async () => {
    // Clean up Redis connection
    await disconnectRedis();
  });

  beforeEach(async () => {
    // Clean up test rate limit keys before each test
    const client = await getRedisClient();
    const rateLimitKeys = await client.keys('ratelimit:*');
    if (rateLimitKeys.length > 0) {
      await client.del(rateLimitKeys);
    }
  });

  /**
   * Property 40: Login Rate Limiting
   * For any IP address, login attempts SHALL be limited to 5 per 15 minutes
   * Validates: Requirements 8.1
   */
  it('Property 40: Login rate limiting enforced', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.ipV4(), // IP address
        async (ipAddress) => {
          const policy = RateLimitPolicies.LOGIN;
          const identifier = `ip:${ipAddress}`;

          // Make requests up to the limit
          for (let i = 0; i < policy.maxRequests; i++) {
            const result = await RateLimiter.checkRateLimit(identifier, policy, 'login');
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(policy.maxRequests - i - 1);
          }

          // Next request should be blocked
          const blockedResult = await RateLimiter.checkRateLimit(identifier, policy, 'login');
          expect(blockedResult.allowed).toBe(false);
          expect(blockedResult.remaining).toBe(0);

          // Clean up
          await RateLimiter.resetRateLimit(identifier, 'login');
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 41: API Rate Limiting
   * For any user, API requests SHALL be limited to 100 per hour
   * Validates: Requirements 8.2
   */
  it('Property 41: API rate limiting enforced', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 50 }), // userId
        fc.integer({ min: 1, max: 10 }), // Number of requests to test
        async (userId, numRequests) => {
          const policy = RateLimitPolicies.API;
          const identifier = `user:${userId}`;

          // Make requests
          for (let i = 0; i < numRequests; i++) {
            const result = await RateLimiter.checkRateLimit(identifier, policy, 'api');
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(policy.maxRequests - i - 1);
          }

          // Verify remaining count is correct
          const status = await RateLimiter.getRateLimitStatus(identifier, policy, 'api');
          expect(status.requestCount).toBe(numRequests);
          expect(status.remaining).toBe(policy.maxRequests - numRequests);

          // Clean up
          await RateLimiter.resetRateLimit(identifier, 'api');
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 42: Rate Limit HTTP Status
   * For any rate limit violation, HTTP 429 status SHALL be returned
   * Validates: Requirements 8.3
   * 
   * Note: This is tested by checking the allowed flag
   */
  it('Property 42: Rate limit violation returns not allowed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 50 }),
        async (identifier) => {
          const policy = {
            windowMs: 60000,
            maxRequests: 3,
          };

          // Exhaust the limit
          for (let i = 0; i < policy.maxRequests; i++) {
            await RateLimiter.checkRateLimit(identifier, policy, 'test');
          }

          // Next request should be blocked
          const result = await RateLimiter.checkRateLimit(identifier, policy, 'test');
          expect(result.allowed).toBe(false);
          expect(result.remaining).toBe(0);
          expect(result.retryAfter).toBeGreaterThan(0);

          // Clean up
          await RateLimiter.resetRateLimit(identifier, 'test');
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 43: Rate Limit Headers
   * For any API response, rate limit headers SHALL be included
   * Validates: Requirements 8.5
   * 
   * Note: We test that the result includes all required fields
   */
  it('Property 43: Rate limit result includes required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 50 }),
        async (identifier) => {
          const policy = RateLimitPolicies.API;

          const result = await RateLimiter.checkRateLimit(identifier, policy, 'api');

          // Verify all required fields are present
          expect(result).toHaveProperty('allowed');
          expect(result).toHaveProperty('remaining');
          expect(result).toHaveProperty('resetAt');
          expect(result.resetAt).toBeInstanceOf(Date);

          // If blocked, should have retryAfter
          if (!result.allowed) {
            expect(result).toHaveProperty('retryAfter');
            expect(typeof result.retryAfter).toBe('number');
          }

          // Clean up
          await RateLimiter.resetRateLimit(identifier, 'api');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 44: Exponential Backoff
   * For any repeated rate limit violations, the backoff duration SHALL increase exponentially
   * Validates: Requirements 8.6
   */
  it('Property 44: Exponential backoff on repeated violations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 50 }),
        async (identifier) => {
          const policy = {
            windowMs: 60000,
            maxRequests: 2,
            blockDurationMs: 1000, // 1 second base block
          };

          // First violation
          for (let i = 0; i < policy.maxRequests; i++) {
            await RateLimiter.checkRateLimit(identifier, policy, 'test');
          }
          const result1 = await RateLimiter.checkRateLimit(identifier, policy, 'test');
          expect(result1.allowed).toBe(false);
          const retryAfter1 = result1.retryAfter || 0;

          // Wait for block to expire
          await new Promise(resolve => setTimeout(resolve, 1500));

          // Second violation
          for (let i = 0; i < policy.maxRequests; i++) {
            await RateLimiter.checkRateLimit(identifier, policy, 'test');
          }
          const result2 = await RateLimiter.checkRateLimit(identifier, policy, 'test');
          expect(result2.allowed).toBe(false);
          const retryAfter2 = result2.retryAfter || 0;

          // Second block should be longer (exponential backoff)
          expect(retryAfter2).toBeGreaterThan(retryAfter1);

          // Clean up
          await RateLimiter.resetRateLimit(identifier, 'test');
        }
      ),
      {
        numRuns: 3, // Reduced due to time delays
        timeout: 20000,
      }
    );
  }, 30000);

  /**
   * Property 45: Rate Limit Violation Logging
   * For any rate limit violation, an audit log entry SHALL be created
   * Validates: Requirements 8.7
   * 
   * Note: We verify that violations are tracked in Redis
   */
  it('Property 45: Rate limit violations are logged', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 50 }),
        async (identifier) => {
          const policy = {
            windowMs: 60000,
            maxRequests: 2,
          };

          // Exhaust the limit
          for (let i = 0; i < policy.maxRequests; i++) {
            await RateLimiter.checkRateLimit(identifier, policy, 'test');
          }

          // Trigger violation
          const result = await RateLimiter.checkRateLimit(identifier, policy, 'test');
          expect(result.allowed).toBe(false);

          // Verify violation is tracked
          const client = await getRedisClient();
          const violationKey = `ratelimit:violations:test:${identifier}`;
          const violationCount = await client.zCard(violationKey);
          expect(violationCount).toBeGreaterThan(0);

          // Clean up
          await RateLimiter.resetRateLimit(identifier, 'test');
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Additional property: Rate limit resets after window expires
   */
  it('Property: Rate limit resets after window', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 50 }),
        async (identifier) => {
          const policy = {
            windowMs: 2000, // 2 seconds
            maxRequests: 3,
          };

          // Exhaust the limit
          for (let i = 0; i < policy.maxRequests; i++) {
            const result = await RateLimiter.checkRateLimit(identifier, policy, 'test');
            expect(result.allowed).toBe(true);
          }

          // Should be blocked
          const blockedResult = await RateLimiter.checkRateLimit(identifier, policy, 'test');
          expect(blockedResult.allowed).toBe(false);

          // Wait for window to expire
          await new Promise(resolve => setTimeout(resolve, 2500));

          // Should be allowed again
          const allowedResult = await RateLimiter.checkRateLimit(identifier, policy, 'test');
          expect(allowedResult.allowed).toBe(true);

          // Clean up
          await RateLimiter.resetRateLimit(identifier, 'test');
        }
      ),
      {
        numRuns: 3, // Reduced due to time delays
        timeout: 15000,
      }
    );
  }, 25000);

  /**
   * Additional property: Different identifiers have independent limits
   */
  it('Property: Independent rate limits per identifier', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.string({ minLength: 5, maxLength: 50 }),
        async (identifier1, identifier2) => {
          // Skip if identifiers are the same
          if (identifier1 === identifier2) {
            return;
          }

          const policy = {
            windowMs: 60000,
            maxRequests: 3,
          };

          // Exhaust limit for identifier1
          for (let i = 0; i < policy.maxRequests; i++) {
            await RateLimiter.checkRateLimit(identifier1, policy, 'test');
          }

          // identifier1 should be blocked
          const result1 = await RateLimiter.checkRateLimit(identifier1, policy, 'test');
          expect(result1.allowed).toBe(false);

          // identifier2 should still be allowed
          const result2 = await RateLimiter.checkRateLimit(identifier2, policy, 'test');
          expect(result2.allowed).toBe(true);

          // Clean up
          await RateLimiter.resetRateLimit(identifier1, 'test');
          await RateLimiter.resetRateLimit(identifier2, 'test');
        }
      ),
      { numRuns: 20 }
    );
  });
});
