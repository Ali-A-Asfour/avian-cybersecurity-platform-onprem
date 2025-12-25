import { NextResponse } from 'next/server';

export async function GET() {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 280));

    const ticketBreakdownData = {
        securityTickets: {
            created: 18,
            resolved: 12
        },
        helpdeskTickets: {
            created: 34,
            resolved: 28
        },
        timestamp: new Date().toISOString()
    };

    return NextResponse.json(ticketBreakdownData);
}