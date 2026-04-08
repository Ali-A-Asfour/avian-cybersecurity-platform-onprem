import { NextRequest, NextResponse } from 'next/server';
import { authenticator } from 'otplib';
import { getClient } from '@/lib/database';
import { createSession, setAuthCookie } from '@/lib/jwt';
import { verifyToken } from '@/lib/jwt';
import { logger } from '@/lib/logger';

// POST /api/auth/mfa/verify — verify TOTP code after password login, return real session token
export async function POST(request: NextRequest) {
  try {
    const { code, mfa_token } = await request.json();

    if (!code || !mfa_token) {
      return NextResponse.json({ error: 'Code and mfa_token are required' }, { status: 400 });
    }

    // Verify the short-lived MFA token issued at password login
    const tokenResult = verifyToken(mfa_token);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json({ error: 'Invalid or expired MFA session. Please log in again.' }, { status: 401 });
    }

    const { userId, email, role, tenantId } = tokenResult.payload;

    // Get user's MFA secret
    const sql = await getClient();
    const rows = await sql`
      SELECT mfa_secret, mfa_enabled, is_active FROM users WHERE id = ${userId}
    `;

    if (rows.length === 0 || !rows[0].is_active) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!rows[0].mfa_enabled || !rows[0].mfa_secret) {
      return NextResponse.json({ error: 'MFA not enabled for this account' }, { status: 400 });
    }

    const isValid = authenticator.verify({ token: code, secret: rows[0].mfa_secret });
    if (!isValid) {
      logger.warn('Invalid MFA code attempt', { userId });
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // MFA passed — issue real session token
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const { token, expiresAt, sessionId } = await createSession(userId, email, role, tenantId, ipAddress, userAgent);

    await sql`UPDATE users SET last_login = NOW() WHERE id = ${userId}`;

    logger.info('MFA verification successful', { userId });

    const response = NextResponse.json({
      success: true,
      token,
      user: { id: userId, email, role, tenantId },
      session: { expiresAt: expiresAt.toISOString() },
    });

    response.headers.set('Set-Cookie', setAuthCookie(token));
    return response;
  } catch (error) {
    logger.error('MFA verification failed', { error });
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
