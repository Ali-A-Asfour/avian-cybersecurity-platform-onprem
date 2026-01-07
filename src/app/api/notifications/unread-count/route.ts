import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/services/notification.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

export async function GET(request: NextRequest) {
  try {
    // Apply authentication and tenant middleware
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

    // Check if tenant exists
    if (!tenant) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TENANT_NOT_FOUND',
            message: 'Tenant not found',
          },
        },
        { status: 404 }
      );
    }

    // Get unread notification count
    const unreadCount = await NotificationService.getUnreadCount(tenant.id, user.user_id);

    return NextResponse.json({
      success: true,
      data: {
        unread_count: unreadCount,
      },
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_UNREAD_COUNT_ERROR',
          message: 'Failed to fetch unread notification count',
        },
      },
      { status: 500 }
    );
  }
}