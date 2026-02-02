import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

/**
 * POST /api/test-assignment
 * Test endpoint for ticket assignment without authentication
 * FOR TESTING ONLY - DO NOT USE IN PRODUCTION
 */
export async function POST(request: NextRequest) {
    try {
        console.log('🧪 Test assignment API called');
        
        // Parse request body
        const body = await request.json();
        const { ticketId, assignee } = body;

        console.log(`🎫 Test: Assigning ticket ${ticketId} to ${assignee}`);

        if (!ticketId || !assignee) {
            return NextResponse.json({
                success: false,
                error: 'ticketId and assignee are required'
            }, { status: 400 });
        }

        // Get database connection
        const db = await getDb();
        
        console.log('📊 Testing database connection...');
        
        // First check if ticket exists
        const checkResult = await db.execute(
            'SELECT id, title, status, assignee FROM tickets WHERE id = $1',
            [ticketId]
        );
        
        console.log('🔍 Ticket check result:', checkResult.rows);
        
        if (checkResult.rows.length === 0) {
            console.log('❌ Ticket not found:', ticketId);
            return NextResponse.json({
                success: false,
                error: 'Ticket not found',
                debug: { ticketId, searchResult: checkResult.rows }
            }, { status: 404 });
        }
        
        const existingTicket = checkResult.rows[0];
        console.log('✅ Ticket found:', existingTicket);
        
        // Update the ticket
        console.log('📝 Updating ticket...');
        const updateResult = await db.execute(
            'UPDATE tickets SET assignee = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
            [assignee, 'in_progress', ticketId]
        );
        
        console.log('📊 Update result:', {
            rowCount: updateResult.rows.length,
            firstRow: updateResult.rows[0] ? {
                id: updateResult.rows[0].id,
                title: updateResult.rows[0].title,
                status: updateResult.rows[0].status,
                assignee: updateResult.rows[0].assignee
            } : null
        });
        
        if (updateResult.rows.length > 0) {
            const updatedTicket = updateResult.rows[0];
            console.log(`✅ Ticket ${ticketId} assigned to ${assignee}`);
            
            return NextResponse.json({
                success: true,
                data: {
                    message: 'Ticket assigned successfully',
                    ticketId: ticketId,
                    assignee: assignee,
                    before: existingTicket,
                    after: {
                        id: updatedTicket.id,
                        title: updatedTicket.title,
                        status: updatedTicket.status,
                        assignee: updatedTicket.assignee,
                        updated_at: updatedTicket.updated_at
                    }
                }
            });
        } else {
            console.log('❌ No rows updated');
            return NextResponse.json({
                success: false,
                error: 'Failed to update ticket',
                debug: { ticketId, assignee, updateResult: updateResult.rows }
            }, { status: 500 });
        }

    } catch (error) {
        console.error('❌ Error in test assignment:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        return NextResponse.json({
            success: false,
            error: 'Internal server error: ' + error.message,
            debug: {
                errorName: error.name,
                errorMessage: error.message
            }
        }, { status: 500 });
    }
}

/**
 * GET /api/test-assignment
 * Get test tickets for debugging
 */
export async function GET(request: NextRequest) {
    try {
        console.log('🔍 Getting test tickets...');
        
        const db = await getDb();
        
        const result = await db.execute(
            'SELECT id, title, status, assignee, requester, created_at FROM tickets ORDER BY created_at DESC LIMIT 10'
        );
        
        console.log('📊 Found tickets:', result.rows.length);
        
        return NextResponse.json({
            success: true,
            data: {
                tickets: result.rows,
                count: result.rows.length
            }
        });

    } catch (error) {
        console.error('❌ Error getting test tickets:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error: ' + error.message
        }, { status: 500 });
    }
}