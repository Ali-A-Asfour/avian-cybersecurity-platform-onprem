/**
 * Firewall Credential Encryption Utility
 * 
 * Provides AES-256-GCM encryption for SonicWall API credentials.
 * Uses Web Crypto API for Edge Runtime compatibility.
 * 
 * Requirements: Task 1.4 - Implement Credential Encryption
 * - AES-256 encryption for API credentials
 * - Encryption key stored in environment variable
 * - Secure storage format with IV
 */

import { CryptoUtils } from './security-utils';

/**
 * Encrypted credential format stored in database
 */
export interface EncryptedCredential {
    encrypted: string;  // Hex-encoded encrypted data
    iv: string;         // Hex-encoded initialization vector
}

/**
 * Firewall credential encryption utilities
 */
export class FirewallEncryption {
    private static readonly ENCRYPTION_KEY_ENV = 'FIREWALL_ENCRYPTION_KEY';

    /**
     * Get encryption key from environment variable
     * Throws error if key is not configured
     */
    private static getEncryptionKey(): string {
        const key = process.env[this.ENCRYPTION_KEY_ENV];

        if (!key) {
            throw new Error(
                `Encryption key not configured. Set ${this.ENCRYPTION_KEY_ENV} environment variable.`
            );
        }

        // Validate key format (should be 64 hex characters for 256-bit key)
        if (!/^[0-9a-f]{64}$/i.test(key)) {
            throw new Error(
                `Invalid encryption key format. Key must be 64 hexadecimal characters (256 bits).`
            );
        }

        return key;
    }

    /**
     * Generate a new encryption key (for initial setup)
     * Returns a 256-bit key as a hex string
     */
    static generateEncryptionKey(): string {
        return CryptoUtils.generateSecureRandom(32); // 32 bytes = 256 bits
    }

    /**
     * Encrypt firewall API credentials
     * 
     * @param credentials - Plain text credentials (username:password or API key)
     * @returns Encrypted credential object with encrypted data and IV
     * 
     * @example
     * const encrypted = await encryptCredentials('admin:mypassword');
     * // Store encrypted.encrypted and encrypted.iv in database
     */
    static async encryptCredentials(credentials: string): Promise<EncryptedCredential> {
        if (!credentials || credentials.trim().length === 0) {
            throw new Error('Credentials cannot be empty');
        }

        const key = this.getEncryptionKey();

        // Use existing CryptoUtils.encryptData with our key
        const result = await CryptoUtils.encryptData(credentials, key);

        return {
            encrypted: result.encrypted,
            iv: result.iv,
        };
    }

    /**
     * Decrypt firewall API credentials
     * 
     * @param encryptedCredential - Encrypted credential object from database
     * @returns Plain text credentials
     * 
     * @example
     * const plaintext = await decryptCredentials({
     *   encrypted: '...',
     *   iv: '...'
     * });
     * // Use plaintext for API authentication
     */
    static async decryptCredentials(encryptedCredential: EncryptedCredential): Promise<string> {
        if (!encryptedCredential.encrypted || !encryptedCredential.iv) {
            throw new Error('Invalid encrypted credential format');
        }

        const key = this.getEncryptionKey();

        // Use existing CryptoUtils.decryptData with our key
        const decrypted = await CryptoUtils.decryptData(
            encryptedCredential.encrypted,
            key,
            encryptedCredential.iv
        );

        return decrypted;
    }

    /**
     * Encrypt API password for storage in database
     * Convenience method that returns a JSON string for the api_password_encrypted field
     * 
     * @param password - Plain text API password
     * @returns JSON string containing encrypted data and IV
     */
    static async encryptPassword(password: string): Promise<string> {
        const encrypted = await this.encryptCredentials(password);
        return JSON.stringify(encrypted);
    }

    /**
     * Decrypt API password from database
     * Convenience method that parses JSON string from api_password_encrypted field
     * 
     * @param encryptedJson - JSON string from database
     * @returns Plain text password
     */
    static async decryptPassword(encryptedJson: string): Promise<string> {
        try {
            const encrypted = JSON.parse(encryptedJson) as EncryptedCredential;
            return await this.decryptCredentials(encrypted);
        } catch (error) {
            throw new Error(`Failed to decrypt password: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Validate that encryption is properly configured
     * Performs a round-trip test to ensure encryption/decryption works
     * 
     * @returns true if encryption is working, throws error otherwise
     */
    static async validateEncryption(): Promise<boolean> {
        const testData = 'test-credential-' + Date.now();

        try {
            // Encrypt test data
            const encrypted = await this.encryptCredentials(testData);

            // Decrypt and verify
            const decrypted = await this.decryptCredentials(encrypted);

            if (decrypted !== testData) {
                throw new Error('Encryption round-trip failed: decrypted data does not match original');
            }

            return true;
        } catch (error) {
            throw new Error(
                `Encryption validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}
