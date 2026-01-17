/**
 * Get Current User API Endpoint
 * GET /api/auth/me
 * Part of production authentication system (Task 2.6)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { users } from '../../../../../database/schemas/main';
import { eq } from 'drizzle-orm';
import { extractTokenFromCookie, verifyToken, validateSession } from '@/lib/jwt';

/**
 * GET /api/auth/me
 * Get current authenticated user information
 */
export async function GET(req: NextRequest) {
    try {
        // Handle demo/bypass mode
        if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
            // Extract token from cookie or Authorization header
            let token = extractTokenFromCookie(req.headers.get('cookie'));
            
            // If no token in cookie, try Authorization header
            if (!token) {
                const authHeader = req.headers.get('authorization');
                if (authHeader?.startsWith('Bearer ')) {
                    token = authHeader.substring(7);
                }
            }

            if (!token) {
                return NextResponse.json(
                    { error: 'Not authenticated' },
                    { status: 401 }
                );
            }

            try {
                // Decode the demo token
                const decoded = JSON.parse(atob(token));
                
                // Check if token is expired
                if (decoded.exp && decoded.exp < Date.now()) {
                    return NextResponse.json(
                        { error: 'Token expired' },
                        { status: 401 }
                    );
                }

                // Import mock users store
                const { findMockUserById } = await import('@/lib/mock-users-store');
                const user = findMockUserById(decoded.userId);

                if (!user || !user.isActive) {
                    return NextResponse.json(
                        { error: 'User not found or inactive' },
                        { status: 404 }
                    );
                }

                return NextResponse.json({
                    success: true,
                    user: {
                        id: user.id,
                        email: user.email,
                        name: `${user.firstName} ${user.lastName}`,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        role: user.role,
                        tenantId: user.tenantId,
                        mfaEnabled: false,
                        lastLogin: user.lastLogin,
                        createdAt: user.createdAt,
                    },
                });
            } catch (error) {
                return NextResponse.json(
                    { error: 'Invalid token' },
                    { status: 401 }
                );
            }
        }

        // Production mode - use database
        const db = await getDb();

        // Extract token from cookie or Authorization header
        let token = extractTokenFromCookie(req.headers.get('cookie'));
        
        // If no token in cookie, try Authorization header
        if (!token) {
            const authHeader = req.headers.get('authorization');
            if (authHeader?.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        if (!token) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        // Verify token
        const verifyResult = verifyToken(token);

        if (!verifyResult.valid || !verifyResult.payload) {
            return NextResponse.json(
                { error: 'Invalid or expired token' },
                { status: 401 }
            );
        }

        // Validate session exists in database
        const isSessionValid = await validateSession(token);

        if (!isSessionValid) {
            return NextResponse.json(
                { error: 'Session expired or invalid' },
                { status: 401 }
            );
        }

        // Get user from database
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, verifyResult.payload.userId))
            .limit(1);

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Check if user is still active
        if (!user.is_active) {
            return NextResponse.json(
                { error: 'Account is inactive' },
                { status: 403 }
            );
        }

        // Return user data (no sensitive information)
        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: `${user.first_name} ${user.last_name}`,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                tenantId: user.tenant_id,
                mfaEnabled: user.mfa_enabled,
                lastLogin: user.last_login,
                createdAt: user.created_at,
            },
        });
    } catch (error) {
        console.error('Get current user error:', error);

        return NextResponse.json(
            { error: 'Failed to get user information' },
            { status: 500 }
        );
    }
}
