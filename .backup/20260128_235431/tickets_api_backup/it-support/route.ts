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

    // Verify user has IT Helpdesk Analyst role or higher
    const userRole = authResult.user!.role;
    if (userRole !== UserRole.IT_HELPDESK_ANALYST && 
        userRole !== UserRole.TENANT_ADMIN && 
        userRole !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only IT Helpdesk Analysts can access IT support tickets',
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

    // Parse other filters
    if (searchParams.get('assignee')) {
      filters.assignee = searchParams.get('assignee')!;
    }
    if (searchParams.get('requester')) {
      filters.requester = searchParams.get('requester')!;
    }
    if (searchParams.get('created_after')) {
      filters.created_after = new Date(searchParams.get('created_after')!);
    }
    if (searchParams.get('created_before')) {
      filters.created_before = new Date(searchParams.get('created_before')!);
    }

    // Get IT support tickets only
    const _result = await TicketService.getITSupportTickets(
      tenantResult.tenant!.id, 
      filters,
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
    console.error('Error fetching IT support tickets:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch IT support tickets',
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}