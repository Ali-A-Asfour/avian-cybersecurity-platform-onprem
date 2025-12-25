/**
 * Session Validation Middleware
 * Validates JWT tokens and sessions for protected routes
 * Part of production authentication system (Task 2.6)
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromCookie, verifyToken, validateSession } from '@/lib/jwt';

/**
 * Session validation result
 */
export interface SessionValidationResult {
    valid: boolean;
    userId?: string;
    email?: string;
    role?: string;
    tenantId?: string;
    error?: string;
}

/**
 * Validate session from request
 * @param req - Next.js request object
 * @returns Session validation result
 */
export async function validateSessionFromRequest(
    req: NextRequest
): Promise<SessionValidationResult> {
    try {
        // Extract token from cookie
        const token = extractTokenFromCookie(req.headers.get('cookie'));

        if (!token) {
            return {
                valid: false,
                error: 'No authentication token found',
            };
        }

        // Verify token signature and expiration
        const verifyResult = verifyToken(token);

        if (!verifyResult.valid || !verifyResult.payload) {
            return {
                valid: false,
                error: verifyResult.error || 'Invalid token',
            };
        }

        // Validate session exists in database
        const isSessionValid = await validateSession(token);

        if (!isSessionValid) {
            return {
                valid: false,
                error: 'Session expired or revoked',
            };
        }

        // Return valid session with user info
        return {
            valid: true,
            userId: verifyResult.payload.userId,
            email: verifyResult.payload.email,
            role: verifyResult.payload.role,
            tenantId: verifyResult.payload.tenantId,
        };
    } catch {
        console.error('Session validation error:', error);
        return {
            valid: false,
            error: 'Session validation failed',
        };
    }
}

/**
 * Middleware to require authentication
 * Use this in API routes that require authentication
 */
export async function requireAuth(
    req: NextRequest
): Promise<SessionValidationResult | NextResponse> {
    const validation = await validateSessionFromRequest(req);

    if (!validation.valid) {
        return NextResponse.json(
            { error: validation.error || 'Authentication required' },
            { status: 401 }
        );
    }

    return validation;
}

/**
 * Middleware to require specific role
 * Use this in API routes that require specific permissions
 */
export async function requireRole(
    req: NextRequest,
    allowedRoles: string[]
): Promise<SessionValidationResult | NextResponse> {
    const validation = await validateSessionFromRequest(req);

    if (!validation.valid) {
        return NextResponse.json(
            { error: validation.error || 'Authentication required' },
            { status: 401 }
        );
    }

    if (!validation.role || !allowedRoles.includes(validation.role)) {
        return NextResponse.json(
            { error: 'Insufficient permissions' },
            { status: 403 }
        );
    }

    return validation;
}

/**
 * Helper to check if response is an error
 */
export function isErrorResponse(
    result: SessionValidationResult | NextResponse
): result is NextResponse {
    return result instanceof NextResponse;
}
