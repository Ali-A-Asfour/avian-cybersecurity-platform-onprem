import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { getClient } from '@/lib/database';
import { verifyPassword } from '@/lib/password';
import { logger } from '@/lib/logger';

// POST /api/auth/mfa/disable — requires password confirmation
export async function POST(request: NextRequest) {
  const authResult = await authMiddleware(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const { password } = await request.json();
    if (!password) {
      return NextResponse.json({ error: 'Password is required to disable MFA' }, { status: 400 });
    }

    const sql = await getClient();
    const rows = await sql`
      SELECT password_hash FROM users WHERE id = ${authResult.user!.user_id}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isValid = await verifyPassword(password, rows[0].password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 400 });
    }

    await sql`
      UPDATE users SET mfa_enabled = false, mfa_secret = NULL, updated_at = NOW()
      WHERE id = ${authResult.user!.user_id}
    `;

    logger.info('MFA disabled', { userId: authResult.user!.user_id });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('MFA disable failed', { error });
    return NextResponse.json({ error: 'Failed to disable MFA' }, { status: 500 });
  }
}
