import { NextResponse } from 'next/server';

export async function GET() {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const kpiData = {
        criticalAlerts: 7,
        securityTicketsOpen: 12,
        helpdeskTicketsOpen: 23,
        complianceScore: 87,
        timestamp: new Date().toISOString()
    };

    return NextResponse.json(kpiData);
}