// import { db } from './database';
import { auditLogs } from '../../database/schemas/main';
import { logger } from './logger';

export interface AuthAuditEvent {
  tenant_id?: string;
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  risk_score?: number;
}

export interface FailedAttemptDetails {
  email?: string;
  user_id?: string;
  attempt_type: 'login' | 'mfa' | 'backup_code' | 'password_reset';
  failure_reason: string;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  additional_context?: Record<string, any>;
}

export class AuthAuditLogger {
  /**
   * Log successful authentication events
   */
  static async logAuthSuccess(event: {
    user_id: string;
    tenant_id: string;
    auth_method: 'password' | 'mfa' | 'backup_code' | 'refresh_token';
    ip_address?: string;
    user_agent?: string;
    session_id?: string;
    additional_details?: Record<string, any>;
  }): Promise<void> {
    const auditEvent: AuthAuditEvent = {
      tenant_id: event.tenant_id,
      user_id: event.user_id,
      action: 'auth.login_success',
      resource_type: 'user',
      resource_id: event.user_id,
      details: {
        auth_method: event.auth_method,
        timestamp: new Date().toISOString(),
        ...event.additional_details,
      },
      ip_address: event.ip_address,
      user_agent: event.user_agent,
      session_id: event.session_id,
      risk_score: this.calculateRiskScore({
        auth_method: event.auth_method,
        ip_address: event.ip_address,
      }),
    };

    await this.writeAuditLog(auditEvent);
    
    logger.info('Authentication success', {
      userId: event.user_id,
      tenantId: event.tenant_id,
      authMethod: event.auth_method,
      ipAddress: event.ip_address,
      sessionId: event.session_id,
    });
  }

  /**
   * Log failed authentication attempts with detailed tracking
   */
  static async logAuthFailure(details: FailedAttemptDetails): Promise<void> {
    const auditEvent: AuthAuditEvent = {
      tenant_id: details.user_id ? undefined : undefined, // Will be set if user_id is available
      user_id: details.user_id,
      action: 'auth.login_failed',
      resource_type: 'user',
      resource_id: details.user_id,
      details: {
        email: details.email,
        attempt_type: details.attempt_type,
        failure_reason: details.failure_reason,
        timestamp: new Date().toISOString(),
        ...details.additional_context,
      },
      ip_address: details.ip_address,
      user_agent: details.user_agent,
      session_id: details.session_id,
      risk_score: this.calculateRiskScore({
        failure_reason: details.failure_reason,
        ip_address: details.ip_address,
        attempt_type: details.attempt_type,
      }),
    };

    await this.writeAuditLog(auditEvent);
    
    logger.warn('Authentication failure', {
      email: details.email,
      userId: details.user_id,
      attemptType: details.attempt_type,
      failureReason: details.failure_reason,
      ipAddress: details.ip_address,
      sessionId: details.session_id,
    });
  }

  /**
   * Log MFA events (setup, verification, backup code usage)
   */
  static async logMFAEvent(event: {
    user_id: string;
    tenant_id: string;
    action: 'mfa_setup' | 'mfa_verified' | 'mfa_failed' | 'backup_code_used' | 'backup_codes_generated';
    success: boolean;
    details?: Record<string, any>;
    ip_address?: string;
    user_agent?: string;
    session_id?: string;
  }): Promise<void> {
    const auditEvent: AuthAuditEvent = {
      tenant_id: event.tenant_id,
      user_id: event.user_id,
      action: `auth.${event.action}`,
      resource_type: 'user',
      resource_id: event.user_id,
      details: {
        success: event.success,
        timestamp: new Date().toISOString(),
        ...event.details,
      },
      ip_address: event.ip_address,
      user_agent: event.user_agent,
      session_id: event.session_id,
      risk_score: this.calculateRiskScore({
        mfa_action: event.action,
        success: event.success,
      }),
    };

    await this.writeAuditLog(auditEvent);
    
    logger.info('MFA event', {
      userId: event.user_id,
      tenantId: event.tenant_id,
      action: event.action,
      success: event.success,
      ipAddress: event.ip_address,
      sessionId: event.session_id,
    });
  }

  /**
   * Log session management events
   */
  static async logSessionEvent(event: {
    user_id: string;
    tenant_id: string;
    action: 'session_created' | 'session_expired' | 'session_terminated' | 'session_timeout' | 'concurrent_session_detected';
    session_id?: string;
    details?: Record<string, any>;
    ip_address?: string;
    user_agent?: string;
  }): Promise<void> {
    const auditEvent: AuthAuditEvent = {
      tenant_id: event.tenant_id,
      user_id: event.user_id,
      action: `auth.${event.action}`,
      resource_type: 'session',
      resource_id: event.session_id,
      details: {
        timestamp: new Date().toISOString(),
        ...event.details,
      },
      ip_address: event.ip_address,
      user_agent: event.user_agent,
      session_id: event.session_id,
      risk_score: this.calculateRiskScore({
        session_action: event.action,
      }),
    };

    await this.writeAuditLog(auditEvent);
    
    logger.info('Session event', {
      userId: event.user_id,
      tenantId: event.tenant_id,
      action: event.action,
      sessionId: event.session_id,
      ipAddress: event.ip_address,
    });
  }

