/**
 * Demo Login API Endpoint
 * POST /api/auth/demo-login
 * For testing purposes only - bypasses real authentication
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Import shared mock users store
    const { findMockUserByEmail } = await import('@/lib/mock-users-store');
    
    // Find user by email and verify password
    const user = findMockUserByEmail(email);
    
    if (!user || user.password !== password || !user.isActive) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create a simple session token
    const sessionToken = btoa(JSON.stringify({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    }));

    // Convert to demo auth user format for compatibility
    const demoUser = {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    const response = NextResponse.json({
      success: true,
      user: demoUser,
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
