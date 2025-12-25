/**
 * Password Management Utility
 * Handles password hashing, validation, strength checking, and history tracking
 * Part of production authentication system (Task 2.1)
 */

import bcrypt from 'bcryptjs';
// import { db } from './database';
import { passwordHistory, users } from '../../database/schemas/main';
import { eq, desc } from 'drizzle-orm';

// Configuration constants
const SALT_ROUNDS = 12; // bcrypt cost factor (higher = more secure but slower)
const PASSWORD_HISTORY_LIMIT = 5; // Number of previous passwords to check

/**
 * Password strength requirements
 */
export const PASSWORD_REQUIREMENTS = {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true,
    specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
} as const;

/**
 * Password strength levels
 */
export enum PasswordStrength {
    WEAK = 'weak',
    FAIR = 'fair',
    GOOD = 'good',
    STRONG = 'strong',
    VERY_STRONG = 'very_strong',
}

/**
 * Password validation result
 */
export interface PasswordValidationResult {
    isValid: boolean;
    errors: string[];
    strength: PasswordStrength;
    score: number; // 0-100
}

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
    if (!password || password.length === 0) {
        throw new Error('Password cannot be empty');
    }

    return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 * @param password - Plain text password
 * @param hash - Hashed password
 * @returns True if password matches hash
 */
export async function verifyPassword(
    password: string,
    hash: string
): Promise<boolean> {
    if (!password || !hash) {
        return false;
    }

    try {
        return await bcrypt.compare(password, hash);
    } catch {
        console.error('Password verification error:', error);
        return false;
    }
}

/**
 * Validate password against requirements
 * @param password - Password to validate
 * @returns Validation result with errors and strength
 */
export function validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];
    let score = 0;

    // Check minimum length
    if (password.length < PASSWORD_REQUIREMENTS.minLength) {
        errors.push(
            `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`
        );
    } else {
        score += 20;
        // Bonus points for extra length
        score += Math.min(20, (password.length - PASSWORD_REQUIREMENTS.minLength) * 2);
    }

    // Check for uppercase letters
    if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    } else if (/[A-Z]/.test(password)) {
        score += 15;
    }

    // Check for lowercase letters
    if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    } else if (/[a-z]/.test(password)) {
        score += 15;
    }

    // Check for numbers
    if (PASSWORD_REQUIREMENTS.requireNumber && !/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    } else if (/\d/.test(password)) {
        score += 15;
    }

    // Check for special characters
    const specialCharsRegex = new RegExp(
        `[${PASSWORD_REQUIREMENTS.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`
    );
    if (
        PASSWORD_REQUIREMENTS.requireSpecial &&
        !specialCharsRegex.test(password)
    ) {
        errors.push(
            `Password must contain at least one special character (${PASSWORD_REQUIREMENTS.specialChars})`
        );
    } else if (specialCharsRegex.test(password)) {
        score += 15;
    }

    // Check for common patterns (reduce score)
    if (/(.)\1{2,}/.test(password)) {
        // Repeated characters (e.g., "aaa", "111")
        score -= 10;
    }
    if (/^[a-zA-Z]+$/.test(password) || /^\d+$/.test(password)) {
        // Only letters or only numbers
        score -= 10;
    }
    if (/^(password|12345|qwerty|admin)/i.test(password)) {
        // Common weak passwords
        score -= 20;
        errors.push('Password contains common weak patterns');
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    // Determine strength based on score
    let strength: PasswordStrength;
    if (score < 40) {
        strength = PasswordStrength.WEAK;
    } else if (score < 60) {
        strength = PasswordStrength.FAIR;
    } else if (score < 75) {
        strength = PasswordStrength.GOOD;
    } else if (score < 90) {
        strength = PasswordStrength.STRONG;
    } else {
        strength = PasswordStrength.VERY_STRONG;
    }

    return {
        isValid: errors.length === 0,
        errors,
        strength,
        score,
    };
}

/**
 * Check if a plain text password has been used recently by a user
 * @param userId - User ID
 * @param newPassword - Plain text password to check
 * @returns True if password was recently used
 */
export async function isPasswordInHistory(
    userId: string,
    newPassword: string
): Promise<boolean> {
    if (!db) {
        throw new Error('Database not initialized');
    }

    try {
        // Get the user's recent password history
        const recentPasswords = await db
            .select()
            .from(passwordHistory)
            .where(eq(passwordHistory.user_id, userId))
            .orderBy(desc(passwordHistory.created_at))
            .limit(PASSWORD_HISTORY_LIMIT);

        // Check if the new password matches any recent password
        for (const record of recentPasswords) {
            const matches = await verifyPassword(newPassword, record.password_hash);
            if (matches) {
                return true;
            }
        }

        return false;
    } catch {
        console.error('Error checking password history:', error);
        return false;
    }
}

/**
 * Add a password to user's history
 * @param userId - User ID
 * @param passwordHash - Hashed password
 */
