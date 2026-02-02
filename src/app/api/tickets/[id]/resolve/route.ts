/**
 * Ticket Resolution API Route
 * 
 * Handles ticket resolution using file-based ticket store
 */

import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { UserRole } from '@/types';
import { ticketStore } from '@/lib/ticket-store';
import { commentStore } from '@/lib/comment-store';

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
        console.log('🎫 Ticket resolve API called (file-based)');
        console.log('🔍 Resolving ticket ID:', ticketId);
        
        // Apply authentication middleware
        const authResult = await authMiddleware(request);
        if (!authResult.success) {
            console.log('❌ Auth failed:', authResult.error);
            return NextResponse.json({
                success: false,
                error: 'Authentication failed'
            }, { status: 401 });
        }

        const user = authResult.user!;
        console.log('✅ User authenticated:', user.email, user.role);

        // Validate user role - only analysts and admins can resolve tickets
        const allowedRoles = [UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST, UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN];
        if (!allowedRoles.includes(user.role)) {
            return NextResponse.json({
                success: false,
                error: 'Access denied - insufficient permissions to resolve tickets'
            }, { status: 403 });
        }

        // Get current ticket from file-based store
        console.log('📊 Looking up ticket in store...');
        const currentTicket = ticketStore.getTicket(ticketId);
        
        if (!currentTicket) {
            console.log('❌ Ticket not found:', ticketId);
            console.log('📊 Available ticket IDs:', ticketStore.getAllTickets().map(t => t.id));
            return NextResponse.json({
                success: false,
                error: 'Ticket not found'
            }, { status: 404 });
        }

        console.log('✅ Ticket found:', currentTicket.title);

        // Check tenant access for cross-tenant users
        if ([UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST].includes(user.role)) {
            const selectedTenantId = request.headers.get('x-selected-tenant-id');
            if (selectedTenantId && currentTicket.tenant_id !== selectedTenantId) {
                console.log('❌ Tenant access denied for resolve');
                return NextResponse.json({
                    success: false,
                    error: 'Cannot resolve ticket from different tenant'
                }, { status: 403 });
            }
        } else if (user.role !== UserRole.SUPER_ADMIN && currentTicket.tenant_id !== user.tenant_id) {
            console.log('❌ User tenant access denied for resolve');
            return NextResponse.json({
                success: false,
                error: 'Cannot resolve ticket from different tenant'
            }, { status: 403 });
        }

        // Check if user can resolve this ticket (must be assigned to them or they must be admin)
        if (currentTicket.assigned_to !== user.user_id &&
            ![UserRole.TENANT_ADMIN, UserRole.SUPER_ADMIN].includes(user.role)) {
            console.log('❌ User not assigned to ticket:', { assigned_to: currentTicket.assigned_to, user_id: user.user_id });
            return NextResponse.json({
                success: false,
                error: 'You can only resolve tickets assigned to you'
            }, { status: 403 });
        }

        // Parse request body for resolution details
        const body = await request.json();
        const { resolution, createKnowledgeArticle } = body;

        if (!resolution || typeof resolution !== 'string') {
            return NextResponse.json({
                success: false,
                error: 'Resolution description is required'
            }, { status: 400 });
        }

        console.log('📝 Resolution provided:', resolution.substring(0, 100) + '...');
        console.log('📚 Create knowledge article:', createKnowledgeArticle);

        // Update ticket status to resolved using file-based store
        console.log('📝 Resolving ticket...');
        const updatedTicket = ticketStore.updateTicket(ticketId, {
            status: 'resolved',
            updated_at: new Date().toISOString()
        });

        if (!updatedTicket) {
            console.log('❌ Failed to resolve ticket');
            return NextResponse.json({
                success: false,
                error: 'Failed to resolve ticket'
            }, { status: 500 });
        }

        console.log('✅ Ticket resolved successfully');

        // Create a resolution comment
        try {
            const resolutionComment = commentStore.createComment({
                id: `comment-resolution-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                ticket_id: ticketId,
                user_id: user.user_id,
                content: `**Ticket Resolved**\n\n${resolution}`,
                is_internal: false,
                created_at: new Date().toISOString(),
                author_name: user.email,
                author_email: user.email
            });
            console.log('💬 Resolution comment created:', resolutionComment.id);
        } catch (commentError) {
            console.error('Failed to create resolution comment:', commentError);
            // Don't fail the resolution if comment creation fails
        }

        // Create knowledge base article if requested
        let knowledgeArticle = null;
        if (createKnowledgeArticle) {
            try {
                const { knowledgeBaseStore } = await import('@/lib/knowledge-base-store');
                
                knowledgeArticle = knowledgeBaseStore.createArticleFromTicket(
                    ticketId,
                    currentTicket.title,
                    currentTicket.description,
                    resolution,
                    user.user_id,
                    currentTicket.tenant_id
                );
                
                console.log('📚 Knowledge base article created:', knowledgeArticle.id);
            } catch (kbError) {
                console.error('Failed to create knowledge base article:', kbError);
                // Don't fail the resolution if KB creation fails
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                ticket: updatedTicket,
                resolution: resolution,
                knowledgeArticle: knowledgeArticle,
                message: 'Ticket resolved successfully'
            }
        });

    } catch (error) {
        console.error('❌ Error resolving ticket:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        return NextResponse.json({
            success: false,
            error: 'Internal server error: ' + error.message
        }, { status: 500 });
    }
}

/**
 * Reopen a resolved ticket
 * PUT /api/tickets/[id]/resolve (reopen)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    const { id: ticketId } = await params;

    try {
        console.log('🎫 Ticket reopen API called (file-based)');
        console.log('🔍 Reopening ticket ID:', ticketId);
        
        // Apply authentication middleware
        const authResult = await authMiddleware(request);
        if (!authResult.success) {
            console.log('❌ Auth failed:', authResult.error);
            return NextResponse.json({
                success: false,
                error: 'Authentication failed'
            }, { status: 401 });
        }

        const user = authResult.user!;
        console.log('✅ User authenticated:', user.email, user.role);

        // Get current ticket from file-based store
        const currentTicket = ticketStore.getTicket(ticketId);
        
        if (!currentTicket) {
            console.log('❌ Ticket not found:', ticketId);
            return NextResponse.json({
                success: false,
                error: 'Ticket not found'
            }, { status: 404 });
        }

        console.log('✅ Ticket found:', currentTicket.title);

        // Only allow reopening resolved tickets
        if (currentTicket.status !== 'resolved') {
            console.log('❌ Invalid state transition:', { current: currentTicket.status, target: 'in_progress' });
            return NextResponse.json({
                success: false,
                error: 'Can only reopen resolved tickets'
            }, { status: 400 });
        }

        // Parse request body for optional reason
        const body = await request.json().catch(() => ({}));
        const reason = body.reason || 'Ticket reopened by user';

        console.log('📝 Reopen reason:', reason);

        // Determine new status based on whether ticket was previously assigned
        const newStatus = currentTicket.assigned_to ? 'in_progress' : 'new';

        // Update ticket status using file-based store
        console.log('📝 Reopening ticket...');
        const updatedTicket = ticketStore.updateTicket(ticketId, {
            status: newStatus,
            updated_at: new Date().toISOString()
        });

        if (!updatedTicket) {
            console.log('❌ Failed to reopen ticket');
            return NextResponse.json({
                success: false,
                error: 'Failed to reopen ticket'
            }, { status: 500 });
        }

        console.log('✅ Ticket reopened successfully');

        return NextResponse.json({
            success: true,
            data: {
                ticket: updatedTicket,
                message: 'Ticket reopened successfully'
            }
        });

    } catch (error) {
        console.error('❌ Error reopening ticket:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        return NextResponse.json({
            success: false,
            error: 'Internal server error: ' + error.message
        }, { status: 500 });
    }
}