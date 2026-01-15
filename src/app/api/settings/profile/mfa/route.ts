import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

// Mock MFA settings storage
const mfaSettings = new Map<string, boolean>();

export async function POST(request: NextRequest) {
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
    const mfaKey = `${tenant!.id}:${user.user_id}`;

    mfaSettings.set(mfaKey, body.enabled);

    return NextResponse.json({
      success: true,
      data: {
        message: `MFA ${body.enabled ? 'enabled' : 'disabled'} successfully`,
        enabled: body.enabled,
      },
    });
  } catch (error) {
    console.error('Error updating MFA settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'MFA_UPDATE_ERROR',
          message: 'Failed to update MFA settings',
        },
      },
      { status: 500 }
    );
  }
}
