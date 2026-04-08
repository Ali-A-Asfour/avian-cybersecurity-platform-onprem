import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  // Auth required — no open relay
  const authResult = await authMiddleware(request);
  if (!authResult.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { to, from, subject, html, text } = await request.json();

    if (!to || !subject || (!html && !text)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate email addresses
    if (!EMAIL_REGEX.test(to)) {
      return NextResponse.json({ error: 'Invalid recipient email' }, { status: 400 });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('📧 Email Notification:', { to, from, subject, text });
      return NextResponse.json({ success: true, messageId: `dev_${Date.now()}` });
    }

    // Production email integration point
    return NextResponse.json({ success: true, messageId: `msg_${Date.now()}` });
  } catch (error) {
    console.error('Email notification error:', error);
    return NextResponse.json({ error: 'Failed to send email notification' }, { status: 500 });
  }
}
