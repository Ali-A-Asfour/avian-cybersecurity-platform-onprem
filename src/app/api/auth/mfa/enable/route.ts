import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserService } from '../../../../../services/user.service';


// Request validation schema
const enableMFASchema = z.object({
  verification_code: z.string().length(6, 'Verification code must be 6 digits'),
});

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

    const user = authResult.user;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = enableMFASchema.parse(body);

    // Enable MFA for user
    await UserService.enableMFA(user.user_id, validatedData.verification_code);

    return NextResponse.json({
      success: true,
      data: { message: 'MFA enabled successfully' },
    });
  } catch (error) {
    console.error('MFA enable error:', error);

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
          code: 'MFA_ENABLE_FAILED',
          message: error instanceof Error ? error.message : 'MFA enable failed',
        },
      },
      { status: 500 }
    );
  }
}