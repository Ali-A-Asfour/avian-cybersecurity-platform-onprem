import { NextRequest, NextResponse } from 'next/server';
import { QueueManagementService } from '@/services/help-desk/QueueManagementService';
import { UserRole } from '@/types';

export async function GET(request: NextRequest) {
    try {
        // In a real application, you would extract these from authentication
        // For now, we'll use mock values that work with the mock database
        const mockTenantId = 'dev-tenant-123';
        const mockUserId = 'demo-user';
        const mockUserRole = UserRole.IT_HELPDESK_ANALYST;

        // Get queue metrics
        const metrics = await QueueManagementService.getQueueMetrics(
            mockTenantId,
            mockUserId,
            mockUserRole
        );

        return NextResponse.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        console.error('Error fetching queue metrics:', error);

        // Return empty metrics instead of failing
        const emptyMetrics = {
            total_tickets: 0,
            unassigned_tickets: 0,
            assigned_tickets: 0,
            overdue_tickets: 0,
            by_severity: {
                low: 0,
                medium: 0,
                high: 0,
                critical: 0
            },
            by_status: {
                new: 0,
                in_progress: 0,
                awaiting_response: 0,
                resolved: 0,
                closed: 0
            },
            average_queue_time: 0
        };

        return NextResponse.json({
            success: true,
            data: emptyMetrics
        });
    }
}