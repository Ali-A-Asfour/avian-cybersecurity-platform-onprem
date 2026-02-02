/**
 * Property-Based Tests for Session Manager
 * 
 * Feature: self-hosted-security-migration
 * Properties: 8, 10, 13, 14, 15
 * Validates: Requirements 2.2, 2.3, 7.1, 7.2, 7.5, 7.6, 7.7
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { SessionManager, SessionData } from '../session-manager';
import { getRedisClient, disconnectRedis } from '../redis';

describe('Session Manager Property Tests', () => {
  beforeAll(async () => {
    // Ensure Redis is connected
    await getRedisClient();
  });

  afterAll(async () => {
    // Clean up Redis connection
    await disconnectRedis();
  });

  beforeEach(async () => {
    // Clean up test sessions before each test
    const client = await getRedisClient();
    const sessionKeys = await client.keys('session:*');
    const userSessionKeys = await client.keys('user:sessions:*');
    const allKeys = [...sessionKeys, ...userSessionKeys];
    if (allKeys.length > 0) {
      await client.del(allKeys);
    }
  });

  /**
   * Property 8: Session Creation with TTL
   * For any user login, a session SHALL be created in Redis with TTL set to 24 hours
   * Validates: Requirements 2.2
   */
  it('Property 8: Session created with correct TTL', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 50 }), // userId
        fc.emailAddress(), // email
        fc.string({ minLength: 3, maxLength: 50 }), // name
        fc.constantFrom('super_admin', 'tenant_admin', 'security_analyst', 'it_helpdesk_analyst', 'user'), // role
        fc.string({ minLength: 5, maxLength: 50 }), // tenantId
        fc.boolean(), // rememberMe
        async (userId, email, name, role, tenantId, rememberMe) => {
          // Create session
          const sessionToken = await SessionManager.createSession(
            userId,
            { email, name, role, tenantId },
            { rememberMe }
          );

          expect(sessionToken).toBeTruthy();
          expect(typeof sessionToken).toBe('string');

          // Get session from Redis
          const client = await getRedisClient();
          const sessionKey = `session:${sessionToken}`;
          const ttl = await client.ttl(sessionKey);

          // Verify TTL is set correctly
          if (rememberMe) {
            // Remember me: 30 days = 2592000 seconds
            expect(ttl).toBeGreaterThan(2591000); // Allow 1000 second buffer
            expect(ttl).toBeLessThanOrEqual(2592000);
          } else {
            // Normal: 7 days = 604800 seconds
            expect(ttl).toBeGreaterThan(603800); // Allow 1000 second buffer
            expect(ttl).toBeLessThanOrEqual(604800);
          }

          // Clean up
          await SessionManager.deleteSession(sessionToken);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 10: Session Token Uniqueness
   * For any session creation, the generated token SHALL be cryptographically unique
   * Validates: Requirements 7.1, 7.2
   */
  it('Property 10: Session tokens are unique', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 5, max: 20 }), // Number of sessions to create
        async (numSessions) => {
          const tokens = new Set<string>();
          const userId = 'test-user-' + Math.random();

          // Create multiple sessions
          for (let i = 0; i < numSessions; i++) {
            const token = await SessionManager.createSession(
              userId,
              {
                email: `test${i}@example.com`,
                name: `Test User ${i}`,
                role: 'user',
                tenantId: 'test-tenant',
              }
            );

            // Token should be unique
            expect(tokens.has(token)).toBe(false);
            tokens.add(token);

            // Token should be at least 32 characters (base64url of 32 bytes)
            expect(token.length).toBeGreaterThanOrEqual(43); // 32 bytes base64url encoded
          }

          // All tokens should be unique
          expect(tokens.size).toBe(numSessions);

          // Clean up
          await SessionManager.deleteAllUserSessions(userId);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 13: Session Invalidation on Logout
   * For any logout request, the session SHALL be removed from Redis
   * Validates: Requirements 7.5
   */
  it('Property 13: Session removed on logout', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.emailAddress(),
        fc.string({ minLength: 3, maxLength: 50 }),
        async (userId, email, name) => {
          // Create session
          const sessionToken = await SessionManager.createSession(
            userId,
            {
              email,
              name,
              role: 'user',
              tenantId: 'test-tenant',
            }
          );

          // Verify session exists
          const sessionBefore = await SessionManager.getSession(sessionToken);
          expect(sessionBefore).not.toBeNull();
          expect(sessionBefore?.userId).toBe(userId);

          // Delete session (logout)
          const deleted = await SessionManager.deleteSession(sessionToken);
          expect(deleted).toBe(true);

          // Verify session is removed
          const sessionAfter = await SessionManager.getSession(sessionToken);
          expect(sessionAfter).toBeNull();

          // Verify validation fails
          const validation = await SessionManager.validateSession(sessionToken);
          expect(validation.valid).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 14: Session Inactivity Expiration
   * For any session with no activity for 24 hours, the session SHALL expire
   * Validates: Requirements 7.6
   * 
   * Note: We test with shorter TTL (3 seconds) for practical testing
   */
  it('Property 14: Session expires after inactivity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.emailAddress(),
        async (userId, email) => {
          // Create session
          const sessionToken = await SessionManager.createSession(
            userId,
            {
              email,
              name: 'Test User',
              role: 'user',
              tenantId: 'test-tenant',
            }
          );

          // Manually set a short TTL for testing (3 seconds)
          const client = await getRedisClient();
          const sessionKey = `session:${sessionToken}`;
          await client.expire(sessionKey, 3);

          // Verify session exists immediately
          const sessionBefore = await SessionManager.getSession(sessionToken);
          expect(sessionBefore).not.toBeNull();

          // Wait for expiration (3 seconds + 500ms buffer)
          await new Promise(resolve => setTimeout(resolve, 3500));

          // Verify session is expired
          const sessionAfter = await SessionManager.getSession(sessionToken);
          expect(sessionAfter).toBeNull();

          // Verify validation fails
          const validation = await SessionManager.validateSession(sessionToken);
          expect(validation.valid).toBe(false);
        }
      ),
      {
        numRuns: 5, // Reduced due to time delays
        timeout: 30000,
      }
    );
  }, 60000);

  /**
   * Property 15: Session Absolute Expiration
   * For any session older than 7 days, the session SHALL expire regardless of activity
   * Validates: Requirements 7.7
   * 
   * Note: We test the expiration logic by checking the expiresAt field
   */
  it('Property 15: Session has absolute expiration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.emailAddress(),
        fc.boolean(),
        async (userId, email, rememberMe) => {
          // Create session
          const sessionToken = await SessionManager.createSession(
            userId,
            {
              email,
              name: 'Test User',
              role: 'user',
              tenantId: 'test-tenant',
            },
            { rememberMe }
          );

          // Get session
          const session = await SessionManager.getSession(sessionToken);
          expect(session).not.toBeNull();

          if (session) {
            const now = Date.now();
            const createdAt = session.createdAt;
            const expiresAt = session.expiresAt;

            // Verify expiresAt is set
            expect(expiresAt).toBeGreaterThan(createdAt);

            // Verify absolute expiration time
            const expectedMaxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
            const actualMaxAge = expiresAt - createdAt;

            // Allow 1 second tolerance
            expect(actualMaxAge).toBeGreaterThanOrEqual(expectedMaxAge - 1000);
            expect(actualMaxAge).toBeLessThanOrEqual(expectedMaxAge + 1000);

            // Verify session is not expired yet
            expect(now).toBeLessThan(expiresAt);
          }

          // Clean up
          await SessionManager.deleteSession(sessionToken);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Additional property: Session refresh extends TTL
   */
  it('Property: Session refresh extends TTL', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.emailAddress(),
        async (userId, email) => {
          // Create session
          const sessionToken = await SessionManager.createSession(
            userId,
            {
              email,
              name: 'Test User',
              role: 'user',
              tenantId: 'test-tenant',
            }
          );

          // Get initial TTL
          const client = await getRedisClient();
          const sessionKey = `session:${sessionToken}`;
          const ttlBefore = await client.ttl(sessionKey);

          // Wait 2 seconds
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Refresh session
          const refreshed = await SessionManager.refreshSession(sessionToken);
          expect(refreshed).toBe(true);

          // Get new TTL
          const ttlAfter = await client.ttl(sessionKey);

          // TTL should be set to sliding window (24 hours = 86400 seconds)
          // or remaining absolute time, whichever is less
          // After refresh, TTL should be close to 86400 (24 hours)
          expect(ttlAfter).toBeGreaterThan(86390); // Allow 10 second buffer
          expect(ttlAfter).toBeLessThanOrEqual(86400);

          // Clean up
          await SessionManager.deleteSession(sessionToken);
        }
      ),
      {
        numRuns: 5, // Reduced due to time delays
        timeout: 20000,
      }
    );
  }, 40000);

  /**
   * Additional property: Delete all user sessions removes all sessions
   */
  it('Property: Delete all user sessions works correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.integer({ min: 2, max: 5 }),
        async (userId, numSessions) => {
          const tokens: string[] = [];

          // Create multiple sessions for user
          for (let i = 0; i < numSessions; i++) {
            const token = await SessionManager.createSession(
              userId,
              {
                email: `test${i}@example.com`,
                name: `Test User ${i}`,
                role: 'user',
                tenantId: 'test-tenant',
              }
            );
            tokens.push(token);
          }

          // Verify all sessions exist
          for (const token of tokens) {
            const session = await SessionManager.getSession(token);
            expect(session).not.toBeNull();
          }

          // Delete all user sessions
          const deletedCount = await SessionManager.deleteAllUserSessions(userId);
          expect(deletedCount).toBe(numSessions);

          // Verify all sessions are removed
          for (const token of tokens) {
            const session = await SessionManager.getSession(token);
            expect(session).toBeNull();
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});
