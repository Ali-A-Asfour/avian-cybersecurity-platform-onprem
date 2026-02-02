import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import postgres from 'postgres';

/**
 * GET /api/tickets/unassigned
 * Get unassigned tickets for the help desk queue
 */
export async function GET(request: NextRequest) {
    try {
        console.log('🎫 Getting unassigned tickets...');
        
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
        console.log('✅ User authenticated:', user.role);

        // Create direct postgres connection
        const client = postgres(process.env.DATABASE_URL!, {
            max: 10,
            idle_timeout: 20,
            connect_timeout: 10,
            ssl: false,
            prepare: true,
            transform: {
                undefined: null,
            },
        });
        
        console.log('📊 Fetching unassigned tickets...');
        
        // Get unassigned tickets
        const tickets = await client`
            SELECT 
                id, title, description, severity, priority, status, 
                category, requester, created_at, updated_at,
                assigned_to, assignee
            FROM tickets 
            WHERE (assigned_to IS NULL OR assigned_to = '') 
            AND (assignee IS NULL OR assignee = '')
            AND status = 'new'
            ORDER BY 
                CASE priority 
                    WHEN 'urgent' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    WHEN 'low' THEN 4 
                END,
                created_at ASC
            LIMIT 50
        `;
        
        await client.end();
        
        console.log(`📋 Found ${tickets.length} unassigned tickets`);
        
        return NextResponse.json({
            success: true,
            data: {
                tickets: tickets,
                count: tickets.length
            }
        });

    } catch (error) {
        console.error('❌ Error getting unassigned tickets:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to get tickets: ' + error.message
        }, { status: 500 });
    }
}