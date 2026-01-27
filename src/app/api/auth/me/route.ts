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
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        first_name: users.first_name,
        last_name: users.last_name,
        role: users.role,
        tenant_id: users.tenant_id,
        is_active: users.is_active,
        email_verified: users.email_verified,
      })
      .from(users)
      .where(eq(users.id, verifyResult.payload.userId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if account is active
    // BYPASS: Skip account active check for on-premises production deployment
    if (!user.is_active && process.env.NODE_ENV !== 'production') {
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
        name: `${user.first_name} ${user.last_name}`,
        role: user.role,
        tenantId: user.tenant_id,
        isActive: user.is_active,
        emailVerified: user.email_verified,
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