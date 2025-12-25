import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
// import { db } from '../lib/database';
import { users, tenants, auditLogs } from '../../database/schemas/main';
import { AuthService, RBACService } from '../lib/auth';
import { SessionService } from '../lib/redis';
import { BackupCodeService } from '../lib/backup-codes';
import { AuthAuditLogger } from '../lib/auth-audit';
import { LoginRequest, LoginResponse, JWTPayload, User, Tenant, UserRole } from '../types';

export interface RegisterRequest {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  tenant_domain: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface MFAVerificationRequest {
  user_id: string;
  code: string;
  backup_code?: string;
}

export interface BackupCodeGenerationResponse {
  backup_codes: string[];
  remaining_codes: number;
}

export interface EnhancedLoginRequest extends LoginRequest {
  backup_code?: string;
  remember_me?: boolean;
  extended_session?: boolean;
}

export class AuthenticationService {
  /**
   * Enhanced user login with comprehensive security checks
   */
  static async login(
    data: EnhancedLoginRequest,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResponse> {
    // Check for account lockout first
    const lockoutInfo = await SessionService.isLocked(`user:${data.email}`);
    if (lockoutInfo.isLocked) {
      await AuthAuditLogger.logAuthFailure({
        email: data.email,
        attempt_type: 'login',
        failure_reason: 'account_locked',
        ip_address: ipAddress,
        user_agent: userAgent,
        additional_context: {
          attempt_count: lockoutInfo.attemptCount,
          time_remaining: lockoutInfo.timeRemaining,
        },
      });
      
      throw new Error(`Account temporarily locked. Try again in ${Math.ceil((lockoutInfo.timeRemaining || 0) / 60)} minutes.`);
    }

    // Rate limiting check
    const rateLimitKey = `login:${data.email}:${ipAddress}`;
    const rateLimit = await SessionService.checkRateLimit(rateLimitKey, 5, 900); // 5 attempts per 15 minutes

    if (!rateLimit.allowed) {
      await AuthAuditLogger.logAuthFailure({
        email: data.email,
        attempt_type: 'login',
        failure_reason: 'rate_limit_exceeded',
        ip_address: ipAddress,
        user_agent: userAgent,
        additional_context: {
          reset_time: rateLimit.resetTime,
        },
      });
      
      throw new Error(`Too many login attempts. Try again in ${Math.ceil((rateLimit.resetTime - Date.now()) / 60000)} minutes.`);
    }

    // Find user by email (we need to check all tenants for super admins)
    let user: User | null = null;
    let tenant: Tenant | null = null;

    // First, try to find user in any tenant (for super admins)
    const userQuery = await db
      .select()
      .from(users)
      .innerJoin(tenants, eq(users.tenant_id, tenants.id))
      .where(and(eq(users.email, data.email), eq(users.is_active, true), eq(tenants.is_active, true)))
      .limit(1);

    if (userQuery.length === 0) {
      // Track failed attempt
      await SessionService.trackFailedAttempt(`user:${data.email}`, {
        email: data.email,
        ipAddress,
        userAgent,
        attemptType: 'login',
        reason: 'user_not_found',
      });

      // Log failed login attempt
      await AuthAuditLogger.logAuthFailure({
        email: data.email,
        attempt_type: 'login',
        failure_reason: 'user_not_found',
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      
      throw new Error('Invalid email or password');
    }

    const foundUser = userQuery[0].users;
    const foundTenant = userQuery[0].tenants;
    
    // Type assertion to match our interface types
    user = {
      ...foundUser,
      logo_url: foundTenant.logo_url || undefined,
    } as User;
    
    tenant = {
      ...foundTenant,
      logo_url: foundTenant.logo_url || undefined,
    } as Tenant;

    // Check if account is locked
    if (user!.account_locked) {
      await AuthAuditLogger.logAuthFailure({
        user_id: user!.id,
        email: data.email,
        attempt_type: 'login',
        failure_reason: 'account_locked',
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      
      throw new Error('Account is locked. Please contact administrator.');
    }

    // Check if MFA setup is completed (mandatory)
    if (!user!.mfa_setup_completed) {
      await AuthAuditLogger.logAuthFailure({
        user_id: user!.id,
        email: data.email,
        attempt_type: 'login',
        failure_reason: 'mfa_not_setup',
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      
      throw new Error('MFA setup required. Please complete MFA setup before logging in.');
    }

    // Verify password
    const isValidPassword = await AuthService.verifyPassword(data.password, user!.password_hash);
    if (!isValidPassword) {
      // Track failed attempt
      await SessionService.trackFailedAttempt(`user:${user!.id}`, {
        userId: user!.id,
        email: data.email,
        ipAddress,
        userAgent,
        attemptType: 'login',
        reason: 'invalid_password',
      });

      // Log failed login attempt
      await AuthAuditLogger.logAuthFailure({
        user_id: user!.id,
        email: data.email,
        attempt_type: 'login',
        failure_reason: 'invalid_password',
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      
      throw new Error('Invalid email or password');
    }

    // MFA is mandatory - check for MFA code or backup code
    if (!data.mfa_code && !data.backup_code) {
      // Store partial login state for MFA verification
      await SessionService.storeMFACode(user!.id, 'pending', 300); // 5 minutes
      await SessionService.storeAuthStatus(user!.id, 'needs_mfa', {
        partial_login: true,
        ip_address: ipAddress,
        user_agent: userAgent,
      });
      
      return {
        user: this.sanitizeUser(user!),
        tenant: tenant!,
        access_token: '',
        refresh_token: '',
        expires_in: 0,
        mfa_required: true,
      } as LoginResponse & { mfa_required: boolean };
    }

    // Verify MFA code or backup code
    let mfaVerified = false;
    let authMethod: 'mfa' | 'backup_code' = 'mfa';

    if (data.mfa_code) {
      // Verify TOTP code (simplified - in production, use proper TOTP library like speakeasy)
      if (data.mfa_code.length !== 6 || !/^\d{6}$/.test(data.mfa_code)) {
        await SessionService.trackFailedAttempt(`user:${user!.id}`, {
          userId: user!.id,
          email: data.email,
          ipAddress,
          userAgent,
          attemptType: 'mfa',
          reason: 'invalid_mfa_code',
        });

        await AuthAuditLogger.logMFAEvent({
          user_id: user!.id,
          tenant_id: user!.tenant_id,
          action: 'mfa_failed',
          success: false,
          details: { reason: 'invalid_format' },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        
        throw new Error('Invalid MFA code format');
      }
      
      // In production, verify against TOTP secret
      mfaVerified = true; // Simplified for demo
      authMethod = 'mfa';
    } else if (data.backup_code) {
      // Verify backup code
      if (!BackupCodeService.isValidBackupCodeFormat(data.backup_code)) {
        await AuthAuditLogger.logMFAEvent({
          user_id: user!.id,
          tenant_id: user!.tenant_id,
          action: 'mfa_failed',
          success: false,
          details: { reason: 'invalid_backup_code_format' },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        
        throw new Error('Invalid backup code format');
      }

      const backupCodes = user!.mfa_backup_codes || [];
      const verificationResult = await BackupCodeService.verifyBackupCode(data.backup_code, backupCodes);
      
      if (!verificationResult.isValid) {
        await SessionService.trackFailedAttempt(`user:${user!.id}`, {
          userId: user!.id,
          email: data.email,
          ipAddress,
          userAgent,
          attemptType: 'backup_code',
          reason: 'invalid_backup_code',
        });

        await AuthAuditLogger.logMFAEvent({
          user_id: user!.id,
          tenant_id: user!.tenant_id,
          action: 'mfa_failed',
          success: false,
          details: { reason: 'invalid_backup_code' },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
        
        throw new Error('Invalid backup code');
      }

      // Mark backup code as used
      const updatedBackupCodes = BackupCodeService.markCodeAsUsed(backupCodes, verificationResult.usedCodeIndex!);
      
      // Update user's backup codes in database
      await db
        .update(users)
        .set({
          mfa_backup_codes: updatedBackupCodes,
          updated_at: new Date(),
        })
        .where(eq(users.id, user!.id));

      mfaVerified = true;
      authMethod = 'backup_code';

      // Log backup code usage
      await AuthAuditLogger.logMFAEvent({
        user_id: user!.id,
        tenant_id: user!.tenant_id,
        action: 'backup_code_used',
        success: true,
        details: { 
          remaining_codes: BackupCodeService.countRemainingCodes(updatedBackupCodes),
          needs_new_codes: BackupCodeService.needsNewBackupCodes(updatedBackupCodes),
        },
        ip_address: ipAddress,
        user_agent: userAgent,
      });
    }

    if (!mfaVerified) {
      throw new Error('MFA verification failed');
    }

    // Generate tokens
    const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      user_id: user!.id,
      tenant_id: user!.tenant_id,
      role: user!.role as UserRole,
    };

    const accessToken = AuthService.generateAccessToken(tokenPayload);
    const refreshToken = AuthService.generateRefreshToken(tokenPayload);

    // Store enhanced session and refresh token
    const sessionId = crypto.randomUUID();
    const sessionData = {
      user_id: user!.id,
      tenant_id: user!.tenant_id,
      role: user!.role,
      login_time: new Date().toISOString(),
      ip_address: ipAddress,
      user_agent: userAgent,
      auth_method: authMethod,
      mfa_verified: true,
      session_id: sessionId,
    };

    await SessionService.storeEnhancedSession(user!.id, sessionData, {
      extendedSession: data.extended_session,
      rememberMe: data.remember_me,
    });
    
    await SessionService.storeRefreshToken(user!.id, refreshToken, 604800); // 7 days
    await SessionService.storeAuthStatus(user!.id, 'authenticated', {
      auth_method: authMethod,
      login_time: new Date().toISOString(),
    });

    // Update last login
    await db
      .update(users)
      .set({
        last_login: new Date(),
        updated_at: new Date(),
      })
      .where(eq(users.id, user!.id));

    // Clear rate limit and failed attempts on successful login
    await SessionService.clearRateLimit(rateLimitKey);
    await SessionService.clearFailedAttempts(`user:${user!.id}`);

    // Reset failed login attempts in database
    await db
      .update(users)
      .set({
        failed_login_attempts: 0,
        last_failed_login: null,
        updated_at: new Date(),
      })
      .where(eq(users.id, user!.id));

    // Log successful login with enhanced audit
    await AuthAuditLogger.logAuthSuccess({
      user_id: user!.id,
      tenant_id: user!.tenant_id,
      auth_method: authMethod,
      ip_address: ipAddress,
      user_agent: userAgent,
      session_id: sessionId,
      additional_details: {
        email: user!.email,
        extended_session: data.extended_session || false,
        remember_me: data.remember_me || false,
      },
    });

    return {
      user: this.sanitizeUser(user!),
      tenant: tenant!,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
    };
  }

  /**
   * User logout
   */
  static async logout(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    // Get user for audit logging
    const _user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Clear session and refresh token
    await SessionService.deleteSession(userId);
    await SessionService.deleteRefreshToken(userId);

    // Log logout
    if (user.length > 0) {
      await this.logAuditEvent({
        tenant_id: user[0].tenant_id,
        user_id: userId,
        action: 'auth.logout',
        resource_type: 'user',
        resource_id: userId,
        details: {},
        ip_address: ipAddress,
        user_agent: userAgent,
      });
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(data: RefreshTokenRequest): Promise<{ access_token: string; expires_in: number }> {
    try {
      // Verify refresh token
      const payload = AuthService.verifyRefreshToken(data.refresh_token);

      // Check if refresh token exists in Redis
      const isValidRefreshToken = await SessionService.verifyRefreshToken(payload.user_id, data.refresh_token);
      if (!isValidRefreshToken) {
        throw new Error('Invalid refresh token');
      }

      // Get user to ensure they're still active
      const _user = await db
        .select()
        .from(users)
        .where(and(eq(users.id, payload.user_id), eq(users.is_active, true)))
        .limit(1);

      if (user.length === 0) {
        throw new Error('User not found or inactive');
      }

      // Generate new access token
      const newTokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
        user_id: payload.user_id,
        tenant_id: payload.tenant_id,
        role: payload.role as UserRole,
      };

      const accessToken = AuthService.generateAccessToken(newTokenPayload);

      // Update session
      const sessionData = await SessionService.getSession(payload.user_id);
      if (sessionData) {
        await SessionService.storeSession(payload.user_id, sessionData, 3600);
      }

      return {
        access_token: accessToken,
        expires_in: 3600,
      };
    } catch {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Verify MFA code during login
   */
  static async verifyMFA(data: MFAVerificationRequest): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    // Check if MFA verification is pending
    const isPending = await SessionService.verifyMFACode(data.user_id, 'pending');
    if (!isPending) {
      throw new Error('MFA verification not initiated or expired');
    }

    // Get user
    const _user = await db
      .select()
      .from(users)
      .where(and(eq(users.id, data.user_id), eq(users.is_active, true)))
      .limit(1);

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Verify MFA code (simplified - in production, use proper TOTP library)
    if (data.code.length !== 6) {
      throw new Error('Invalid MFA code');
    }

    // Generate tokens
    const tokenPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      user_id: user[0].id,
      tenant_id: user[0].tenant_id,
      role: user[0].role as UserRole,
    };

    const accessToken = AuthService.generateAccessToken(tokenPayload);
    const refreshToken = AuthService.generateRefreshToken(tokenPayload);

    // Store session and refresh token
    const sessionData = {
      user_id: user[0].id,
      tenant_id: user[0].tenant_id,
      role: user[0].role,
      login_time: new Date().toISOString(),
      mfa_verified: true,
    };

    await SessionService.storeSession(user[0].id, sessionData, 3600);
    await SessionService.storeRefreshToken(user[0].id, refreshToken, 604800);

    // Update last login
    await db
      .update(users)
      .set({
        last_login: new Date(),
        updated_at: new Date(),
      })
      .where(eq(users.id, user[0].id));

    // Log successful MFA verification
    await this.logAuditEvent({
      tenant_id: user[0].tenant_id,
      user_id: user[0].id,
      action: 'auth.mfa_verified',
      resource_type: 'user',
      resource_id: user[0].id,
      details: {},
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
    };
  }

  /**
   * Get current user profile
   */
  static async getCurrentUser(_userId: string): Promise<Omit<User, 'password_hash' | 'mfa_secret'> | null> {
    const _user = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.is_active, true)))
      .limit(1);

    if (user.length === 0) {
      return null;
    }

    return this.sanitizeUser({
      ...user[0],
      role: user[0].role as UserRole,
    } as User);
  }

  /**
   * Validate session
   */
  static async validateSession(_userId: string): Promise<boolean> {
    const session = await SessionService.getSession(userId);
    return session !== null;
  }

  /**
   * Generate new backup codes for user
   */
  static async generateBackupCodes(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<BackupCodeGenerationResponse> {
    // Get user
    const _user = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.is_active, true)))
      .limit(1);

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Generate new backup codes
    const { codes, hashedCodes } = BackupCodeService.generateBackupCodes();

    // Update user's backup codes in database
    await db
      .update(users)
      .set({
        mfa_backup_codes: hashedCodes,
        updated_at: new Date(),
      })
      .where(eq(users.id, userId));

    // Log backup code generation
    await AuthAuditLogger.logMFAEvent({
      user_id: userId,
      tenant_id: user[0].tenant_id,
      action: 'backup_codes_generated',
      success: true,
      details: {
        codes_count: codes.length,
        previous_codes_count: user[0].mfa_backup_codes ? (user[0].mfa_backup_codes as string[]).length : 0,
      },
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return {
      backup_codes: codes,
      remaining_codes: codes.length,
    };
  }

  /**
   * Get remaining backup codes count
   */
  static async getRemainingBackupCodesCount(_userId: string): Promise<number> {
    const _user = await db
      .select({ mfa_backup_codes: users.mfa_backup_codes })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return 0;
    }

    const backupCodes = user[0].mfa_backup_codes as string[] || [];
    return BackupCodeService.countRemainingCodes(backupCodes);
  }

  /**
   * Check if user needs new backup codes
   */
  static async needsNewBackupCodes(_userId: string): Promise<boolean> {
    const remainingCount = await this.getRemainingBackupCodesCount(userId);
    return remainingCount < 3;
  }

  /**
   * Remove sensitive fields from user object
   */
  private static sanitizeUser(user: User): Omit<User, 'password_hash' | 'mfa_secret' | 'mfa_backup_codes'> {
    const { password_hash, mfa_secret, mfa_backup_codes, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  /**
   * Log audit event
   */
  private static async logAuditEvent(event: Omit<typeof auditLogs.$inferInsert, 'id' | 'created_at'>): Promise<void> {
    await db.insert(auditLogs).values({
      ...event,
      created_at: new Date(),
    });
  }
}