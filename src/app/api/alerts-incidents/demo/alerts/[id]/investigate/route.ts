/**
 * Demo API endpoint for Alert Investigation with mock data
 * 
 * Simulates assigning an alert to the current user for investigation
 */

import { NextRequest, NextResponse } from 'next/server';
import { DemoStateManager } from '@/lib/demo-state';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: alertId } = await params;
        const body = await request.json();
        
        // Get user ID from request body, or generate one based on session/tenant
        const userId = body.userId || body.assignedTo || `user-${Date.now()}`;

        // In demo mode, we simulate successful assignment
        // Update the demo state to track this assignment
        DemoStateManager.assignAlert(alertId, userId);

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 500));

        return NextResponse.json({
            success: true,
            data: {
                alertId,
                status: 'assigned',
                assignedTo: userId,
                assignedAt: new Date().toISOString(),
                message: 'Alert assigned for investigation'
            }
        });

    } catch (error) {
        console.error('Demo investigate API error:', error);
        return NextResponse.json({
            success: false,
            error: {
                code: 'DEMO_ERROR',
                message: 'Demo investigation error'
            }
        }, { status: 500 });
    }
}