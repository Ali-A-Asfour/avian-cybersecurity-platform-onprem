/**
 * Tests for Firewall Credential Encryption
 * 
 * Requirements: Task 1.4 - Test encryption/decryption roundtrip
 */

import { FirewallEncryption } from '../firewall-encryption';

describe('FirewallEncryption', () => {
    // Set up test encryption key before tests
    const TEST_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    beforeAll(() => {
        process.env.FIREWALL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    });

    afterAll(() => {
        delete process.env.FIREWALL_ENCRYPTION_KEY;
    });

    describe('generateEncryptionKey', () => {
        it('should generate a valid 256-bit key', () => {
            const key = FirewallEncryption.generateEncryptionKey();

            // Should be 64 hex characters (32 bytes = 256 bits)
            expect(key).toMatch(/^[0-9a-f]{64}$/i);
            expect(key.length).toBe(64);
        });

        it('should generate unique keys', () => {
            const key1 = FirewallEncryption.generateEncryptionKey();
            const key2 = FirewallEncryption.generateEncryptionKey();

            expect(key1).not.toBe(key2);
        });
    });

    describe('encryptCredentials', () => {
        it('should encrypt credentials successfully', async () => {
            const credentials = 'admin:password123';
            const encrypted = await FirewallEncryption.encryptCredentials(credentials);

            expect(encrypted).toHaveProperty('encrypted');
            expect(encrypted).toHaveProperty('iv');
            expect(encrypted.encrypted).toMatch(/^[0-9a-f]+$/i);
            expect(encrypted.iv).toMatch(/^[0-9a-f]+$/i);
        });

        it('should produce different encrypted values for same input', async () => {
            const credentials = 'admin:password123';
            const encrypted1 = await FirewallEncryption.encryptCredentials(credentials);
            const encrypted2 = await FirewallEncryption.encryptCredentials(credentials);

            // Different IVs should produce different encrypted values
            expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
            expect(encrypted1.iv).not.toBe(encrypted2.iv);
        });

        it('should throw error for empty credentials', async () => {
            await expect(FirewallEncryption.encryptCredentials('')).rejects.toThrow('Credentials cannot be empty');
            await expect(FirewallEncryption.encryptCredentials('   ')).rejects.toThrow('Credentials cannot be empty');
        });

        it('should throw error when encryption key is not set', async () => {
            delete process.env.FIREWALL_ENCRYPTION_KEY;

            await expect(FirewallEncryption.encryptCredentials('test')).rejects.toThrow('Encryption key not configured');

            // Restore key
            process.env.FIREWALL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
        });
    });

    describe('decryptCredentials', () => {
        it('should decrypt credentials successfully', async () => {
            const originalCredentials = 'admin:password123';
            const encrypted = await FirewallEncryption.encryptCredentials(originalCredentials);
            const decrypted = await FirewallEncryption.decryptCredentials(encrypted);

            expect(decrypted).toBe(originalCredentials);
        });

        it('should handle special characters in credentials', async () => {
            const specialCredentials = 'user@domain.com:P@ssw0rd!#$%^&*()';
            const encrypted = await FirewallEncryption.encryptCredentials(specialCredentials);
            const decrypted = await FirewallEncryption.decryptCredentials(encrypted);

            expect(decrypted).toBe(specialCredentials);
        });

        it('should handle long credentials', async () => {
            const longCredentials = 'a'.repeat(1000);
            const encrypted = await FirewallEncryption.encryptCredentials(longCredentials);
            const decrypted = await FirewallEncryption.decryptCredentials(encrypted);

            expect(decrypted).toBe(longCredentials);
        });

        it('should throw error for invalid encrypted credential format', async () => {
            await expect(FirewallEncryption.decryptCredentials({ encrypted: '', iv: '' })).rejects.toThrow('Invalid encrypted credential format');
            await expect(FirewallEncryption.decryptCredentials({ encrypted: 'abc', iv: '' })).rejects.toThrow('Invalid encrypted credential format');
        });

        it('should throw error when decrypting with wrong key', async () => {
            const credentials = 'admin:password123';
            const encrypted = await FirewallEncryption.encryptCredentials(credentials);

            // Change the key
            process.env.FIREWALL_ENCRYPTION_KEY = '1111111111111111111111111111111111111111111111111111111111111111';

            await expect(FirewallEncryption.decryptCredentials(encrypted)).rejects.toThrow();

            // Restore key
            process.env.FIREWALL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
        });
    });

    describe('encryptPassword and decryptPassword', () => {
        it('should encrypt and decrypt password as JSON string', async () => {
            const password = 'mySecurePassword123!';
            const encryptedJson = await FirewallEncryption.encryptPassword(password);

            // Should be valid JSON
            expect(() => JSON.parse(encryptedJson)).not.toThrow();

            const decrypted = await FirewallEncryption.decryptPassword(encryptedJson);
            expect(decrypted).toBe(password);
        });

        it('should throw error for invalid JSON', async () => {
            await expect(FirewallEncryption.decryptPassword('not-valid-json')).rejects.toThrow('Failed to decrypt password');
        });
    });

    describe('validateEncryption', () => {
        it('should validate encryption is working correctly', async () => {
            const result = await FirewallEncryption.validateEncryption();
            expect(result).toBe(true);
        });

        it('should throw error when encryption key is invalid', async () => {
            process.env.FIREWALL_ENCRYPTION_KEY = 'invalid-key';

            await expect(FirewallEncryption.validateEncryption()).rejects.toThrow('Invalid encryption key format');

            // Restore key
            process.env.FIREWALL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
        });

        it('should throw error when encryption key is missing', async () => {
            delete process.env.FIREWALL_ENCRYPTION_KEY;

            await expect(FirewallEncryption.validateEncryption()).rejects.toThrow('Encryption key not configured');

            // Restore key
            process.env.FIREWALL_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
        });
    });

    describe('Round-trip encryption', () => {
        it('should successfully encrypt and decrypt various credential formats', async () => {
            const testCases = [
                'admin:password',
                'user@example.com:P@ssw0rd123!',
                'api-key-12345678',
                'very-long-password-with-many-characters-' + 'x'.repeat(100),
                'unicode-密码-🔐',
            ];

            for (const credentials of testCases) {
                const encrypted = await FirewallEncryption.encryptCredentials(credentials);
                const decrypted = await FirewallEncryption.decryptCredentials(encrypted);

                expect(decrypted).toBe(credentials);
            }
        });
    });
});
