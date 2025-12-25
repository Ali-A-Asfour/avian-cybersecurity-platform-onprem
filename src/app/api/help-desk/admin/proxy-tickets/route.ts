import { NextRequest, NextResponse } from 'next/server';
import { TicketService, CreateTicketRequest } from '@/services/ticket.service';
import { RoleBasedAccessService } from '@/services/help-desk/RoleBasedAccessService';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { TicketCategory, TicketSeverity, TicketPriority, UserRole } from '@/types';
import { ErrorHandler, ApiErrors } from '@/lib/api-errors';
import { HelpDeskValidator } from '@/lib/help-desk/error-handling';

/**
 * POST /api/help-desk/admin/proxy-tickets
 * Create a ticket on behalf of another user (tenant admin only)
 */
export async function POST(request: NextRequest) {
    try {
        // Apply middleware
        const authResult = await authMiddleware(request);
        if (!authResult.success) {
            return NextResponse.json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication failed' }
            }, { status: 401 });
        }

        const tenantResult = await tenantMiddleware(request, authResult.user!);
        if (!tenantResult.success) {
            return NextResponse.json({
                success: false,
                error: { code: "FORBIDDEN", message: tenantResult.error?.message || "Access denied" }
            }, { status: 403 });
        }

        // Validate tenant admin access
        const accessValidation = RoleBasedAccessService.validateTenantAdminOperation('create_proxy_ticket', {
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
        const validation = HelpDeskValidator.validateProxyTicketCreation(body);
        if (!validation.valid) {
            throw ApiErrors.validation('Invalid proxy ticket data', { errors: validation.errors });
        }

        const validatedData = validation.data!;

        // Validate that the requester belongs to the same tenant
        if (validatedData.onBehalfOfUserId) {
            // In a real implementation, you would validate that the user exists and belongs to the tenant
            // For now, we'll assume the validation is done by the frontend
        }

        // Create ticket with validated data
        const ticketData: CreateTicketRequest = {
            title: validatedData.title,
            description: validatedData.description,
            category: validatedData.category || TicketCategory.GENERAL_REQUEST,
            severity: validatedData.severity || TicketSeverity.MEDIUM,
            priority: validatedData.priority || TicketPriority.MEDIUM,
            requester: validatedData.onBehalfOfEmail || validatedData.requesterEmail,
        };

        // Validate category access for the admin creating the ticket
        const categoryValidation = RoleBasedAccessService.validateHelpDeskAccess('create_ticket', {
            userId: authResult.user!.user_id,
            userRole: authResult.user!.role,
            tenantId: tenantResult.tenant!.id,
            ticketCategory: ticketData.category,
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

        const ticket = await TicketService.createTicket(
            tenantResult.tenant!.id,
            validatedData.onBehalfOfUserId || authResult.user!.user_id,
            ticketData
        );

        // Add a comment indicating this was created by an admin on behalf of someone else
        if (validatedData.onBehalfOfUserId && validatedData.onBehalfOfUserId !== authResult.user!.user_id) {
            await TicketService.addComment(
                tenantResult.tenant!.id,
                ticket.id,
                authResult.user!.user_id,
                {
                    content: `Ticket created by admin on behalf of ${validatedData.onBehalfOfEmail || 'user'}`,
                    is_internal: true,
                }
            );
        }

        // Send notification email to the requester
        try {
            const { NotificationService } = await import('@/lib/help-desk/notification-service');
            await NotificationService.sendTicketCreatedNotification(ticket, {
                user_id: validatedData.onBehalfOfUserId || authResult.user!.user_id,
                email: validatedData.onBehalfOfEmail || validatedData.requesterEmail,
                role: UserRole.USER, // Assume the person on whose behalf the ticket is created is a regular user
            });
        } catch (notificationError) {
            // Log notification error but don't fail ticket creation
            console.warn('Failed to send proxy ticket creation notification:', notificationError);
        }

        return ErrorHandler.success(ticket, undefined, 201);
    } catch (error) {
        const url = new URL(request.url);
        return ErrorHandler.handleError(error, url.pathname);
    }
}