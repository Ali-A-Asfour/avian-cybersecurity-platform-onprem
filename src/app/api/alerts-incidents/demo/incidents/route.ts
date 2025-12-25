/**
 * Demo API endpoints for Security Incident operations with mock data
 * 
 * Provides realistic mock data to demonstrate the SOC workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { SecurityIncident } from '@/types/alerts-incidents';
import { DemoStateManager } from '@/lib/demo-state';

// Mock incidents data
const mockIncidents: SecurityIncident[] = [
    {
        id: 'incident-001',
        tenantId: 'demo-tenant-123',
        ownerId: 'demo-user-123',
        title: 'Ransomware Attack on SERVER-DB01',
        description: 'Critical ransomware incident requiring immediate containment and investigation. Multiple files encrypted with .locked extension.',
        severity: 'critical',
        status: 'in_progress',
        resolutionSummary: null,
        dismissalJustification: null,
        slaAcknowledgeBy: new Date('2024-01-15T06:00:00Z'),
        slaInvestigateBy: new Date('2024-01-15T06:45:00Z'),
        slaResolveBy: new Date('2024-01-15T09:45:00Z'),
        acknowledgedAt: new Date('2024-01-15T05:50:00Z'),
        investigationStartedAt: new Date('2024-01-15T06:15:00Z'),
        resolvedAt: null,
        createdAt: new Date('2024-01-15T05:45:00Z'),
        updatedAt: new Date('2024-01-15T06:15:00Z')
    },
    {
        id: 'incident-002',
        tenantId: 'demo-tenant-123',
        ownerId: 'demo-user-456',
        title: 'Potential Data Exfiltration Attempt',
        description: 'Large data transfer to external IP detected. Investigating potential data breach.',
        severity: 'high',
        status: 'in_progress',
        resolutionSummary: null,
        dismissalJustification: null,
        slaAcknowledgeBy: new Date('2024-01-15T05:00:00Z'),
        slaInvestigateBy: new Date('2024-01-15T06:30:00Z'),
        slaResolveBy: new Date('2024-01-15T12:30:00Z'),
        acknowledgedAt: new Date('2024-01-15T04:45:00Z'),
        investigationStartedAt: new Date('2024-01-15T05:10:00Z'),
        resolvedAt: null,
        createdAt: new Date('2024-01-15T04:30:00Z'),
        updatedAt: new Date('2024-01-15T05:10:00Z')
    },
    {
        id: 'incident-003',
        tenantId: 'demo-tenant-123',
        ownerId: 'demo-user-123',
        title: 'Coordinated Phishing Campaign',
        description: 'Multiple phishing emails detected targeting finance department. Investigating scope and impact.',
        severity: 'medium',
        status: 'open',
        resolutionSummary: null,
        dismissalJustification: null,
        slaAcknowledgeBy: new Date('2024-01-15T08:20:00Z'),
        slaInvestigateBy: new Date('2024-01-15T11:20:00Z'),
        slaResolveBy: new Date('2024-01-16T07:20:00Z'),
        acknowledgedAt: new Date('2024-01-15T07:30:00Z'),
        investigationStartedAt: null,
        resolvedAt: null,
        createdAt: new Date('2024-01-15T07:20:00Z'),
        updatedAt: new Date('2024-01-15T07:30:00Z')
    },
    {
        id: 'incident-004',
        tenantId: 'demo-tenant-123',
        ownerId: 'demo-user-789',
        title: 'Malware Outbreak - Trojan Detection',
        description: 'Trojan malware detected on multiple endpoints. Containment measures applied, investigating spread.',
        severity: 'high',
        status: 'resolved',
        resolutionSummary: 'All affected endpoints quarantined and cleaned. Malware removed successfully. No data loss detected. Updated endpoint protection policies to prevent recurrence.',
        dismissalJustification: null,
        slaAcknowledgeBy: new Date('2024-01-14T10:00:00Z'),
        slaInvestigateBy: new Date('2024-01-14T11:30:00Z'),
        slaResolveBy: new Date('2024-01-14T17:30:00Z'),
        acknowledgedAt: new Date('2024-01-14T09:50:00Z'),
        investigationStartedAt: new Date('2024-01-14T10:15:00Z'),
        resolvedAt: new Date('2024-01-14T15:30:00Z'),
        createdAt: new Date('2024-01-14T09:30:00Z'),
        updatedAt: new Date('2024-01-14T15:30:00Z')
    },
    {
        id: 'incident-005',
        tenantId: 'demo-tenant-123',
        ownerId: 'demo-user-456',
        title: 'Brute Force Attack on SSH Services',
        description: 'Multiple failed SSH login attempts from external IPs. Investigating potential compromise.',
        severity: 'medium',
        status: 'resolved',
        resolutionSummary: 'Attack blocked by firewall. No successful logins detected. Source IPs added to blocklist. SSH access restricted to VPN only.',
        dismissalJustification: null,
        slaAcknowledgeBy: new Date('2024-01-13T09:45:00Z'),
        slaInvestigateBy: new Date('2024-01-13T13:45:00Z'),
        slaResolveBy: new Date('2024-01-14T09:45:00Z'),
        acknowledgedAt: new Date('2024-01-13T09:30:00Z'),
        investigationStartedAt: new Date('2024-01-13T10:00:00Z'),
        resolvedAt: new Date('2024-01-13T16:20:00Z'),
        createdAt: new Date('2024-01-13T08:45:00Z'),
        updatedAt: new Date('2024-01-13T16:20:00Z')
    },
    {
        id: 'incident-006',
        tenantId: 'demo-tenant-123',
        ownerId: 'demo-user-123',
        title: 'Suspicious PowerShell Activity',
        description: 'Unusual PowerShell execution patterns detected on admin workstation.',
        severity: 'low',
        status: 'dismissed',
        resolutionSummary: null,
        dismissalJustification: 'Confirmed as legitimate administrative script execution. Activity authorized by IT operations team for system maintenance.',
        slaAcknowledgeBy: new Date('2024-01-12T10:10:00Z'),
        slaInvestigateBy: new Date('2024-01-12T18:10:00Z'),
        slaResolveBy: new Date('2024-01-15T06:10:00Z'),
        acknowledgedAt: new Date('2024-01-12T07:00:00Z'),
        investigationStartedAt: new Date('2024-01-12T08:30:00Z'),
        resolvedAt: new Date('2024-01-12T09:45:00Z'),
        createdAt: new Date('2024-01-12T06:10:00Z'),
        updatedAt: new Date('2024-01-12T09:45:00Z')
    }
];

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
        tenantId: 'demo-tenant-123',
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
        const ownerId = searchParams.get('ownerId') || 'demo-user-123'; // Default for demo

        // Get dynamically created incidents from demo state
        const dynamicIncidents = DemoStateManager.getAllIncidents().map(convertDemoIncidentToSecurityIncident);

        // Combine mock incidents with dynamic incidents
        let allIncidents = [...mockIncidents, ...dynamicIncidents];

        let filteredIncidents = allIncidents;

        // Filter based on queue type
        if (queue === 'all') {
            // All Security Incidents tab - all incidents regardless of owner
            filteredIncidents = allIncidents;
        } else if (queue === 'my' && ownerId) {
            // My Security Incidents tab - only incidents owned by current user
            filteredIncidents = allIncidents.filter(incident => incident.ownerId === ownerId);
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