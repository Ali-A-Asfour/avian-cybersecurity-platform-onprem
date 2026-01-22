/**
 * Current User API Endpoint
 * GET /api/auth/me
 * Returns current authenticated user information
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { users } from '../../../../../database/schemas/main';
import { eq } from 'drizzle-orm';
import { verifyToken, extractTokenFromCookie, extractTokenFromHeader } from '@/lib/jwt';

/**
 * GET /api/auth/me
 * Get current authenticated user information
 */
export async function GET(req: NextRequest) {
  try {
    // Extract token from cookie or Authorization header
    const cookieHeader = req.headers.get('cookie');
    const authHeader = req.headers.get('authorization');
    
    let token = extractTokenFromCookie(cookieHeader);
    if (!token) {
      token = extractTokenFromHeader(authHeader);
    }

    if (!token) {
      return NextResponse.json(
        { error: 'No authentication token provided' },
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

    // Get user from database
    const db = await getDb();
    
    // The JWT payload uses snake_case (user_id) not camelCase (userId)
    const userId = (verifyResult.payload as any).user_id || verifyResult.payload.userId;
    
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.first_name,
        lastName: users.last_name,
        role: users.role,
        tenantId: users.tenant_id,
        emailVerified: users.email_verified,
        mfaEnabled: users.mfa_enabled,
        isActive: users.is_active,
        lastLogin: users.last_login,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is inactive' },
        { status: 403 }
      );
    }

    // Return user information
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
        tenantId: user.tenantId,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
        lastLogin: user.lastLogin,
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