/**
 * Authorization Middleware
 * Provides authentication and authorization checks for API routes
 * Part of production authentication system (Task 5.1)
 */

import { NextRequest, NextResponse } from 'next/server';
// import { db } from './database';
import { users } from '../../database/schemas/main';
import { eq } from 'drizzle-orm';
import { extractTokenFromCookie, verifyToken } from './jwt';
import {
    UserRole,
    Resource,
    Action,
    checkPermission,
    PermissionCheckResult,
} from './permissions';
import { logAccessDenied } from './audit-logger';

/**
 * Authenticated user context
 */
export interface AuthContext {
    user: {
        id: string;
        email: string;
        role: UserRole;
        tenantId: string;
        firstName: string;
        lastName: string;
        isActive: boolean;
    };
    token: string;
}

/**
 * Authorization options
 */
export interface AuthOptions {
    requiredRole?: UserRole | UserRole[];
    requiredPermission?: {
        resource: Resource;
        action: Action;
    };
    allowSameUser?: boolean; // Allow if accessing own resources
    allowSameTenant?: boolean; // Allow if accessing same tenant resources
}

/**
 * Extract and verify authentication from request
 */
export async function authenticate(
    req: NextRequest
): Promise<{ success: true; context: AuthContext } | { success: false; error: string; status: number }> {
    if (!db) {
        return {
            success: false,
            error: 'Service temporarily unavailable',
            status: 503,
        };
    }

    // Extract token from cookie
    const cookieHeader = req.headers.get('cookie');
    const token = extractTokenFromCookie(cookieHeader);

    if (!token) {
        return {
            success: false,
            error: 'Authentication required',
            status: 401,
        };
    }

    // Verify token
    const verifyResult = verifyToken(token);
    if (!verifyResult.valid || !verifyResult.payload) {
        return {
            success: false,
            error: verifyResult.error || 'Invalid authentication token',
            status: 401,
        };
    }

    // Get user from database
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, verifyResult.payload.userId))
        .limit(1);

    if (!user) {
        return {
            success: false,
            error: 'User not found',
            status: 404,
        };
    }

    if (!user.is_active) {
        return {
            success: false,
            error: 'Account is inactive',
            status: 403,
        };
    }

    return {
        success: true,
        context: {
            user: {
                id: user.id,
                email: user.email,
                role: user.role as UserRole,
                tenantId: user.tenant_id,
                firstName: user.first_name,
                lastName: user.last_name,
                isActive: user.is_active,
            },
            token,
        },
    };
}

/**
 * Check authorization based on options
 */
export function authorize(
    context: AuthContext,
    options: AuthOptions,
    targetContext?: {
        tenantId?: string;
        userId?: string;
    }
): PermissionCheckResult {
    const { user } = context;

    // Check required role
    if (options.requiredRole) {
        const requiredRoles = Array.isArray(options.requiredRole)
            ? options.requiredRole
            : [options.requiredRole];

        if (!requiredRoles.includes(user.role)) {
            return {
                allowed: false,
                reason: 'Insufficient role permissions',
            };
        }
    }

    // Check required permission
    if (options.requiredPermission) {
        const permissionCheck = checkPermission(
            user.role,
            options.requiredPermission.resource,
            options.requiredPermission.action,
            {
                userTenantId: user.tenantId,
                targetTenantId: targetContext?.tenantId,
                userId: user.id,
                targetUserId: targetContext?.userId,
            }
        );

        if (!permissionCheck.allowed) {
            return permissionCheck;
        }
    }

    // Check same user access
    if (options.allowSameUser && targetContext?.userId) {
        if (user.id === targetContext.userId) {
            return { allowed: true, scope: 'own' };
        }
    }

    // Check same tenant access
    if (options.allowSameTenant && targetContext?.tenantId) {
        if (user.tenantId === targetContext.tenantId) {
            return { allowed: true, scope: 'tenant' };
        }
    }

    return { allowed: true };
}

/**
 * Middleware wrapper for API routes
 */
export function withAuth(
    handler: (req: NextRequest, context: AuthContext) => Promise<NextResponse>,
    options?: AuthOptions
) {
    return async (req: NextRequest): Promise<NextResponse> => {
        // Authenticate user
        const authResult = await authenticate(req);

        if (!authResult.success) {
            return NextResponse.json(
                { error: authResult.error },
                { status: authResult.status }
            );
        }

        const _context = authResult.context;

        // Authorize if options provided
        if (options) {
            const authzResult = authorize(context, options);

            if (!authzResult.allowed) {
                // Log access denied
                await logAccessDenied(
                    context.user.id,
                    context.user.email,
                    req,
                    req.url,
                    authzResult.reason || 'Unauthorized'
                );

                return NextResponse.json(
                    { error: authzResult.reason || 'Unauthorized' },
                    { status: 403 }
                );
            }
        }

        // Call handler with context
        return handler(req, context);
    };
}

/**
 * Require specific role(s)
 */
export function requireRole(...roles: UserRole[]) {
    return (
        handler: (req: NextRequest, context: AuthContext) => Promise<NextResponse>
    ) => {
        return withAuth(handler, { requiredRole: roles });
    };
}

/**
 * Require specific permission
 */
export function requirePermission(resource: Resource, action: Action) {
    return (
        handler: (req: NextRequest, context: AuthContext) => Promise<NextResponse>
    ) => {
        return withAuth(handler, {
            requiredPermission: { resource, action },
        });
    };
}

/**
 * Require admin role (super admin or tenant admin)
 */
export function requireAdmin() {
    return requireRole(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN);
}

/**
 * Require super admin role
 */
export function requireSuperAdmin() {
    return requireRole(UserRole.SUPER_ADMIN);
}

/**
 * Allow access to own resources or admin
 */
export function requireOwnerOrAdmin(getUserId: (req: NextRequest) => string | Promise<string>) {
    return (
        handler: (req: NextRequest, context: AuthContext) => Promise<NextResponse>
    ) => {
        return async (req: NextRequest): Promise<NextResponse> => {
            const authResult = await authenticate(req);

            if (!authResult.success) {
                return NextResponse.json(
                    { error: authResult.error },
                    { status: authResult.status }
                );
            }

            const _context = authResult.context;
            const targetUserId = await getUserId(req);

            // Check if user is admin or accessing own resource
            const isAdmin =
                context.user.role === UserRole.SUPER_ADMIN ||
                context.user.role === UserRole.TENANT_ADMIN;
            const isOwner = context.user.id === targetUserId;

            if (!isAdmin && !isOwner) {
                await logAccessDenied(
                    context.user.id,
                    context.user.email,
                    req,
                    req.url,
                    'Not owner or admin'
                );

                return NextResponse.json(
                    { error: 'You can only access your own resources' },
                    { status: 403 }
                );
            }

            return handler(req, context);
        };
    };
}

/**
 * Extract user ID from URL parameter
 */
export function extractUserIdFromUrl(req: NextRequest): string {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    return pathParts[pathParts.length - 1];
}

/**
 * Extract tenant ID from URL parameter
 */
export function extractTenantIdFromUrl(req: NextRequest): string {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const tenantIndex = pathParts.indexOf('tenants');
    return pathParts[tenantIndex + 1];
}

/**
 * Extract tenant ID from query parameter
 */
export function extractTenantIdFromQuery(req: NextRequest): string | null {
    const url = new URL(req.url);
    return url.searchParams.get('tenantId');
}
