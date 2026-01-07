import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserService } from '../../../../../services/user.service';


// Request validation schema
const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'New password must be at least 8 characters'),
});

// PUT /api/users/[id]/password - Change user password
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const user = authResult.user;

    // Validate user ID parameter
    const resolvedParams = await params;
    const userId = resolvedParams.id;
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_USER_ID',
            message: 'Invalid user ID',
          },
        },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = changePasswordSchema.parse(body);

    // Change password
    await UserService.changePassword(
      userId,
      validatedData,
      user.user_id,
      user.role,
      user.tenant_id
    );

    return NextResponse.json({
      success: true,
      data: { message: 'Password changed successfully' },
    });
  } catch (error) {
    console.error('Change password error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.issues,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CHANGE_PASSWORD_FAILED',
          message: error instanceof Error ? error.message : 'Failed to change password',
        },
      },
      { status: 500 }
    );
  }
}