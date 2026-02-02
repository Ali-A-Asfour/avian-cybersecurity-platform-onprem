/**
 * Password Policy Validation
 * 
 * Implements password strength validation and expiration tracking:
 * - Minimum 12 characters
 * - Complexity requirements (uppercase, lowercase, numbers, special characters)
 * - Password expiration (90 days)
 * - Client and server-side validation
 * 
 * Requirements: 6.1, 6.2, 6.5, 6.7
 */

import { logger } from './logger';

/**
 * Password validation result
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Password policy configuration
 */
export interface PasswordPolicyConfig {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  expirationDays: number;
}

/**
 * Default password policy
 * Requirements: 6.1, 6.2, 6.5
 */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicyConfig = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  expirationDays: 90,
};

/**
 * Common weak passwords to reject
 */
const COMMON_WEAK_PASSWORDS = new Set([
  'password',
  'password123',
  'password1234',
  '123456789012',
  'qwertyuiop12',
  'admin123456',
  'welcome12345',
  'letmein12345',
  'changeme123',
]);

export class PasswordPolicy {
  private config: PasswordPolicyConfig;

  constructor(config: PasswordPolicyConfig = DEFAULT_PASSWORD_POLICY) {
    this.config = config;
  }

  /**
   * Validate password strength
   * Requirements: 6.1, 6.2, 6.7
   */
  validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];

    // Check minimum length (Requirement 6.1)
    if (password.length < this.config.minLength) {
      errors.push(`Password must be at least ${this.config.minLength} characters long`);
    }

    // Check maximum length (prevent DoS)
    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }

    // Check uppercase requirement (Requirement 6.2)
    if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Check lowercase requirement (Requirement 6.2)
    if (this.config.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Check numbers requirement (Requirement 6.2)
    if (this.config.requireNumbers && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check special characters requirement (Requirement 6.2)
    if (this.config.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check against common weak passwords
    if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
      errors.push('Password is too common and easily guessable');
    }

    // Check for sequential characters (e.g., "123456", "abcdef")
    if (this.hasSequentialCharacters(password)) {
      errors.push('Password must not contain sequential characters');
    }

    // Check for repeated characters (e.g., "aaaaaa", "111111")
    if (this.hasRepeatedCharacters(password)) {
      errors.push('Password must not contain excessive repeated characters');
    }

    const valid = errors.length === 0;

    if (!valid) {
      logger.debug('Password validation failed', { errors });
    }

    return {
      valid,
      errors,
    };
  }

  /**
   * Check if password contains sequential characters
   */
  private hasSequentialCharacters(password: string): boolean {
    const sequences = [
      '0123456789',
      'abcdefghijklmnopqrstuvwxyz',
      'qwertyuiop',
      'asdfghjkl',
      'zxcvbnm',
    ];

    for (const sequence of sequences) {
      for (let i = 0; i <= sequence.length - 4; i++) {
        const substr = sequence.substring(i, i + 4);
        if (password.toLowerCase().includes(substr)) {
          return true;
        }
        // Check reverse sequence
        if (password.toLowerCase().includes(substr.split('').reverse().join(''))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if password has excessive repeated characters
   */
  private hasRepeatedCharacters(password: string): boolean {
    // Check for 4 or more repeated characters
    return /(.)\1{3,}/.test(password);
  }

  /**
   * Check if password is expired
   * Requirements: 6.5
   */
  isPasswordExpired(passwordChangedAt: Date): boolean {
    const now = new Date();
    const expirationDate = new Date(passwordChangedAt);
    expirationDate.setDate(expirationDate.getDate() + this.config.expirationDays);

    return now > expirationDate;
  }

  /**
   * Calculate days until password expires
   * Requirements: 6.5
   */
  getDaysUntilExpiration(passwordChangedAt: Date): number {
    const now = new Date();
    const expirationDate = new Date(passwordChangedAt);
    expirationDate.setDate(expirationDate.getDate() + this.config.expirationDays);

    const diffTime = expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }

  /**
   * Calculate password expiration date
   * Requirements: 6.5
   */
  calculateExpirationDate(passwordChangedAt: Date = new Date()): Date {
    const expirationDate = new Date(passwordChangedAt);
    expirationDate.setDate(expirationDate.getDate() + this.config.expirationDays);
    return expirationDate;
  }

  /**
   * Get password policy requirements as human-readable text
   */
  getPolicyDescription(): string[] {
    const requirements: string[] = [];

    requirements.push(`At least ${this.config.minLength} characters long`);

    if (this.config.requireUppercase) {
      requirements.push('At least one uppercase letter (A-Z)');
    }

    if (this.config.requireLowercase) {
      requirements.push('At least one lowercase letter (a-z)');
    }

    if (this.config.requireNumbers) {
      requirements.push('At least one number (0-9)');
    }

    if (this.config.requireSpecialChars) {
      requirements.push('At least one special character (!@#$%^&*...)');
    }

    requirements.push('No common or easily guessable passwords');
    requirements.push('No sequential or repeated characters');

    if (this.config.expirationDays > 0) {
      requirements.push(`Password expires after ${this.config.expirationDays} days`);
    }

    return requirements;
  }
}

/**
 * Default password policy instance
 */
export const passwordPolicy = new PasswordPolicy();

/**
 * Validate password strength (convenience function)
 * Requirements: 6.1, 6.2, 6.7
 */
export function validatePassword(password: string): PasswordValidationResult {
  return passwordPolicy.validatePassword(password);
}

/**
 * Check if password is expired (convenience function)
 * Requirements: 6.5
 */
export function isPasswordExpired(passwordChangedAt: Date): boolean {
  return passwordPolicy.isPasswordExpired(passwordChangedAt);
}

/**
 * Get days until password expires (convenience function)
 * Requirements: 6.5
 */
export function getDaysUntilExpiration(passwordChangedAt: Date): number {
  return passwordPolicy.getDaysUntilExpiration(passwordChangedAt);
}

/**
 * Calculate password expiration date (convenience function)
 * Requirements: 6.5
 */
export function calculateExpirationDate(passwordChangedAt: Date = new Date()): Date {
  return passwordPolicy.calculateExpirationDate(passwordChangedAt);
}
