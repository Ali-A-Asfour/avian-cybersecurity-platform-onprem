import { NextRequest, NextResponse } from 'next/server';
import { AlertService } from '@/services/alert.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { AlertStatus } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: _id } = await params;
    const _result = await AlertService.getAlertById(tenantResult.tenant!.id, id);
    
    if (!result.success) {
      const status = result.error?.code === 'ALERT_NOT_FOUND' ? 404 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/alerts/[id]:', error);
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Status is required',
          },
        },
        { status: 400 }
      );
    }

    const { id: _id } = await params;
    const _result = await AlertService.updateAlertStatus(
      tenantResult.tenant!.id,
      id,
      status as AlertStatus
    );
    
    if (!result.success) {
      const statusCode = result.error?.code === 'ALERT_NOT_FOUND' ? 404 : 400;
      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in PUT /api/alerts/[id]:', error);
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