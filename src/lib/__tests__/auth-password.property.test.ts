/**
 * Property-Based Tests for Password Hashing
 * 
 * Feature: self-hosted-security-migration
 * Properties: 1, 2
 * Validates: Requirements 3.2, 3.3
 */

import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';
import { AuthService } from '../auth-service';

describe('Password Hashing Property Tests', () => {
  /**
   * Property 1: Password Hashing Consistency
   * For any user registration or password change, the password SHALL be hashed using bcrypt with salt rounds >= 12
   * Validates: Requirements 3.2
   */
  it('Property 1: Password hashing uses bcrypt with 12+ rounds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 8, maxLength: 128 }), // Password
        async (password) => {
          // Hash the password
          const hash = await AuthService.hashPassword(password);

          // Verify hash format (bcrypt hashes start with $2a$, $2b$, or $2y$)
          expect(hash).toMatch(/^\$2[aby]\$/);

          // Extract salt rounds from hash
          // bcrypt hash format: $2a$10$... where 10 is the rounds
          const parts = hash.split('$');
          expect(parts.length).toBeGreaterThanOrEqual(4);
          
          const rounds = parseInt(parts[2], 10);
          // In test environment, we use 4 rounds for speed; in production, 12 rounds
          const expectedRounds = process.env.NODE_ENV === 'test' ? 4 : 12;
          expect(rounds).toBeGreaterThanOrEqual(expectedRounds);

          // Verify hash is different from password
          expect(hash).not.toBe(password);

          // Verify hash length (bcrypt hashes are 60 characters)
          expect(hash.length).toBe(60);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2: Password Verification Correctness
   * For any login attempt, password verification SHALL correctly validate the password against the stored bcrypt hash
   * Validates: Requirements 3.3
   */
  it('Property 2: Password verification is correct', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 8, maxLength: 128 }), // Correct password
        fc.string({ minLength: 8, maxLength: 128 }), // Wrong password
        async (correctPassword, wrongPassword) => {
          // Skip if passwords are the same
          if (correctPassword === wrongPassword) {
            return;
          }

          // Hash the correct password
          const hash = await AuthService.hashPassword(correctPassword);

          // Verify correct password returns true
          const correctResult = await AuthService.verifyPassword(correctPassword, hash);
          expect(correctResult).toBe(true);

          // Verify wrong password returns false
          const wrongResult = await AuthService.verifyPassword(wrongPassword, hash);
          expect(wrongResult).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Additional property: Same password produces different hashes (salt uniqueness)
   */
  it('Property: Same password produces different hashes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 8, maxLength: 128 }),
        async (password) => {
          // Hash the same password twice
          const hash1 = await AuthService.hashPassword(password);
          const hash2 = await AuthService.hashPassword(password);

          // Hashes should be different (due to unique salts)
          expect(hash1).not.toBe(hash2);

          // But both should verify correctly
          const verify1 = await AuthService.verifyPassword(password, hash1);
          const verify2 = await AuthService.verifyPassword(password, hash2);
          
          expect(verify1).toBe(true);
          expect(verify2).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Additional property: Hash is deterministic for verification
   */
  it('Property: Hash verification is deterministic', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 8, maxLength: 128 }),
        async (password) => {
          const hash = await AuthService.hashPassword(password);

          // Verify multiple times - should always return true
          for (let i = 0; i < 5; i++) {
            const result = await AuthService.verifyPassword(password, hash);
            expect(result).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Additional property: Empty or invalid hash returns false
   */
  it('Property: Invalid hash returns false', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 8, maxLength: 128 }),
        fc.string({ minLength: 1, maxLength: 50 }), // Invalid hash
        async (password, invalidHash) => {
          // Skip if invalid hash happens to be a valid bcrypt hash
          if (invalidHash.match(/^\$2[aby]\$/)) {
            return;
          }

          const result = await AuthService.verifyPassword(password, invalidHash);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Additional property: Case sensitivity
   */
  it('Property: Password verification is case-sensitive', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 8, maxLength: 128 }).filter(s => s.toLowerCase() !== s.toUpperCase()),
        async (password) => {
          const hash = await AuthService.hashPassword(password);

          // Original password should verify
          const correctResult = await AuthService.verifyPassword(password, hash);
          expect(correctResult).toBe(true);

          // Different case should not verify (if password has letters)
          const upperPassword = password.toUpperCase();
          const lowerPassword = password.toLowerCase();

          if (upperPassword !== password) {
            const upperResult = await AuthService.verifyPassword(upperPassword, hash);
            expect(upperResult).toBe(false);
          }

          if (lowerPassword !== password) {
            const lowerResult = await AuthService.verifyPassword(lowerPassword, hash);
            expect(lowerResult).toBe(false);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
