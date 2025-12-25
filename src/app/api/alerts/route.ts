import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    // Apply middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: authResult.error || 'Authentication failed'
        }
      }, { status: 401 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: tenantResult.error?.message || "Access denied"
        }
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    // Use mock database in development
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      const { mockDb } = await import('@/lib/mock-database');

      const result = await mockDb.getAlerts(tenantResult.tenant!.id, {
        limit,
        page: 1,
        sort_by: 'created_at',
        sort_order: 'desc'
      });

      const response: ApiResponse = {
        success: true,
        data: {
          alerts: result.alerts,
          total: result.total,
        },
      };

      return NextResponse.json(response);
    }

    // For production, you would implement actual database queries here
    // For now, return empty data to prevent errors
    const response: ApiResponse = {
      success: true,
      data: {
        alerts: [],
        total: 0,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch alerts',
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}