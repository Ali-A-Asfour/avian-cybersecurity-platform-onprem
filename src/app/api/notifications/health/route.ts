import { NextResponse } from 'next/server';

export async function GET() {
    // Simple health check for notification service
    return NextResponse.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'notification'
    });
}