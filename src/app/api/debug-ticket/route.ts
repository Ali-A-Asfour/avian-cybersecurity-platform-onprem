import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

/**
 * POST /api/debug-ticket
 * Direct database ticket assignment test (no auth, no middleware)
 */
export async function POST(request: NextRequest) {
    try {
        console.log('🔧 Debug ticket assignment called');
        
        const body = await request.json();
        const { ticketId, assignee } = body;

        console.log(`🎫 Debug: Assigning ticket ${ticketId} to ${assignee}`);

        if (!ticketId || !assignee) {
            return NextResponse.json({
                success: false,
                error: 'ticketId and assignee are required'
            }, { status: 400 });
        }

        // Direct database update without using TicketService
        const db = await getDb();
        
        console.log('📊 Database connection established');
        
        // Raw SQL update
        const result = await db.execute(
            `UPDATE tickets SET assignee = $1, status = 'in_progress', updated_at = NOW() WHERE id = $2 RETURNING id, title, status, assignee`,
            [assignee, ticketId]
        );
        
        console.log('📝 Update result:', result);

        if (result.rows && result.rows.length > 0) {
            return NextResponse.json({
                success: true,
                data: {
                    ticket: result.rows[0],
                    message: 'Debug assignment successful'
                }
            });
        } else {
            return NextResponse.json({
                success: false,
                error: 'Ticket not found or update failed'
            }, { status: 404 });
        }

    } catch (error) {
        console.error('❌ Debug assignment error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal error',
            stack: error.stack
        }, { status: 500 });
    }
}

/**
 * GET /api/debug-ticket
 * Health check
 */
export async function GET() {
    try {
        const db = await getDb();
        console.log('🔧 Debug endpoint health check');
        
        // Test database connection
        const result = await db.execute('SELECT NOW() as current_time');
        
        return NextResponse.json({
            success: true,
            message: 'Debug endpoint is working',
            database: 'connected',
            time: result.rows[0]?.current_time
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error.message,
            database: 'failed'
        }, { status: 500 });
    }
}