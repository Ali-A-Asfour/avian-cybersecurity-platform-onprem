import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/services/ticket.service';

/**
 * POST /api/tickets/test-assign
 * Test ticket assignment without authentication (for debugging)
 */
export async function POST(request: NextRequest) {
    try {
        console.log('🧪 Test assign endpoint called');
        
        // Parse request body
        const body = await request.json();
        const { ticketId, assignee } = body;

        console.log(`🎫 Test assigning ticket ${ticketId} to user ${assignee}`);

        if (!ticketId || !assignee) {
            return NextResponse.json({
                success: false,
                error: 'ticketId and assignee are required'
            }, { status: 400 });
        }

        // Try to assign the ticket directly
        const updatedTicket = await TicketService.assignTicket(ticketId, assignee);
        
        if (!updatedTicket) {
            return NextResponse.json({
                success: false,
                error: 'Failed to assign ticket - ticket not found or database error'
            }, { status: 500 });
        }

        console.log(`✅ Test assignment successful: ${ticketId} → ${assignee}`);

        return NextResponse.json({
            success: true,
            data: {
                ticket: updatedTicket,
                message: 'Test assignment successful'
            }
        });

    } catch (error) {
        console.error('Error in test assign:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal error'
        }, { status: 500 });
    }
}

/**
 * GET /api/tickets/test-assign
 * Simple health check
 */
export async function GET() {
    return NextResponse.json({
        success: true,
        message: 'Test assign endpoint is working'
    });
}