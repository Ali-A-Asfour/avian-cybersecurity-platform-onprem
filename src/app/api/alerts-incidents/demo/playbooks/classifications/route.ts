/**
 * Demo API endpoint for Playbook Classifications with mock data
 * 
 * Provides realistic mock data to demonstrate classification coverage
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock classifications summary data
const mockClassifications = [
    {
        classification: 'malware',
        primaryPlaybook: {
            id: 'playbook-001',
            name: 'Malware Detection Response',
            version: '2.1',
            status: 'active' as const,
            purpose: 'Standard response procedure for malware detection alerts from EDR systems',
            quickResponseGuide: [],
            initialValidationSteps: [],
            sourceInvestigationSteps: [],
            containmentChecks: [],
            decisionGuidance: {
                escalateToIncident: '',
                resolveBenign: '',
                resolveFalsePositive: ''
            },
            createdBy: 'security-team',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-10T00:00:00Z')
        },
        secondaryCount: 2 // playbook-008, playbook-011
    },
    {
        classification: 'network_intrusion',
        primaryPlaybook: {
            id: 'playbook-002',
            name: 'Network Intrusion Investigation',
            version: '1.8',
            status: 'active' as const,
            purpose: 'Investigation procedures for network-based security alerts and intrusion attempts',
            quickResponseGuide: [],
            initialValidationSteps: [],
            sourceInvestigationSteps: [],
            containmentChecks: [],
            decisionGuidance: {
                escalateToIncident: '',
                resolveBenign: '',
                resolveFalsePositive: ''
            },
            createdBy: 'network-security-team',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-08T00:00:00Z')
        },
        secondaryCount: 2 // playbook-006, playbook-009
    },
    {
        classification: 'phishing',
        primaryPlaybook: {
            id: 'playbook-003',
            name: 'Phishing Email Response',
            version: '3.0',
            status: 'active' as const,
            purpose: 'Response procedures for phishing and malicious email detection alerts',
            quickResponseGuide: [],
            initialValidationSteps: [],
            sourceInvestigationSteps: [],
            containmentChecks: [],
            decisionGuidance: {
                escalateToIncident: '',
                resolveBenign: '',
                resolveFalsePositive: ''
            },
            createdBy: 'email-security-team',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-12T00:00:00Z')
        },
        secondaryCount: 0
    },
    {
        classification: 'data_loss',
        primaryPlaybook: {
            id: 'playbook-004',
            name: 'Data Exfiltration Investigation',
            version: '1.5',
            status: 'active' as const,
            purpose: 'Investigation procedures for potential data loss and exfiltration events',
            initialValidationSteps: [],
            sourceInvestigationSteps: [],
            containmentChecks: [],
            decisionGuidance: {
                escalateToIncident: '',
                resolveBenign: '',
                resolveFalsePositive: ''
            },
            createdBy: 'data-protection-team',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-05T00:00:00Z')
        },
        secondaryCount: 1 // playbook-012
    },
    {
        classification: 'behavioral',
        primaryPlaybook: {
            id: 'playbook-005',
            name: 'Behavioral Anomaly Analysis',
            version: '2.3',
            status: 'active' as const,
            purpose: 'Investigation procedures for behavioral and user activity anomalies',
            initialValidationSteps: [],
            sourceInvestigationSteps: [],
            containmentChecks: [],
            decisionGuidance: {
                escalateToIncident: '',
                resolveBenign: '',
                resolveFalsePositive: ''
            },
            createdBy: 'behavioral-analytics-team',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-15T00:00:00Z')
        },
        secondaryCount: 1 // playbook-012
    },
    {
        classification: 'brute_force',
        primaryPlaybook: {
            id: 'playbook-006',
            name: 'Brute Force Attack Response',
            version: '1.4',
            status: 'active' as const,
            purpose: 'Response procedures for brute force and credential stuffing attacks',
            initialValidationSteps: [],
            sourceInvestigationSteps: [],
            containmentChecks: [],
            decisionGuidance: {
                escalateToIncident: '',
                resolveBenign: '',
                resolveFalsePositive: ''
            },
            createdBy: 'authentication-security-team',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-18T00:00:00Z')
        },
        secondaryCount: 0
    },
    {
        classification: 'privilege_escalation',
        primaryPlaybook: {
            id: 'playbook-007',
            name: 'Privilege Escalation Investigation',
            version: '2.0',
            status: 'active' as const,
            purpose: 'Investigation procedures for unauthorized privilege escalation attempts',
            initialValidationSteps: [],
            sourceInvestigationSteps: [],
            containmentChecks: [],
            decisionGuidance: {
                escalateToIncident: '',
                resolveBenign: '',
                resolveFalsePositive: ''
            },
            createdBy: 'privilege-management-team',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-20T00:00:00Z')
        },
        secondaryCount: 0
    },
    {
        classification: 'suspicious_file',
        primaryPlaybook: {
            id: 'playbook-008',
            name: 'Suspicious File Activity Response',
            version: '1.7',
            status: 'active' as const,
            purpose: 'Investigation procedures for suspicious file creation, modification, or execution',
            initialValidationSteps: [],
            sourceInvestigationSteps: [],
            containmentChecks: [],
            decisionGuidance: {
                escalateToIncident: '',
                resolveBenign: '',
                resolveFalsePositive: ''
            },
            createdBy: 'file-analysis-team',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-22T00:00:00Z')
        },
        secondaryCount: 0
    },
    {
        classification: 'dns_anomaly',
        primaryPlaybook: {
            id: 'playbook-009',
            name: 'DNS Anomaly Investigation',
            version: '1.6',
            status: 'active' as const,
            purpose: 'Investigation procedures for suspicious DNS queries and domain communications',
            initialValidationSteps: [],
            sourceInvestigationSteps: [],
            containmentChecks: [],
            decisionGuidance: {
                escalateToIncident: '',
                resolveBenign: '',
                resolveFalsePositive: ''
            },
            createdBy: 'network-security-team',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-25T00:00:00Z')
        },
        secondaryCount: 0
    },
    {
        classification: 'account_compromise',
        primaryPlaybook: {
            id: 'playbook-010',
            name: 'Account Compromise Investigation',
            version: '2.2',
            status: 'active' as const,
            purpose: 'Investigation procedures for suspected user account compromise and unauthorized access',
            initialValidationSteps: [],
            sourceInvestigationSteps: [],
            containmentChecks: [],
            decisionGuidance: {
                escalateToIncident: '',
                resolveBenign: '',
                resolveFalsePositive: ''
            },
            createdBy: 'identity-security-team',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-28T00:00:00Z')
        },
        secondaryCount: 0
    },
    {
        classification: 'ransomware',
        primaryPlaybook: {
            id: 'playbook-011',
            name: 'Ransomware Response Protocol',
            version: '3.1',
            status: 'active' as const,
            purpose: 'Emergency response procedures for ransomware detection and containment',
            initialValidationSteps: [],
            sourceInvestigationSteps: [],
            containmentChecks: [],
            decisionGuidance: {
                escalateToIncident: '',
                resolveBenign: '',
                resolveFalsePositive: ''
            },
            createdBy: 'incident-response-team',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-30T00:00:00Z')
        },
        secondaryCount: 0
    },
    {
        classification: 'insider_threat',
        primaryPlaybook: {
            id: 'playbook-012',
            name: 'Insider Threat Assessment',
            version: '1.9',
            status: 'active' as const,
            purpose: 'Investigation procedures for potential insider threat activities and policy violations',
            initialValidationSteps: [],
            sourceInvestigationSteps: [],
            containmentChecks: [],
            decisionGuidance: {
                escalateToIncident: '',
                resolveBenign: '',
                resolveFalsePositive: ''
            },
            createdBy: 'insider-threat-team',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-02-01T00:00:00Z')
        },
        secondaryCount: 0
    },
    {
        classification: 'lateral_movement',
        primaryPlaybook: null,
        secondaryCount: 0
    }
];

export async function GET(request: NextRequest) {
    try {
        return NextResponse.json({
            success: true,
            data: mockClassifications
        });

    } catch (error) {
        console.error('Demo classifications API error:', error);
        return NextResponse.json({
            success: false,
            error: {
                code: 'DEMO_ERROR',
                message: 'Demo data error'
            }
        }, { status: 500 });
    }
}