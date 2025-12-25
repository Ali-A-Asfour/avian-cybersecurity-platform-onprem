import { NextRequest, NextResponse } from 'next/server';
import { QueueManagementService } from '@/services/help-desk/QueueManagementService';
import { authMiddleware } from '@/middleware/auth.middleware';
import { UserRole } from '@/types';

/**
 * GET /api/help-desk/queue/unassigned
 * Get unassigned tickets queue for help desk analysts
 */
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

        const user = authResult.user!;

        // Validate user role - only analysts and admins can access unassigned queue
        const { RoleBasedAccessService } = await import('@/services/help-desk/RoleBasedAccessService');
        const accessValidation = RoleBasedAccessService.validateHelpDeskAccess('view_queue', {
            userId: user.user_id,
            userRole: user.role,
            tenantId: user.tenant_id,
        });

        if (!accessValidation.allowed) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: accessValidation.reason || 'Access denied',
                    requiredRole: accessValidation.requiredRole
                }
            }, { status: 403 });
        }

        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const status = searchParams.getAll('status');
        const severity = searchParams.getAll('severity');
        const priority = searchParams.getAll('priority');
        const category = searchParams.getAll('category');
        const createdAfter = searchParams.get('created_after');
        const createdBefore = searchParams.get('created_before');

        // Build filters
        const filters = {
            page,
            limit,
            ...(status.length > 0 && { status: status as any }),
            ...(severity.length > 0 && { severity: severity as any }),
            ...(priority.length > 0 && { priority: priority as any }),
            ...(category.length > 0 && { category: category as any }),
            ...(createdAfter && { created_after: new Date(createdAfter) }),
            ...(createdBefore && { created_before: new Date(createdBefore) }),
        };

        // Get unassigned queue
        const result = await QueueManagementService.getUnassignedQueue(
            user.tenant_id,
            user.role,
            user.user_id,
            filters
        );

        return NextResponse.json({
            success: true,
            data: {
                tickets: result.tickets,
                pagination: {
                    page,
                    limit,
                    total: result.total,
                    pages: Math.ceil(result.total / limit),
                },
            },
        });
    } catch (error) {
        console.error('Error fetching unassigned queue:', error);
        return NextResponse.json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch unassigned queue',
            },
        }, { status: 500 });
    }
}