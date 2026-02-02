import { NextRequest, NextResponse } from 'next/server';
import { QueueManagementService } from '@/services/help-desk/QueueManagementService';
import { validateAuth } from '@/lib/auth-utils';
import { ErrorHandler, ApiErrors } from '@/lib/api-errors';
import { UserRole } from '@/types';

/**
 * GET /api/help-desk/queue/tenant-admin
 * Get tenant admin view showing all tenant tickets
 */
export async function GET(request: NextRequest) {
    try {
        // Validate authentication and get user context
        const authResult = await validateAuth(request);
        if (!authResult) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const { user, tenant } = authResult;

        // Validate user role - only tenant admins can access this view
        const { RoleBasedAccessService } = await import('@/services/help-desk/RoleBasedAccessService');
        const accessValidation = RoleBasedAccessService.validateTenantAdminOperation('view_all_tickets', {
            userId: user.id,
            userRole: user.role,
            tenantId: tenant.id,
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
        const assignee = searchParams.get('assignee');
        const requester = searchParams.get('requester');
        const createdAfter = searchParams.get('created_after');
        const createdBefore = searchParams.get('created_before');

        // Build filters
        const filters = {
            page,
            limit,
            ...(status.length > 0 && { status }),
            ...(severity.length > 0 && { severity }),
            ...(priority.length > 0 && { priority }),
            ...(category.length > 0 && { category }),
            ...(assignee && { assignee }),
            ...(requester && { requester }),
            ...(createdAfter && { created_after: new Date(createdAfter) }),
            ...(createdBefore && { created_before: new Date(createdBefore) }),
        };

        // Get tenant admin queue
        const result = await QueueManagementService.getTenantAdminQueue(
            tenant.id,
            user.role,
            user.id,
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
        console.error('Error fetching tenant admin queue:', error);
        return ErrorHandler.handleError(error);
    }
}