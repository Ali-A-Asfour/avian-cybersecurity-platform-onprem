/**
 * Debug API endpoint for Demo State Management
 * 
 * Allows checking and resetting demo state for testing
 */

import { NextRequest, NextResponse } from 'next/server';
import { DemoStateManager } from '@/lib/demo-state';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'reset') {
            DemoStateManager.reset();
            return NextResponse.json({
                success: true,
                message: 'Demo state reset successfully'
            });
        }

        if (action === 'session') {
            // Test endpoint to check session ID consistency
            const sessionId = searchParams.get('sessionId');
            if (sessionId) {
                const alertsAssigned = DemoStateManager.getAlertsAssignedTo(sessionId);
                const incidentsOwned = DemoStateManager.getIncidentsOwnedBy(sessionId);
                
                return NextResponse.json({
                    success: true,
                    data: {
                        sessionId,
                        alertsAssigned,
                        incidentsOwned: incidentsOwned.map(i => ({ id: i.id, title: i.title, ownerId: i.ownerId }))
                    }
                });
            }
        }

        if (action === 'recover') {
            // Recovery endpoint to set session ID to existing user with incidents
            const existingUserId = DemoStateManager.getExistingUserWithIncidents();
            if (existingUserId) {
                return NextResponse.json({
                    success: true,
                    data: {
                        message: 'Found existing user with incidents',
                        existingUserId,
                        instructions: `Set localStorage.setItem('demoUserId', '${existingUserId}') in browser console to recover incidents`
                    }
                });
            } else {
                return NextResponse.json({
                    success: true,
                    data: {
                        message: 'No existing incidents found',
                        existingUserId: null
                    }
                });
            }
        }

        // Get all current states
        const states = DemoStateManager.getAllStates();
        
        return NextResponse.json({
            success: true,
            data: {
                alertStates: Array.from(states.alerts.entries()).map(([id, state]) => ({
                    alertId: id,
                    ...state
                })),
                incidentStates: Array.from(states.incidents.entries()).map(([id, state]) => ({
                    incidentId: id,
                    ...state
                })),
                totalAlerts: states.alerts.size,
                totalIncidents: states.incidents.size
            }
        });

    } catch (error) {
        console.error('Demo debug API error:', error);
        return NextResponse.json({
            success: false,
            error: {
                code: 'DEMO_ERROR',
                message: 'Demo debug error'
            }
        }, { status: 500 });
    }
}