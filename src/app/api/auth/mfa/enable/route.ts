import { NextRequest, NextResponse } from 'next/server';
import { authenticator } from 'otplib';
import { authMiddleware } from '@/middleware/auth.middleware';
import { getClient } from '@/lib/database';
import { logger } from '@/lib/logger';

// POST /api/auth/mfa/enable — verify code then flip mfa_enabled = true
export async function POST(request: NextRequest) {
  const authResult = await authMiddleware(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
    }

    const sql = await getClient();
    const rows = await sql`
      SELECT mfa_secret FROM users WHERE id = ${authResult.user!.user_id}
    `;

    if (rows.length === 0 || !rows[0].mfa_secret) {
      return NextResponse.json({ error: 'MFA not set up. Call /api/auth/mfa/setup first.' }, { status: 400 });
    }

    const isValid = authenticator.verify({ token: code, secret: rows[0].mfa_secret });
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    await sql`
      UPDATE users SET mfa_enabled = true, updated_at = NOW()
      WHERE id = ${authResult.user!.user_id}
    `;

    logger.info('MFA enabled', { userId: authResult.user!.user_id });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('MFA enable failed', { error });
    return NextResponse.json({ error: 'Failed to enable MFA' }, { status: 500 });
  }
}
