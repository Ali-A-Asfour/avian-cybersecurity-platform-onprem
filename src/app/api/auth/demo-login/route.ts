/**
 * Demo Login API Endpoint
 * POST /api/auth/demo-login
 * For testing purposes only - bypasses real authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { DEMO_AUTH_USERS } from '@/lib/demo-auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Demo credentials - for testing only
    const demoCredentials = [
      { email: 'admin@demo.com', password: 'admin123', user: DEMO_AUTH_USERS[0] },
      { email: 'analyst@demo.com', password: 'analyst123', user: DEMO_AUTH_USERS[2] },
      { email: 'helpdesk@demo.com', password: 'helpdesk123', user: DEMO_AUTH_USERS[3] },
      { email: 'user@demo.com', password: 'user123', user: DEMO_AUTH_USERS[4] }
    ];

    const validCredential = demoCredentials.find(
      cred => cred.email === email && cred.password === password
    );

    if (!validCredential) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create a simple session token
    const sessionToken = btoa(JSON.stringify({
      userId: validCredential.user.id,
      email: validCredential.user.email,
      role: validCredential.user.role,
      tenantId: validCredential.user.tenantId,
      exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    }));

    const response = NextResponse.json({
      success: true,
      user: validCredential.user,
      token: sessionToken
    });

    // Set auth cookie
    response.cookies.set('auth-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 // 24 hours
    });

    return response;
  } catch (error) {
    console.error('Demo login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
