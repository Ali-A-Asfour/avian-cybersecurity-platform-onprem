/**
 * Authentication Utilities
 * Provides utility functions for authentication validation
 */

import { NextRequest } from 'next/server';
import { verifyAuth, getAuthData, AuthenticatedRequest } from './auth-middleware';

/**
 * Authentication context interface
 */
export interface AuthContext {
    user: {
        id: string;
        tenantId: string;
        role: string;
        email?: string;
    };
}

/**
 * Validate authentication for API routes
 * Returns authentication context or null if invalid
 */
export async function validateAuth(req: NextRequest): Promise<AuthContext | null> {
    const authResult = await verifyAuth(req);

    if (!authResult.authenticated || !authResult.payload) {
        return null;
    }

    // Convert payload to AuthContext format
    return {
        user: {
            id: authResult.payload.userId,
            tenantId: authResult.payload.tenantId,
            role: authResult.payload.role,
            email: authResult.payload.email,
        }
    };
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