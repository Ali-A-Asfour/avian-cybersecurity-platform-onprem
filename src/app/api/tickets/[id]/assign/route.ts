import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/services/ticket.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { ApiResponse } from '@/types';
import { ErrorHandler, ApiErrors } from '@/lib/api-errors';
import { HelpDeskErrors, HelpDeskBusinessRules } from '@/lib/help-desk/error-handling';

interface RouteParams {
    params: Promise<{
        id: string;
    }>;
}

/**
 * Self-assign a ticket to the current user
 * POST /api/tickets/[id]/assign
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    const { id: ticketId } = await params;

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

        // Get current ticket to validate it exists
        const currentTicket = await TicketService.getTicketById(tenantResult.tenant!.id, ticketId);
        if (!currentTicket) {
            throw HelpDeskErrors.ticketNotFound(ticketId);
        }

        // Validate role-based access for ticket assignment
        const { RoleBasedAccessService } = await import('@/services/help-desk/RoleBasedAccessService');
        const accessValidation = RoleBasedAccessService.validateHelpDeskAccess('assign_ticket', {
            userId: authResult.user!.user_id,
            userRole: authResult.user!.role,
            tenantId: tenantResult.tenant!.id,
            ticketCategory: currentTicket.category,
            ticketAssignee: currentTicket.assignee,
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

        // Validate ticket assignment using business rules
        const assignmentValidation = HelpDeskBusinessRules.validateTicketAssignment(
            currentTicket,
            authResult.user!.user_id,
            authResult.user!.role
        );

        if (!assignmentValidation.valid) {
            if (assignmentValidation.error?.includes('already assigned')) {
                throw HelpDeskErrors.ticketAlreadyAssigned(currentTicket.assignee || 'unknown');
            } else {
                throw HelpDeskErrors.queueAccessDenied(
                    authResult.user!.role,
                    currentTicket.category
                );
            }
        }

        // Self-assign the ticket
        const updatedTicket = await TicketService.selfAssignTicket(
            tenantResult.tenant!.id,
            ticketId,
            authResult.user!.user_id,
            authResult.user!.role
        );

        if (!updatedTicket) {
            throw new Error('Failed to assign ticket');
        }

        return ErrorHandler.success(updatedTicket, {
            message: 'Ticket successfully assigned to you'
        });
    } catch (error) {
        const url = new URL(request.url);
        return ErrorHandler.handleError(error, url.pathname);
    }
}