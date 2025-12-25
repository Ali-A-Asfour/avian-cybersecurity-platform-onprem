import { NextResponse } from 'next/server';

export async function GET() {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 180));

    const activityFeedData = {
        activities: [
            {
                id: 'activity-1',
                timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(), // 3 minutes ago
                description: 'High-severity phishing attempt blocked on user@company.com',
                type: 'alert' as const,
                icon: 'shield-alert'
            },
            {
                id: 'activity-2',
                timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(), // 8 minutes ago
                description: 'New device WS-156 successfully enrolled with AVIAN agent',
                type: 'device' as const,
                icon: 'monitor'
            },
            {
                id: 'activity-3',
                timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
                description: 'Microsoft 365 integration sync completed successfully',
                type: 'integration' as const,
                icon: 'refresh-cw'
            }
        ],
        timestamp: new Date().toISOString()
    };

    return NextResponse.json(activityFeedData);
}