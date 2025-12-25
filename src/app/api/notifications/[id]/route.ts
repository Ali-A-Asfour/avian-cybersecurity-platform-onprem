import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/services/notification.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply authentication and tenant middleware
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    const { id: notificationId } = await params;

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (tenantResult instanceof NextResponse) {
      return tenantResult;
    }

    const { tenant } = tenantResult;
    const _user = authResult.user!;
    const body = await request.json();

    if (body.action === 'mark_read') {
      const success = await NotificationService.markAsRead(
        tenant!.id,
        notificationId,
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
        data: { id: notificationId, is_read: true },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_ACTION',
          message: 'Invalid action specified',
        },
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UPDATE_NOTIFICATION_ERROR',
          message: 'Failed to update notification',
        },
      },
      { status: 500 }
    );
  }
}