/**
 * Extend Session API Endpoint
 * POST /api/auth/extend-session
 * Refreshes the user's JWT token to extend their session
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromCookie, verifyToken, refreshToken } from '@/lib/jwt';

/**
 * POST /api/auth/extend-session
 * Extend the current session by issuing a new token
 */
export async function POST(req: NextRequest) {
  try {
    // Get token from cookie
    const cookieHeader = req.headers.get('cookie');
    const token = extractTokenFromCookie(cookieHeader);

    if (!token) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No active session found' 
        },
        { status: 401 }
      );
    }

    // Verify current token
    const verifyResult = verifyToken(token);
    
    if (!verifyResult.valid) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid or expired session' 
        },
        { status: 401 }
      );
    }

    // Check if user wants to keep "remember me" setting
    // We'll maintain the same session duration type
    const payload = verifyResult.payload;
    if (!payload) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid token payload' 
        },
        { status: 401 }
      );
    }

    // Refresh the token (creates new session, revokes old one)
    const newTokenResult = await refreshToken(token, false); // Default to 24-hour session

    if (!newTokenResult) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to refresh session' 
        },
        { status: 500 }
      );
    }

    // Create response with new token
    const response = NextResponse.json({
      success: true,
      message: 'Session extended successfully',
      token: newTokenResult.token,
      expiresAt: newTokenResult.expiresAt.toISOString(),
    });

    // Set new token in cookie
    response.cookies.set('auth_token', newTokenResult.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('Session extension error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to extend session' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/extend-session
 * Get information about session extension capability
 */
export async function GET(req: NextRequest) {
  try {
    // Get token from cookie
    const cookieHeader = req.headers.get('cookie');
    const token = extractTokenFromCookie(cookieHeader);

    if (!token) {
      return NextResponse.json({
        canExtend: false,
        reason: 'No active session',
      });
    }

    // Verify token
    const verifyResult = verifyToken(token);

    if (!verifyResult.valid) {
      return NextResponse.json({
        canExtend: false,
        reason: verifyResult.expired ? 'Session expired' : 'Invalid session',
      });
    }

    return NextResponse.json({
      canExtend: true,
      message: 'Session can be extended',
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({
      canExtend: false,
      reason: 'Error checking session',
    });
  }
}
