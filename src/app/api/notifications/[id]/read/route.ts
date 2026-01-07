import { NextRequest, NextResponse } from 'next/server';
import { NotificationService } from '@/services/notification.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
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
        const notificationId = params.id;

        // Mark notification as read
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
            message: 'Notification marked as read',
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'MARK_READ_ERROR',
                    message: 'Failed to mark notification as read',
                },
            },
            { status: 500 }
        );
    }
}