/**
 * Email Verification Service
 * 
 * Implements email verification functionality:
 * - Generate unique verification tokens
 * - Send verification emails
 * - Verify tokens and activate accounts
 * - Resend verification emails
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import crypto from 'crypto';
import { getClient } from './database';
import { drizzle } from 'drizzle-orm/postgres-js';
import { users, emailVerificationTokens } from '../../database/schemas/main';
import { eq, and, gt } from 'drizzle-orm';
import { logger } from './logger';
import { EmailService } from './email-service';

/**
 * Email verification service
 */
export class EmailVerificationService {
  private static readonly TOKEN_EXPIRY_HOURS = 24;

  /**
   * Generate a unique verification token
   * Requirements: 10.2
   */
  static generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create verification token and send email
   * Requirements: 10.1, 10.2
   */
  static async createAndSendVerification(
    userId: string,
    email: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const client = await getClient();
      const db = drizzle(client);

      // Generate unique token
      const token = this.generateToken();
      const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      // Delete any existing verification tokens for this user
      await db
        .delete(emailVerificationTokens)
        .where(eq(emailVerificationTokens.user_id, userId));

      // Store new token
      await db.insert(emailVerificationTokens).values({
        user_id: userId,
        token,
        expires_at: expiresAt,
      });

      // Send verification email
      const emailResult = await EmailService.sendVerificationEmail(email, token);

      if (!emailResult.success) {
        logger.error('Failed to send verification email', new Error(emailResult.error), {
          userId,
          email,
        });
        return {
          success: false,
          error: 'Failed to send verification email',
        };
      }

      logger.info('Verification email sent', {
        userId,
        email,
        expiresAt: expiresAt.toISOString(),
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Failed to create verification token', error instanceof Error ? error : new Error(String(error)), {
        userId,
        email,
      });
      return {
        success: false,
        error: 'Failed to create verification token',
      };
    }
  }

  /**
   * Verify email with token
   * Requirements: 10.3
   */
  static async verifyEmail(token: string): Promise<{
    success: boolean;
    userId?: string;
    error?: string;
  }> {
    try {
      const client = await getClient();
      const db = drizzle(client);

      // Find valid token
      const [verificationRecord] = await db
        .select()
        .from(emailVerificationTokens)
        .where(
          and(
            eq(emailVerificationTokens.token, token),
            gt(emailVerificationTokens.expires_at, new Date())
          )
        )
        .limit(1);

      if (!verificationRecord) {
        logger.warn('Invalid or expired verification token', { token: token.substring(0, 8) + '...' });
        return {
          success: false,
          error: 'Invalid or expired verification token',
        };
      }

      // Get user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, verificationRecord.user_id))
        .limit(1);

      if (!user) {
        logger.error('User not found for verification token', { userId: verificationRecord.user_id });
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Check if already verified
      if (user.email_verified) {
        logger.info('Email already verified', { userId: user.id, email: user.email });
        
        // Delete the token
        await db
          .delete(emailVerificationTokens)
          .where(eq(emailVerificationTokens.id, verificationRecord.id));

        return {
          success: true,
          userId: user.id,
        };
      }

      // Mark email as verified
      await db
        .update(users)
        .set({
          email_verified: true,
          updated_at: new Date(),
        })
        .where(eq(users.id, user.id));

      // Delete the used verification token
      await db
        .delete(emailVerificationTokens)
        .where(eq(emailVerificationTokens.id, verificationRecord.id));

      // Delete all other verification tokens for this user
      await db
        .delete(emailVerificationTokens)
        .where(eq(emailVerificationTokens.user_id, user.id));

      logger.info('Email verified successfully', {
        userId: user.id,
        email: user.email,
      });

      return {
        success: true,
        userId: user.id,
      };
    } catch (error) {
      logger.error('Email verification failed', error instanceof Error ? error : new Error(String(error)), {
        token: token.substring(0, 8) + '...',
      });
      return {
        success: false,
        error: 'Email verification failed',
      };
    }
  }

  /**
   * Resend verification email
   * Requirements: 10.5, 10.6
   */
  static async resendVerification(email: string): Promise<{
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
        // Don't reveal if email exists
        logger.warn('Resend verification requested for non-existent email', { email });
        return {
          success: true, // Return success to prevent email enumeration
        };
      }

      // Check if already verified
      if (user.email_verified) {
        logger.info('Resend verification requested for already verified email', {
          userId: user.id,
          email,
        });
        return {
          success: true,
        };
      }

      // Create and send new verification
      return await this.createAndSendVerification(user.id, email);
    } catch (error) {
      logger.error('Failed to resend verification email', error instanceof Error ? error : new Error(String(error)), {
        email,
      });
      return {
        success: false,
        error: 'Failed to resend verification email',
      };
    }
  }

  /**
   * Check if user's email is verified
   * Requirements: 10.4
   */
  static async isEmailVerified(userId: string): Promise<boolean> {
    try {
      const client = await getClient();
      const db = drizzle(client);

      const [user] = await db
        .select({ email_verified: users.email_verified })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return user?.email_verified ?? false;
    } catch (error) {
      logger.error('Failed to check email verification status', error instanceof Error ? error : new Error(String(error)), {
        userId,
      });
      return false;
    }
  }

  /**
   * Delete expired verification tokens (cleanup)
   */
  static async cleanupExpiredTokens(): Promise<number> {
    try {
      const client = await getClient();
      const db = drizzle(client);

      const result = await db
        .delete(emailVerificationTokens)
        .where(gt(new Date(), emailVerificationTokens.expires_at))
        .returning({ id: emailVerificationTokens.id });

      const count = result.length;

      if (count > 0) {
        logger.info('Cleaned up expired verification tokens', { count });
      }

      return count;
    } catch (error) {
      logger.error('Failed to cleanup expired tokens', error instanceof Error ? error : new Error(String(error)));
      return 0;
    }
  }
}
