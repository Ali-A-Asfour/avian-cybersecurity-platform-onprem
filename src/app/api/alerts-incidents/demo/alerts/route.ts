/**
 * Demo API endpoints for Alert operations with mock data
 * 
 * Provides realistic mock data to demonstrate the SOC workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { SecurityAlert } from '@/types/alerts-incidents';
import { DemoStateManager } from '@/lib/demo-state';

// Mock alerts data for multiple tenants (using actual tenant IDs from database)
const mockAlerts: SecurityAlert[] = [
    // ESR tenant alerts
    {
        id: 'alert-001',
        tenantId: '85cfd918-8558-4baa-9534-25454aea76a8', // ESR
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
        tenantId: '85cfd918-8558-4baa-9534-25454aea76a8', // ESR
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
        tenantId: '85cfd918-8558-4baa-9534-25454aea76a8', // ESR
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
        tenantId: '85cfd918-8558-4baa-9534-25454aea76a8', // ESR
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
        tenantId: '85cfd918-8558-4baa-9534-25454aea76a8', // ESR
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
        tenantId: '85cfd918-8558-4baa-9534-25454aea76a8', // ESR
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
    },
    // Test tenant alerts (using Default Organization ID)
    {
        id: 'alert-007',
        tenantId: '1f9656a9-1d4a-4ebf-94db-45427789ba24', // Test/Default Organization
        sourceSystem: 'edr',
        sourceId: 'defender-alert-007',
        alertType: 'malware_detection',
        classification: 'malware',
        severity: 'high',
        title: 'Spyware detected on WORKSTATION-TS01',
        description: 'Microsoft Defender detected spyware attempting to steal credentials.',
        metadata: {
            deviceName: 'WORKSTATION-TS01',
            userName: 'sarah.tech@techstart.com',
            filePath: 'C:\\Users\\sarah.tech\\AppData\\Local\\Temp\\keylogger.exe'
        },
        seenCount: 1,
        firstSeenAt: new Date('2024-01-15T10:15:00Z'),
        lastSeenAt: new Date('2024-01-15T10:15:00Z'),
        defenderIncidentId: 'inc-007',
        defenderAlertId: 'alert-def-007',
        defenderSeverity: 'High',
        threatName: 'Trojan:Win32/Spy.Agent',
        affectedDevice: 'WORKSTATION-TS01',
        affectedUser: 'sarah.tech@techstart.com',
        status: 'open',
        assignedTo: null,
        assignedAt: null,
        detectedAt: new Date('2024-01-15T10:15:00Z'),
        createdAt: new Date('2024-01-15T10:15:00Z'),
        updatedAt: new Date('2024-01-15T10:15:00Z')
    },
    {
        id: 'alert-008',
        tenantId: '1f9656a9-1d4a-4ebf-94db-45427789ba24', // Test/Default Organization
        sourceSystem: 'firewall',
        sourceId: 'fw-alert-008',
        alertType: 'port_scan',
        classification: 'reconnaissance',
        severity: 'medium',
        title: 'Port scanning activity detected from external source',
        description: 'SonicWall detected systematic port scanning targeting multiple internal hosts.',
        metadata: {
            sourceIp: '198.51.100.42',
            targetHosts: 12,
            scannedPorts: '22,80,443,3389,8080',
            duration: '15 minutes'
        },
        seenCount: 1,
        firstSeenAt: new Date('2024-01-15T09:45:00Z'),
        lastSeenAt: new Date('2024-01-15T09:45:00Z'),
        defenderIncidentId: null,
        defenderAlertId: null,
        defenderSeverity: null,
        threatName: null,
        affectedDevice: null,
        affectedUser: null,
        status: 'open',
        assignedTo: null,
        assignedAt: null,
        detectedAt: new Date('2024-01-15T09:45:00Z'),
        createdAt: new Date('2024-01-15T09:45:00Z'),
        updatedAt: new Date('2024-01-15T09:45:00Z')
    },
    {
        id: 'alert-009',
        tenantId: '1f9656a9-1d4a-4ebf-94db-45427789ba24', // Test/Default Organization
        sourceSystem: 'email',
        sourceId: 'email-alert-009',
        alertType: 'business_email_compromise',
        classification: 'phishing',
        severity: 'critical',
        title: 'CEO impersonation email detected',
        description: 'Email security detected spoofed email claiming to be from CEO requesting wire transfer.',
        metadata: {
            sender: 'ceo@techstart-inc.com',
            recipient: 'finance@techstart.com',
            subject: 'URGENT: Wire Transfer Required',
            amount: '$50,000'
        },
        seenCount: 1,
        firstSeenAt: new Date('2024-01-15T08:30:00Z'),
        lastSeenAt: new Date('2024-01-15T08:30:00Z'),
        defenderIncidentId: null,
        defenderAlertId: null,
        defenderSeverity: null,
        threatName: null,
        affectedDevice: null,
        affectedUser: null,
        status: 'open',
        assignedTo: null,
        assignedAt: null,
        detectedAt: new Date('2024-01-15T08:30:00Z'),
        createdAt: new Date('2024-01-15T08:30:00Z'),
        updatedAt: new Date('2024-01-15T08:30:00Z')
    },
    // Third tenant alerts (ETX or other client)
    {
        id: 'alert-010',
        tenantId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', // Third tenant
        sourceSystem: 'edr',
        sourceId: 'defender-alert-010',
        alertType: 'credential_theft',
        classification: 'credential_access',
        severity: 'critical',
        title: 'Credential dumping attempt detected on FINANCE-SRV01',
        description: 'Microsoft Defender detected LSASS memory dumping attempt to steal credentials.',
        metadata: {
            deviceName: 'FINANCE-SRV01',
            userName: 'SYSTEM',
            processName: 'mimikatz.exe',
            technique: 'LSASS Memory Dump'
        },
        seenCount: 1,
        firstSeenAt: new Date('2024-01-15T11:00:00Z'),
        lastSeenAt: new Date('2024-01-15T11:00:00Z'),
        defenderIncidentId: 'inc-010',
        defenderAlertId: 'alert-def-010',
        defenderSeverity: 'High',
        threatName: 'HackTool:Win32/Mimikatz',
        affectedDevice: 'FINANCE-SRV01',
        affectedUser: 'SYSTEM',
        status: 'open',
        assignedTo: null,
        assignedAt: null,
        detectedAt: new Date('2024-01-15T11:00:00Z'),
        createdAt: new Date('2024-01-15T11:00:00Z'),
        updatedAt: new Date('2024-01-15T11:00:00Z')
    },
    {
        id: 'alert-011',
        tenantId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', // Third tenant
        sourceSystem: 'firewall',
        sourceId: 'fw-alert-011',
        alertType: 'ddos_attempt',
        classification: 'denial_of_service',
        severity: 'high',
        title: 'DDoS attack detected targeting web services',
        description: 'SonicWall detected distributed denial of service attack with 10,000+ requests per second.',
        metadata: {
            attackType: 'SYN Flood',
            requestRate: '10,500 req/sec',
            sourceIPs: '247 unique IPs',
            targetService: 'HTTPS (443)'
        },
        seenCount: 1,
        firstSeenAt: new Date('2024-01-15T10:30:00Z'),
        lastSeenAt: new Date('2024-01-15T10:30:00Z'),
        defenderIncidentId: null,
        defenderAlertId: null,
        defenderSeverity: null,
        threatName: null,
        affectedDevice: null,
        affectedUser: null,
        status: 'open',
        assignedTo: null,
        assignedAt: null,
        detectedAt: new Date('2024-01-15T10:30:00Z'),
        createdAt: new Date('2024-01-15T10:30:00Z'),
        updatedAt: new Date('2024-01-15T10:30:00Z')
    },
    {
        id: 'alert-012',
        tenantId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', // Third tenant
        sourceSystem: 'edr',
        sourceId: 'defender-alert-012',
        alertType: 'lateral_movement',
        classification: 'lateral_movement',
        severity: 'high',
        title: 'Suspicious lateral movement detected',
        description: 'Microsoft Defender detected unusual network authentication patterns indicating lateral movement.',
        metadata: {
            sourceDevice: 'FINANCE-WS05',
            targetDevices: 'FINANCE-SRV01, FINANCE-SRV02, FINANCE-DC01',
            userName: 'admin@globalfinance.com',
            authMethod: 'NTLM'
        },
        seenCount: 1,
        firstSeenAt: new Date('2024-01-15T09:15:00Z'),
        lastSeenAt: new Date('2024-01-15T09:15:00Z'),
        defenderIncidentId: 'inc-012',
        defenderAlertId: 'alert-def-012',
        defenderSeverity: 'Medium',
        threatName: 'Suspicious Network Activity',
        affectedDevice: 'FINANCE-WS05',
        affectedUser: 'admin@globalfinance.com',
        status: 'open',
        assignedTo: null,
        assignedAt: null,
        detectedAt: new Date('2024-01-15T09:15:00Z'),
        createdAt: new Date('2024-01-15T09:15:00Z'),
        updatedAt: new Date('2024-01-15T09:15:00Z')
    }
];

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const queue = searchParams.get('queue') || 'all';
        const assignedTo = searchParams.get('assignedTo');
        
        // Get selected tenant from header (for cross-tenant users like security analysts)
        const selectedTenantId = request.headers.get('x-selected-tenant-id');
        
        console.log(`🔍 Demo Alerts API: queue=${queue}, assignedTo=${assignedTo}, selectedTenant=${selectedTenantId}`);

        let filteredAlerts = mockAlerts;
        
        // Filter by selected tenant if provided (for security analysts)
        if (selectedTenantId) {
            filteredAlerts = filteredAlerts.filter(alert => alert.tenantId === selectedTenantId);
            console.log(`🔍 Filtered to tenant ${selectedTenantId}: ${filteredAlerts.length} alerts`);
        }

        // Filter based on queue type and demo state
        if (queue === 'all') {
            // All Alerts tab - only unassigned alerts (not assigned or escalated in demo state)
            filteredAlerts = filteredAlerts.filter(alert =>
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
                filteredAlerts = filteredAlerts.filter(alert =>
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
                    unassignedCount: mockAlerts.filter(a => {
                        const matchesTenant = selectedTenantId ? a.tenantId === selectedTenantId : true;
                        return matchesTenant && a.status === 'open' && !DemoStateManager.isAlertAssigned(a.id);
                    }).length,
                    assignedCount: assignedTo ? DemoStateManager.getAlertsAssignedTo(assignedTo).filter(id => {
                        const alert = mockAlerts.find(a => a.id === id);
                        return selectedTenantId ? alert?.tenantId === selectedTenantId : true;
                    }).length : 0,
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