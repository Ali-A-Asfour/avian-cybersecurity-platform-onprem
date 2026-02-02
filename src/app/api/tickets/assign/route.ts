import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { UserRole } from '@/types';
import { TicketService } from '@/services/ticket.service';

/**
 * POST /api/tickets/assign
 * Assign a ticket to a user (simplified endpoint)
 */
export async function POST(request: NextRequest) {
    try {
        // Apply authentication middleware
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

        // Validate user role - only analysts and admins can assign tickets
        const allowedRoles = [UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST, UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN];
        if (!allowedRoles.includes(user.role)) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Access denied - insufficient permissions to assign tickets'
                }
            }, { status: 403 });
        }

        // Parse request body
        const body = await request.json();
        const { ticketId, assignee } = body;

        if (!ticketId || !assignee) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'ticketId and assignee are required'
                }
            }, { status: 400 });
        }

        console.log(`🎫 Assigning ticket ${ticketId} to user ${assignee}`);

        // Get the ticket first to verify it exists
        const ticket = await TicketService.getTicket(ticketId);
        if (!ticket) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Ticket not found'
                }
            }, { status: 404 });
        }

        // For cross-tenant users, check if they can access this ticket's tenant
        if ([UserRole.SECURITY_ANALYST, UserRole.IT_HELPDESK_ANALYST].includes(user.role)) {
            const selectedTenantId = request.headers.get('x-selected-tenant-id');
            if (selectedTenantId && ticket.tenant_id !== selectedTenantId) {
                return NextResponse.json({
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Cannot assign ticket from different tenant'
                    }
                }, { status: 403 });
            }
        } else if (user.role !== UserRole.SUPER_ADMIN && ticket.tenant_id !== user.tenant_id) {
            // Regular users can only assign tickets from their own tenant
            return NextResponse.json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Cannot assign ticket from different tenant'
                }
            }, { status: 403 });
        }

        // Assign the ticket
        const updatedTicket = await TicketService.assignTicket(ticketId, assignee);
        
        if (!updatedTicket) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to assign ticket'
                }
            }, { status: 500 });
        }

        console.log(`✅ Ticket ${ticketId} successfully assigned to ${assignee}`);

        return NextResponse.json({
            success: true,
            data: {
                ticket: updatedTicket,
                message: 'Ticket assigned successfully'
            }
        });

    } catch (error) {
        console.error('Error assigning ticket:', error);
        return NextResponse.json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to assign ticket'
            }
        }, { status: 500 });
    }
}