/**
 * Password Reset Service
 * 
 * Implements password reset functionality:
 * - Generate unique reset tokens
 * - Send password reset emails
 * - Validate tokens and reset passwords
 * - Invalidate sessions on password reset
 * - Prevent password reuse
 * - Log all reset attempts
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */

import crypto from 'crypto';
import { getClient } from './database';
import { drizzle } from 'drizzle-orm/postgres-js';
import { users, passwordResetTokens } from '../../database/schemas/main';
import { eq, and, gt } from 'drizzle-orm';
import { logger } from './logger';
import { EmailService } from './email-service';
import { AuthService } from './auth-service';

/**
 * Password reset service
 */
export class PasswordResetService {
  private static readonly TOKEN_EXPIRY_HOURS = 1;

  /**
   * Generate a unique reset token
   * Requirements: 11.2
   */
  static generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Request password reset (send email with token)
   * Requirements: 11.1, 11.2
   */
  static async requestPasswordReset(email: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const client = await getClient();
      const db = drizzle(client);

      // Find user by email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        // Don't reveal if email exists (prevent enumeration)
        logger.warn('Password reset requested for non-existent email', { email });
        
        // Log the attempt
        logger.info('Password reset attempt logged', {
          email,
          result: 'email_not_found',
        });

        return {
          success: true, // Return success to prevent email enumeration
        };
      }

