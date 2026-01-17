/**
 * Encryption utilities for SonicWall API credentials
 * Uses AES-256-GCM for secure credential storage
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM, this is always 16
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const ITERATIONS = 100000;

/**
 * Encrypt credentials using AES-256-GCM
 */
export function encryptCredentials(
  username: string,
  password: string,
  encryptionKey: string
): { encrypted: string; iv: string } {
  try {
    // Generate a random IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipher(ALGORITHM, encryptionKey);
    cipher.setAAD(Buffer.from('sonicwall-credentials'));
    
    // Encrypt the credentials object
    const credentials = JSON.stringify({ username, password });
    let encrypted = cipher.update(credentials, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get the authentication tag
    const tag = cipher.getAuthTag();
    
    // Combine encrypted data with tag
    const result = encrypted + tag.toString('hex');
    
    return {
      encrypted: result,
      iv: iv.toString('hex'),
    };
  } catch (error) {
    throw new Error(`Failed to encrypt credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt credentials using AES-256-GCM
 */
export function decryptCredentials(
  encryptedData: string,
  iv: string,
  encryptionKey: string
): { username: string; password: string } {
  try {
    // Extract the tag from the end of the encrypted data
    const tag = Buffer.from(encryptedData.slice(-TAG_LENGTH * 2), 'hex');
    const encrypted = encryptedData.slice(0, -TAG_LENGTH * 2);
    
    // Create decipher
    const decipher = crypto.createDecipher(ALGORITHM, encryptionKey);
    decipher.setAAD(Buffer.from('sonicwall-credentials'));
    decipher.setAuthTag(tag);
    
    // Decrypt
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Parse the credentials
    const credentials = JSON.parse(decrypted);
    
    if (!credentials.username || !credentials.password) {
      throw new Error('Invalid credentials format');
    }
    
    return {
      username: credentials.username,
      password: credentials.password,
    };
  } catch (error) {
    throw new Error(`Failed to decrypt credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate a secure encryption key from a master password
 */
export function deriveEncryptionKey(masterPassword: string, salt?: string): { key: string; salt: string } {
  try {
    // Generate salt if not provided
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(SALT_LENGTH);
    
    // Derive key using PBKDF2
    const key = crypto.pbkdf2Sync(masterPassword, saltBuffer, ITERATIONS, 32, 'sha512');
    
    return {
      key: key.toString('hex'),
      salt: saltBuffer.toString('hex'),
    };
  } catch (error) {
    throw new Error(`Failed to derive encryption key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate encryption key format
 */
export function validateEncryptionKey(key: string): boolean {
  try {
    // Key should be 64 hex characters (32 bytes)
    return /^[0-9a-fA-F]{64}$/.test(key);
  } catch {
    return false;
  }
}

/**
 * Generate a random master password for testing
 */
export function generateMasterPassword(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Secure credential storage helper
 */
export class CredentialManager {
  private encryptionKey: string;

  constructor(masterPassword: string, salt?: string) {
    const derived = deriveEncryptionKey(masterPassword, salt);
    this.encryptionKey = derived.key;
  }

  /**
   * Encrypt and store credentials
   */
  encryptCredentials(username: string, password: string): { encrypted: string; iv: string } {
    return encryptCredentials(username, password, this.encryptionKey);
  }

  /**
   * Decrypt stored credentials
   */
  decryptCredentials(encryptedData: string, iv: string): { username: string; password: string } {
    return decryptCredentials(encryptedData, iv, this.encryptionKey);
  }

  /**
   * Test encryption/decryption roundtrip
   */
  testEncryption(username: string, password: string): boolean {
    try {
      const encrypted = this.encryptCredentials(username, password);
      const decrypted = this.decryptCredentials(encrypted.encrypted, encrypted.iv);
      return decrypted.username === username && decrypted.password === password;
    } catch {
      return false;
    }
  }
}

/**
 * Environment-based credential manager
 * Uses environment variables for the master password
 */
export class EnvironmentCredentialManager extends CredentialManager {
  constructor() {
    const masterPassword = process.env.FIREWALL_ENCRYPTION_KEY;
    if (!masterPassword) {
      throw new Error('FIREWALL_ENCRYPTION_KEY environment variable is required');
    }
    super(masterPassword);
  }
}