import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '../lib/auth';
import { SessionService } from '../lib/session-service-compat';
import { AuthAuditLogger } from '../lib/auth-audit';
import { JWTPayload, UserRole } from '../types';
import { monitoring } from '../lib/monitoring';
// import { logger } from '../lib/logger';

export interface EnhancedAuthRequest extends NextRequest {
  user?: JWTPayload & {
    session_id: string;
    last_activity: string;
    needs_reauth: boolean;
  };
}

export interface AuthMiddlewareOptions {
  requireMFA?: boolean;
  allowIdleTimeout?: boolean;
  maxIdleMinutes?: number;
  requireRecentAuth?: boolean;
  recentAuthMinutes?: number;
  bypassInDevelopment?: boolean;
}

/**
 * Enhanced authentication middleware with comprehensive security checks
 */
export async function enhancedAuthMiddleware(
  request: NextRequest,
  options: AuthMiddlewareOptions = {}
): Promise<{
  success: boolean;
  user?: JWTPayload & { session_id: string; last_activity: string; needs_reauth: boolean };
  error?: string;
  requiresReauth?: boolean;
  lockoutInfo?: { isLocked: boolean; timeRemaining?: number };
}> {
  const span = monitoring.startSpan('enhanced_auth.middleware');
  const startTime = Date.now();

  try {
    monitoring.tagSpan(span.spanId, {
      'http.method': request.method,
      'http.path': request.nextUrl.pathname,
      'auth.enhanced': true,
    });

    // Development mode bypass
    if (options.bypassInDevelopment && process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      monitoring.tagSpan(span.spanId, {
        success: true,
        bypass: true,
        mode: 'development'
      });

      logger.debug('Enhanced authentication bypassed in development mode', {
        path: request.nextUrl.pathname,
        method: request.method,
      });

      monitoring.finishSpan(span.spanId);

      return {
        success: true,
        user: {
          user_id: 'dev-user-123',
          tenant_id: 'dev-tenant-123',
          role: UserRole.SECURITY_ANALYST,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          session_id: 'dev-session-123',
          last_activity: new Date().toISOString(),
          needs_reauth: false,
        }
      };
    }

    // Extract client information
    const ipAddress = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      monitoring.tagSpan(span.spanId, {
        success: false,
        error: 'missing_auth_header'
      });

      await AuthAuditLogger.logAuthFailure({
        attempt_type: 'login',
        failure_reason: 'missing_auth_header',
        ip_address: ipAddress,
        user_agent: userAgent,
        additional_context: {
          path: request.nextUrl.pathname,
          method: request.method,
        },
      });

      monitoring.recordMetric('enhanced_auth_failures_total', 1, {
        reason: 'missing_header',
        path: request.nextUrl.pathname,
      });

      monitoring.finishSpan(span.spanId);

      return {
        success: false,
        error: 'Missing or invalid authorization header'
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    let payload: JWTPayload;
    try {
      payload = AuthService.verifyAccessToken(token);
    } catch (error) {
      monitoring.tagSpan(span.spanId, {
        success: false,
        error: 'invalid_token'
      });

      await AuthAuditLogger.logAuthFailure({
        attempt_type: 'login',
        failure_reason: 'invalid_token',
        ip_address: ipAddress,
        user_agent: userAgent,
        additional_context: {
          path: request.nextUrl.pathname,
          method: request.method,
          error: error instanceof Error ? error.message : 'unknown',
        },
      });

      monitoring.recordMetric('enhanced_auth_failures_total', 1, {
        reason: 'invalid_token',
        path: request.nextUrl.pathname,
      });

      monitoring.finishSpan(span.spanId);

      return {
        success: false,
        error: 'Invalid or expired token'
      };
    }

    // Check if user account is locked
    const lockoutInfo = await SessionService.isLocked(`user:${payload.user_id}`);
    if (lockoutInfo.isLocked) {
      monitoring.tagSpan(span.spanId, {
        success: false,
        error: 'account_locked',
        userId: payload.user_id
      });

      await AuthAuditLogger.logSecurityEvent({
        user_id: payload.user_id,
        tenant_id: payload.tenant_id,
        action: 'account_locked',
        severity: 'high',
        details: {
          attempt_count: lockoutInfo.attemptCount,
          time_remaining: lockoutInfo.timeRemaining,
          path: request.nextUrl.pathname,
        },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      monitoring.finishSpan(span.spanId);

      return {
        success: false,
        error: 'Account temporarily locked due to multiple failed attempts',
        lockoutInfo,
      };
    }

    // Validate session exists and get session data
    const sessionData = await SessionService.getSession(payload.user_id);
    if (!sessionData) {
      monitoring.tagSpan(span.spanId, {
        success: false,
        error: 'invalid_session',
        userId: payload.user_id
      });

      await AuthAuditLogger.logAuthFailure({
        user_id: payload.user_id,
        attempt_type: 'login',
        failure_reason: 'session_not_found',
        ip_address: ipAddress,
        user_agent: userAgent,
        additional_context: {
          path: request.nextUrl.pathname,
          method: request.method,
        },
      });

      monitoring.recordMetric('enhanced_auth_failures_total', 1, {
        reason: 'invalid_session',
        path: request.nextUrl.pathname,
      });

      monitoring.finishSpan(span.spanId);

      return {
        success: false,
        error: 'Session expired or invalid'
      };
    }

    // Check authentication status
    const authStatus = await SessionService.getAuthStatus(payload.user_id);
    if (authStatus.status === 'locked' || authStatus.status === 'expired') {
      monitoring.tagSpan(span.spanId, {
        success: false,
        error: 'auth_status_invalid',
        userId: payload.user_id,
        authStatus: authStatus.status
      });

      await AuthAuditLogger.logAuthFailure({
        user_id: payload.user_id,
        attempt_type: 'login',
        failure_reason: `auth_status_${authStatus.status}`,
        ip_address: ipAddress,
        user_agent: userAgent,
        additional_context: {
          path: request.nextUrl.pathname,
          auth_status: authStatus.status,
        },
      });

      monitoring.finishSpan(span.spanId);

      return {
        success: false,
        error: `Authentication ${authStatus.status}`,
        requiresReauth: true,
      };
    }

    // Check for MFA requirement
    if (options.requireMFA && authStatus.status === 'needs_mfa') {
      monitoring.tagSpan(span.spanId, {
        success: false,
        error: 'mfa_required',
        userId: payload.user_id
      });

      monitoring.finishSpan(span.spanId);

      return {
        success: false,
        error: 'MFA verification required',
        requiresReauth: true,
      };
    }

    // Check session idle timeout
    const idleCheck = await SessionService.checkSessionIdleTimeout(payload.user_id);
    if (!idleCheck.isValid) {
      monitoring.tagSpan(span.spanId, {
        success: false,
        error: 'session_expired',
        userId: payload.user_id
      });

      await AuthAuditLogger.logSessionEvent({
        user_id: payload.user_id,
        tenant_id: payload.tenant_id,
        action: 'session_expired',
        session_id: sessionData.session_id,
        details: {
          reason: 'session_not_found',
          path: request.nextUrl.pathname,
        },
        ip_address: ipAddress,
        user_agent: userAgent,
      });

      monitoring.finishSpan(span.spanId);

      return {
        success: false,
        error: 'Session expired',
        requiresReauth: true,
      };
    }

    let needsReauth = false;

    // Check idle timeout
    if (options.allowIdleTimeout !== false && idleCheck.needsReauth) {
      needsReauth = true;

      await AuthAuditLogger.logSessionEvent({
        user_id: payload.user_id,
        tenant_id: payload.tenant_id,
        action: 'session_timeout',
        session_id: sessionData.session_id,
        details: {
          reason: 'idle_timeout',
          path: request.nextUrl.pathname,
          idle_time_minutes: Math.floor((Date.now() - new Date(sessionData.last_activity).getTime()) / 60000),
        },
        ip_address: ipAddress,
        user_agent: userAgent,
      });
    }

    // Check recent authentication requirement
    if (options.requireRecentAuth) {
      const recentAuthMinutes = options.recentAuthMinutes || 30;
      const lastAuthTime = new Date(sessionData.login_time || sessionData.created_at);
      const minutesSinceAuth = (Date.now() - lastAuthTime.getTime()) / (1000 * 60);

      if (minutesSinceAuth > recentAuthMinutes) {
        needsReauth = true;

        await AuthAuditLogger.logSessionEvent({
          user_id: payload.user_id,
          tenant_id: payload.tenant_id,
          action: 'session_timeout',
          session_id: sessionData.session_id,
          details: {
            reason: 'recent_auth_required',
            path: request.nextUrl.pathname,
            minutes_since_auth: Math.floor(minutesSinceAuth),
            required_minutes: recentAuthMinutes,
          },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
      }
    }

    // Update session activity if not requiring reauth
    if (!needsReauth) {
      await SessionService.updateSessionActivity(payload.user_id);
    }

    // Prepare enhanced user object
    const enhancedUser = {
      ...payload,
      session_id: sessionData.session_id,
      last_activity: sessionData.last_activity,
      needs_reauth: needsReauth,
    };

    monitoring.tagSpan(span.spanId, {
      success: true,
      userId: payload.user_id,
      userRole: payload.role,
      tenantId: payload.tenant_id,
      needsReauth,
      sessionId: sessionData.session_id,
    });

    logger.debug('Enhanced authentication successful', {
      userId: payload.user_id,
      userRole: payload.role,
      tenantId: payload.tenant_id,
      path: request.nextUrl.pathname,
      needsReauth,
      sessionId: sessionData.session_id,
      processingTime: Date.now() - startTime,
    });

    monitoring.recordMetric('enhanced_auth_success_total', 1, {
      userRole: payload.role,
      path: request.nextUrl.pathname,
      needsReauth: needsReauth.toString(),
    });

    monitoring.recordMetric('enhanced_auth_duration_ms', Date.now() - startTime, {
      path: request.nextUrl.pathname,
    });

    monitoring.finishSpan(span.spanId);

    return {
      success: true,
      user: enhancedUser,
      requiresReauth: needsReauth,
    };

  } catch (error) {
    monitoring.tagSpan(span.spanId, {
      success: false,
      error: error instanceof Error ? error.message : 'unknown_error'
    });

    logger.error('Enhanced authentication middleware error', error instanceof Error ? error : undefined, {
      path: request.nextUrl.pathname,
      method: request.method,
      processingTime: Date.now() - startTime,
    });

    await AuthAuditLogger.logAuthFailure({
      attempt_type: 'login',
      failure_reason: 'middleware_error',
      additional_context: {
        path: request.nextUrl.pathname,
        method: request.method,
        error: error instanceof Error ? error.message : 'unknown',
      },
    });

    monitoring.recordMetric('enhanced_auth_errors_total', 1, {
      path: request.nextUrl.pathname,
      method: request.method,
    });

    monitoring.finishSpan(span.spanId);

    return {
      success: false,
      error: 'Authentication service error'
    };
  }
}

/**
 * Middleware factory for protected routes with enhanced security
 */
export function requireEnhancedAuth(options: AuthMiddlewareOptions = {}) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const authResult = await enhancedAuthMiddleware(request, options);

    if (!authResult.success) {
      const errorResponse = {
        error: {
          code: authResult.lockoutInfo?.isLocked ? 'ACCOUNT_LOCKED' :
            authResult.requiresReauth ? 'REAUTHENTICATION_REQUIRED' : 'UNAUTHORIZED',
          message: authResult.error || 'Authentication required',
          ...(authResult.lockoutInfo && { lockout_info: authResult.lockoutInfo }),
          ...(authResult.requiresReauth && { requires_reauth: true }),
        }
      };

      const statusCode = authResult.lockoutInfo?.isLocked ? 423 : // Locked
        authResult.requiresReauth ? 401 : // Unauthorized but needs reauth
          401; // Unauthorized

      return NextResponse.json(errorResponse, { status: statusCode });
    }

    if (authResult.requiresReauth) {
      // Allow the request but add headers indicating reauth is needed
      const response = NextResponse.next();
      response.headers.set('X-Requires-Reauth', 'true');
      response.headers.set('X-Session-Status', 'needs_reauth');
      return response;
    }

    // Add user info to headers for downstream processing
    const response = NextResponse.next();
    response.headers.set('X-User-ID', authResult.user!.user_id);
    response.headers.set('X-Tenant-ID', authResult.user!.tenant_id);
    response.headers.set('X-User-Role', authResult.user!.role);
    response.headers.set('X-Session-ID', authResult.user!.session_id);

    return response;
  };
}

/**
 * Helper function to extract enhanced user info from request
 */
export async function getEnhancedUserFromRequest(request: NextRequest): Promise<{
  user?: JWTPayload & { session_id: string; last_activity: string; needs_reauth: boolean };
  error?: string;
}> {
  const authResult = await enhancedAuthMiddleware(request);
  return {
    user: authResult.user,
    error: authResult.error,
  };
}