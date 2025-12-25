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
        const user = authResult.user!;

        // Mark all notifications as read for the user
        const updatedCount = await NotificationService.markAllAsRead(
            tenant!.id,
            user.user_id
        );

        return NextResponse.json({
            success: true,
            data: {
                updated_count: updatedCount,
            },
            message: `${updatedCount} notifications marked as read`,
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'MARK_ALL_READ_ERROR',
                    message: 'Failed to mark all notifications as read',
                },
            },
            { status: 500 }
        );
    }
}