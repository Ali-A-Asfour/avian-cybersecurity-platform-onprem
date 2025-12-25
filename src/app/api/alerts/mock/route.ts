import { NextRequest, NextResponse } from 'next/server';
import { AlertService } from '@/services/alert.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

export async function POST(request: NextRequest) {
  try {
    // Apply authentication and tenant middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json(authResult, { status: 401 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      return NextResponse.json(tenantResult, { status: 403 });
    }

    // Only allow Super Admin or Tenant Admin to generate mock data
    if (!['super_admin', 'tenant_admin'].includes(authResult.user!.role)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Only administrators can generate mock alerts',
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const count = Math.min(body.count || 50, 200); // Limit to 200 alerts max

    const _result = await AlertService.generateMockAlerts(tenantResult.tenant!.id, count);
    
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch {
    console.error('Error in POST /api/alerts/mock:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      },
      { status: 500 }
    );
  }
}