/**
 * Authentication Middleware
 * 
 * Provides middleware for:
 * - JWT token verification
 * - Session validation via Redis
 * - Role-based access control
 * - Tenant isolation
 * 
 * Requirements: 3.4, 3.5, 5.2, 5.3, 16.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthService, JWTPayload } from './auth-service';
import { SessionManager } from './session-manager';
import { logger } from './logger';

/**
 * Extended request with auth data
 */
export interface AuthenticatedRequest extends NextRequest {
  auth?: {
    userId: string;
    email: string;
    role: string;
    tenantId: string;
    sessionId: string;
  };
}

/**
 * Authentication result
 */
interface AuthMiddlewareResult {
  authenticated: boolean;
  payload?: JWTPayload;
  error?: string;
}

/**
 * Extract JWT token from request
 */
function extractToken(request: NextRequest): string | null {
  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookie
  const tokenCookie = request.cookies.get('access_token');
  if (tokenCookie) {
    return tokenCookie.value;
  }

  return null;
}

/**
 * Verify JWT token and validate session
 * Requirements: 3.4, 3.5
 */
export async function verifyAuth(request: NextRequest): Promise<AuthMiddlewareResult> {
  try {
    // Extract token
    const token = extractToken(request);
    
    if (!token) {
      return {
        authenticated: false,
        error: 'No authentication token provided',
      };
    }

    // Verify JWT token
    const payload = AuthService.verifyAccessToken(token);
    
    if (!payload) {
      return {
        authenticated: false,
        error: 'Invalid or expired token',
      };
    }

    // Validate session in Redis
    const sessionValidation = await SessionManager.validateSession(payload.sessionId);
    
    if (!sessionValidation.valid) {
      return {
        authenticated: false,
        error: sessionValidation.reason || 'Session invalid',
      };
    }

    // Refresh session if needed
    if (sessionValidation.needsRefresh) {
      await SessionManager.refreshSession(payload.sessionId);
    }

    return {
      authenticated: true,
      payload,
    };
  } catch (error) {
    logger.error('Auth verification failed', error instanceof Error ? error : new Error(String(error)));
    return {
      authenticated: false,
      error: 'Authentication verification failed',
    };
  }
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(
  request: NextRequest,
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const authResult = await verifyAuth(request);

  if (!authResult.authenticated || !authResult.payload) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: authResult.error || 'Authentication required',
      },
      { status: 401 }
    );
  }

  // Attach auth data to request
  const authenticatedRequest = request as AuthenticatedRequest;
  authenticatedRequest.auth = {
    userId: authResult.payload.userId,
    email: authResult.payload.email,
    role: authResult.payload.role,
    tenantId: authResult.payload.tenantId,
    sessionId: authResult.payload.sessionId,
  };

  return handler(authenticatedRequest);
}

/**
 * Middleware to require specific role
 * Requirements: 5.2
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: string[],
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const authResult = await verifyAuth(request);

  if (!authResult.authenticated || !authResult.payload) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: authResult.error || 'Authentication required',
      },
      { status: 401 }
    );
  }

  // Check role
  if (!allowedRoles.includes(authResult.payload.role)) {
    logger.warn('Authorization failed - insufficient role', {
      userId: authResult.payload.userId,
      userRole: authResult.payload.role,
      requiredRoles: allowedRoles,
    });

    return NextResponse.json(
      {
        error: 'Forbidden',
        message: 'Insufficient permissions',
      },
      { status: 403 }
    );
  }

  // Attach auth data to request
  const authenticatedRequest = request as AuthenticatedRequest;
  authenticatedRequest.auth = {
    userId: authResult.payload.userId,
    email: authResult.payload.email,
    role: authResult.payload.role,
    tenantId: authResult.payload.tenantId,
    sessionId: authResult.payload.sessionId,
  };

  return handler(authenticatedRequest);
}

/**
 * Middleware to enforce tenant isolation
 * Requirements: 5.3, 16.3
 */
export async function requireTenantAccess(
  request: NextRequest,
  tenantId: string,
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const authResult = await verifyAuth(request);

  if (!authResult.authenticated || !authResult.payload) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: authResult.error || 'Authentication required',
      },
      { status: 401 }
    );
  }

  // Super admins can access any tenant
  if (authResult.payload.role === 'super_admin') {
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.auth = {
      userId: authResult.payload.userId,
      email: authResult.payload.email,
      role: authResult.payload.role,
      tenantId: authResult.payload.tenantId,
      sessionId: authResult.payload.sessionId,
    };
    return handler(authenticatedRequest);
  }

  // Check tenant access
  if (authResult.payload.tenantId !== tenantId) {
    logger.warn('Authorization failed - tenant mismatch', {
      userId: authResult.payload.userId,
      userTenantId: authResult.payload.tenantId,
      requestedTenantId: tenantId,
    });

    return NextResponse.json(
      {
        error: 'Forbidden',
        message: 'Access denied to this tenant',
      },
      { status: 403 }
    );
  }

  // Attach auth data to request
  const authenticatedRequest = request as AuthenticatedRequest;
  authenticatedRequest.auth = {
    userId: authResult.payload.userId,
    email: authResult.payload.email,
    role: authResult.payload.role,
    tenantId: authResult.payload.tenantId,
    sessionId: authResult.payload.sessionId,
  };

  return handler(authenticatedRequest);
}

/**
 * Helper to get auth data from request
 */
export function getAuthData(request: AuthenticatedRequest) {
  return request.auth;
}

/**
 * Helper to check if user has role
 */
export function hasRole(request: AuthenticatedRequest, role: string): boolean {
  return request.auth?.role === role;
}

/**
 * Helper to check if user has any of the roles
 */
export function hasAnyRole(request: AuthenticatedRequest, roles: string[]): boolean {
  return request.auth ? roles.includes(request.auth.role) : false;
}

/**
 * Helper to check if user can access tenant
 */
export function canAccessTenant(request: AuthenticatedRequest, tenantId: string): boolean {
  if (!request.auth) {
    return false;
  }

  // Super admins can access any tenant
  if (request.auth.role === 'super_admin') {
    return true;
  }

  return request.auth.tenantId === tenantId;
}
