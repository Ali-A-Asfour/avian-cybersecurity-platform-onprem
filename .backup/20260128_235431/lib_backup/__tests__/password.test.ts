/**
 * Unit Tests for Password Management
 * Tests password hashing, verification, and validation
 * Part of Phase 9: Testing (Task 9.1)
 */

import {
    hashPassword,
    verifyPassword,
    validatePassword,
} from '../password';

describe('Password Hashing', () => {
    describe('hashPassword', () => {
        it('should hash a password successfully', async () => {
            const password = 'TestPassword123!';
            const hash = await hashPassword(password);

            expect(hash).toBeDefined();
            expect(hash).not.toBe(password);
            expect(hash.length).toBeGreaterThan(50);
            expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
        });

        it('should generate different hashes for the same password', async () => {
            const password = 'TestPassword123!';
            const hash1 = await hashPassword(password);
            const hash2 = await hashPassword(password);

            expect(hash1).not.toBe(hash2); // Different salts
        });

        it('should handle empty password', async () => {
            await expect(hashPassword('')).rejects.toThrow();
        });

        it('should handle very long passwords', async () => {
            const longPassword = 'a'.repeat(100) + 'A1!';
            const hash = await hashPassword(longPassword);

            expect(hash).toBeDefined();
            expect(hash.length).toBeGreaterThan(50);
        });
    });

    describe('verifyPassword', () => {
        it('should verify correct password', async () => {
            const password = 'TestPassword123!';
            const hash = await hashPassword(password);
            const isValid = await verifyPassword(password, hash);

            expect(isValid).toBe(true);
        });

        it('should reject incorrect password', async () => {
            const password = 'TestPassword123!';
            const wrongPassword = 'WrongPassword123!';
            const hash = await hashPassword(password);
            const isValid = await verifyPassword(wrongPassword, hash);

            expect(isValid).toBe(false);
        });

        it('should reject empty password', async () => {
            const password = 'TestPassword123!';
            const hash = await hashPassword(password);
            const isValid = await verifyPassword('', hash);

            expect(isValid).toBe(false);
        });

        it('should handle invalid hash format', async () => {
            const password = 'TestPassword123!';
            const invalidHash = 'not-a-valid-hash';
            const isValid = await verifyPassword(password, invalidHash);

            expect(isValid).toBe(false);
        });
    });
});

describe('Password Validation', () => {
    describe('validatePassword', () => {
        it('should accept strong password', () => {
            const result = validatePassword('StrongPass123!@#');

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.score).toBeGreaterThanOrEqual(60);
            expect(['good', 'strong', 'very_strong']).toContain(result.strength);
        });

        it('should reject password without uppercase', () => {
            const result = validatePassword('weakpass123!');

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should reject password without lowercase', () => {
            const result = validatePassword('WEAKPASS123!');

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should reject password without number', () => {
            const result = validatePassword('WeakPassword!');

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should reject password without special character', () => {
            const result = validatePassword('NoSpecialChar1');

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(e => e.includes('special character'))).toBe(true);
        });

        it('should reject password that is too short', () => {
            const result = validatePassword('Short1!');

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should accept password with exactly 12 characters', () => {
            const result = validatePassword('ValidPass1!@');

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });
});
