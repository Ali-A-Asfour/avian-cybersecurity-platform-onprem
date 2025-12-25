import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthenticationService } from '../../../../services/auth.service';
import { rateLimit } from '../../../../middleware/auth.middleware';

// Request validation schema
const refreshSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(20, 3600)(request); // 20 attempts per hour
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = refreshSchema.parse(body);

    // Refresh token
    const _result = await AuthenticationService.refreshToken(validatedData);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Token refresh error:', error);

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
          code: 'REFRESH_FAILED',
          message: error instanceof Error ? error.message : 'Token refresh failed',
        },
      },
      { status: 401 }
    );
  }
}