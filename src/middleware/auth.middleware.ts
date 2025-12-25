import { NextRequest, NextResponse } from 'next/server';
import { AuthService, RBACService } from '../lib/auth';
import { AuthenticationService } from '../services/auth.service';
import { JWTPayload, UserRole } from '../types';
import { monitoring } from '../lib/monitoring';
import { logger } from '../lib/logger';

export interface AuthenticatedRequest extends NextRequest {
  user?: JWTPayload;
}

/**
 * Authentication middleware - verifies JWT token and returns user info
 */
export async function authMiddleware(request: NextRequest): Promise<{ success: boolean; user?: JWTPayload; error?: string }> {
  const span = monitoring.startSpan('auth.middleware');

  try {
    monitoring.tagSpan(span.spanId, {
      'http.method': request.method,
      'http.path': request.nextUrl.pathname,
    });

    // Development mode bypass
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      monitoring.tagSpan(span.spanId, {
        success: true,
        bypass: true,
        mode: 'development'
      });

      logger.debug('Authentication bypassed in development mode', {
        path: request.nextUrl.pathname,
        method: request.method,
      });

      // Generate consistent user ID based on role for development
      // This ensures helpdesk analysts can see tickets from all users
      let userId: string;
      const sessionId = request.headers.get('x-session-id') ||
        request.headers.get('x-forwarded-for') ||
        request.headers.get('user-agent')?.slice(-10) ||
        'anonymous';

      // Create a consistent but unique user ID for this session
      const userIdSuffix = sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(-6) ||
        Math.random().toString(36).slice(-6);

      // For development, use a mix of predictable user IDs
      const userIds = ['dev-user-123', 'dev-user-456', 'dev-user-789', 'dev-user-abc', 'dev-user-def'];
      userId = userIds[Math.abs(userIdSuffix.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % userIds.length];

      monitoring.finishSpan(span.spanId);

      return {
        success: true,
        user: {
          user_id: userId, // Consistent user ID from predefined pool
          tenant_id: 'dev-tenant-123',
          role: UserRole.SUPER_ADMIN, // Super admin can access all ticket categories
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        }
      };
    }

    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      monitoring.tagSpan(span.spanId, {
        success: false,
        error: 'missing_auth_header'
      });

      logger.warn('Authentication failed - missing authorization header', {
        path: request.nextUrl.pathname,
        method: request.method,
      });

      monitoring.recordMetric('auth_failures_total', 1, {
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

    // Verify token
    const payload = AuthService.verifyAccessToken(token);

    // Validate session exists
    const isValidSession = await AuthenticationService.validateSession(payload.user_id);
    if (!isValidSession) {
      monitoring.tagSpan(span.spanId, {
        success: false,
        error: 'invalid_session',
        userId: payload.user_id
      });

      logger.warn('Authentication failed - invalid session', {
        userId: payload.user_id,
        path: request.nextUrl.pathname,
        method: request.method,
      });

      monitoring.recordMetric('auth_failures_total', 1, {
        reason: 'invalid_session',
        path: request.nextUrl.pathname,
      });

      monitoring.finishSpan(span.spanId);

      return {
        success: false,
        error: 'Session expired or invalid'
      };
    }

    monitoring.tagSpan(span.spanId, {
      success: true,
      userId: payload.user_id,
      userRole: payload.role,
      tenantId: payload.tenant_id,
    });

    logger.debug('Authentication successful', {
      userId: payload.user_id,
      userRole: payload.role,
      tenantId: payload.tenant_id,
      path: request.nextUrl.pathname,
    });

    monitoring.recordMetric('auth_success_total', 1, {
      userRole: payload.role,
      path: request.nextUrl.pathname,
    });

    monitoring.finishSpan(span.spanId);

    return {
      success: true,
      user: payload
    };
  } catch (error) {
    monitoring.tagSpan(span.spanId, {
      success: false,
      error: error instanceof Error ? error.message : 'unknown_error'
    });

    logger.error('Authentication middleware error', error instanceof Error ? error : undefined, {
      path: request.nextUrl.pathname,
      method: request.method,
    });

    monitoring.recordMetric('auth_errors_total', 1, {
      path: request.nextUrl.pathname,
      method: request.method,
    });

    monitoring.finishSpan(span.spanId);

    return {
      success: false,
      error: 'Invalid or expired token'
    };
  }
}

/**
 * Role-based authorization middleware factory
 */
export function requireRole(requiredRole: UserRole) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    // First run auth middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication required' } },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const userRole = user.role;

    // Check if user has required role
    if (!RBACService.hasRole(userRole, requiredRole)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    return null; // Allow request to continue
  };
}

/**
 * Permission-based authorization middleware factory
 */
export function requirePermission(permission: string) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    // First run auth middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication required' } },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const userRole = user.role;

    // Check if user has required permission
    if (!RBACService.hasPermission(userRole, permission)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    return null; // Allow request to continue
  };
}

/**
 * Tenant isolation middleware - ensures users can only access their tenant's data
 */
export function requireTenantAccess(getTenantIdFromRequest: (request: NextRequest) => string | null) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    // First run auth middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication required' } },
        { status: 401 }
      );
    }

    const { user } = authResult;

    // Get target tenant ID from request
    const targetTenantId = getTenantIdFromRequest(request);

    if (!targetTenantId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Tenant ID not specified in request' } },
        { status: 400 }
      );
    }

    // Check tenant access
    if (!RBACService.canAccessTenant(user.tenant_id, targetTenantId, user.role)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied to this tenant' } },
        { status: 403 }
      );
    }

    return null; // Allow request to continue
  };
}

/**
 * Rate limiting middleware factory
 */
export function rateLimit(maxRequests: number = 100, windowSeconds: number = 3600) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimitKey = `api:${ip}`;

    try {
      const { allowed, remaining, resetTime } = await import('../lib/redis').then(
        ({ SessionService }) => SessionService.checkRateLimit(rateLimitKey, maxRequests, windowSeconds)
      );

      if (!allowed) {
        return NextResponse.json(
          {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests',
              details: { resetTime }
            }
          },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
            }
          }
        );
      }

      // Add rate limit headers to response
      const response = NextResponse.next();
      response.headers.set('X-RateLimit-Limit', maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      response.headers.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());

      return response;
    } catch (error) {
      // If rate limiting fails, allow the request but log the error
      console.error('Rate limiting error:', error);
      return null;
    }
  };
}

/**
 * Combine multiple middleware functions
 */
export function combineMiddleware(...middlewares: Array<(request: NextRequest) => Promise<NextResponse | null>>) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    for (const middleware of middlewares) {
      const result = await middleware(request);
      if (result) {
        return result; // Stop if middleware returns a response
      }
    }
    return null; // All middleware passed
  };
}

/**
 * Helper function to extract user info from request headers
 */
export function getUserFromRequest(request: NextRequest): JWTPayload | null {
  const userId = request.headers.get('x-user-id');
  const tenantId = request.headers.get('x-tenant-id');
  const role = request.headers.get('x-user-role') as UserRole;

  if (!userId || !tenantId || !role) {
    return null;
  }

  return {
    user_id: userId,
    tenant_id: tenantId,
    role,
    iat: 0, // Not needed for this use case
    exp: 0, // Not needed for this use case
  };
}