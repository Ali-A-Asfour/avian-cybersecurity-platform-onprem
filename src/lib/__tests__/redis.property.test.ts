/**
 * Property-Based Tests for Redis Connection
 * 
 * Feature: self-hosted-security-migration
 * Property 9: Session Expiration
 * Validates: Requirements 2.3
 * 
 * Tests that Redis automatically removes sessions when TTL expires
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { getRedisClient, disconnectRedis, checkRedisHealth } from '../redis';

describe('Redis Connection Property Tests', () => {
  beforeAll(async () => {
    // Ensure Redis is connected
    await getRedisClient();
  });

  afterAll(async () => {
    // Clean up Redis connection
    await disconnectRedis();
  });

  beforeEach(async () => {
    // Clean up test keys before each test
    const client = await getRedisClient();
    const keys = await client.keys('test:*');
    if (keys.length > 0) {
      await client.del(keys);
    }
  });

  /**
   * Property 9: Session Expiration
   * For any session with TTL expired, Redis SHALL automatically remove it
   * Validates: Requirements 2.3
   */
  it('Property 9: Redis automatically removes expired keys', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random key names and TTL values (1-3 seconds for fast testing)
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.integer({ min: 1, max: 3 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (keyName, ttlSeconds, value) => {
          const client = await getRedisClient();
          const testKey = `test:expiration:${keyName}`;

          // Set key with TTL
          await client.setEx(testKey, ttlSeconds, value);

          // Verify key exists immediately
          const existsImmediately = await client.exists(testKey);
          expect(existsImmediately).toBe(1);

          // Wait for TTL to expire (add 500ms buffer)
          await new Promise(resolve => setTimeout(resolve, (ttlSeconds * 1000) + 500));

          // Verify key is automatically removed
          const existsAfterExpiry = await client.exists(testKey);
          expect(existsAfterExpiry).toBe(0);

          // Verify we cannot retrieve the value
          const retrievedValue = await client.get(testKey);
          expect(retrievedValue).toBeNull();
        }
      ),
      {
        numRuns: 10, // Reduced from 100 due to time delays in test
        timeout: 60000, // 60 second timeout for property test
      }
    );
  }, 120000); // 2 minute timeout for entire test

  /**
   * Additional property: Redis connection health check always returns valid structure
   */
  it('Property: Health check returns valid structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null), // No input needed
        async () => {
          const health = await checkRedisHealth();

          // Health check must return an object with healthy boolean
          expect(health).toHaveProperty('healthy');
          expect(typeof health.healthy).toBe('boolean');

          // If healthy, must have latency
          if (health.healthy) {
            expect(health).toHaveProperty('latency');
            expect(typeof health.latency).toBe('number');
            expect(health.latency).toBeGreaterThanOrEqual(0);
          }

          // If unhealthy, must have error
          if (!health.healthy) {
            expect(health).toHaveProperty('error');
            expect(typeof health.error).toBe('string');
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Additional property: Redis SET then GET returns same value
   */
  it('Property: Round-trip consistency (set then get)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 0, maxLength: 1000 }),
        async (keyName, value) => {
          const client = await getRedisClient();
          const testKey = `test:roundtrip:${keyName}`;

          // Set value
          await client.set(testKey, value);

          // Get value
          const retrieved = await client.get(testKey);

          // Should match exactly
          expect(retrieved).toBe(value);

          // Clean up
          await client.del(testKey);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: TTL decreases over time
   */
  it('Property: TTL decreases monotonically', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.integer({ min: 10, max: 30 }),
        async (keyName, ttlSeconds) => {
          const client = await getRedisClient();
          const testKey = `test:ttl:${keyName}`;

          // Set key with TTL
          await client.setEx(testKey, ttlSeconds, 'test-value');

          // Get initial TTL
          const ttl1 = await client.ttl(testKey);
          expect(ttl1).toBeGreaterThan(0);
          expect(ttl1).toBeLessThanOrEqual(ttlSeconds);

          // Wait 1 second
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Get TTL again
          const ttl2 = await client.ttl(testKey);

          // TTL should have decreased
          expect(ttl2).toBeLessThan(ttl1);
          expect(ttl2).toBeGreaterThanOrEqual(0);

          // Clean up
          await client.del(testKey);
        }
      ),
      {
        numRuns: 10, // Reduced due to time delays
        timeout: 30000,
      }
    );
  }, 60000);

  /**
   * Additional property: DELETE removes key completely
   */
  it('Property: Deleted keys cannot be retrieved', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (keyName, value) => {
          const client = await getRedisClient();
          const testKey = `test:delete:${keyName}`;

          // Set value
          await client.set(testKey, value);

          // Verify it exists
          const existsBefore = await client.exists(testKey);
          expect(existsBefore).toBe(1);

          // Delete it
          await client.del(testKey);

          // Verify it's gone
          const existsAfter = await client.exists(testKey);
          expect(existsAfter).toBe(0);

          // Verify we cannot retrieve it
          const retrieved = await client.get(testKey);
          expect(retrieved).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
