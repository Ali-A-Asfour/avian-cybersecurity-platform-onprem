/**
 * Demo API endpoint for starting work on incidents with mock data
 * 
 * Simulates starting work on a security incident
 */

import { NextRequest, NextResponse } from 'next/server';
import { DemoStateManager } from '@/lib/demo-state';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: incidentId } = await params;
        console.log('🔥 Demo start work endpoint called for incident:', incidentId);

        // Validate incident ID
        if (!incidentId) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Incident ID is required',
                    },
                },
                { status: 400 }
            );
        }

        // Get incident from demo state
        const incident = DemoStateManager.getIncident(incidentId);
        if (!incident) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Incident not found',
                    },
                },
                { status: 404 }
            );
        }

        // Check if incident is in a startable status
        if (incident.status !== 'open') {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_STATUS',
                        message: 'Incident is not in a status that allows starting work',
                    },
                },
                { status: 409 }
            );
        }

        // Update incident status to in_progress in demo state
        const updatedIncident = {
            ...incident,
            status: 'in_progress' as const,
        };

        // Update the incident in demo state (we'll need to add this method)
        DemoStateManager.updateIncident(incidentId, updatedIncident);

        console.log('✅ Work started on incident:', incidentId);

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 300));

        const response = {
            success: true,
            data: {
                message: 'Work started on incident successfully',
                incidentId,
                status: 'in_progress'
            }
        };

        console.log('📤 Sending response:', response);
        return NextResponse.json(response);

    } catch (error) {
        console.error('❌ Demo start work API error:', error);
        return NextResponse.json({
            success: false,
            error: {
                code: 'DEMO_ERROR',
                message: 'Demo start work error'
            }
        }, { status: 500 });
    }
}