  /**
   * Log security events (account lockouts, suspicious activity)
   */
  static async logSecurityEvent(event: {
    user_id?: string;
    tenant_id?: string;
    action: 'account_locked' | 'account_unlocked' | 'suspicious_activity' | 'brute_force_detected' | 'password_changed';
    severity: 'low' | 'medium' | 'high' | 'critical';
    details: Record<string, any>;
    ip_address?: string;
    user_agent?: string;
    session_id?: string;
  }): Promise<void> {
    const auditEvent: AuthAuditEvent = {
      tenant_id: event.tenant_id,
      user_id: event.user_id,
      action: `security.${event.action}`,
      resource_type: 'security',
      resource_id: event.user_id,
      details: {
        severity: event.severity,
        timestamp: new Date().toISOString(),
        ...event.details,
      },
      ip_address: event.ip_address,
      user_agent: event.user_agent,
      session_id: event.session_id,
      risk_score: this.calculateRiskScore({
        security_event: event.action,
        severity: event.severity,
      }),
    };

    await this.writeAuditLog(auditEvent);
    
    logger.warn('Security event', {
      userId: event.user_id,
      tenantId: event.tenant_id,
      action: event.action,
      severity: event.severity,
      ipAddress: event.ip_address,
      sessionId: event.session_id,
    });
  }

  /**
   * Calculate risk score based on various factors
   */
  private static calculateRiskScore(factors: Record<string, any>): number {
    let score = 0;

    // Base score for different event types
    if (factors.failure_reason) {
      switch (factors.failure_reason) {
        case 'invalid_password':
          score += 30;
          break;
        case 'invalid_mfa':
          score += 40;
          break;
        case 'account_locked':
          score += 80;
          break;
        case 'user_not_found':
          score += 20;
          break;
        default:
          score += 25;
      }
    }

    // MFA-related scoring
    if (factors.mfa_action) {
      if (factors.success === false) {
        score += 35;
      } else if (factors.mfa_action === 'backup_code_used') {
        score += 15; // Slightly elevated for backup code usage
      }
    }

    // Security event scoring
    if (factors.security_event) {
      switch (factors.severity) {
        case 'critical':
          score += 90;
          break;
        case 'high':
          score += 70;
          break;
        case 'medium':
          score += 40;
          break;
        case 'low':
          score += 20;
          break;
      }
    }

    // Session-related scoring
    if (factors.session_action) {
      switch (factors.session_action) {
        case 'concurrent_session_detected':
          score += 60;
          break;
        case 'session_timeout':
          score += 10;
          break;
        default:
          score += 5;
      }
    }

    // IP-based factors (simplified - in production, use GeoIP and reputation services)
    if (factors.ip_address) {
      // Add logic for suspicious IP patterns, geolocation changes, etc.
      // For now, just a placeholder
      score += 0;
    }

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Write audit log to database
   */
  private static async writeAuditLog(event: AuthAuditEvent): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        tenant_id: event.tenant_id,
        user_id: event.user_id,
        action: event.action,
        resource_type: event.resource_type,
        resource_id: event.resource_id,
        details: {
          ...event.details,
          risk_score: event.risk_score,
          session_id: event.session_id,
        },
        ip_address: event.ip_address,
        user_agent: event.user_agent,
        created_at: new Date(),
      });
    } catch (error) {
      logger.error('Failed to write audit log', error instanceof Error ? error : undefined, {
        action: event.action,
        userId: event.user_id,
        tenantId: event.tenant_id,
      });
    }
  }

  /**
   * Get failed attempt statistics for monitoring
   */
  static async getFailedAttemptStats(
    timeRange: { start: Date; end: Date },
    filters?: {
      tenant_id?: string;
      user_id?: string;
      ip_address?: string;
    }
  ): Promise<{
    total_attempts: number;
    unique_users: number;
    unique_ips: number;
    top_failure_reasons: Array<{ reason: string; count: number }>;
  }> {
    // This would typically use a more sophisticated query
    // For now, return a placeholder structure
    return {
      total_attempts: 0,
      unique_users: 0,
      unique_ips: 0,
      top_failure_reasons: [],
    };
  }
}