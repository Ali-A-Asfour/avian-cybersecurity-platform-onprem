import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

// Mock user profiles storage
const userProfiles = new Map<string, any>();

export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: authResult.error || 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const tenantResult = await tenantMiddleware(request, authResult.user);
    if (!tenantResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: tenantResult.error || {
            code: 'TENANT_ERROR',
            message: 'Failed to process tenant context',
          },
        },
        { status: 500 }
      );
    }

    const { tenant } = tenantResult;
    const user = authResult.user;
    const profileKey = `${tenant!.id}:${user.user_id}`;

    const profile = userProfiles.get(profileKey) || {
      name: user.name || 'User',
      email: user.email || 'user@example.com',
      phone: '',
      timezone: 'America/New_York',
      language: 'en',
    };

    return NextResponse.json({
      success: true,
      data: {
        profile,
        mfaEnabled: false,
      },
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_PROFILE_ERROR',
          message: 'Failed to fetch profile',
        },
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: authResult.error || 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const tenantResult = await tenantMiddleware(request, authResult.user);
    if (!tenantResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: tenantResult.error || {
            code: 'TENANT_ERROR',
            message: 'Failed to process tenant context',
          },
        },
        { status: 500 }
      );
    }

    const { tenant } = tenantResult;
    const user = authResult.user;
    const body = await request.json();
    const profileKey = `${tenant!.id}:${user.user_id}`;

    const validProfile = {
      name: body.name || user.name,
      email: body.email || user.email,
      phone: body.phone || '',
      timezone: body.timezone || 'America/New_York',
      language: body.language || 'en',
    };

    userProfiles.set(profileKey, validProfile);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Profile updated successfully',
        profile: validProfile,
      },
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UPDATE_PROFILE_ERROR',
          message: 'Failed to update profile',
        },
      },
      { status: 500 }
    );
  }
}
