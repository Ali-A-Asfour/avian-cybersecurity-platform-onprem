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

    const body = await request.json();
    const { alerts } = body;

    if (!Array.isArray(alerts) || alerts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Alerts array is required and must not be empty',
          },
        },
        { status: 400 }
      );
    }

    // Validate each alert has required fields
    for (const alert of alerts) {
      const { source, title, description, severity, category } = alert;
      if (!source || !title || !description || !severity || !category) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Each alert must have: source, title, description, severity, category',
            },
          },
          { status: 400 }
        );
      }
    }

    const _result = await AlertService.bulkCreateAlerts(tenantResult.tenant!.id, alerts);
    
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/alerts/bulk:', error);
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