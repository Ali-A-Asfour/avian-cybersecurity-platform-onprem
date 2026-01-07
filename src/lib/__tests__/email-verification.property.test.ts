/**
 * Property-Based Tests for Email Verification
 * 
 * Tests email verification functionality to ensure:
 * - Property 53: Verification Email on Registration (Requirements 10.1)
 * - Property 54: Verification Token Uniqueness (Requirements 10.2)
 * - Property 55: Email Verification on Valid Token (Requirements 10.3)
 * - Property 56: Login Prevention for Unverified (Requirements 10.4)
 * - Property 57: Verification Email Resend (Requirements 10.5)
 * - Property 58: New Token on Expiration (Requirements 10.6)
 * 
 * Feature: self-hosted-security-migration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import * as fc from 'fast-check';
import { EmailVerificationService } from '../email-verification-service';
import { AuthService } from '../auth-service';
import { EmailService } from '../email-service';
import { getClient } from '../database';
import { drizzle } from 'drizzle-orm/postgres-js';
import { users, tenants, emailVerificationTokens } from '../../../database/schemas/main';
import { eq } from 'drizzle-orm';

describe('Email Verification Property Tests', () => {
  let testTenantId: string;
  let sendVerificationEmailSpy: jest.SpiedFunction<typeof EmailService.sendVerificationEmail>;

  beforeAll(async () => {
    // Create test tenant
    const client = await getClient();
    const db = drizzle(client);

    const [tenant] = await db
      .insert(tenants)
      .values({
        name: 'Email Verification Test Tenant',
        domain: `email-verification-test-${Date.now()}.example.com`,
      })
      .returning();

    testTenantId = tenant.id;

    // Spy on email sending to avoid sending real emails
    sendVerificationEmailSpy = jest.spyOn(EmailService, 'sendVerificationEmail').mockResolvedValue({
      success: true,
      messageId: 'test-message-id',
    });
  });

  afterAll(async () => {
    // Restore spy
    sendVerificationEmailSpy.mockRestore();

    // Clean up test tenant and all related data
    const client = await getClient();
    const db = drizzle(client);

    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });

  beforeEach(async () => {
    // Clean up any test users and tokens before each test
    const client = await getClient();
    const db = drizzle(client);

    await db.delete(users).where(eq(users.tenant_id, testTenantId));
    
    // Clear mock calls
    sendVerificationEmailSpy.mockClear();
  });

  /**
   * Helper: Create a test user
   */
  async function createTestUser(email: string, password: string, emailVerified: boolean = false) {
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
        email_verified: emailVerified,
      })
      .returning();

    return user;
  }

  /**
   * Property 53: Verification Email on Registration
   * Feature: self-hosted-security-migration, Property 53: Verification Email on Registration
   * Validates: Requirements 10.1
   * 
   * For any user registration, a verification email SHALL be sent
   */
  describe('Property 53: Verification Email on Registration', () => {
    it('should send verification email when creating verification token', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 12, maxLength: 20 }).filter(s => 
            /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[!@#$%^&*]/.test(s)
          ),
          async (email, password) => {
            // Create user
            const user = await createTestUser(email, password, false);

            // Create verification and send email
            const result = await EmailVerificationService.createAndSendVerification(
              user.id,
              email
            );

            // Verify email was sent
            expect(result.success).toBe(true);
            expect(sendVerificationEmailSpy).toHaveBeenCalledWith(
              email,
              expect.any(String)
            );

            return true;
          }
        ),
        { numRuns: 10, timeout: 180000 }
      );
    }, 180000);
  });

  /**
   * Property 54: Verification Token Uniqueness
   * Feature: self-hosted-security-migration, Property 54: Verification Token Uniqueness
   * Validates: Requirements 10.2
   * 
   * For any verification token, it SHALL be unique with 24-hour expiration
   */
  describe('Property 54: Verification Token Uniqueness', () => {
    it('should generate unique tokens for each user', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(
              fc.emailAddress(),
              fc.string({ minLength: 12, maxLength: 20 }).filter(s => 
                /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[!@#$%^&*]/.test(s)
              )
            ),
            { minLength: 2, maxLength: 5 }
          ),
          async (userCredentials) => {
            const tokens: string[] = [];

            // Create users and tokens
            for (const [email, password] of userCredentials) {
              const user = await createTestUser(email, password, false);
              await EmailVerificationService.createAndSendVerification(user.id, email);

              // Get the token from database
              const client = await getClient();
              const db = drizzle(client);

              const [tokenRecord] = await db
                .select()
                .from(emailVerificationTokens)
                .where(eq(emailVerificationTokens.user_id, user.id))
                .limit(1);

              if (tokenRecord) {
                tokens.push(tokenRecord.token);
              }
            }

            // Verify all tokens are unique
            const uniqueTokens = new Set(tokens);
            expect(uniqueTokens.size).toBe(tokens.length);

            return true;
          }
        ),
        { numRuns: 10, timeout: 180000 }
      );
    }, 180000);

    it('should set 24-hour expiration on tokens', async () => {
      const email = `test-${Date.now()}@example.com`;
      const password = 'TestPassword123!';
      const user = await createTestUser(email, password, false);

      await EmailVerificationService.createAndSendVerification(user.id, email);

      // Get the token from database
      const client = await getClient();
      const db = drizzle(client);

      const [tokenRecord] = await db
        .select()
        .from(emailVerificationTokens)
        .where(eq(emailVerificationTokens.user_id, user.id))
        .limit(1);

      expect(tokenRecord).toBeDefined();

      // Verify expiration is approximately 24 hours from now
      const now = Date.now();
      const expiresAt = tokenRecord!.expires_at.getTime();
      const expectedExpiration = now + 24 * 60 * 60 * 1000;
      const timeDiff = Math.abs(expiresAt - expectedExpiration);

      // Allow 5 seconds difference for test execution time
      expect(timeDiff).toBeLessThan(5000);
    }, 180000);
  });

  /**
   * Property 55: Email Verification on Valid Token
   * Feature: self-hosted-security-migration, Property 55: Email Verification on Valid Token
   * Validates: Requirements 10.3
   * 
   * For any valid verification token, the email SHALL be marked as verified
   */
  describe('Property 55: Email Verification on Valid Token', () => {
    it('should mark email as verified when valid token is used', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 12, maxLength: 20 }).filter(s => 
            /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[!@#$%^&*]/.test(s)
          ),
          async (email, password) => {
            // Create unverified user
            const user = await createTestUser(email, password, false);
            await EmailVerificationService.createAndSendVerification(user.id, email);

            // Get the token
            const client = await getClient();
            const db = drizzle(client);

            const [tokenRecord] = await db
              .select()
              .from(emailVerificationTokens)
              .where(eq(emailVerificationTokens.user_id, user.id))
              .limit(1);

            expect(tokenRecord).toBeDefined();

            // Verify email with token
            const result = await EmailVerificationService.verifyEmail(tokenRecord!.token);

            expect(result.success).toBe(true);
            expect(result.userId).toBe(user.id);

            // Check user is now verified
            const [updatedUser] = await db
              .select()
              .from(users)
              .where(eq(users.id, user.id))
              .limit(1);

            expect(updatedUser.email_verified).toBe(true);

            return true;
          }
        ),
        { numRuns: 10, timeout: 180000 }
      );
    }, 180000);

    it('should reject expired tokens', async () => {
      const email = `test-${Date.now()}@example.com`;
      const password = 'TestPassword123!';
      const user = await createTestUser(email, password, false);

      // Create token with past expiration
      const client = await getClient();
      const db = drizzle(client);

      const expiredToken = EmailVerificationService.generateToken();
      const pastExpiration = new Date(Date.now() - 1000); // 1 second ago

      await db.insert(emailVerificationTokens).values({
        user_id: user.id,
        token: expiredToken,
        expires_at: pastExpiration,
      });

      // Try to verify with expired token
      const result = await EmailVerificationService.verifyEmail(expiredToken);

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    }, 180000);
  });

  /**
   * Property 56: Login Prevention for Unverified
   * Feature: self-hosted-security-migration, Property 56: Login Prevention for Unverified
   * Validates: Requirements 10.4
   * 
   * For any unverified account, login SHALL be blocked
   */
  describe('Property 56: Login Prevention for Unverified', () => {
    it('should prevent login for unverified accounts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 12, maxLength: 20 }).filter(s => 
            /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[!@#$%^&*]/.test(s)
          ),
          async (email, password) => {
            // Create unverified user
            await createTestUser(email, password, false);

            // Try to login
            const result = await AuthService.authenticateUser({
              email,
              password,
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('verify');

            return true;
          }
        ),
        { numRuns: 10, timeout: 180000 }
      );
    }, 180000);

    it('should allow login for verified accounts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 12, maxLength: 20 }).filter(s => 
            /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[!@#$%^&*]/.test(s)
          ),
          async (email, password) => {
            // Create verified user
            await createTestUser(email, password, true);

            // Try to login
            const result = await AuthService.authenticateUser({
              email,
              password,
            });

            expect(result.success).toBe(true);
            expect(result.accessToken).toBeDefined();

            return true;
          }
        ),
        { numRuns: 10, timeout: 180000 }
      );
    }, 180000);
  });

  /**
   * Property 57: Verification Email Resend
   * Feature: self-hosted-security-migration, Property 57: Verification Email Resend
   * Validates: Requirements 10.5
   * 
   * For any resend request, a new verification email SHALL be sent
   */
  describe('Property 57: Verification Email Resend', () => {
    it('should send new verification email on resend request', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 12, maxLength: 20 }).filter(s => 
            /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[!@#$%^&*]/.test(s)
          ),
          async (email, password) => {
            // Create unverified user
            const user = await createTestUser(email, password, false);
            await EmailVerificationService.createAndSendVerification(user.id, email);

            // Clear mock to track resend
            sendVerificationEmailSpy.mockClear();

            // Resend verification
            const result = await EmailVerificationService.resendVerification(email);

            expect(result.success).toBe(true);
            expect(sendVerificationEmailSpy).toHaveBeenCalledWith(
              email,
              expect.any(String)
            );

            return true;
          }
        ),
        { numRuns: 10, timeout: 180000 }
      );
    }, 180000);

    it('should not reveal if email does not exist', async () => {
      const nonExistentEmail = `nonexistent-${Date.now()}@example.com`;

      // Resend for non-existent email
      const result = await EmailVerificationService.resendVerification(nonExistentEmail);

      // Should return success to prevent email enumeration
      expect(result.success).toBe(true);
      expect(sendVerificationEmailSpy).not.toHaveBeenCalled();
    }, 180000);
  });

  /**
   * Property 58: New Token on Expiration
   * Feature: self-hosted-security-migration, Property 58: New Token on Expiration
   * Validates: Requirements 10.6
   * 
   * For any expired verification token, a new token SHALL be generated on request
   */
  describe('Property 58: New Token on Expiration', () => {
    it('should generate new token when resending after expiration', async () => {
      const email = `test-${Date.now()}@example.com`;
      const password = 'TestPassword123!';
      const user = await createTestUser(email, password, false);

      // Create expired token
      const client = await getClient();
      const db = drizzle(client);

      const expiredToken = EmailVerificationService.generateToken();
      const pastExpiration = new Date(Date.now() - 1000);

      await db.insert(emailVerificationTokens).values({
        user_id: user.id,
        token: expiredToken,
        expires_at: pastExpiration,
      });

      // Resend verification (should create new token)
      const result = await EmailVerificationService.resendVerification(email);

      expect(result.success).toBe(true);

      // Get new token
      const [newTokenRecord] = await db
        .select()
        .from(emailVerificationTokens)
        .where(eq(emailVerificationTokens.user_id, user.id))
        .limit(1);

      expect(newTokenRecord).toBeDefined();
      expect(newTokenRecord!.token).not.toBe(expiredToken);
      expect(newTokenRecord!.expires_at.getTime()).toBeGreaterThan(Date.now());
    }, 180000);
  });
});
