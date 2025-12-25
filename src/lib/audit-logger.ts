/**
 * Audit Logging Service
 * Comprehensive audit logging for authentication and authorization events
 * Part of production authentication system (Task 4.3)
 */

import { db } from './database';
import { authAuditLogs, auditLogs } from '../../database/schemas/main';
import { NextRequest } from 'next/server';

/**
 * Audit event types
 */
export enum AuditAction {
  // Authentication events
  LOGIN = 'login',
  LOGOUT = 'logout',
  REGISTER = 'register',
  LOGIN_FAILED = 'login_failed',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',

  // Password events
  PASSWORD_CHANGED = 'password_changed',
  PASSWORD_RESET_REQUESTED = 'password_reset_requested',
  PASSWORD_RESET_COMPLETED = 'password_reset_completed',
  PASSWORD_RESET_FAILED = 'password_reset_failed',

  // Email verification
  EMAIL_VERIFICATION_SENT = 'email_verification_sent',
  EMAIL_VERIFIED = 'email_verified',
  EMAIL_VERIFICATION_FAILED = 'email_verification_failed',

  // Session events
  SESSION_CREATED = 'session_created',
  SESSION_EXPIRED = 'session_expired',
  SESSION_REVOKED = 'session_revoked',
  SESSION_REFRESHED = 'session_refreshed',

  // MFA events
  MFA_ENABLED = 'mfa_enabled',
  MFA_DISABLED = 'mfa_disabled',
  MFA_VERIFIED = 'mfa_verified',
  MFA_FAILED = 'mfa_failed',

  // User management
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  USER_ACTIVATED = 'user_activated',
  USER_DEACTIVATED = 'user_deactivated',

  // Authorization events
  ACCESS_GRANTED = 'access_granted',
  ACCESS_DENIED = 'access_denied',
  PERMISSION_CHANGED = 'permission_changed',
  ROLE_CHANGED = 'role_changed',

  // Security events
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INVALID_TOKEN = 'invalid_token',
  CSRF_DETECTED = 'csrf_detected',
}

/**
 * Audit result types
 */
export enum AuditResult {
  SUCCESS = 'success',
  FAILURE = 'failure',
  ERROR = 'error',
  BLOCKED = 'blocked',
  RATE_LIMITED = 'rate_limited',
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  userId?: string | null;
  email?: string;
  action: AuditAction | string;
  result: AuditResult | string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  tenantId?: string;
}

/**
 * Extract client information from request
 */
export function extractClientInfo(req: NextRequest): {
  ipAddress: string;
  userAgent: string;
} {
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  const userAgent = req.headers.get('user-agent') || 'unknown';

  return { ipAddress, userAgent };
}

/**
 * Log authentication event
 */
export async function logAuthEvent(entry: AuditLogEntry): Promise<void> {
  if (!db) {
    console.error('Database not initialized - cannot log audit event');
    return;
  }

  try {
    await db.insert(authAuditLogs).values({
      user_id: entry.userId || null,
      email: entry.email || null,
      action: entry.action,
      result: entry.result,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
      metadata: entry.metadata || {},
    });

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUDIT]', {
        action: entry.action,
        result: entry.result,
        userId: entry.userId,
        email: entry.email,
        ip: entry.ipAddress,
      });
    }
  } catch (error) {
    console.error('Failed to log auth event:', error);
    // Don't throw - logging should never break the application
  }
}

/**
 * Log general audit event (for non-auth events)
 */
