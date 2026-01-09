/**
 * Demo API endpoints for Alert operations with mock data
 * 
 * Provides realistic mock data to demonstrate the SOC workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { SecurityAlert } from '@/types/alerts-incidents';
import { DemoStateManager } from '@/lib/demo-state';

// Mock alerts data
const mockAlerts: SecurityAlert[] = [
    {
        id: 'alert-001',
        tenantId: 'acme-corp',
        sourceSystem: 'edr',
        sourceId: 'defender-alert-001',
        alertType: 'malware_detection',
        classification: 'malware',
        severity: 'critical',
        title: 'Trojan:Win32/Wacatac.B!ml detected on DESKTOP-ABC123',
        description: 'Microsoft Defender detected malware on endpoint DESKTOP-ABC123. The threat was quarantined automatically.',
        metadata: {
            deviceName: 'DESKTOP-ABC123',
            userName: 'john.doe@company.com',
            filePath: 'C:\\Users\\john.doe\\Downloads\\suspicious.exe'
        },
        seenCount: 1,
        firstSeenAt: new Date('2024-01-15T09:30:00Z'),
        lastSeenAt: new Date('2024-01-15T09:30:00Z'),
        defenderIncidentId: 'inc-001',
        defenderAlertId: 'alert-def-001',
        defenderSeverity: 'High',
        threatName: 'Trojan:Win32/Wacatac.B!ml',
        affectedDevice: 'DESKTOP-ABC123',
        affectedUser: 'john.doe@company.com',
        status: 'open',
        assignedTo: null,
        assignedAt: null,
        detectedAt: new Date('2024-01-15T09:30:00Z'),
        createdAt: new Date('2024-01-15T09:30:00Z'),
        updatedAt: new Date('2024-01-15T09:30:00Z')
    },
    {
        id: 'alert-002',
        tenantId: 'acme-corp',
        sourceSystem: 'firewall',
        sourceId: 'fw-alert-002',
        alertType: 'intrusion_attempt',
        classification: 'network_intrusion',
        severity: 'high',
        title: 'Multiple failed SSH login attempts from 192.168.1.100',
        description: 'SonicWall detected 15 failed SSH login attempts from external IP within 5 minutes.',
        metadata: {
            sourceIp: '192.168.1.100',
            targetPort: '22',
            attemptCount: 15,
            timeWindow: '5 minutes'
        },
        seenCount: 3,
        firstSeenAt: new Date('2024-01-15T08:45:00Z'),
        lastSeenAt: new Date('2024-01-15T09:15:00Z'),
        defenderIncidentId: null,
        defenderAlertId: null,
        defenderSeverity: null,
        threatName: null,
        affectedDevice: null,
        affectedUser: null,
        status: 'open',
        assignedTo: null,
        assignedAt: null,
        detectedAt: new Date('2024-01-15T08:45:00Z'),
        createdAt: new Date('2024-01-15T08:45:00Z'),
        updatedAt: new Date('2024-01-15T09:15:00Z')
    },
    {
        id: 'alert-003',
        tenantId: 'acme-corp',
        sourceSystem: 'email',
        sourceId: 'email-alert-003',
        alertType: 'phishing_attempt',
        classification: 'phishing',
        severity: 'medium',
        title: 'Suspicious email with malicious attachment detected',
        description: 'Email security system detected a suspicious email with a potentially malicious attachment.',
        metadata: {
            sender: 'noreply@suspicious-domain.com',
            recipient: 'jane.smith@company.com',
            subject: 'Urgent: Invoice Payment Required',
            attachmentType: '.zip'
        },
        seenCount: 1,
        firstSeenAt: new Date('2024-01-15T07:20:00Z'),
        lastSeenAt: new Date('2024-01-15T07:20:00Z'),
        defenderIncidentId: null,
        defenderAlertId: null,
        defenderSeverity: null,
        threatName: null,
        affectedDevice: null,
        affectedUser: null,
        status: 'open',
        assignedTo: null,
        assignedAt: null,
        detectedAt: new Date('2024-01-15T07:20:00Z'),
        createdAt: new Date('2024-01-15T07:20:00Z'),
        updatedAt: new Date('2024-01-15T07:20:00Z')
    },
    {
        id: 'alert-004',
        tenantId: 'acme-corp',
        sourceSystem: 'edr',
        sourceId: 'defender-alert-004',
        alertType: 'suspicious_activity',
        classification: 'behavioral',
        severity: 'low',
        title: 'Unusual process execution pattern detected',
        description: 'Microsoft Defender detected unusual process execution patterns that may indicate suspicious activity.',
        metadata: {
            deviceName: 'LAPTOP-XYZ789',
            userName: 'admin@company.com',
            processName: 'powershell.exe',
            commandLine: 'powershell.exe -ExecutionPolicy Bypass -File script.ps1'
        },
        seenCount: 1,
        firstSeenAt: new Date('2024-01-15T06:10:00Z'),
        lastSeenAt: new Date('2024-01-15T06:10:00Z'),
        defenderIncidentId: 'inc-004',
        defenderAlertId: 'alert-def-004',
        defenderSeverity: 'Low',
        threatName: 'Suspicious PowerShell Activity',
        affectedDevice: 'LAPTOP-XYZ789',
        affectedUser: 'admin@company.com',
        status: 'open',
        assignedTo: null,
        assignedAt: null,
        detectedAt: new Date('2024-01-15T06:10:00Z'),
        createdAt: new Date('2024-01-15T06:10:00Z'),
        updatedAt: new Date('2024-01-15T06:10:00Z')
    },
    {
        id: 'alert-005',
        tenantId: 'acme-corp',
        sourceSystem: 'edr',
        sourceId: 'defender-alert-005',
        alertType: 'malware_detection',
        classification: 'malware',
        severity: 'critical',
        title: 'Ransomware activity detected on SERVER-DB01',
        description: 'Microsoft Defender detected potential ransomware activity with file encryption patterns.',
        metadata: {
            deviceName: 'SERVER-DB01',
            userName: 'SYSTEM',
            affectedFiles: 1247,
            encryptionPattern: '.locked'
        },
        seenCount: 1,
        firstSeenAt: new Date('2024-01-15T05:45:00Z'),
        lastSeenAt: new Date('2024-01-15T05:45:00Z'),
        defenderIncidentId: 'inc-005',
        defenderAlertId: 'alert-def-005',
        defenderSeverity: 'High',
        threatName: 'Ransom:Win32/StopCrypt',
        affectedDevice: 'SERVER-DB01',
        affectedUser: 'SYSTEM',
        status: 'open',
        assignedTo: null,
        assignedAt: null,
        detectedAt: new Date('2024-01-15T05:45:00Z'),
        createdAt: new Date('2024-01-15T05:45:00Z'),
        updatedAt: new Date('2024-01-15T09:00:00Z')
    },
    {
        id: 'alert-006',
        tenantId: 'acme-corp',
        sourceSystem: 'firewall',
        sourceId: 'fw-alert-006',
        alertType: 'data_exfiltration',
        classification: 'data_loss',
        severity: 'high',
        title: 'Large data transfer to external IP detected',
        description: 'SonicWall detected unusually large data transfer (2.3GB) to external IP address.',
        metadata: {
            sourceIp: '192.168.1.50',
            destinationIp: '203.0.113.45',
            dataVolume: '2.3GB',
            duration: '45 minutes'
        },
        seenCount: 1,
        firstSeenAt: new Date('2024-01-15T04:30:00Z'),
        lastSeenAt: new Date('2024-01-15T04:30:00Z'),
        defenderIncidentId: null,
        defenderAlertId: null,
        defenderSeverity: null,
        threatName: null,
        affectedDevice: null,
        affectedUser: null,
        status: 'open',
        assignedTo: null,
        assignedAt: null,
        detectedAt: new Date('2024-01-15T04:30:00Z'),
        createdAt: new Date('2024-01-15T04:30:00Z'),
        updatedAt: new Date('2024-01-15T08:45:00Z')
    }
];

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const queue = searchParams.get('queue') || 'all';
        const assignedTo = searchParams.get('assignedTo');
        console.log(`🔍 Demo Alerts API: queue=${queue}, assignedTo=${assignedTo}`);

        let filteredAlerts = mockAlerts;

        // Filter based on queue type and demo state
        if (queue === 'all') {
            // All Alerts tab - only unassigned alerts (not assigned or escalated in demo state)
            filteredAlerts = mockAlerts.filter(alert =>
                alert.status === 'open' && !DemoStateManager.isAlertAssigned(alert.id)
            );
            console.log(`🔍 All Alerts: Found ${filteredAlerts.length} unassigned alerts`);
        } else if (queue === 'my') {
            // My Alerts tab - alerts assigned to current user in demo state (but not escalated)
            if (!assignedTo) {
                // If no assignedTo provided, return empty array to prevent showing all alerts
                filteredAlerts = [];
                console.log(`🔍 My Alerts: No assignedTo provided, returning empty array`);
            } else {
                const assignedAlertIds = DemoStateManager.getAlertsAssignedTo(assignedTo);
                console.log(`🔍 My Alerts: Found ${assignedAlertIds.length} alerts assigned to ${assignedTo}:`, assignedAlertIds);
                filteredAlerts = mockAlerts.filter(alert =>
                    assignedAlertIds.includes(alert.id)
                ).map(alert => {
                    // Update alert properties to reflect assignment
                    const state = DemoStateManager.getAlertState(alert.id);
                    return {
                        ...alert,
                        status: 'assigned' as const,
                        assignedTo: state?.assignedTo || null,
                        assignedAt: state?.assignedAt ? new Date(state.assignedAt) : null
                    };
                });
                console.log(`🔍 My Alerts: Returning ${filteredAlerts.length} alerts for ${assignedTo}`);
            }
        }

        // Sort alerts properly
        filteredAlerts.sort((a, b) => {
            // First by severity (Critical → Low)
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
            if (severityDiff !== 0) return severityDiff;

            // Then by created time (oldest first for triage, newest at bottom for assigned)
            if (queue === 'all') {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            } else {
                return new Date(b.assignedAt || b.createdAt).getTime() - new Date(a.assignedAt || a.createdAt).getTime();
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                alerts: filteredAlerts,
                pagination: {
                    page: 1,
                    limit: 50,
                    total: filteredAlerts.length
                },
                metadata: {
                    unassignedCount: mockAlerts.filter(a =>
                        a.status === 'open' && !DemoStateManager.isAlertAssigned(a.id)
                    ).length,
                    assignedCount: assignedTo ? DemoStateManager.getAlertsAssignedTo(assignedTo).length : 0,
                    queue: queue
                }
            }
        });

    } catch (error) {
        console.error('Demo alerts API error:', error);
        return NextResponse.json({
            success: false,
            error: {
                code: 'DEMO_ERROR',
                message: 'Demo data error'
            }
        }, { status: 500 });
    }
}