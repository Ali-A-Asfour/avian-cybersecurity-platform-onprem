import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        console.log('Dashboard tickets endpoint called');

        // Check if we're in bypass mode
        if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
            console.log('Using bypass auth mode');
            
            // Import services dynamically to avoid issues
            const { TicketService } = await import('@/services/ticket.service');
            const { UserRole } = await import('@/types');
            
            // For development, we need to get user info from request headers or use mock data
            // Since we're in bypass mode, let's return empty data for now
            const ticketBreakdownData = {
                securityTickets: {
                    created: 0,
                    resolved: 0
                },
                helpdeskTickets: {
                    created: 0,
                    resolved: 0
                },
                timestamp: new Date().toISOString()
            };

            console.log('Returning ticket breakdown data:', ticketBreakdownData);
            return NextResponse.json(ticketBreakdownData);
        }

        // Production auth flow would go here
        const ticketBreakdownData = {
            securityTickets: {
                created: 0,
                resolved: 0
            },
            helpdeskTickets: {
                created: 0,
                resolved: 0
            },
            timestamp: new Date().toISOString()
        };

        return NextResponse.json(ticketBreakdownData);
    } catch (error) {
        console.error('Error in dashboard tickets endpoint:', error);
        
        // Return fallback data on error
        const fallbackData = {
            securityTickets: {
                created: 0,
                resolved: 0
            },
            helpdeskTickets: {
                created: 0,
                resolved: 0
            },
            timestamp: new Date().toISOString()
        };

        return NextResponse.json(fallbackData);
    }
}