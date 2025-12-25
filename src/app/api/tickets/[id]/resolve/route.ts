/**
 * Ticket Resolution API Route
 * 
 * Handles ticket resolution with validation, knowledge base creation,
 * and notification handling with comprehensive error recovery.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { TicketService } from '@/services/ticket.service';
import { ErrorHandler, ApiErrors } from '@/lib/api-errors';
import { HelpDeskValidator, HelpDeskErrors, HelpDeskBusinessRules } from '@/lib/help-desk/error-handling';
import { NotificationService } from '@/lib/help-desk/notification-service';
import { TicketStatus } from '@/types';

interface RouteParams {
    params: Promise<{
        id: string;
    }>;
}

/**
 * Resolve a ticket
 * POST /api/tickets/[id]/resolve
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

        // Get current ticket
        const currentTicket = await TicketService.getTicketById(tenantResult.tenant!.id, ticketId);
        if (!currentTicket) {
            throw HelpDeskErrors.ticketNotFound(ticketId);
        }

        // Validate role-based access for ticket resolution
        const { RoleBasedAccessService } = await import('@/services/help-desk/RoleBasedAccessService');
        const accessValidation = RoleBasedAccessService.validateHelpDeskAccess('resolve_ticket', {
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

        // Parse and validate request body
        const body = await request.json();
        const validation = HelpDeskValidator.validateTicketResolution(body);

        if (!validation.valid) {
            throw ApiErrors.validation('Invalid resolution data', { errors: validation.errors });
        }

        const validatedData = validation.data!;

        // Validate state transition
        const stateValidation = HelpDeskBusinessRules.validateStateTransition(
            currentTicket.status,
            TicketStatus.RESOLVED,
            authResult.user!.role,
            true // has resolution
        );

        if (!stateValidation.valid) {
            throw HelpDeskErrors.invalidStateTransition(
                currentTicket.status,
                TicketStatus.RESOLVED
            );
        }

        // Check if user can resolve this ticket (must be assigned to them or they must be admin)
        if (currentTicket.assignee !== authResult.user!.user_id &&
            !['tenant_admin', 'super_admin'].includes(authResult.user!.role)) {
            throw ApiErrors.forbidden('You can only resolve tickets assigned to you');
        }

        // Update ticket status to resolved using mock database directly
        const { mockDb } = await import('@/lib/mock-database');
        const updatedTicket = await mockDb.updateTicket(
            tenantResult.tenant!.id,
            ticketId,
            {
                status: TicketStatus.RESOLVED,
                updated_at: new Date(),
            }
        );

        if (!updatedTicket) {
            throw new Error('Failed to update ticket status');
        }

        // Add resolution comment using mock database
        await mockDb.addComment(
            tenantResult.tenant!.id,
            ticketId,
            authResult.user!.user_id,
            {
                content: `**Resolution:** ${validatedData.resolution}`,
                is_internal: false,
            }
        );

        // Create knowledge base article if requested
        let knowledgeArticle = null;
        if (validatedData.createKnowledgeArticle) {
            try {
                const { KnowledgeBaseService } = await import('@/services/help-desk/KnowledgeBaseService');

                // Use the ticket title as the KB article title if not provided
                const articleTitle = validatedData.knowledgeArticleTitle || currentTicket.title;

                knowledgeArticle = await KnowledgeBaseService.createArticleFromTicketResolution(
                    tenantResult.tenant!.id,
                    ticketId,
                    authResult.user!.user_id,
                    articleTitle,
                    currentTicket.description,
                    validatedData.resolution
                );

                console.log(`Knowledge base article created: ${knowledgeArticle.id}`);
            } catch (kbError) {
                // Don't fail the resolution if KB creation fails
                console.error('Failed to create knowledge base article:', kbError);
                // Log the error but continue with successful resolution
            }
        }

        // Send resolution notification (don't fail if notification fails)
        try {
            await NotificationService.sendTicketResolvedNotification({
                ticketId: updatedTicket.id,
                ticketTitle: updatedTicket.title,
                ticketStatus: updatedTicket.status,
                assignee: authResult.user!.user_id,
                requester: updatedTicket.requester,
                requesterEmail: updatedTicket.requester, // TODO: Get actual email
                tenantName: tenantResult.tenant!.id || 'Help Desk',
                resolution: validatedData.resolution,
                deviceId: updatedTicket.device_name || undefined,
            });
        } catch (notificationError) {
            console.warn('Failed to send resolution notification:', notificationError);
            // Continue with success response even if notification fails
        }

        const response = {
            ticket: updatedTicket,
            resolution: validatedData.resolution,
            knowledgeArticle,
            message: 'Ticket resolved successfully',
        };

        return ErrorHandler.success(response);

    } catch (error) {
        const url = new URL(request.url);
        return ErrorHandler.handleError(error, url.pathname);
    }
}

/**
 * Reopen a resolved ticket
 * POST /api/tickets/[id]/reopen
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

        // Get current ticket
        const currentTicket = await TicketService.getTicketById(tenantResult.tenant!.id, ticketId);
        if (!currentTicket) {
            throw HelpDeskErrors.ticketNotFound(ticketId);
        }

        // Only allow reopening resolved tickets
        if (currentTicket.status !== TicketStatus.RESOLVED) {
            throw HelpDeskErrors.invalidStateTransition(
                currentTicket.status,
                TicketStatus.IN_PROGRESS
            );
        }

        // Parse request body for optional reason
        const body = await request.json().catch(() => ({}));
        const reason = body.reason || 'Ticket reopened by user';

        // Validate reason if provided
        if (reason && typeof reason !== 'string') {
            throw ApiErrors.validation('Reason must be a string');
        }

        if (reason && reason.length > 500) {
            throw ApiErrors.validation('Reason must be less than 500 characters');
        }

        // Determine new status based on whether ticket was previously assigned
        const newStatus = currentTicket.assignee && currentTicket.assignee !== 'Unassigned'
            ? TicketStatus.IN_PROGRESS
            : TicketStatus.NEW;

        // Update ticket status
        const updatedTicket = await TicketService.updateTicket(
            tenantResult.tenant!.id,
            ticketId,
            {
                status: newStatus,
            },
            authResult.user!.user_id,
            authResult.user!.role
        );

        if (!updatedTicket) {
            throw new Error('Failed to reopen ticket');
        }

        // Add reopening comment
        await TicketService.addComment(
            tenantResult.tenant!.id,
            ticketId,
            authResult.user!.user_id,
            {
                content: `**Ticket Reopened:** ${reason}`,
                is_internal: false,
            }
        );

        // Send notification to assignee if ticket was assigned
        if (currentTicket.assignee && currentTicket.assignee !== 'Unassigned') {
            try {
                await NotificationService.sendTicketAssignedNotification({
                    ticketId: updatedTicket.id,
                    ticketTitle: updatedTicket.title,
                    ticketStatus: updatedTicket.status,
                    assignee: currentTicket.assignee,
                    requester: updatedTicket.requester,
                    requesterEmail: updatedTicket.requester, // TODO: Get actual email
                    tenantName: tenantResult.tenant!.id || 'Help Desk',
                    deviceId: updatedTicket.device_name || undefined,
                });
            } catch (notificationError) {
                console.warn('Failed to send reopening notification:', notificationError);
            }
        }

        return ErrorHandler.success({
            ticket: updatedTicket,
            message: 'Ticket reopened successfully',
        });

    } catch (error) {
        const url = new URL(request.url);
        return ErrorHandler.handleError(error, url.pathname);
    }
}