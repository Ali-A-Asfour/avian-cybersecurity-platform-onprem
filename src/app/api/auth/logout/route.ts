/**
 * User Logout API Endpoint
 * POST /api/auth/logout
 * Part of production authentication system (Task 2.5)
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromCookie, revokeSession, verifyToken, clearAuthCookie } from '@/lib/jwt';
import { logAuthEvent, AuditAction, AuditResult } from '@/lib/audit-logger';

/**
 * POST /api/auth/logout
 * Logout user and invalidate session
 */
export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  try {
    // Extract token from cookie
    const token = extractTokenFromCookie(req.headers.get('cookie'));

    if (!token) {
      return NextResponse.json(
        { error: 'No active session found' },
        { status: 401 }
      );
    }

    // Verify token to get user info
    const verifyResult = verifyToken(token);
    const userId = verifyResult.payload?.userId || null;
    const email = verifyResult.payload?.email || 'unknown';

    // Revoke session (delete from database)
    await revokeSession(token);

    // Log logout event
    await logAuthEvent({
      userId,
      email,
      action: AuditAction.LOGOUT,
      result: AuditResult.SUCCESS,
      ipAddress,
      userAgent,
      metadata: { method: 'manual' }
    });

    // Create response
    const response = NextResponse.json(
      {
        success: true,
        message: 'Logged out successfully',
      },
      { status: 200 }
    );

    // Clear auth cookie
    response.headers.set('Set-Cookie', clearAuthCookie());

    return response;
  } catch (error) {
    console.error('Logout error:', error);

    // Log error
    await logAuthEvent({
      userId: null,
      email: 'unknown',
      action: AuditAction.LOGOUT,
      result: AuditResult.ERROR,
      ipAddress,
      userAgent,
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    });

    // Still clear cookie even on error
    const response = NextResponse.json(
      { error: 'Logout failed, but session cleared' },
      { status: 500 }
    );

    response.headers.set('Set-Cookie', clearAuthCookie());

    return response;
  }
}
