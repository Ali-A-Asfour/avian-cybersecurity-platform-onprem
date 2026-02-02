import { NextRequest, NextResponse } from 'next/server';
import { TicketService, CreateCommentRequest } from '@/services/ticket.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { ApiResponse, TicketStatus, UserRole } from '@/types';
import { NotificationService } from '@/lib/help-desk/notification-service';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
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

    // Verify ticket exists
    const ticket = await TicketService.getTicketById(tenantResult.tenant!.id, id);
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

    const comments = await TicketService.getComments(tenantResult.tenant!.id, id);

    const response: ApiResponse = {
      success: true,
      data: comments,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching ticket comments:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch ticket comments',
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
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

    // Verify ticket exists
    const ticket = await TicketService.getTicketById(tenantResult.tenant!.id, id);
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

    const body: CreateCommentRequest = await request.json();

    // Validate required fields
    if (!body.content) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Comment content is required',
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Add the comment
    const comment = await TicketService.addComment(
      tenantResult.tenant!.id,
      id,
      authResult.user!.user_id,
      body
    );

    // Implement automatic reopening for resolved tickets
    // Requirements 3.4: WHEN an end user or tenant admin replies to a resolved ticket, 
    // THE Help_Desk_System SHALL automatically reopen the ticket
    let updatedTicket = ticket;
    if (ticket.status === TicketStatus.RESOLVED) {
      // Check if the commenter is an end user or tenant admin (not a help desk analyst)
      const isEndUserOrTenantAdmin = authResult.user!.role === UserRole.USER ||
        authResult.user!.role === UserRole.TENANT_ADMIN ||
        authResult.user!.user_id === ticket.requester;

      if (isEndUserOrTenantAdmin) {
        try {
          // Determine new status based on whether ticket was previously assigned
          const newStatus = ticket.assignee && ticket.assignee !== 'Unassigned'
            ? TicketStatus.IN_PROGRESS
            : TicketStatus.NEW;

          // Reopen the ticket
          updatedTicket = await TicketService.updateTicket(
            tenantResult.tenant!.id,
            id,
            { status: newStatus },
            authResult.user!.user_id,
            authResult.user!.role
          );

          if (updatedTicket) {
            // Add system comment about reopening
            await TicketService.addComment(
              tenantResult.tenant!.id,
              id,
              'system',
              {
                content: `**Ticket Automatically Reopened:** User replied to resolved ticket`,
                is_internal: false,
              }
            );

            // Send notification to assignee if ticket was assigned
            if (ticket.assignee && ticket.assignee !== 'Unassigned') {
              try {
                await NotificationService.sendTicketAssignedNotification({
                  ticketId: updatedTicket.id,
                  ticketTitle: updatedTicket.title,
                  ticketStatus: updatedTicket.status,
                  assignee: ticket.assignee,
                  requester: updatedTicket.requester,
                  requesterEmail: updatedTicket.requester, // TODO: Get actual email
                  tenantName: tenantResult.tenant!.name || 'Help Desk',
                  deviceId: updatedTicket.device_id,
                });
              } catch (notificationError) {
                console.warn('Failed to send reopening notification:', notificationError);
              }
            }

            console.log(`Ticket ${id} automatically reopened due to user reply`);
          }
        } catch (reopenError) {
          console.error('Failed to automatically reopen ticket:', reopenError);
          // Don't fail the comment creation if reopening fails
        }
      }
    }

    const response: ApiResponse = {
      success: true,
      data: {
        comment,
        ticket: updatedTicket, // Include updated ticket if it was reopened
        automaticallyReopened: ticket.status === TicketStatus.RESOLVED && updatedTicket?.status !== TicketStatus.RESOLVED
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating ticket comment:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create ticket comment',
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}