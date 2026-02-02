/**
 * Authentication Service
 * 
 * Implements authentication using:
 * - Passport.js with local strategy
 * - bcrypt for password hashing (12 rounds)
 * - JWT tokens for session management
 * - Account lockout after failed attempts
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getClient } from './database';
import { drizzle } from 'drizzle-orm/postgres-js';
import { users } from '../../database/schemas/main';
import { eq } from 'drizzle-orm';
import { logger } from './logger';
import { config } from './config';
import { logAuthEvent, AuditAction, AuditResult } from './audit-logger';
import { SessionManager } from './session-manager';
import { validatePassword, calculateExpirationDate, isPasswordExpired, type PasswordValidationResult } from './password-policy';

/**
 * User authentication data
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
}

/**
 * JWT payload
 */
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
  sessionId: string;
  type: 'access' | 'refresh';
}

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  accessToken?: string;
  refreshToken?: string;
  requiresMFA?: boolean;
  error?: string;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export class AuthService {
  private static readonly BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;
  private static readonly MAX_LOGIN_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Validate password strength
   * Requirements: 6.1, 6.2, 6.7
   */
  static validatePasswordStrength(password: string): PasswordValidationResult {
    return validatePassword(password);
  }

  /**
   * Check if user's password is expired
   * Requirements: 6.5
   */
  static isUserPasswordExpired(user: any): boolean {
    if (!user.password_changed_at) {
      // If no password_changed_at, consider it expired for safety
      return true;
    }
    return isPasswordExpired(user.password_changed_at);
  }

  /**
   * Hash password using bcrypt
   * Requirements: 3.2
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      const salt = await bcrypt.genSalt(this.BCRYPT_ROUNDS);
      const hash = await bcrypt.hash(password, salt);
      return hash;
    } catch (error) {
      logger.error('Password hashing failed', error instanceof Error ? error : new Error(String(error)));
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify password against hash
   * Requirements: 3.3
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Password verification failed', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Authenticate user with email and password
   * Requirements: 3.1, 3.7, 3.8
   */
  static async authenticateUser(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      const { email, password, rememberMe = false } = credentials;

      // Get database connection
      const client = await getClient();
      const db = drizzle(client);

      // Find user by email
      const userResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
      
      if (userResult.length === 0) {
        logger.warn('Login attempt for non-existent user', { email });
        return {
          success: false,
          error: 'Invalid email or password',
        };
      }

      const user = userResult[0];

      // Check if account is locked (Requirements: 3.8)
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const lockoutRemaining = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 1000 / 60);
        logger.warn('Login attempt for locked account', {
          userId: user.id,
          email,
          lockoutRemaining: `${lockoutRemaining} minutes`,
        });
        return {
          success: false,
          error: `Account is locked. Try again in ${lockoutRemaining} minutes.`,
        };
      }

      // Verify password (Requirements: 3.3)
      const isValidPassword = await this.verifyPassword(password, user.password_hash);

      if (!isValidPassword) {
        // Increment failed login attempts (Requirements: 3.7)
        await this.handleFailedLogin(user.id, email);
        
        return {
          success: false,
          error: 'Invalid email or password',
        };
      }

      // Check if email is verified
      if (!user.email_verified) {
        logger.warn('Login attempt with unverified email', {
          userId: user.id,
          email,
        });
        return {
          success: false,
          error: 'Please verify your email address before logging in',
        };
      }

      // Check if password is expired (Requirements: 6.5, 6.6)
      if (this.isUserPasswordExpired(user)) {
        logger.warn('Login attempt with expired password', {
          userId: user.id,
          email,
        });
        return {
          success: false,
          error: 'Your password has expired. Please reset your password.',
        };
      }

      // Reset failed login attempts on successful login
      if (user.failed_login_attempts > 0) {
        await db.update(users)
          .set({
            failed_login_attempts: 0,
            locked_until: null,
            last_login: new Date(),
          })
          .where(eq(users.id, user.id));
      } else {
        await db.update(users)
          .set({ last_login: new Date() })
          .where(eq(users.id, user.id));
      }

      // Check if MFA is required
      if (user.mfa_enabled) {
        logger.info('MFA required for user', {
          userId: user.id,
          email,
        });
        return {
          success: true,
          requiresMFA: true,
          user: {
            id: user.id,
            email: user.email,
            name: `${user.first_name} ${user.last_name}`,
            role: user.role,
            tenantId: user.tenant_id,
            emailVerified: user.email_verified,
            mfaEnabled: user.mfa_enabled,
          },
        };
      }

      // Create session and generate tokens
      return await this.createAuthSession(user, rememberMe);
    } catch (error) {
      logger.error('Authentication failed', error instanceof Error ? error : new Error(String(error)), {
        email: credentials.email,
      });
      return {
        success: false,
        error: 'Authentication failed. Please try again.',
      };
    }
  }

  /**
   * Handle failed login attempt
   * Requirements: 3.7, 3.8
   */
  private static async handleFailedLogin(userId: string, email: string): Promise<void> {
    try {
      // Get database connection
      const client = await getClient();
      const db = drizzle(client);

      const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (userResult.length === 0) {
        return;
      }

      const user = userResult[0];
      const newAttempts = user.failed_login_attempts + 1;

      // Lock account if max attempts exceeded
      if (newAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + this.LOCKOUT_DURATION_MS);
        
        await db.update(users)
          .set({
            failed_login_attempts: newAttempts,
            locked_until: lockedUntil,
          })
          .where(eq(users.id, userId));

        logger.warn('Account locked due to failed login attempts', {
          userId,
          email,
          attempts: newAttempts,
          lockedUntil: lockedUntil.toISOString(),
        });
      } else {
        await db.update(users)
          .set({ failed_login_attempts: newAttempts })
          .where(eq(users.id, userId));

        logger.warn('Failed login attempt', {
          userId,
          email,
          attempts: newAttempts,
          remaining: this.MAX_LOGIN_ATTEMPTS - newAttempts,
        });
      }
    } catch (error) {
      logger.error('Failed to handle failed login', error instanceof Error ? error : new Error(String(error)), {
        userId,
        email,
      });
    }
  }

  /**
   * Create authentication session with JWT tokens
   * Requirements: 3.4, 3.5
   */
  private static async createAuthSession(
    user: any,
    rememberMe: boolean
  ): Promise<AuthResult> {
    try {
      // Create session in Redis
      const sessionId = await SessionManager.createSession(
        user.id,
        {
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          role: user.role,
          tenantId: user.tenant_id,
        },
        { rememberMe }
      );

      // Generate JWT tokens
      const accessToken = this.generateAccessToken(user, sessionId);
      const refreshToken = this.generateRefreshToken(user, sessionId);

      logger.info('Authentication successful', {
        userId: user.id,
        email: user.email,
        sessionId: sessionId.substring(0, 8) + '...',
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          role: user.role,
          tenantId: user.tenant_id,
          emailVerified: user.email_verified,
          mfaEnabled: user.mfa_enabled,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      logger.error('Failed to create auth session', error instanceof Error ? error : new Error(String(error)), {
        userId: user.id,
      });
      throw error;
    }
  }

  /**
   * Generate JWT access token
   * Requirements: 3.4
   */
  static generateAccessToken(user: any, sessionId: string): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
      sessionId,
      type: 'access',
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);
  }

  /**
   * Generate JWT refresh token
   * Requirements: 3.6
   */
  static generateRefreshToken(user: any, sessionId: string): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
      sessionId,
      type: 'refresh',
    };

    return jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    } as jwt.SignOptions);
  }

  /**
   * Verify JWT token
   * Requirements: 3.5
   */
  static verifyAccessToken(token: string): JWTPayload | null {
    try {
      const payload = jwt.verify(token, config.jwt.secret) as JWTPayload;
      
      if (payload.type !== 'access') {
        return null;
      }

      return payload;
    } catch (error) {
      logger.debug('Access token verification failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Verify refresh token
   * Requirements: 3.6
   */
  static verifyRefreshToken(token: string): JWTPayload | null {
    try {
      const payload = jwt.verify(token, config.jwt.refreshSecret) as JWTPayload;
      
      if (payload.type !== 'refresh') {
        return null;
      }

      return payload;
    } catch (error) {
      logger.debug('Refresh token verification failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   * Requirements: 3.6
   */
  static async refreshAccessToken(refreshToken: string): Promise<{
    success: boolean;
    accessToken?: string;
    error?: string;
  }> {
    try {
      // Verify refresh token
      const payload = this.verifyRefreshToken(refreshToken);
      
      if (!payload) {
        return {
          success: false,
          error: 'Invalid refresh token',
        };
      }

      // Validate session still exists
      const sessionValidation = await SessionManager.validateSession(payload.sessionId);
      
      if (!sessionValidation.valid) {
        return {
          success: false,
          error: 'Session expired',
        };
      }

      // Get database connection
      const client = await getClient();
      const db = drizzle(client);

      // Get user from database
      const userResult = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      
      if (userResult.length === 0) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      const user = userResult[0];

      // Generate new access token
      const newAccessToken = this.generateAccessToken(user, payload.sessionId);

      // Refresh session if needed
      if (sessionValidation.needsRefresh) {
        await SessionManager.refreshSession(payload.sessionId);
      }

      logger.info('Access token refreshed', {
        userId: user.id,
        sessionId: payload.sessionId.substring(0, 8) + '...',
      });

      return {
        success: true,
        accessToken: newAccessToken,
      };
    } catch (error) {
      logger.error('Token refresh failed', error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        error: 'Token refresh failed',
      };
    }
  }

  /**
   * Logout user (invalidate session)
   */
  static async logout(sessionId: string): Promise<boolean> {
    try {
      await SessionManager.deleteSession(sessionId);
      logger.info('User logged out', {
        sessionId: sessionId.substring(0, 8) + '...',
      });
      return true;
    } catch (error) {
      logger.error('Logout failed', error instanceof Error ? error : new Error(String(error)), {
        sessionId: sessionId.substring(0, 8) + '...',
      });
      return false;
    }
  }

  /**
   * Logout user from all devices (invalidate all sessions)
   */
  static async logoutAllDevices(userId: string): Promise<number> {
    try {
      const count = await SessionManager.deleteAllUserSessions(userId);
      logger.info('User logged out from all devices', {
        userId,
        sessionsDeleted: count,
      });
      return count;
    } catch (error) {
      logger.error('Logout all devices failed', error instanceof Error ? error : new Error(String(error)), {
        userId,
      });
      return 0;
    }
  }

  /**
   * Invalidate session on suspicious activity
   * Requirements: 7.8
   * 
   * This method should be called when suspicious activity is detected, such as:
   * - Multiple failed login attempts from different locations
   * - Unusual access patterns
   * - Potential account compromise indicators
   * - Security policy violations
   * 
   * @param sessionId - Session ID to invalidate
   * @param userId - User ID for logging
   * @param reason - Reason for invalidation
   * @param metadata - Additional context about the suspicious activity
   */
  static async invalidateSessionOnSuspiciousActivity(
    sessionId: string,
    userId: string,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      // Delete the specific session
      await SessionManager.deleteSession(sessionId);
      
      // Log the security event
      logger.warn('Session invalidated due to suspicious activity', {
        userId,
        sessionId: sessionId.substring(0, 8) + '...',
        reason,
        ...metadata,
      });

      // Optionally, log to audit trail
      await logAuthEvent({
        userId,
        email: metadata?.email || 'unknown',
        action: AuditAction.SESSION_INVALIDATED,
        result: AuditResult.SUCCESS,
        ipAddress: metadata?.ipAddress || 'unknown',
        userAgent: metadata?.userAgent || 'unknown',
        metadata: {
          reason,
          sessionId: sessionId.substring(0, 8) + '...',
          ...metadata,
        },
      });

      return true;
    } catch (error) {
      logger.error('Failed to invalidate session on suspicious activity', error instanceof Error ? error : new Error(String(error)), {
        userId,
        sessionId: sessionId.substring(0, 8) + '...',
        reason,
      });
      return false;
    }
  }

  /**
   * Invalidate all sessions on suspicious activity
   * Requirements: 7.8
   * 
   * This method invalidates ALL sessions for a user when severe suspicious activity is detected.
   * Use this for high-severity security events that require immediate action.
   * 
   * @param userId - User ID
   * @param reason - Reason for invalidation
   * @param metadata - Additional context about the suspicious activity
   */
  static async invalidateAllSessionsOnSuspiciousActivity(
    userId: string,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<number> {
    try {
      // Delete all user sessions
      const count = await SessionManager.deleteAllUserSessions(userId);
      
      // Log the security event
      logger.warn('All sessions invalidated due to suspicious activity', {
        userId,
        reason,
        sessionsDeleted: count,
        ...metadata,
      });

      // Log to audit trail
      await logAuthEvent({
        userId,
        email: metadata?.email || 'unknown',
        action: AuditAction.ALL_SESSIONS_INVALIDATED,
        result: AuditResult.SUCCESS,
        ipAddress: metadata?.ipAddress || 'unknown',
        userAgent: metadata?.userAgent || 'unknown',
        metadata: {
          reason,
          sessionsDeleted: count,
          ...metadata,
        },
      });

      return count;
    } catch (error) {
      logger.error('Failed to invalidate all sessions on suspicious activity', error instanceof Error ? error : new Error(String(error)), {
        userId,
        reason,
      });
      return 0;
    }
  }

  /**
   * Check if password is in user's password history
   * Requirements: 6.3, 6.4
   */
  static async checkPasswordHistory(
    userId: string,
    newPassword: string
  ): Promise<boolean> {
    try {
      // Get database connection
      const client = await getClient();
      const db = drizzle(client);

      // Get last 5 passwords from history
      const { passwordHistory } = await import('../../database/schemas/main');
      const { desc } = await import('drizzle-orm');
      
      const recentPasswords = await db
        .select()
        .from(passwordHistory)
        .where(eq(passwordHistory.user_id, userId))
        .orderBy(desc(passwordHistory.created_at))
        .limit(5);

      // Check if new password matches any recent password
      for (const record of recentPasswords) {
        const matches = await this.verifyPassword(newPassword, record.password_hash);
        if (matches) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Failed to check password history', error instanceof Error ? error : new Error(String(error)), {
        userId,
      });
      // On error, allow password change (fail open for availability)
      return false;
    }
  }

  /**
   * Add password to user's history
   * Requirements: 6.3, 6.4
   */
  static async addPasswordToHistory(
    userId: string,
    passwordHash: string
  ): Promise<void> {
    try {
      // Get database connection
      const client = await getClient();
      const db = drizzle(client);

      // Add password to history
      const { passwordHistory } = await import('../../database/schemas/main');
      
      await db.insert(passwordHistory).values({
        user_id: userId,
        password_hash: passwordHash,
      });

      logger.debug('Password added to history', {
        userId,
      });
    } catch (error) {
      logger.error('Failed to add password to history', error instanceof Error ? error : new Error(String(error)), {
        userId,
      });
      // Don't throw - this is not critical for password change
    }
  }

  /**
   * Change user password with validation
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7
   */
  static async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<{
    success: boolean;
    error?: string;
    errors?: string[];
  }> {
    try {
      // Get database connection
      const client = await getClient();
      const db = drizzle(client);

      // Get user
      const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (userResult.length === 0) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      const user = userResult[0];

      // Verify old password
      const isValidOldPassword = await this.verifyPassword(oldPassword, user.password_hash);
      
      if (!isValidOldPassword) {
        logger.warn('Password change failed - incorrect old password', {
          userId,
        });
        return {
          success: false,
          error: 'Current password is incorrect',
        };
      }

      // Validate new password strength (Requirements: 6.1, 6.2, 6.7)
      const validation = this.validatePasswordStrength(newPassword);
      
      if (!validation.valid) {
        logger.warn('Password change failed - weak password', {
          userId,
          errors: validation.errors,
        });
        return {
          success: false,
          error: 'Password does not meet requirements',
          errors: validation.errors,
        };
      }

      // Check if new password is same as old password
      const isSamePassword = await this.verifyPassword(newPassword, user.password_hash);
      
      if (isSamePassword) {
        return {
          success: false,
          error: 'New password must be different from current password',
        };
      }

      // Check password history (Requirements: 6.3, 6.4)
      const isInHistory = await this.checkPasswordHistory(userId, newPassword);
      
      if (isInHistory) {
        logger.warn('Password change failed - password in history', {
          userId,
        });
        return {
          success: false,
          error: 'Password has been used recently. Please choose a different password.',
          errors: ['You cannot reuse your last 5 passwords'],
        };
      }

      // Add current password to history before changing (Requirements: 6.3, 6.4)
      await this.addPasswordToHistory(userId, user.password_hash);

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Calculate new expiration date (Requirements: 6.5)
      const passwordChangedAt = new Date();
      const passwordExpiresAt = calculateExpirationDate(passwordChangedAt);

      // Update password and expiration
      await db.update(users)
        .set({
          password_hash: newPasswordHash,
          password_changed_at: passwordChangedAt,
          password_expires_at: passwordExpiresAt,
          updated_at: new Date(),
        })
        .where(eq(users.id, userId));

      // Invalidate all sessions (force re-login)
      await this.logoutAllDevices(userId);

      logger.info('Password changed successfully', {
        userId,
        passwordExpiresAt: passwordExpiresAt.toISOString(),
      });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Password change failed', error instanceof Error ? error : new Error(String(error)), {
        userId,
      });
      return {
        success: false,
        error: 'Failed to change password. Please try again.',
      };
    }
  }
}