export async function logAuditEvent(
  entry: AuditLogEntry & {
    resourceType: string;
    resourceId?: string;
  }
): Promise<void> {
  if (!db) {
    console.error('Database not initialized - cannot log audit event');
    return;
  }

  try {
    await db.insert(auditLogs).values({
      tenant_id: entry.tenantId || null,
      user_id: entry.userId || null,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId || null,
      details: entry.metadata || {},
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[AUDIT]', {
        action: entry.action,
        resource: `${entry.resourceType}:${entry.resourceId}`,
        userId: entry.userId,
        tenantId: entry.tenantId,
      });
    }
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Convenience functions for common audit events
 */

export async function logLoginSuccess(
  userId: string,
  email: string,
  req: NextRequest,
  metadata?: Record<string, any>
): Promise<void> {
  const { ipAddress, userAgent } = extractClientInfo(req);
  await logAuthEvent({
    userId,
    email,
    action: AuditAction.LOGIN,
    result: AuditResult.SUCCESS,
    ipAddress,
    userAgent,
    metadata,
  });
}

export async function logLoginFailure(
  email: string,
  req: NextRequest,
  reason: string,
  metadata?: Record<string, any>
): Promise<void> {
  const { ipAddress, userAgent } = extractClientInfo(req);
  await logAuthEvent({
    email,
    action: AuditAction.LOGIN_FAILED,
    result: AuditResult.FAILURE,
    ipAddress,
    userAgent,
    metadata: { reason, ...metadata },
  });
}

export async function logLogout(
  userId: string,
  email: string,
  req: NextRequest
): Promise<void> {
  const { ipAddress, userAgent } = extractClientInfo(req);
  await logAuthEvent({
    userId,
    email,
    action: AuditAction.LOGOUT,
    result: AuditResult.SUCCESS,
    ipAddress,
    userAgent,
  });
}

export async function logPasswordChange(
  userId: string,
  email: string,
  req: NextRequest,
  metadata?: Record<string, any>
): Promise<void> {
  const { ipAddress, userAgent } = extractClientInfo(req);
  await logAuthEvent({
    userId,
    email,
    action: AuditAction.PASSWORD_CHANGED,
    result: AuditResult.SUCCESS,
    ipAddress,
    userAgent,
    metadata,
  });
}

export async function logPasswordResetRequest(
  userId: string | null,
  email: string,
  req: NextRequest
): Promise<void> {
  const { ipAddress, userAgent } = extractClientInfo(req);
  await logAuthEvent({
    userId,
    email,
    action: AuditAction.PASSWORD_RESET_REQUESTED,
    result: AuditResult.SUCCESS,
    ipAddress,
    userAgent,
  });
}

export async function logPasswordResetComplete(
  userId: string,
  email: string,
  req: NextRequest
): Promise<void> {
  const { ipAddress, userAgent } = extractClientInfo(req);
  await logAuthEvent({
    userId,
    email,
    action: AuditAction.PASSWORD_RESET_COMPLETED,
    result: AuditResult.SUCCESS,
    ipAddress,
    userAgent,
  });
}

export async function logAccountLocked(
  userId: string,
  email: string,
  req: NextRequest,
  reason: string
): Promise<void> {
  const { ipAddress, userAgent } = extractClientInfo(req);
  await logAuthEvent({
    userId,
    email,
    action: AuditAction.ACCOUNT_LOCKED,
    result: AuditResult.BLOCKED,
    ipAddress,
    userAgent,
    metadata: { reason },
  });
}

export async function logRateLimitExceeded(
  email: string | undefined,
  req: NextRequest,
  endpoint: string
): Promise<void> {
  const { ipAddress, userAgent } = extractClientInfo(req);
  await logAuthEvent({
    email,
    action: AuditAction.RATE_LIMIT_EXCEEDED,
    result: AuditResult.RATE_LIMITED,
    ipAddress,
    userAgent,
    metadata: { endpoint },
  });
}

export async function logSuspiciousActivity(
  userId: string | null,
  email: string | undefined,
  req: NextRequest,
  description: string,
  metadata?: Record<string, any>
): Promise<void> {
  const { ipAddress, userAgent } = extractClientInfo(req);
  await logAuthEvent({
    userId,
    email,
    action: AuditAction.SUSPICIOUS_ACTIVITY,
    result: AuditResult.BLOCKED,
    ipAddress,
    userAgent,
    metadata: { description, ...metadata },
  });
}

export async function logAccessDenied(
  userId: string,
  email: string,
  req: NextRequest,
  resource: string,
  reason: string
): Promise<void> {
  const { ipAddress, userAgent } = extractClientInfo(req);
  await logAuthEvent({
    userId,
    email,
    action: AuditAction.ACCESS_DENIED,
    result: AuditResult.BLOCKED,
    ipAddress,
    userAgent,
    metadata: { resource, reason },
  });
}

/**
 * Batch logging for high-volume events
 */
class AuditLogBatcher {
  private batch: AuditLogEntry[] = [];
  private batchSize = 100;
  private flushInterval = 5000; // 5 seconds
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    this.startTimer();
  }

  add(entry: AuditLogEntry): void {
    this.batch.push(entry);
    if (this.batch.length >= this.batchSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.batch.length === 0) return;

    const toFlush = [...this.batch];
    this.batch = [];

    try {
      if (db) {
        await db.insert(authAuditLogs).values(
          toFlush.map((entry) => ({
            user_id: entry.userId || null,
            email: entry.email || null,
            action: entry.action,
            result: entry.result,
            ip_address: entry.ipAddress,
            user_agent: entry.userAgent,
            metadata: entry.metadata || {},
          }))
        );
      }
    } catch (error) {
      console.error('Failed to flush audit log batch:', error);
    }
  }

  private startTimer(): void {
    this.timer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flush();
  }
}

// Global batcher instance
const globalBatcher = new AuditLogBatcher();

/**
 * Add event to batch (for high-volume logging)
 */
export function logAuthEventBatched(entry: AuditLogEntry): void {
  globalBatcher.add(entry);
}

/**
 * Flush all batched events immediately
 */
export async function flushAuditLogs(): Promise<void> {
  await globalBatcher.flush();
}

/**
 * Cleanup function (call on app shutdown)
 */
export function destroyAuditLogger(): void {
  globalBatcher.destroy();
}
