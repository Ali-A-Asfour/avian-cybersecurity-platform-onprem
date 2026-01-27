/**
 * Session Extension API Endpoint
 * POST /api/auth/extend-session
 * Extends the current user session by refreshing the token
 */

import { NextRequest, NextResponse } from 'next/server';
import { refreshToken, extractTokenFromCookie, extractTokenFromHeader, setAuthCookie } from '@/lib/jwt';

/**
 * POST /api/auth/extend-session
 * Extend the current session by refreshing the token
 */
export async function POST(req: NextRequest) {
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

    // Refresh the token
    const result = await refreshToken(token, false); // Use normal session duration

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to refresh token' },
        { status: 401 }
      );
    }

    // Create response with new token
    const response = NextResponse.json({
      success: true,
      token: result.token,
      expiresAt: result.expiresAt.toISOString(),
    });

    // Set new auth cookie
    response.headers.set('Set-Cookie', setAuthCookie(result.token, false));

    return response;
  } catch (error) {
    console.error('Session extension error:', error);
    return NextResponse.json(
      { error: 'Failed to extend session' },
      { status: 500 }
    );
  }
}