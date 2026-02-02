import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { UserRole } from '@/types';
import { ticketStore } from '@/lib/ticket-store';

/**
 * POST /api/tickets/[id]/assign
 * Assign a ticket to a user
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
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
        const ticketId = params.id;

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
        const { assignee } = body;

        if (!assignee) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Assignee is required'
                }
            }, { status: 400 });
        }

        console.log(`🎫 Assigning ticket ${ticketId} to user ${assignee}`);

        // Get the ticket first to verify it exists
        const ticket = ticketStore.getTicket(ticketId);
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
        const updatedTicket = ticketStore.assignTicket(ticketId, assignee);
        
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