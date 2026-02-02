import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { UserRole } from '@/types';
import { commentStore } from '@/lib/comment-store';
import { ticketStore } from '@/lib/ticket-store';

interface RouteParams {
    params: Promise<{
        id: string;
    }>;
}

/**
 * GET /api/tickets/[id]/comments
 * Get comments for a ticket
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id: ticketId } = await params;

    try {
        console.log('💬 Get ticket comments API called (file-based)');
        console.log('🔍 Ticket ID:', ticketId);
        
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

        // Verify ticket exists
        const ticket = ticketStore.getTicket(ticketId);
        if (!ticket) {
            console.log('❌ Ticket not found:', ticketId);
            return NextResponse.json({
                success: false,
                error: 'Ticket not found'
            }, { status: 404 });
        }

        // Get comments from comment store
        const comments = commentStore.getCommentsByTicket(ticketId);
        console.log(`📋 Found ${comments.length} comments for ticket ${ticketId}`);

        return NextResponse.json({
            success: true,
            data: comments
        });

    } catch (error) {
        console.error('❌ Error fetching ticket comments:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error: ' + error.message
        }, { status: 500 });
    }
}

/**
 * POST /api/tickets/[id]/comments
 * Add a comment to a ticket
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    const { id: ticketId } = await params;

    try {
        console.log('💬 Add ticket comment API called (file-based)');
        console.log('🔍 Ticket ID:', ticketId);
        
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

        // Verify ticket exists
        const ticket = ticketStore.getTicket(ticketId);
        if (!ticket) {
            console.log('❌ Ticket not found:', ticketId);
            return NextResponse.json({
                success: false,
                error: 'Ticket not found'
            }, { status: 404 });
        }

        // Parse request body
        const body = await request.json();
        const { content, is_internal } = body;

        if (!content || typeof content !== 'string' || !content.trim()) {
            return NextResponse.json({
                success: false,
                error: 'Comment content is required'
            }, { status: 400 });
        }

        console.log('📝 Comment content:', content.substring(0, 100) + '...');
        console.log('🔒 Is internal:', is_internal);

        // Create comment using comment store
        const comment = commentStore.createComment({
            id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ticket_id: ticketId,
            user_id: user.user_id,
            content: content.trim(),
            is_internal: is_internal || false,
            created_at: new Date().toISOString(),
            author_name: user.email, // Use email as name for now
            author_email: user.email
        });

        console.log('✅ Comment created:', comment.id);

        return NextResponse.json({
            success: true,
            data: comment,
            message: 'Comment added successfully'
        });

    } catch (error) {
        console.error('❌ Error adding ticket comment:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error: ' + error.message
        }, { status: 500 });
    }
}