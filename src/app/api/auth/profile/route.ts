import { NextRequest, NextResponse } from 'next/server';
import { AuthenticationService } from '../../../../services/auth.service';


export async function GET(request: NextRequest) {
  try {
    // Apply authentication middleware
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

    const _user = authResult.user;

    // Get current user profile
    const profile = await AuthenticationService.getCurrentUser(user.user_id);

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User profile not found',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('Get profile error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROFILE_FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch profile',
        },
      },
      { status: 500 }
    );
  }
}