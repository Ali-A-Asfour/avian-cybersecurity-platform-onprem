import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/services/notification.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

export async function GET(request: NextRequest) {
  try {
    // Apply authentication and tenant middleware
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (tenantResult instanceof NextResponse) {
      return tenantResult;
    }

    const { tenant } = tenantResult;
    const user = authResult.user!;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const unreadOnly = searchParams.get('unread_only') === 'true';

    // Get user notifications
    const notifications = await NotificationService.getUserNotifications(
      tenant!.id,
      user.user_id,
      limit
    );

    // Filter for unread only if requested
    const filteredNotifications = unreadOnly
      ? notifications.filter(n => !n.is_read)
      : notifications;

    return NextResponse.json({
      success: true,
      data: filteredNotifications,
      meta: {
        total: filteredNotifications.length,
        limit,
        unread_only: unreadOnly,
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_NOTIFICATIONS_ERROR',
          message: 'Failed to fetch notifications',
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Apply authentication and tenant middleware
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (tenantResult instanceof NextResponse) {
      return tenantResult;
    }

    const { tenant } = tenantResult;
    const user = authResult.user!;
    const body = await request.json();

    // Create notification
    const notification = await NotificationService.createNotification(tenant!.id, {
      user_id: body.user_id || user.user_id,
      title: body.title,
      message: body.message,
      type: body.type || 'info',
      metadata: body.metadata,
    });

    return NextResponse.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CREATE_NOTIFICATION_ERROR',
          message: 'Failed to create notification',
        },
      },
      { status: 500 }
    );
  }
}