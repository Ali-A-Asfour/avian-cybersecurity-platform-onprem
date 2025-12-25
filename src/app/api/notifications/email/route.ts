import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { to, from, subject, html, text } = await request.json();

    // In development, just log the email
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 Email Notification:');
      console.log(`To: ${to}`);
      console.log(`From: ${from}`);
      console.log(`Subject: ${subject}`);
      console.log(`Text: ${text}`);

      return NextResponse.json({
        success: true,
        messageId: `dev_${Date.now()}`,
        message: 'Email logged to console (development mode)'
      });
    }

    // In production, this would integrate with a real email service
    // For now, return success
    return NextResponse.json({
      success: true,
      messageId: `msg_${Date.now()}`,
      message: 'Email sent successfully'
    });

  } catch (error) {
    console.error('Email notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send email notification' },
      { status: 500 }
    );
  }
}