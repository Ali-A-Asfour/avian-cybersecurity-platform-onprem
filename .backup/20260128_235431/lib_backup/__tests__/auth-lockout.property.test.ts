/**
 * Property-Based Tests for Account Lockout
 * 
 * Feature: self-hosted-security-migration
 * Properties: 6, 7
 * Validates: Requirements 3.7, 3.8
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { AuthService } from '../auth-service';
import { getClient } from '../database';
import { drizzle } from 'drizzle-orm/postgres-js';
import { users, tenants } from '../../../database/schemas/main';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

describe('Account Lockout Property Tests', () => {
  // Test user data
  const testUsers: Array<{ id: string; email: string; password: string }> = [];
  let db: ReturnType<typeof drizzle>;
  let testTenantId: string;

  beforeAll(async () => {
    // Initialize database connection
    const client = await getClient();
    db = drizzle(client);

    // Create a test tenant
    const tenantResult = await db.insert(tenants).values({
      id: crypto.randomUUID(),
      name: 'Test Tenant',
      domain: `test-${crypto.randomUUID()}.example.com`,
      is_active: true,
    }).returning();
    
    testTenantId = tenantResult[0].id;
  });

  beforeEach(async () => {
    // Clean up test users
    for (const user of testUsers) {
      await db.delete(users).where(eq(users.id, user.id));
    }
    testUsers.length = 0;
  });

  afterAll(async () => {
    // Final cleanup
    for (const user of testUsers) {
      await db.delete(users).where(eq(users.id, user.id));
    }
    
    // Clean up test tenant
    if (testTenantId) {
      await db.delete(tenants).where(eq(tenants.id, testTenantId));
    }
  });

  /**
   * Helper function to create a test user
   */
  async function createTestUser(email: string, password: string): Promise<string> {
    const userId = crypto.randomUUID();
    const passwordHash = await AuthService.hashPassword(password);

    await db.insert(users).values({
      id: userId,
      tenant_id: testTenantId,
      email,
      first_name: 'Test',
      last_name: 'User',
      password_hash: passwordHash,
      role: 'user',
      email_verified: true,
      mfa_enabled: false,
      failed_login_attempts: 0,
    });

    testUsers.push({ id: userId, email, password });
    return userId;
  }

  /**
   * Property 6: Failed Login Counter Increment
   * For any failed login attempt, the failed_login_attempts counter SHALL increment by exactly 1
   * Validates: Requirements 3.7
   */
  it('Property 6: Failed login counter increments by 1', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }), // Number of failed attempts (less than lockout threshold)
        async (numAttempts) => {
          // Create test user
          const email = `test-${crypto.randomUUID()}@example.com`;
          const correctPassword = 'CorrectPassword123!';
          const wrongPassword = 'WrongPassword456!';
          const userId = await createTestUser(email, correctPassword);

          // Make failed login attempts
          for (let i = 0; i < numAttempts; i++) {
            await AuthService.authenticateUser({
              email,
              password: wrongPassword,
            });

            // Check counter after each attempt
            const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
            expect(userResult.length).toBe(1);
            expect(userResult[0].failed_login_attempts).toBe(i + 1);
          }

          // Verify final count
          const finalResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          expect(finalResult[0].failed_login_attempts).toBe(numAttempts);
        }
      ),
      { numRuns: 1 }
    );
  }, 30000);

  /**
   * Property 7: Account Lockout on Threshold
   * For any user with failed_login_attempts >= 5, the account SHALL be locked for 30 minutes
   * Validates: Requirements 3.8
   */
  it('Property 7: Account locks after 5 failed attempts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null), // No random input needed
        async () => {
          // Create test user
          const email = `test-${crypto.randomUUID()}@example.com`;
          const correctPassword = 'CorrectPassword123!';
          const wrongPassword = 'WrongPassword456!';
          const userId = await createTestUser(email, correctPassword);

          const beforeLockout = Date.now();

          // Make 5 failed login attempts
          for (let i = 0; i < 5; i++) {
            await AuthService.authenticateUser({
              email,
              password: wrongPassword,
            });
          }

          const afterLockout = Date.now();

          // Check that account is locked
          const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          expect(userResult.length).toBe(1);
          
          const user = userResult[0];
          expect(user.failed_login_attempts).toBe(5);
          expect(user.locked_until).not.toBeNull();

          // Verify lockout duration is approximately 30 minutes
          const lockedUntilTime = new Date(user.locked_until!).getTime();
          const expectedLockoutDuration = 30 * 60 * 1000; // 30 minutes in ms
          
          // Allow some tolerance for execution time (±5 seconds)
          const minExpectedTime = beforeLockout + expectedLockoutDuration - 5000;
          const maxExpectedTime = afterLockout + expectedLockoutDuration + 5000;
          
          expect(lockedUntilTime).toBeGreaterThanOrEqual(minExpectedTime);
          expect(lockedUntilTime).toBeLessThanOrEqual(maxExpectedTime);

          // Verify that login is blocked even with correct password
          const loginResult = await AuthService.authenticateUser({
            email,
            password: correctPassword,
          });

          expect(loginResult.success).toBe(false);
          expect(loginResult.error).toMatch(/locked/i);
        }
      ),
      { numRuns: 1 }
    );
  }, 30000);

  /**
   * Additional property: Counter resets on successful login
   */
  it('Property: Failed login counter resets on successful login', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 4 }), // Number of failed attempts before success
        async (numFailedAttempts) => {
          // Create test user
          const email = `test-${crypto.randomUUID()}@example.com`;
          const correctPassword = 'CorrectPassword123!';
          const wrongPassword = 'WrongPassword456!';
          const userId = await createTestUser(email, correctPassword);

          // Make some failed attempts
          for (let i = 0; i < numFailedAttempts; i++) {
            await AuthService.authenticateUser({
              email,
              password: wrongPassword,
            });
          }

          // Verify counter is incremented
          let userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          expect(userResult[0].failed_login_attempts).toBe(numFailedAttempts);

          // Successful login
          const loginResult = await AuthService.authenticateUser({
            email,
            password: correctPassword,
          });

          expect(loginResult.success).toBe(true);

          // Verify counter is reset
          userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          expect(userResult[0].failed_login_attempts).toBe(0);
          expect(userResult[0].locked_until).toBeNull();
        }
      ),
      { numRuns: 1 }
    );
  }, 30000);

  /**
   * Additional property: Lockout prevents login even with correct password
   */
  it('Property: Locked account rejects correct password', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          // Create test user
          const email = `test-${crypto.randomUUID()}@example.com`;
          const correctPassword = 'CorrectPassword123!';
          const wrongPassword = 'WrongPassword456!';
          await createTestUser(email, correctPassword);

          // Lock the account
          for (let i = 0; i < 5; i++) {
            await AuthService.authenticateUser({
              email,
              password: wrongPassword,
            });
          }

          // Try to login with correct password
          const result = await AuthService.authenticateUser({
            email,
            password: correctPassword,
          });

          expect(result.success).toBe(false);
          expect(result.error).toMatch(/locked/i);
        }
      ),
      { numRuns: 1 }
    );
  }, 30000);

  /**
   * Additional property: Multiple failed attempts beyond threshold don't extend lockout
   */
  it('Property: Additional failed attempts after lockout', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }), // Additional attempts after lockout
        async (additionalAttempts) => {
          // Create test user
          const email = `test-${crypto.randomUUID()}@example.com`;
          const correctPassword = 'CorrectPassword123!';
          const wrongPassword = 'WrongPassword456!';
          const userId = await createTestUser(email, correctPassword);

          // Lock the account (5 failed attempts)
          for (let i = 0; i < 5; i++) {
            await AuthService.authenticateUser({
              email,
              password: wrongPassword,
            });
          }

          // Get initial lockout time
          let userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          const initialLockedUntil = userResult[0].locked_until;
          expect(initialLockedUntil).not.toBeNull();

          // Make additional failed attempts
          for (let i = 0; i < additionalAttempts; i++) {
            await AuthService.authenticateUser({
              email,
              password: wrongPassword,
            });
          }

          // Verify lockout time hasn't changed significantly (within 1 second tolerance)
          userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          const finalLockedUntil = userResult[0].locked_until;
          
          const timeDiff = Math.abs(
            new Date(finalLockedUntil!).getTime() - new Date(initialLockedUntil!).getTime()
          );
          
          // Allow 1 second tolerance for execution time
          expect(timeDiff).toBeLessThan(1000);
        }
      ),
      { numRuns: 1 }
    );
  }, 30000);
});
