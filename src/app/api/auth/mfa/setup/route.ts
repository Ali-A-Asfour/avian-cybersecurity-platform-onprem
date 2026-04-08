import { NextRequest, NextResponse } from 'next/server';
import { authenticator } from 'otplib';
import { authMiddleware } from '@/middleware/auth.middleware';
import { getClient } from '@/lib/database';
import { logger } from '@/lib/logger';

// POST /api/auth/mfa/setup — generate secret + QR code URL for the user
export async function POST(request: NextRequest) {
  const authResult = await authMiddleware(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(authResult.user!.email, 'AVIAN Platform', secret);

    // Store secret temporarily (not enabled yet — enabled after verification)
    const sql = await getClient();
    await sql`
      UPDATE users SET mfa_secret = ${secret}, updated_at = NOW()
      WHERE id = ${authResult.user!.user_id}
    `;

    logger.info('MFA setup initiated', { userId: authResult.user!.user_id });

    return NextResponse.json({ secret, otpauth_url: otpauthUrl });
  } catch (error) {
    logger.error('MFA setup failed', { error });
    return NextResponse.json({ error: 'Failed to set up MFA' }, { status: 500 });
  }
}
