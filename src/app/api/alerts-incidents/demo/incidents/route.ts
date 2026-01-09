/**
 * Demo API endpoints for Security Incident operations with mock data
 * 
 * Provides realistic mock data to demonstrate the SOC workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { SecurityIncident } from '@/types/alerts-incidents';
import { DemoStateManager } from '@/lib/demo-state';

// Mock incidents data - empty array to start with clean slate
const mockIncidents: SecurityIncident[] = [];

/**
 * Convert demo incident state to SecurityIncident format
 */
function convertDemoIncidentToSecurityIncident(demoIncident: any): SecurityIncident {
    const now = new Date();
    const createdAt = new Date(demoIncident.createdAt);

    // Calculate SLA times based on severity
    const slaMinutes = demoIncident.severity === 'critical' ? 60 :
        demoIncident.severity === 'high' ? 120 :
            demoIncident.severity === 'medium' ? 240 : 480;

    return {
        id: demoIncident.id,
        tenantId: 'acme-corp',
        ownerId: demoIncident.ownerId,
        title: demoIncident.title,
        description: demoIncident.description,
        severity: demoIncident.severity,
        status: demoIncident.status,
        resolutionSummary: null,
        dismissalJustification: null,
        slaAcknowledgeBy: new Date(createdAt.getTime() + 15 * 60 * 1000), // 15 minutes
        slaInvestigateBy: new Date(createdAt.getTime() + 45 * 60 * 1000), // 45 minutes
        slaResolveBy: new Date(createdAt.getTime() + slaMinutes * 60 * 1000),
        acknowledgedAt: demoIncident.status !== 'open' ? createdAt : null,
        investigationStartedAt: demoIncident.status === 'in_progress' ? new Date(createdAt.getTime() + 10 * 60 * 1000) : null,
        resolvedAt: null,
        createdAt: createdAt,
        updatedAt: createdAt
    };
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const queue = searchParams.get('queue') || 'all';
        const ownerId = searchParams.get('ownerId');
        console.log(`🔍 Demo Incidents API: queue=${queue}, ownerId=${ownerId}`);

        // Get dynamically created incidents from demo state
        const dynamicIncidents = DemoStateManager.getAllIncidents().map(convertDemoIncidentToSecurityIncident);
        console.log(`🔍 Found ${dynamicIncidents.length} dynamic incidents from demo state`);
        if (dynamicIncidents.length > 0) {
            console.log(`📋 Dynamic incidents:`, dynamicIncidents.map(i => `${i.id}: ${i.title} (owner: ${i.ownerId})`));
        }

        // Combine mock incidents with dynamic incidents
        let allIncidents = [...mockIncidents, ...dynamicIncidents];

        let filteredIncidents = allIncidents;

        // Filter based on queue type
        if (queue === 'all') {
            // All Security Incidents tab - all incidents regardless of owner
            filteredIncidents = allIncidents;
            console.log(`🔍 All Incidents: Returning ${filteredIncidents.length} incidents`);
        } else if (queue === 'my') {
            // My Security Incidents tab - only incidents owned by current user
            if (!ownerId) {
                // If no ownerId provided, return empty array to prevent showing all incidents
                filteredIncidents = [];
                console.log(`🔍 My Incidents: No ownerId provided, returning empty array`);
            } else {
                filteredIncidents = allIncidents.filter(incident => incident.ownerId === ownerId);
                console.log(`🔍 My Incidents: Found ${filteredIncidents.length} incidents owned by ${ownerId}`);
            }
        }

        // Sort incidents properly
        filteredIncidents.sort((a, b) => {
            // First by status (in_progress → open → resolved/dismissed)
            const statusOrder = { in_progress: 0, open: 1, resolved: 2, dismissed: 3 };
            const statusDiff = statusOrder[a.status] - statusOrder[b.status];
            if (statusDiff !== 0) return statusDiff;

            // Then by severity (Critical → Low)
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
            if (severityDiff !== 0) return severityDiff;

            // Finally by created time (newest first for active, oldest first for closed)
            if (['in_progress', 'open'].includes(a.status)) {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            } else {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                incidents: filteredIncidents,
                pagination: {
                    page: 1,
                    limit: 50,
                    total: filteredIncidents.length
                },
                metadata: {
                    openCount: allIncidents.filter(i => i.status === 'open').length,
                    inProgressCount: allIncidents.filter(i => i.status === 'in_progress').length,
                    resolvedCount: allIncidents.filter(i => i.status === 'resolved').length,
                    dismissedCount: allIncidents.filter(i => i.status === 'dismissed').length,
                    myIncidentsCount: allIncidents.filter(i => i.ownerId === ownerId).length,
                    total: allIncidents.length,
                    queue: queue,
                    readOnly: queue === 'all'
                }
            }
        });

    } catch (error) {
        console.error('Demo incidents API error:', error);
        return NextResponse.json({
            success: false,
            error: {
                code: 'DEMO_ERROR',
                message: 'Demo data error'
            }
        }, { status: 500 });
    }
}