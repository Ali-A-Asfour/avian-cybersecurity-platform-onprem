/**
 * Demo API endpoint for Alert Escalation with mock data
 * 
 * Simulates escalating an alert to a security incident
 */

import { NextRequest, NextResponse } from 'next/server';
import { DemoStateManager } from '@/lib/demo-state';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: alertId } = await params;
        console.log('🔥 Demo escalation endpoint called for alert:', alertId);

        const body = await request.json();
        const { incidentTitle, incidentDescription, userId, assignedTo } = body;
        console.log('📝 Escalation request body:', { incidentTitle, incidentDescription, userId, assignedTo });

        // Get user ID from request body, or generate one based on session/tenant
        const escalatingUserId = userId || assignedTo || `user-${Date.now()}`;
        console.log(`👤 Using escalating user ID: ${escalatingUserId}`);

        // In demo mode, we simulate successful escalation
        // Create incident and update alert state
        console.log('🏗️ Creating incident via DemoStateManager...');
        const incidentId = DemoStateManager.escalateAlert(
            alertId,
            escalatingUserId,
            incidentTitle,
            incidentDescription
        );
        console.log('✅ Incident created with ID:', incidentId);

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 500));

        const response = {
            success: true,
            data: {
                message: 'Alert escalated to security incident successfully',
                alertId,
                incidentId,
                alertStatus: 'escalated'
            }
        };

        console.log('📤 Sending response:', response);
        return NextResponse.json(response);

    } catch (error) {
        console.error('❌ Demo escalate API error:', error);
        return NextResponse.json({
            success: false,
            error: {
                code: 'DEMO_ERROR',
                message: 'Demo escalation error'
            }
        }, { status: 500 });
    }
}