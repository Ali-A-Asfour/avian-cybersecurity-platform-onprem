/**
 * Authentication Utilities
 * Provides utility functions for authentication validation
 */

import { NextRequest } from 'next/server';
import { authenticate, AuthContext } from './auth-middleware';

/**
 * Validate authentication for API routes
 * Returns authentication context or null if invalid
 */
export async function validateAuth(req: NextRequest): Promise<AuthContext | null> {
    const authResult = await authenticate(req);

    if (!authResult.success) {
        return null;
    }

    return authResult.context;
}

/**
 * Extract tenant ID from authenticated user context
 */
export function getTenantId(context: AuthContext): string {
    return context.user.tenantId;
}

/**
 * Extract user ID from authenticated user context
 */
export function getUserId(context: AuthContext): string {
    return context.user.id;
}

/**
 * Check if user has specific role
 */
export function hasRole(context: AuthContext, role: string): boolean {
    return context.user.role === role;
}

/**
 * Check if user is admin (super admin or tenant admin)
 */
export function isAdmin(context: AuthContext): boolean {
    return context.user.role === 'super_admin' || context.user.role === 'tenant_admin';
}