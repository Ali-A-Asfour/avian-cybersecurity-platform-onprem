import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { UserRole } from '@/types';
import { ticketStore } from '@/lib/ticket-store';

/**
 * POST /api/tickets/assign-simple
 * Simple ticket assignment using file-based ticket store
 */
export async function POST(request: NextRequest) {
    try {
        console.log('🎫 Simple assignment API called (file-based)');
        
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

        // Parse request body
        const body = await request.json();
        const { ticketId, assignee } = body;

        console.log(`🎫 Assigning ticket ${ticketId} to ${assignee}`);

        if (!ticketId || !assignee) {
            return NextResponse.json({
                success: false,
                error: 'ticketId and assignee are required'
            }, { status: 400 });
        }

        // Use file-based ticket store for assignment
        console.log('📊 Checking if ticket exists in store...');
        console.log('📊 Total tickets in store:', ticketStore.getAllTickets().length);
        
        const existingTicket = ticketStore.getTicket(ticketId);
        console.log('📊 Ticket lookup result:', existingTicket ? 'FOUND' : 'NOT FOUND');
        
        if (!existingTicket) {
            console.log('❌ Ticket not found:', ticketId);
            console.log('📊 Available ticket IDs:', ticketStore.getAllTickets().map(t => t.id));
            return NextResponse.json({
                success: false,
                error: 'Ticket not found'
            }, { status: 404 });
        }
        
        console.log('✅ Ticket found:', existingTicket.title);
        
        // Assign the ticket using ticket store
        console.log('📝 Assigning ticket...');
        const updatedTicket = ticketStore.assignTicket(ticketId, assignee);
        
        if (updatedTicket) {
            console.log(`✅ Ticket ${ticketId} assigned to ${assignee}`);
            
            return NextResponse.json({
                success: true,
                data: {
                    message: 'Ticket assigned successfully',
                    ticketId: ticketId,
                    assignee: assignee,
                    ticket: updatedTicket
                }
            });
        } else {
            console.log('❌ Failed to assign ticket');
            return NextResponse.json({
                success: false,
                error: 'Failed to assign ticket'
            }, { status: 500 });
        }

    } catch (error) {
        console.error('❌ Error in simple assignment:', error);
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