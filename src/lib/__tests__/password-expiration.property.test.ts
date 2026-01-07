/**
 * Property-Based Tests for Password Expiration
 * 
 * Tests password expiration functionality to ensure:
 * - Property 38: Password Change on Expiration (Requirements 6.6)
 * 
 * Feature: self-hosted-security-migration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { AuthService } from '../auth-service';
import { getClient } from '../database';
import { drizzle } from 'drizzle-orm/postgres-js';
import { users, tenants } from '../../../database/schemas/main';
import { eq } from 'drizzle-orm';

describe('Password Expiration Property Tests', () => {
  let testTenantId: string;

  beforeAll(async () => {
    // Create test tenant
    const client = await getClient();
    const db = drizzle(client);

    const [tenant] = await db
      .insert(tenants)
      .values({
        name: 'Password Expiration Test Tenant',
        domain: `password-expiration-test-${Date.now()}.example.com`,
      })
      .returning();

    testTenantId = tenant.id;
  });

  afterAll(async () => {
    // Clean up test tenant and all related data
    const client = await getClient();
    const db = drizzle(client);

    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });

  beforeEach(async () => {
    // Clean up any test users before each test
    const client = await getClient();
    const db = drizzle(client);

    await db.delete(users).where(eq(users.tenant_id, testTenantId));
  });

  /**
   * Helper: Create a test user with a password and specific expiration date
   */
  async function createTestUser(
    email: string,
    password: string,
    passwordChangedAt: Date,
    passwordExpiresAt: Date
  ) {
    const client = await getClient();
    const db = drizzle(client);

    const passwordHash = await AuthService.hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({
        tenant_id: testTenantId,
        email,
        first_name: 'Test',
        last_name: 'User',
        role: 'user',
        password_hash: passwordHash,
        password_changed_at: passwordChangedAt,
        password_expires_at: passwordExpiresAt,
        email_verified: true,
      })
      .returning();

    return user;
  }

  /**
   * Property 38: Password Change on Expiration
   * Feature: self-hosted-security-migration, Property 38: Password Change on Expiration
   * Validates: Requirements 6.6
   * 
   * For any login with expired password, password change SHALL be required before access
   */
  describe('Property 38: Password Change on Expiration', () => {
    it('should prevent login when password is expired', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 12, maxLength: 20 }).filter(s => 
            /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[!@#$%^&*]/.test(s)
          ),
          fc.integer({ min: 91, max: 365 }), // Days past expiration (91-365 days ago)
          async (password, daysAgo) => {
            // Create user with expired password
            const email = `test-${Date.now()}-${Math.random()}@example.com`;
            const passwordChangedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
            const passwordExpiresAt = new Date(passwordChangedAt.getTime() + 90 * 24 * 60 * 60 * 1000);

            await createTestUser(email, password, passwordChangedAt, passwordExpiresAt);

            // Try to login - should fail due to expired password
            const result = await AuthService.authenticateUser({
              email,
              password,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('expired');

            return true;
          }
        ),
        { numRuns: 10, timeout: 180000 }
      );
    }, 180000);

    it('should allow login when password is not expired', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 12, maxLength: 20 }).filter(s => 
            /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[!@#$%^&*]/.test(s)
          ),
          fc.integer({ min: 1, max: 89 }), // Days since password change (1-89 days ago, not expired)
          async (password, daysAgo) => {
            // Create user with non-expired password
            const email = `test-${Date.now()}-${Math.random()}@example.com`;
            const passwordChangedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
            const passwordExpiresAt = new Date(passwordChangedAt.getTime() + 90 * 24 * 60 * 60 * 1000);

            await createTestUser(email, password, passwordChangedAt, passwordExpiresAt);

            // Try to login - should succeed
            const result = await AuthService.authenticateUser({
              email,
              password,
            });

            expect(result.success).toBe(true);
            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).toBeDefined();

            return true;
          }
        ),
        { numRuns: 10, timeout: 180000 }
      );
    }, 180000);

    it('should update password_changed_at when password is changed', async () => {
      // Create user with expired password
      const email = `test-${Date.now()}@example.com`;
      const oldPassword = 'OldPassword123!';
      const newPassword = 'NewPassword456!';
      
      const passwordChangedAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
      const passwordExpiresAt = new Date(passwordChangedAt.getTime() + 90 * 24 * 60 * 60 * 1000);

      const user = await createTestUser(email, oldPassword, passwordChangedAt, passwordExpiresAt);

      // Change password
      const changeResult = await AuthService.changePassword(
        user.id,
        oldPassword,
        newPassword
      );

      expect(changeResult.success).toBe(true);

      // Verify password_changed_at was updated
      const client = await getClient();
      const db = drizzle(client);

      const [updatedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id));

      expect(updatedUser.password_changed_at).toBeDefined();
      expect(updatedUser.password_changed_at!.getTime()).toBeGreaterThan(passwordChangedAt.getTime());
      
      // Verify new expiration date is 90 days from password_changed_at
      const expectedExpiration = new Date(updatedUser.password_changed_at!.getTime() + 90 * 24 * 60 * 60 * 1000);
      const actualExpiration = updatedUser.password_expires_at!.getTime();
      const timeDiff = Math.abs(actualExpiration - expectedExpiration.getTime());
      
      // Allow 2 hours difference for timezone issues and test execution time
      expect(timeDiff).toBeLessThan(2 * 60 * 60 * 1000);
    }, 180000);

    it('should allow login after password change for previously expired password', async () => {
      // Create user with expired password
      const email = `test-${Date.now()}@example.com`;
      const oldPassword = 'OldPassword123!';
      const newPassword = 'NewPassword456!';
      
      const passwordChangedAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
      const passwordExpiresAt = new Date(passwordChangedAt.getTime() + 90 * 24 * 60 * 60 * 1000);

      const user = await createTestUser(email, oldPassword, passwordChangedAt, passwordExpiresAt);

      // Verify login fails with expired password
      const loginBeforeChange = await AuthService.authenticateUser({
        email,
        password: oldPassword,
      });

      expect(loginBeforeChange.success).toBe(false);
      expect(loginBeforeChange.error).toContain('expired');

      // Change password
      const changeResult = await AuthService.changePassword(
        user.id,
        oldPassword,
        newPassword
      );

      expect(changeResult.success).toBe(true);

      // Verify login succeeds with new password
      const loginAfterChange = await AuthService.authenticateUser({
        email,
        password: newPassword,
      });

      expect(loginAfterChange.success).toBe(true);
      expect(loginAfterChange.accessToken).toBeDefined();
      expect(loginAfterChange.refreshToken).toBeDefined();
    }, 180000);
  });
});
