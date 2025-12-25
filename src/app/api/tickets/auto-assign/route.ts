import { NextRequest, NextResponse } from 'next/server';
import { WorkflowService } from '@/services/workflow.service';
import { TicketService } from '@/services/ticket.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { ApiResponse, TicketSeverity } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // Apply middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: authResult.error || "Authentication failed" } }, { status: 401 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: tenantResult.error?.message || "Access denied" } }, { status: 403 });
    }

    const body = await request.json();
    const { ticket_id, severity } = body;

    // Validate required fields
    if (!ticket_id || !severity) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Ticket ID and severity are required',
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Verify ticket exists
    const ticket = await TicketService.getTicketById(tenantResult.tenant!.id, ticket_id);
    if (!ticket) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Ticket not found',
        },
      };
      return NextResponse.json(response, { status: 404 });
    }

    const assignedTo = await WorkflowService.assignTicketWithWorkloadBalancing(
      tenantResult.tenant!.id,
      ticket_id,
      severity as TicketSeverity
    );

    const response: ApiResponse = {
      success: true,
      data: { 
        assigned: !!assignedTo,
        assignee: assignedTo 
      },
    };

    return NextResponse.json(response);
  } catch {
    console.error('Error auto-assigning ticket:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to auto-assign ticket',
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}