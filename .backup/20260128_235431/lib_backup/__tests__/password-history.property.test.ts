/**
 * Property-Based Tests for Password History
 * 
 * Tests password history functionality to ensure:
 * - Property 35: Password History Prevention (Requirements 6.3)
 * - Property 36: Password History Hashing (Requirements 6.4)
 * 
 * Feature: self-hosted-security-migration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { AuthService } from '../auth-service';
import { getClient } from '../database';
import { drizzle } from 'drizzle-orm/postgres-js';
import { users, tenants, passwordHistory } from '../../../database/schemas/main';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

describe('Password History Property Tests', () => {
  let testTenantId: string;

  beforeAll(async () => {
    // Create test tenant
    const client = await getClient();
    const db = drizzle(client);

    const [tenant] = await db
      .insert(tenants)
      .values({
        name: 'Password History Test Tenant',
        domain: `password-history-test-${Date.now()}.example.com`,
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
   * Helper: Create a test user with a password
   */
  async function createTestUser(email: string, password: string) {
    const client = await getClient();
    const db = drizzle(client);

    const passwordHash = await AuthService.hashPassword(password);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const [user] = await db
      .insert(users)
      .values({
        tenant_id: testTenantId,
        email,
        first_name: 'Test',
        last_name: 'User',
        role: 'user',
        password_hash: passwordHash,
        password_changed_at: now,
        password_expires_at: expiresAt,
        email_verified: true,
      })
      .returning();

    return user;
  }

  /**
   * Helper: Add passwords to history with proper timestamps
   */
  async function addPasswordsToHistory(userId: string, passwords: string[]) {
    const client = await getClient();
    const db = drizzle(client);

    for (let i = 0; i < passwords.length; i++) {
      const password = passwords[i];
      const hash = await AuthService.hashPassword(password);
      
      // Add password with explicit timestamp to ensure proper ordering
      // Older passwords get earlier timestamps
      const createdAt = new Date(Date.now() - (passwords.length - i) * 1000);
      
      await db.insert(passwordHistory).values({
        user_id: userId,
        password_hash: hash,
        created_at: createdAt,
      });
    }
  }

  /**
   * Property 35: Password History Prevention
   * Feature: self-hosted-security-migration, Property 35: Password History Prevention
   * Validates: Requirements 6.3
   * 
   * For any password change, the new password SHALL not match any of the last 5 passwords
   */
  describe('Property 35: Password History Prevention', () => {
    it('should prevent reuse of any password in history (last 5)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 12, maxLength: 20 }).filter(s => 
              /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[!@#$%^&*]/.test(s)
            ),
            { minLength: 1, maxLength: 5 }
          ),
          fc.string({ minLength: 12, maxLength: 20 }).filter(s => 
            /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[!@#$%^&*]/.test(s)
          ),
          async (historicalPasswords, currentPassword) => {
            // Create unique passwords
            const uniqueHistorical = Array.from(new Set(historicalPasswords));
            if (uniqueHistorical.length === 0) return true;

            // Create test user
            const email = `test-${Date.now()}-${Math.random()}@example.com`;
            const user = await createTestUser(email, currentPassword);

            // Add historical passwords
            await addPasswordsToHistory(user.id, uniqueHistorical);

            // Try to change to each historical password - should fail
            for (const oldPassword of uniqueHistorical) {
              const result = await AuthService.changePassword(
                user.id,
                currentPassword,
                oldPassword
              );

              expect(result.success).toBe(false);
              expect(result.error).toContain('used recently');
            }

            return true;
          }
        ),
        { numRuns: 10, timeout: 180000 }
      );
    }, 180000);

    it('should allow password change if not in history', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 12, maxLength: 20 }).filter(s => 
            /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[!@#$%^&*]/.test(s)
          ),
          fc.string({ minLength: 12, maxLength: 20 }).filter(s => 
            /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[!@#$%^&*]/.test(s)
          ),
          async (currentPassword, newPassword) => {
            // Skip if passwords are the same
            if (currentPassword === newPassword) return true;

            // Create test user
            const email = `test-${Date.now()}-${Math.random()}@example.com`;
            const user = await createTestUser(email, currentPassword);

            // Change password (should succeed since no history)
            const result = await AuthService.changePassword(
              user.id,
              currentPassword,
              newPassword
            );

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();

            return true;
          }
        ),
        { numRuns: 10, timeout: 180000 }
      );
    }, 180000);

    it('should only check last 5 passwords in history', async () => {
      // Create test user
      const email = `test-${Date.now()}@example.com`;
      const currentPassword = 'CurrentPass123!';
      const user = await createTestUser(email, currentPassword);

      // Add 6 passwords to history (oldest to newest)
      // The helper function will add them with timestamps ensuring proper order
      const oldPasswords = [
        'OldPass1!Aa1', // Oldest (6th in history)
        'OldPass2!Bb2', // 5th
        'OldPass3!Cc3', // 4th
        'OldPass4!Dd4', // 3rd
        'OldPass5!Ee5', // 2nd
        'OldPass6!Ff6', // Newest (1st in history)
      ];

      await addPasswordsToHistory(user.id, oldPasswords);

      // Try to change to the oldest password (1st in array, 6th in history)
      // This should succeed because we only check the last 5 passwords
      const result = await AuthService.changePassword(
        user.id,
        currentPassword,
        'OldPass1!Aa1' // This is the 6th password, should be allowed
      );

      expect(result.success).toBe(true);
    }, 180000);
  });

  /**
   * Property 36: Password History Hashing
   * Feature: self-hosted-security-migration, Property 36: Password History Hashing
   * Validates: Requirements 6.4
   * 
   * For any password history entry, the password SHALL be stored as a bcrypt hash
   */
  describe('Property 36: Password History Hashing', () => {
    it('should store all password history entries as bcrypt hashes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 12, maxLength: 20 }).filter(s => 
            /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[!@#$%^&*]/.test(s)
          ),
          fc.string({ minLength: 12, maxLength: 20 }).filter(s => 
            /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[!@#$%^&*]/.test(s)
          ),
          async (currentPassword, newPassword) => {
            // Skip if passwords are the same
            if (currentPassword === newPassword) return true;

            // Create test user
            const email = `test-${Date.now()}-${Math.random()}@example.com`;
            const user = await createTestUser(email, currentPassword);

            // Change password (this should add old password to history)
            await AuthService.changePassword(user.id, currentPassword, newPassword);

            // Get password history entries
            const client = await getClient();
            const db = drizzle(client);

            const history = await db
              .select()
              .from(passwordHistory)
              .where(eq(passwordHistory.user_id, user.id));

            // Verify all history entries are bcrypt hashes
            for (const entry of history) {
              // Bcrypt hashes start with $2a$, $2b$, or $2y$ followed by cost factor
              expect(entry.password_hash).toMatch(/^\$2[aby]\$\d{2}\$/);

              // Verify it's a valid bcrypt hash by checking length (60 chars)
              expect(entry.password_hash.length).toBe(60);

              // Verify we can use bcrypt to compare against it
              const canCompare = await bcrypt.compare(
                currentPassword,
                entry.password_hash
              );
              expect(typeof canCompare).toBe('boolean');
            }

            return true;
          }
        ),
        { numRuns: 10, timeout: 180000 }
      );
    }, 180000);

    it('should use bcrypt with appropriate cost factor for history entries', async () => {
      // Create test user
      const email = `test-${Date.now()}@example.com`;
      const currentPassword = 'CurrentPass123!';
      const newPassword = 'NewPassword456!';
      const user = await createTestUser(email, currentPassword);

      // Change password
      await AuthService.changePassword(user.id, currentPassword, newPassword);

      // Get password history
      const client = await getClient();
      const db = drizzle(client);

      const history = await db
        .select()
        .from(passwordHistory)
        .where(eq(passwordHistory.user_id, user.id));

      expect(history.length).toBeGreaterThan(0);

      // Check bcrypt cost factor (should be 4 in test, 12 in production)
      const expectedRounds = process.env.NODE_ENV === 'test' ? 4 : 12;

      for (const entry of history) {
        const rounds = parseInt(entry.password_hash.split('$')[2]);
        expect(rounds).toBe(expectedRounds);
      }
    }, 180000);

    it('should verify password history hashes correctly match original passwords', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.string({ minLength: 12, maxLength: 20 }).filter(s => 
              /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[!@#$%^&*]/.test(s)
            ),
            { minLength: 1, maxLength: 3 }
          ),
          async (passwords) => {
            const uniquePasswords = Array.from(new Set(passwords));
            if (uniquePasswords.length === 0) return true;

            // Create test user with first password
            const email = `test-${Date.now()}-${Math.random()}@example.com`;
            const user = await createTestUser(email, uniquePasswords[0]);

            // Add passwords to history
            await addPasswordsToHistory(user.id, uniquePasswords);

            // Get password history
            const client = await getClient();
            const db = drizzle(client);

            const history = await db
              .select()
              .from(passwordHistory)
              .where(eq(passwordHistory.user_id, user.id));

            // Verify each hash can be verified against its original password
            for (let i = 0; i < uniquePasswords.length && i < history.length; i++) {
              const matches = await bcrypt.compare(
                uniquePasswords[i],
                history[i].password_hash
              );
              expect(matches).toBe(true);
            }

            return true;
          }
        ),
        { numRuns: 10, timeout: 180000 }
      );
    }, 180000);
  });

  /**
   * Additional test: Verify password history is added on password change
   */
  describe('Password History Integration', () => {
    it('should add old password to history when changing password', async () => {
      // Create test user
      const email = `test-${Date.now()}@example.com`;
      const currentPassword = 'CurrentPass123!';
      const newPassword = 'NewPassword456!';
      const user = await createTestUser(email, currentPassword);

      // Get initial history count
      const client = await getClient();
      const db = drizzle(client);

      const initialHistory = await db
        .select()
        .from(passwordHistory)
        .where(eq(passwordHistory.user_id, user.id));

      const initialCount = initialHistory.length;

      // Change password
      const result = await AuthService.changePassword(
        user.id,
        currentPassword,
        newPassword
      );

      expect(result.success).toBe(true);

      // Verify history was updated
      const updatedHistory = await db
        .select()
        .from(passwordHistory)
        .where(eq(passwordHistory.user_id, user.id));

      expect(updatedHistory.length).toBe(initialCount + 1);

      // Verify the added entry matches the old password
      const latestEntry = updatedHistory[updatedHistory.length - 1];
      const matches = await bcrypt.compare(currentPassword, latestEntry.password_hash);
      expect(matches).toBe(true);
    }, 180000);
  });
});