export async function addPasswordToHistory(
    userId: string,
    passwordHash: string
): Promise<void> {
    if (!db) {
        throw new Error('Database not initialized');
    }

    try {
        await db.insert(passwordHistory).values({
            user_id: userId,
            password_hash: passwordHash,
        });

        // Clean up old password history (keep only last N passwords)
        await cleanupPasswordHistory(userId);
    } catch {
        console.error('Error adding password to history:', error);
        throw error;
    }
}

/**
 * Clean up old password history for a user
 * Keeps only the most recent N passwords
 * @param userId - User ID
 */
async function cleanupPasswordHistory(_userId: string): Promise<void> {
    if (!db) {
        return;
    }

    try {
        // Get all password history for user, ordered by date
        const allPasswords = await db
            .select()
            .from(passwordHistory)
            .where(eq(passwordHistory.user_id, userId))
            .orderBy(desc(passwordHistory.created_at));

        // If we have more than the limit, delete the oldest ones
        if (allPasswords.length > PASSWORD_HISTORY_LIMIT + 5) {
            // Keep a buffer of 5 extra
            const toDelete = allPasswords.slice(PASSWORD_HISTORY_LIMIT + 5);
            for (const record of toDelete) {
                await db
                    .delete(passwordHistory)
                    .where(eq(passwordHistory.id, record.id));
            }
        }
    } catch {
        console.error('Error cleaning up password history:', error);
        // Don't throw - this is a cleanup operation
    }
}

/**
 * Change a user's password with validation and history checking
 * @param userId - User ID
 * @param currentPassword - Current password (for verification)
 * @param newPassword - New password
 * @returns Success status and any errors
 */
export async function changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
): Promise<{ success: boolean; errors: string[] }> {
    if (!db) {
        return { success: false, errors: ['Database not initialized'] };
    }

    const errors: string[] = [];

    try {
        // Get user's current password hash
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            errors.push('User not found');
            return { success: false, errors };
        }

        // Verify current password
        const isCurrentPasswordValid = await verifyPassword(
            currentPassword,
            user.password_hash
        );

        if (!isCurrentPasswordValid) {
            errors.push('Current password is incorrect');
            return { success: false, errors };
        }

        // Validate new password
        const validation = validatePassword(newPassword);
        if (!validation.isValid) {
            errors.push(...validation.errors);
            return { success: false, errors };
        }

        // Check if new password is in history
        const inHistory = await isPasswordInHistory(userId, newPassword);
        if (inHistory) {
            errors.push(
                `Password has been used recently. Please choose a different password. You cannot reuse your last ${PASSWORD_HISTORY_LIMIT} passwords.`
            );
            return { success: false, errors };
        }

        // Hash new password
        const newPasswordHash = await hashPassword(newPassword);

        // Update user's password
        await db
            .update(users)
            .set({
                password_hash: newPasswordHash,
                updated_at: new Date(),
            })
            .where(eq(users.id, userId));

        // Add old password to history (this happens automatically via trigger in migration 0010)
        // But we'll also do it explicitly here for safety
        await addPasswordToHistory(userId, user.password_hash);

        return { success: true, errors: [] };
    } catch {
        console.error('Error changing password:', error);
        errors.push('An error occurred while changing password');
        return { success: false, errors };
    }
}

/**
 * Generate a password strength indicator message
 * @param strength - Password strength level
 * @returns Human-readable strength message
 */
export function getPasswordStrengthMessage(strength: PasswordStrength): string {
    switch (strength) {
        case PasswordStrength.WEAK:
            return 'Weak - This password is easy to guess';
        case PasswordStrength.FAIR:
            return 'Fair - This password could be stronger';
        case PasswordStrength.GOOD:
            return 'Good - This password is reasonably secure';
        case PasswordStrength.STRONG:
            return 'Strong - This password is secure';
        case PasswordStrength.VERY_STRONG:
            return 'Very Strong - This password is highly secure';
        default:
            return 'Unknown strength';
    }
}

/**
 * Get password requirements as a human-readable list
 * @returns Array of requirement strings
 */
export function getPasswordRequirements(): string[] {
    const requirements: string[] = [];

    requirements.push(
        `At least ${PASSWORD_REQUIREMENTS.minLength} characters long`
    );

    if (PASSWORD_REQUIREMENTS.requireUppercase) {
        requirements.push('At least one uppercase letter (A-Z)');
    }

    if (PASSWORD_REQUIREMENTS.requireLowercase) {
        requirements.push('At least one lowercase letter (a-z)');
    }

    if (PASSWORD_REQUIREMENTS.requireNumber) {
        requirements.push('At least one number (0-9)');
    }

    if (PASSWORD_REQUIREMENTS.requireSpecial) {
        requirements.push(
            `At least one special character (${PASSWORD_REQUIREMENTS.specialChars})`
        );
    }

    requirements.push(`Cannot reuse your last ${PASSWORD_HISTORY_LIMIT} passwords`);

    return requirements;
}
