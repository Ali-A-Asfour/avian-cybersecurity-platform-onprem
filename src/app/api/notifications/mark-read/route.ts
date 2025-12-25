import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/services/notification.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

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
    const _user = authResult.user!;
    const body = await request.json();

    if (body.notification_ids && Array.isArray(body.notification_ids)) {
      // Mark multiple notifications as read
      const results = await Promise.all(
        body.notification_ids.map((id: string) =>
          NotificationService.markAsRead(tenant!.id, id, user.user_id)
        )
      );

      return NextResponse.json({
        success: true,
        data: {
          marked_count: results.filter(Boolean).length,
          total_count: body.notification_ids.length,
        },
      });
    } else if (body.notification_id) {
      // Mark single notification as read
      const success = await NotificationService.markAsRead(
        tenant!.id,
        body.notification_id,
        user.user_id
      );

      if (!success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOTIFICATION_NOT_FOUND',
              message: 'Notification not found or access denied',
            },
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { id: body.notification_id, is_read: true },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'notification_id or notification_ids required',
        },
      },
      { status: 400 }
    );
  } catch {
    console.error('Error marking notifications as read:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'MARK_READ_ERROR',
          message: 'Failed to mark notifications as read',
        },
      },
      { status: 500 }
    );
  }
}