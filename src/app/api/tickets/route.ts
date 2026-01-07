import { NextRequest, NextResponse } from 'next/server';
import { TicketService, CreateTicketRequest } from '@/services/ticket.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { TicketFilters, ApiResponse } from '@/types';
import { ErrorHandler, ApiErrors } from '@/lib/api-errors';
import { HelpDeskValidator, HelpDeskErrors } from '@/lib/help-desk/error-handling';

export async function GET(request: NextRequest) {
  try {
    // Apply middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication failed' } }, { status: 401 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: tenantResult.error?.message || "Access denied" } }, { status: 403 });
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

    // Apply role-based filtering
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
    const url = new URL(request.url);
    return ErrorHandler.handleError(error, url.pathname);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Apply middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      throw ApiErrors.unauthorized(authResult.error || 'Authentication failed');
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      throw ApiErrors.forbidden(tenantResult.error?.message || 'Access denied');
    }

    // Validate role-based access for ticket creation
    const { RoleBasedAccessService } = await import('@/services/help-desk/RoleBasedAccessService');
    const accessValidation = RoleBasedAccessService.validateHelpDeskAccess('create_ticket', {
      userId: authResult.user!.user_id,
      userRole: authResult.user!.role,
      tenantId: tenantResult.tenant!.id,
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

    const body = await request.json();

    // Validate input using help desk validator
    const validation = HelpDeskValidator.validateTicketCreation(body);
    if (!validation.valid) {
      throw ApiErrors.validation('Invalid ticket data', { errors: validation.errors });
    }

    const validatedData = validation.data!;

    // Map impact level to ticket category for help desk system
    // Help desk uses simplified categories based on impact level
    const category = 'it_support'; // Default to IT support for help desk tickets

    // Validate category access for the user creating the ticket
    const categoryValidation = RoleBasedAccessService.validateHelpDeskAccess('create_ticket', {
      userId: authResult.user!.user_id,
      userRole: authResult.user!.role,
      tenantId: tenantResult.tenant!.id,
      ticketCategory: category as any,
    });

    if (!categoryValidation.allowed) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: categoryValidation.reason || 'Cannot create ticket in this category',
          requiredRole: categoryValidation.requiredRole
        }
      }, { status: 403 });
    }

    // Create ticket with validated data
    // Note: requester should be the user's email, not user_id
    // We'll use user_id as a fallback if email is not available
    // Map severity to priority: critical -> urgent, others stay the same
    const priorityMap: Record<string, string> = {
      'critical': 'urgent',
      'high': 'high',
      'medium': 'medium',
      'low': 'low',
    };
    
    const ticketData: CreateTicketRequest = {
      title: validatedData.title,
      description: validatedData.description,
      category: category,
      severity: validatedData.impactLevel,
      priority: priorityMap[validatedData.impactLevel] || validatedData.impactLevel,
      phoneNumber: validatedData.phoneNumber,
      requester: (authResult.user as any).email || authResult.user!.user_id,
    };

    const ticket = await TicketService.createTicket(
      tenantResult.tenant!.id,
      authResult.user!.user_id,
      ticketData
    );

    // Send notification email to user
    try {
      const { NotificationService } = await import('@/lib/help-desk/notification-service');
      await NotificationService.sendTicketCreatedNotification(ticket, authResult.user!);
    } catch (notificationError) {
      // Log notification error but don't fail ticket creation
      console.warn('Failed to send ticket creation notification:', notificationError);
    }

    return ErrorHandler.success(ticket, undefined, 201);
  } catch (error) {
    const url = new URL(request.url);
    return ErrorHandler.handleError(error, url.pathname);
  }
}