import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/services/ticket.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { TicketFilters, ApiResponse } from '@/types';

/**
 * GET /api/tickets/user-tickets
 * Returns tickets created by or assigned to the current user
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

        // Parse query parameters
        const filters: TicketFilters = {
            page: parseInt(searchParams.get('page') || '1'),
            limit: parseInt(searchParams.get('limit') || '100'),
            sort_by: searchParams.get('sort_by') || 'created_at',
            sort_order: (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc',
        };

        // Parse array filters
        if (searchParams.get('status')) {
            filters.status = searchParams.get('status')!.split(',') as any[];
        }
        if (searchParams.get('severity')) {
            filters.severity = searchParams.get('severity')!.split(',') as any[];
        }
        if (searchParams.get('priority')) {
            filters.priority = searchParams.get('priority')!.split(',') as any[];
        }
        if (searchParams.get('category')) {
            filters.category = searchParams.get('category')!.split(',') as any[];
        }

        // Get all tickets for the tenant with role-based filtering
        const result = await TicketService.getTickets(
            tenantResult.tenant!.id,
            filters,
            authResult.user!.role,
            authResult.user!.user_id
        );

        // Filter to only show tickets created by or assigned to the current user
        const userId = authResult.user!.user_id;
        const userTickets = result.tickets.filter(ticket =>
            ticket.created_by === userId || ticket.assignee === userId
        );

        const response: ApiResponse = {
            success: true,
            data: {
                tickets: userTickets,
                total: userTickets.length,
            },
            meta: {
                page: filters.page,
                limit: filters.limit,
            },
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching user tickets:', error);
        const response: ApiResponse = {
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch user tickets',
            },
        };
        return NextResponse.json(response, { status: 500 });
    }
}