      // Generate unique token
      const token = this.generateToken();
      const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      // Delete any existing reset tokens for this user
      await db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.user_id, user.id));

      // Store new token
      await db.insert(passwordResetTokens).values({
        user_id: user.id,
        token,
        expires_at: expiresAt,
      });

      // Send password reset email
      const emailResult = await EmailService.sendPasswordResetEmail(email, token);

      if (!emailResult.success) {
        logger.error('Failed to send password reset email', new Error(emailResult.error), {
          userId: user.id,
          email,
        });
        return {
          success: false,
          error: 'Failed to send password reset email',
        };
      }

      // Log the reset request (Requirements: 11.6)
      logger.info('Password reset email sent', {
        userId: user.id,
        email,
        expiresAt: expiresAt.toISOString(),
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to request password reset', error instanceof Error ? error : new Error(String(error)), {
        email,
      });
      return {
        success: false,
        error: 'Failed to request password reset',
      };
    }
  }

  /**
   * Reset password with token
   * Requirements: 11.3, 11.4, 11.5, 11.6
   */
  static async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{
    success: boolean;
    userId?: string;
    error?: string;
    errors?: string[];
  }> {
    try {
      const client = await getClient();
      const db = drizzle(client);

      // Find valid token
      const [resetTokenRecord] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, token),
            gt(passwordResetTokens.expires_at, new Date())
          )
        )
        .limit(1);

      if (!resetTokenRecord) {
        logger.warn('Invalid or expired password reset token', { 
          token: token.substring(0, 8) + '...' 
        });
        
        // Log the failed attempt (Requirements: 11.6)
        logger.info('Password reset attempt with invalid token', {
          result: 'invalid_token',
        });

        return {
          success: false,
          error: 'Invalid or expired password reset token',
        };
      }

      // Get user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, resetTokenRecord.user_id))
        .limit(1);

      if (!user) {
        logger.error('User not found for password reset token', { 
          userId: resetTokenRecord.user_id 
        });
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Validate new password strength
      const validation = AuthService.validatePasswordStrength(newPassword);
      
      if (!validation.valid) {
        logger.warn('Password reset failed - weak password', {
          userId: user.id,
          errors: validation.errors,
        });
        
        // Log the failed attempt (Requirements: 11.6)
        logger.info('Password reset attempt with weak password', {
          userId: user.id,
          email: user.email,
          result: 'weak_password',
        });

        return {
          success: false,
          error: 'Password does not meet requirements',
          errors: validation.errors,
        };
      }

      // Check if new password is same as current password
      const isSamePassword = await AuthService.verifyPassword(newPassword, user.password_hash);
      
      if (isSamePassword) {
        logger.warn('Password reset failed - same as current password', {
          userId: user.id,
        });
        return {
          success: false,
          error: 'New password must be different from current password',
        };
      }

      // Check password history (Requirements: 11.5)
      const isInHistory = await AuthService.checkPasswordHistory(user.id, newPassword);
      
      if (isInHistory) {
        logger.warn('Password reset failed - password in history', {
          userId: user.id,
        });
        
        // Log the failed attempt (Requirements: 11.6)
        logger.info('Password reset attempt with password in history', {
          userId: user.id,
          email: user.email,
          result: 'password_in_history',
        });

        return {
          success: false,
          error: 'Password has been used recently. Please choose a different password.',
          errors: ['You cannot reuse your last 5 passwords'],
        };
      }

      // Add current password to history before changing
      await AuthService.addPasswordToHistory(user.id, user.password_hash);

      // Hash new password
      const newPasswordHash = await AuthService.hashPassword(newPassword);

      // Calculate new expiration date
      const passwordChangedAt = new Date();
      const passwordExpiresAt = new Date(passwordChangedAt.getTime() + 90 * 24 * 60 * 60 * 1000);

      // Update password and expiration
      await db
        .update(users)
        .set({
          password_hash: newPasswordHash,
          password_changed_at: passwordChangedAt,
          password_expires_at: passwordExpiresAt,
          updated_at: new Date(),
        })
        .where(eq(users.id, user.id));

      // Delete the used reset token
      await db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.id, resetTokenRecord.id));

      // Delete all other reset tokens for this user
      await db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.user_id, user.id));

      // Invalidate all existing sessions (force re-login) (Requirements: 11.4)
      await AuthService.logoutAllDevices(user.id);

      // Send password changed notification email
      await EmailService.sendPasswordChangedEmail(user.email);

      // Log successful password reset (Requirements: 11.6)
      logger.info('Password reset successful', {
        userId: user.id,
        email: user.email,
        passwordExpiresAt: passwordExpiresAt.toISOString(),
      });

      return {
        success: true,
        userId: user.id,
      };
    } catch (error) {
      logger.error('Password reset failed', error instanceof Error ? error : new Error(String(error)), {
        token: token.substring(0, 8) + '...',
      });
      
      // Log the failed attempt (Requirements: 11.6)
      logger.info('Password reset attempt failed with error', {
        result: 'error',
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: 'Password reset failed',
      };
    }
  }

  /**
   * Validate reset token (check if valid without resetting)
   */
  static async validateToken(token: string): Promise<{
    valid: boolean;
    userId?: string;
    email?: string;
  }> {
    try {
      const client = await getClient();
      const db = drizzle(client);

      // Find valid token
      const [resetTokenRecord] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, token),
            gt(passwordResetTokens.expires_at, new Date())
          )
        )
        .limit(1);

      if (!resetTokenRecord) {
        return { valid: false };
      }

      // Get user
      const [user] = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.id, resetTokenRecord.user_id))
        .limit(1);

      if (!user) {
        return { valid: false };
      }

      return {
        valid: true,
        userId: user.id,
        email: user.email,
      };
    } catch (error) {
      logger.error('Failed to validate reset token', error instanceof Error ? error : new Error(String(error)), {
        token: token.substring(0, 8) + '...',
      });
      return { valid: false };
    }
  }

  /**
   * Delete expired reset tokens (cleanup)
   */
  static async cleanupExpiredTokens(): Promise<number> {
    try {
      const client = await getClient();
      const db = drizzle(client);

      const result = await db
        .delete(passwordResetTokens)
        .where(gt(new Date(), passwordResetTokens.expires_at))
        .returning({ id: passwordResetTokens.id });

      const count = result.length;

      if (count > 0) {
        logger.info('Cleaned up expired password reset tokens', { count });
      }

      return count;
    } catch (error) {
      logger.error('Failed to cleanup expired reset tokens', error instanceof Error ? error : new Error(String(error)));
      return 0;
    }
  }
}
