/**
 * Property-Based Tests for Password Policy
 * 
 * Tests universal correctness properties for password validation and expiration.
 * 
 * Properties tested:
 * - Property 33: Password Minimum Length
 * - Property 34: Password Complexity Requirements
 * - Property 37: Password Expiration Enforcement
 * - Property 39: Dual Password Validation
 * 
 * Requirements: 6.1, 6.2, 6.5, 6.7
 */

import * as fc from 'fast-check';
import {
  PasswordPolicy,
  validatePassword,
  isPasswordExpired,
  getDaysUntilExpiration,
  calculateExpirationDate,
  DEFAULT_PASSWORD_POLICY,
} from '../password-policy';

describe('Password Policy Property Tests', () => {
  describe('Property 33: Password Minimum Length', () => {
    it('should enforce minimum 12 characters for all passwords', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 50 }),
          async (password) => {
            const result = validatePassword(password);

            if (password.length < 12) {
              // Password too short - must be invalid
              expect(result.valid).toBe(false);
              expect(result.errors.some(e => e.includes('at least 12 characters'))).toBe(true);
            } else {
              // Password meets length requirement
              // (may still be invalid for other reasons)
              if (!result.valid) {
                // If invalid, it should NOT be due to length
                expect(result.errors.some(e => e.includes('at least 12 characters'))).toBe(false);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept passwords with exactly 12 characters if they meet other requirements', () => {
      // Valid 12-character password with all requirements (no sequential/repeated chars)
      const validPassword = 'MyP@ssw0rd12';
      const result = validatePassword(validPassword);
      
      expect(validPassword.length).toBe(12);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject passwords shorter than 12 characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 11 }),
          async (password) => {
            const result = validatePassword(password);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('at least 12 characters'))).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 34: Password Complexity Requirements', () => {
    it('should enforce uppercase, lowercase, numbers, and special characters', () => {
      // Test specific combinations to verify each requirement
      const testCases = [
        // Missing uppercase
        { password: 'abcdefgh123!', hasUpper: false, hasLower: true, hasNumber: true, hasSpecial: true },
        // Missing lowercase
        { password: 'ABCDEFGH123!', hasUpper: true, hasLower: false, hasNumber: true, hasSpecial: true },
        // Missing number
        { password: 'Abcdefghijk!', hasUpper: true, hasLower: true, hasNumber: false, hasSpecial: true },
        // Missing special
        { password: 'Abcdefgh1234', hasUpper: true, hasLower: true, hasNumber: true, hasSpecial: false },
        // All requirements met
        { password: 'Abcdefgh123!', hasUpper: true, hasLower: true, hasNumber: true, hasSpecial: true },
      ];

      testCases.forEach(({ password, hasUpper, hasLower, hasNumber, hasSpecial }) => {
        const result = validatePassword(password);

        // Check that missing requirements are reported
        if (!hasUpper) {
          expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
        } else {
          expect(result.errors.some(e => e.includes('uppercase'))).toBe(false);
        }
        
        if (!hasLower) {
          expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
        } else {
          expect(result.errors.some(e => e.includes('lowercase'))).toBe(false);
        }
        
        if (!hasNumber) {
          expect(result.errors.some(e => e.includes('number'))).toBe(true);
        } else {
          expect(result.errors.some(e => e.includes('number'))).toBe(false);
        }
        
        if (!hasSpecial) {
          expect(result.errors.some(e => e.includes('special character'))).toBe(true);
        } else {
          expect(result.errors.some(e => e.includes('special character'))).toBe(false);
        }

        // If all requirements met, should be valid (unless other issues like sequential chars)
        if (hasUpper && hasLower && hasNumber && hasSpecial) {
          // Should not have complexity errors
          expect(result.errors.some(e => e.includes('uppercase'))).toBe(false);
          expect(result.errors.some(e => e.includes('lowercase'))).toBe(false);
          expect(result.errors.some(e => e.includes('number'))).toBe(false);
          expect(result.errors.some(e => e.includes('special character'))).toBe(false);
        }
      });
    });

    it('should accept passwords with all complexity requirements', () => {
      const validPasswords = [
        'MyP@ssw0rd12',
        'Secure#Pass1',
        'C0mpl3x!Pass',
        'Valid$Passw0rd',
        'Str0ng!Passw',
      ];

      validPasswords.forEach(password => {
        const result = validatePassword(password);
        if (!result.valid) {
          console.log(`Password "${password}" failed:`, result.errors);
        }
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject passwords missing any complexity requirement', () => {
      const invalidPasswords = [
        { password: 'abcdef123!@#', missing: 'uppercase' },
        { password: 'ABCDEF123!@#', missing: 'lowercase' },
        { password: 'Abcdefghij!@', missing: 'number' },
        { password: 'Abcdef123456', missing: 'special' },
      ];

      invalidPasswords.forEach(({ password, missing }) => {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.toLowerCase().includes(missing))).toBe(true);
      });
    });
  });

  describe('Property 37: Password Expiration Enforcement', () => {
    it('should enforce 90-day password expiration for all passwords', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 180 }), // Days ago
          async (daysAgo) => {
            const passwordChangedAt = new Date();
            passwordChangedAt.setDate(passwordChangedAt.getDate() - daysAgo);

            const expired = isPasswordExpired(passwordChangedAt);

            if (daysAgo > 90) {
              // Password older than 90 days - must be expired
              expect(expired).toBe(true);
            } else {
              // Password 90 days or newer - must not be expired
              expect(expired).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate correct expiration date (90 days from change)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          async (passwordChangedAt) => {
            const expirationDate = calculateExpirationDate(passwordChangedAt);

            // Calculate expected expiration (90 days later)
            const expected = new Date(passwordChangedAt);
            expected.setDate(expected.getDate() + 90);

            // Should be exactly 90 days later
            expect(expirationDate.getTime()).toBe(expected.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate correct days until expiration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 180 }),
          async (daysAgo) => {
            const passwordChangedAt = new Date();
            passwordChangedAt.setDate(passwordChangedAt.getDate() - daysAgo);

            const daysUntilExpiration = getDaysUntilExpiration(passwordChangedAt);

            if (daysAgo >= 90) {
              // Already expired - should return 0
              expect(daysUntilExpiration).toBe(0);
            } else {
              // Not expired - should return remaining days
              const expected = 90 - daysAgo;
              // Allow 1 day tolerance for timing
              expect(daysUntilExpiration).toBeGreaterThanOrEqual(expected - 1);
              expect(daysUntilExpiration).toBeLessThanOrEqual(expected + 1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should mark password as expired exactly at 90 days', () => {
      const passwordChangedAt = new Date();
      passwordChangedAt.setDate(passwordChangedAt.getDate() - 90);
      passwordChangedAt.setHours(passwordChangedAt.getHours() - 1); // 90 days + 1 hour ago

      const expired = isPasswordExpired(passwordChangedAt);
      expect(expired).toBe(true);
    });

    it('should not mark password as expired before 90 days', () => {
      const passwordChangedAt = new Date();
      passwordChangedAt.setDate(passwordChangedAt.getDate() - 89);

      const expired = isPasswordExpired(passwordChangedAt);
      expect(expired).toBe(false);
    });
  });

  describe('Property 39: Dual Password Validation', () => {
    it('should provide consistent validation results for same password', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 50 }),
          async (password) => {
            // Validate twice
            const result1 = validatePassword(password);
            const result2 = validatePassword(password);

            // Results should be identical
            expect(result1.valid).toBe(result2.valid);
            expect(result1.errors).toEqual(result2.errors);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate on both client and server side with same rules', () => {
      // This test verifies that the validation function can be used
      // on both client and server with consistent results

      const testPasswords = [
        'Abcdef123!@#', // Valid
        'short', // Too short
        'nouppercase123!', // No uppercase
        'NOLOWERCASE123!', // No lowercase
        'NoNumbers!@#$', // No numbers
        'NoSpecial123', // No special chars
      ];

      testPasswords.forEach(password => {
        // Simulate client-side validation
        const clientResult = validatePassword(password);

        // Simulate server-side validation
        const serverResult = validatePassword(password);

        // Results must match
        expect(clientResult.valid).toBe(serverResult.valid);
        expect(clientResult.errors).toEqual(serverResult.errors);
      });
    });

    it('should provide detailed error messages for validation failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 50 }),
          async (password) => {
            const result = validatePassword(password);

            if (!result.valid) {
              // Must have at least one error message
              expect(result.errors.length).toBeGreaterThan(0);

              // Each error should be a non-empty string
              result.errors.forEach(error => {
                expect(typeof error).toBe('string');
                expect(error.length).toBeGreaterThan(0);
              });
            } else {
              // Valid passwords should have no errors
              expect(result.errors).toHaveLength(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Additional Password Policy Tests', () => {
    it('should reject common weak passwords', () => {
      const weakPasswords = [
        'password',
        'password123',
        'password1234',
        '123456789012',
        'qwertyuiop12',
      ];

      weakPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('common') || e.includes('guessable'))).toBe(true);
      });
    });

    it('should reject passwords with sequential characters', () => {
      const sequentialPasswords = [
        'Abcd1234!@#$', // Contains "1234"
        'Qwerty123!@#', // Contains "qwerty"
        'Abc123456!@#', // Contains "123456"
      ];

      sequentialPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('sequential'))).toBe(true);
      });
    });

    it('should reject passwords with repeated characters', () => {
      const repeatedPasswords = [
        'aaaa1234!@AB', // Contains "aaaa"
        'Abcd1111!@#$', // Contains "1111"
        'Abcd!!!!1234', // Contains "!!!!"
        'Xxxxxx12!@Ab', // Contains "xxxxxx"
      ];

      repeatedPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('repeated'))).toBe(true);
      });
    });

    it('should enforce maximum password length', () => {
      const tooLongPassword = 'A'.repeat(129) + 'bc123!@#';
      const result = validatePassword(tooLongPassword);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('128 characters'))).toBe(true);
    });

    it('should provide policy description', () => {
      const policy = new PasswordPolicy();
      const description = policy.getPolicyDescription();

      expect(Array.isArray(description)).toBe(true);
      expect(description.length).toBeGreaterThan(0);
      expect(description.some(d => d.includes('12 characters'))).toBe(true);
      expect(description.some(d => d.includes('uppercase'))).toBe(true);
      expect(description.some(d => d.includes('lowercase'))).toBe(true);
      expect(description.some(d => d.includes('number'))).toBe(true);
      expect(description.some(d => d.includes('special character'))).toBe(true);
      expect(description.some(d => d.includes('90 days'))).toBe(true);
    });
  });
});
