import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '../../../../../services/user.service';


export async function POST(request: NextRequest) {
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

    // Disable MFA for user
    await UserService.disableMFA(user.user_id);

    return NextResponse.json({
      success: true,
      data: { message: 'MFA disabled successfully' },
    });
  } catch {
    console.error('MFA disable error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'MFA_DISABLE_FAILED',
          message: error instanceof Error ? error.message : 'MFA disable failed',
        },
      },
      { status: 500 }
    );
  }
}