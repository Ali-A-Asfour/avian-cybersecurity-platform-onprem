import { NextResponse } from 'next/server';

export async function GET() {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));

    const deviceCoverageData = {
        protected: 142,
        missingAgent: 18,
        withAlerts: 7,
        total: 167,
        timestamp: new Date().toISOString()
    };

    return NextResponse.json(deviceCoverageData);
}