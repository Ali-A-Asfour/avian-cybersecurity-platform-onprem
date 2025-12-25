import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthenticationService } from '../../../../../services/auth.service';
import { rateLimit } from '../../../../../middleware/auth.middleware';

// Request validation schema
const verifyMFASchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  code: z.string().length(6, 'MFA code must be 6 digits'),
});

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(10, 900)(request); // 10 attempts per 15 minutes
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = verifyMFASchema.parse(body);

    // Verify MFA code
    const _result = await AuthenticationService.verifyMFA(validatedData);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch {
    console.error('MFA verification error:', error);

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
          code: 'MFA_VERIFICATION_FAILED',
          message: error instanceof Error ? error.message : 'MFA verification failed',
        },
      },
      { status: 401 }
    );
  }
}