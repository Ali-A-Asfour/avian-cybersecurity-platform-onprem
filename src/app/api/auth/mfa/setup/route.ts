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

    // Setup MFA for user
    const _result = await UserService.setupMFA(user.user_id);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch {
    console.error('MFA setup error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'MFA_SETUP_FAILED',
          message: error instanceof Error ? error.message : 'MFA setup failed',
        },
      },
      { status: 500 }
    );
  }
}