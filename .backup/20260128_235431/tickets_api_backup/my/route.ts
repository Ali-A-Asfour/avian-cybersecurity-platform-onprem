import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/services/ticket.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { TicketFilters, ApiResponse, UserRole } from '@/types';

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

    // Verify user has analyst role or higher
    const userRole = authResult.user!.role;
    if (userRole !== UserRole.SECURITY_ANALYST &&
      userRole !== UserRole.IT_HELPDESK_ANALYST &&
      userRole !== UserRole.TENANT_ADMIN &&
      userRole !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only analysts and admins can access personal ticket queues',
        },
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const filters: TicketFilters = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
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

    // Parse other filters
    if (searchParams.get('requester')) {
      filters.requester = searchParams.get('requester')!;
    }
    if (searchParams.get('created_after')) {
      filters.created_after = new Date(searchParams.get('created_after')!);
    }
    if (searchParams.get('created_before')) {
      filters.created_before = new Date(searchParams.get('created_before')!);
    }

    // Get tickets assigned to the current user
    const result = await TicketService.getMyTickets(
      tenantResult.tenant!.id,
      authResult.user!.user_id,
      userRole,
      filters
    );

    const response: ApiResponse = {
      success: true,
      data: {
        tickets: result.tickets,
        total: result.total,
      },
      meta: {
        page: filters.page,
        limit: filters.limit,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching my tickets:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch personal tickets',
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}