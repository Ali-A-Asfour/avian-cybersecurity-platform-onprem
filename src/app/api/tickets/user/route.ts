import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/services/ticket.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { TicketFilters, ApiResponse } from '@/types';

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
            limit: parseInt(searchParams.get('limit') || '20'),
            sort_by: searchParams.get('sort_by') || 'created_at',
            sort_order: (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc',
            // Don't add requester filter here - let the service handle user filtering
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

        // Parse date filters
        if (searchParams.get('created_after')) {
            filters.created_after = new Date(searchParams.get('created_after')!);
        }
        if (searchParams.get('created_before')) {
            filters.created_before = new Date(searchParams.get('created_before')!);
        }

        // Get tickets created by the current user
        const result = await TicketService.getTickets(
            tenantResult.tenant!.id,
            filters,
            authResult.user!.role,
            authResult.user!.user_id
        );

        const response: ApiResponse = {
            success: true,
            data: result.tickets,
            meta: {
                total: result.total,
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