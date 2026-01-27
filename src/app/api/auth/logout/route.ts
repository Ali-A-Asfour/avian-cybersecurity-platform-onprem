/**
 * User Logout API Endpoint
 * POST /api/auth/logout
 * Revokes user session and clears authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { revokeSession, extractTokenFromCookie, extractTokenFromHeader, clearAuthCookie } from '@/lib/jwt';

/**
 * POST /api/auth/logout
 * Logout user and revoke session
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

    if (token) {
      // Revoke the session in the database
      await revokeSession(token);
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    // Clear the auth cookie
    response.headers.set('Set-Cookie', clearAuthCookie());

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    
    // Even if there's an error, clear the cookie and return success
    // This ensures the client-side logout always works
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    response.headers.set('Set-Cookie', clearAuthCookie());
    return response;
  }
}