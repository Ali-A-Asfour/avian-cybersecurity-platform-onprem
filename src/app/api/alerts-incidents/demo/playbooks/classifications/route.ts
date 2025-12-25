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
        secondaryCount: 0
    },
    {
        classification: 'network_intrusion',
        primaryPlaybook: {
            id: 'playbook-002',
            name: 'Network Intrusion Investigation',
            version: '1.8',
            status: 'active' as const,
            purpose: 'Investigation procedures for network-based security alerts and intrusion attempts',
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
        secondaryCount: 0
    },
    {
        classification: 'phishing',
        primaryPlaybook: {
            id: 'playbook-003',
            name: 'Phishing Email Response',
            version: '3.0',
            status: 'active' as const,
            purpose: 'Response procedures for phishing and malicious email detection alerts',
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
        secondaryCount: 0
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
        secondaryCount: 0
    },
    {
        classification: 'privilege_escalation',
        primaryPlaybook: null,
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