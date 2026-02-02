import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

/**
 * GET /api/test-db
 * Test database connection directly
 */
export async function GET(request: NextRequest) {
    try {
        console.log('🔧 Testing database connection in API...');
        console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
        
        if (!process.env.DATABASE_URL) {
            return NextResponse.json({
                success: false,
                error: 'DATABASE_URL not found in environment'
            }, { status: 500 });
        }

        const client = postgres(process.env.DATABASE_URL, {
            max: 10,
            idle_timeout: 20,
            connect_timeout: 10,
            ssl: false, // Disable SSL for local testing
            prepare: true,
            transform: {
                undefined: null,
            },
        });

        console.log('📊 Testing connection...');
        const connectionTest = await client`SELECT 1 as connection_test`;
        console.log('✅ Connection test result:', connectionTest);

        console.log('🎫 Testing ticket query...');
        const tickets = await client`SELECT id, title, status, assigned_to, assignee FROM tickets LIMIT 3`;
        console.log('✅ Tickets found:', tickets);

        await client.end();

        return NextResponse.json({
            success: true,
            data: {
                connectionTest: connectionTest[0],
                tickets: tickets,
                environment: {
                    NODE_ENV: process.env.NODE_ENV,
                    DATABASE_URL_EXISTS: !!process.env.DATABASE_URL
                }
            }
        });

    } catch (error) {
        console.error('❌ Database test failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Database connection failed: ' + error.message,
            debug: {
                errorName: error.name,
                errorMessage: error.message
            }
        }, { status: 500 });
    }
}

/**
 * POST /api/test-db
 * Test ticket assignment directly
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { ticketId, assignee } = body;

        console.log('🎯 Testing assignment:', { ticketId, assignee });

        if (!ticketId || !assignee) {
            return NextResponse.json({
                success: false,
                error: 'ticketId and assignee are required'
            }, { status: 400 });
        }

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

        // Check if ticket exists
        const checkResult = await client`
            SELECT id, title, status, assigned_to, assignee 
            FROM tickets 
            WHERE id = ${ticketId}
        `;

        if (checkResult.length === 0) {
            await client.end();
            return NextResponse.json({
                success: false,
                error: 'Ticket not found'
            }, { status: 404 });
        }

        console.log('✅ Ticket found:', checkResult[0]);

        // Update assignment
        const updateResult = await client`
            UPDATE tickets 
            SET assigned_to = ${assignee}, assignee = ${assignee}, status = 'in_progress', updated_at = NOW() 
            WHERE id = ${ticketId} 
            RETURNING id, title, status, assigned_to, assignee, updated_at
        `;

        await client.end();

        if (updateResult.length > 0) {
            console.log('✅ Assignment successful:', updateResult[0]);
            return NextResponse.json({
                success: true,
                data: {
                    message: 'Ticket assigned successfully',
                    before: checkResult[0],
                    after: updateResult[0]
                }
            });
        } else {
            return NextResponse.json({
                success: false,
                error: 'Failed to update ticket'
            }, { status: 500 });
        }

    } catch (error) {
        console.error('❌ Assignment test failed:', error);
        return NextResponse.json({
            success: false,
            error: 'Assignment failed: ' + error.message
        }, { status: 500 });
    }
}