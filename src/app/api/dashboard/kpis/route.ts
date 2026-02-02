import { NextResponse } from 'next/server';

export async function GET() {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));

    const kpiData = {
        criticalAlerts: 7,
        securityTicketsOpen: 12,
        helpdeskTicketsOpen: 0, // No helpdesk tickets
        complianceScore: 87,
        timestamp: new Date().toISOString()
    };

    return NextResponse.json(kpiData);
}
