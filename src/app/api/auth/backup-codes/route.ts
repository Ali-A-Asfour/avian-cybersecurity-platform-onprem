import { NextRequest, NextResponse } from 'next/server';
import { AuthenticationService } from '../../../../services/auth.service';
import { enhancedAuthMiddleware } from '../../../../middleware/enhanced-auth.middleware';

/**
 * Generate new backup codes for MFA recovery
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user with enhanced security
    const authResult = await enhancedAuthMiddleware(request, {
      requireMFA: true,
      requireRecentAuth: true,
      recentAuthMinutes: 15, // Require recent authentication for security
    });

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

    if (authResult.requiresReauth) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'REAUTHENTICATION_REQUIRED',
            message: 'Recent authentication required for this action',
          },
        },
        { status: 401 }
      );
    }

    // Get client info
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    // Generate new backup codes
    const _result = await AuthenticationService.generateBackupCodes(
      authResult.user.user_id,
      ipAddress,
      userAgent
    );

    return NextResponse.json({
      success: true,
      data: result,
      message: 'New backup codes generated successfully. Please store them securely.',
    });

  } catch {
    console.error('Backup code generation error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BACKUP_CODE_GENERATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to generate backup codes',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Get remaining backup codes count
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await enhancedAuthMiddleware(request);

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

    // Get remaining backup codes count
    const remainingCount = await AuthenticationService.getRemainingBackupCodesCount(
      authResult.user.user_id
    );

    const needsNewCodes = await AuthenticationService.needsNewBackupCodes(
      authResult.user.user_id
    );

    return NextResponse.json({
      success: true,
      data: {
        remaining_codes: remainingCount,
        needs_new_codes: needsNewCodes,
        recommendation: needsNewCodes 
          ? 'You have few backup codes remaining. Consider generating new ones.'
          : 'You have sufficient backup codes.',
      },
    });

  } catch {
    console.error('Backup code status error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BACKUP_CODE_STATUS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get backup code status',
        },
      },
      { status: 500 }
    );
  }
}