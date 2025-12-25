/**
 * Demo API endpoints for Investigation Playbooks with mock data
 * 
 * Provides realistic mock data to demonstrate the SOC workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { InvestigationPlaybook } from '@/types/alerts-incidents';

// Mock playbooks data
const mockPlaybooks: InvestigationPlaybook[] = [
    {
        id: 'playbook-001',
        name: 'Malware Detection Response',
        version: '2.1',
        status: 'active',
        purpose: 'Standard response procedure for malware detection alerts from EDR systems',
        initialValidationSteps: [
            'Verify alert authenticity in Microsoft Defender portal',
            'Check if affected device is online and accessible',
            'Confirm malware signature and threat classification',
            'Review user activity at time of detection'
        ],
        sourceInvestigationSteps: [
            'Analyze malware execution path and entry vector',
            'Check for lateral movement indicators',
            'Review network connections and data access',
            'Examine file system changes and registry modifications',
            'Correlate with other security events in SIEM'
        ],
        containmentChecks: [
            'Isolate affected device from network',
            'Preserve forensic evidence',
            'Block malicious IPs/domains at firewall',
            'Update endpoint protection signatures',
            'Notify affected users and stakeholders'
        ],
        decisionGuidance: {
            escalateToIncident: 'Escalate if: (1) Malware spread to multiple systems, (2) Data exfiltration detected, (3) Critical system affected, (4) Advanced persistent threat indicators',
            resolveBenign: 'Resolve as benign if: (1) False positive confirmed by vendor, (2) Legitimate software flagged incorrectly, (3) Test file or sandbox execution',
            resolveFalsePositive: 'Mark false positive if: (1) Known good file incorrectly flagged, (2) Heuristic detection error confirmed, (3) Whitelist candidate identified'
        },
        createdBy: 'security-team',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-10T00:00:00Z')
    },
    {
        id: 'playbook-002',
        name: 'Network Intrusion Investigation',
        version: '1.8',
        status: 'active',
        purpose: 'Investigation procedures for network-based security alerts and intrusion attempts',
        initialValidationSteps: [
            'Verify firewall alert details and source IP',
            'Check threat intelligence for known bad actors',
            'Review network topology and affected segments',
            'Confirm alert timing and duration'
        ],
        sourceInvestigationSteps: [
            'Analyze network traffic patterns and protocols',
            'Review firewall and IDS logs for related events',
            'Check for successful vs. failed connection attempts',
            'Examine payload content if available',
            'Correlate with endpoint security events'
        ],
        containmentChecks: [
            'Block malicious IP addresses at perimeter',
            'Review and update firewall rules',
            'Monitor for continued attack attempts',
            'Check for compromised internal systems',
            'Implement additional network segmentation if needed'
        ],
        decisionGuidance: {
            escalateToIncident: 'Escalate if: (1) Successful system compromise detected, (2) Data access or exfiltration confirmed, (3) Persistent access established, (4) Multiple attack vectors used',
            resolveBenign: 'Resolve as benign if: (1) Legitimate security scanning, (2) Authorized penetration testing, (3) False positive from security tools',
            resolveFalsePositive: 'Mark false positive if: (1) Internal system misidentified, (2) Legitimate business traffic flagged, (3) Tool misconfiguration confirmed'
        },
        createdBy: 'network-security-team',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-08T00:00:00Z')
    },
    {
        id: 'playbook-003',
        name: 'Phishing Email Response',
        version: '3.0',
        status: 'active',
        purpose: 'Response procedures for phishing and malicious email detection alerts',
        initialValidationSteps: [
            'Review email headers and sender reputation',
            'Check attachment or link safety status',
            'Verify recipient list and delivery status',
            'Confirm email security system detection accuracy'
        ],
        sourceInvestigationSteps: [
            'Analyze email content and social engineering tactics',
            'Check for similar emails in organization',
            'Review sender domain and infrastructure',
            'Examine attachment behavior in sandbox',
            'Correlate with threat intelligence feeds'
        ],
        containmentChecks: [
            'Remove email from all recipient mailboxes',
            'Block sender domain and IP addresses',
            'Update email security rules and filters',
            'Notify affected users about the threat',
            'Monitor for credential compromise attempts'
        ],
        decisionGuidance: {
            escalateToIncident: 'Escalate if: (1) Users clicked links or opened attachments, (2) Credentials potentially compromised, (3) Malware payload delivered, (4) Targeted spear-phishing campaign',
            resolveBenign: 'Resolve as benign if: (1) Legitimate marketing email flagged, (2) Internal communication misclassified, (3) Known safe sender blocked',
            resolveFalsePositive: 'Mark false positive if: (1) Business partner email blocked incorrectly, (2) Security tool misconfiguration, (3) Legitimate service notification flagged'
        },
        createdBy: 'email-security-team',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-12T00:00:00Z')
    },
    {
        id: 'playbook-004',
        name: 'Data Exfiltration Investigation',
        version: '1.5',
        status: 'active',
        purpose: 'Investigation procedures for potential data loss and exfiltration events',
        initialValidationSteps: [
            'Verify data transfer volume and destination',
            'Check user authorization for data access',
            'Review business justification for transfer',
            'Confirm data classification and sensitivity'
        ],
        sourceInvestigationSteps: [
            'Analyze data access patterns and timing',
            'Review user behavior and access history',
            'Examine network protocols and encryption',
            'Check for data staging and compression',
            'Correlate with user authentication events'
        ],
        containmentChecks: [
            'Block external data transfer destinations',
            'Suspend user account if compromise suspected',
            'Preserve audit logs and forensic evidence',
            'Implement additional data loss prevention rules',
            'Notify legal and compliance teams'
        ],
        decisionGuidance: {
            escalateToIncident: 'Escalate if: (1) Unauthorized sensitive data accessed, (2) Large volume data transfer confirmed, (3) External threat actor suspected, (4) Regulatory compliance implications',
            resolveBenign: 'Resolve as benign if: (1) Authorized business data transfer, (2) Legitimate backup or sync operation, (3) Approved cloud migration activity',
            resolveFalsePositive: 'Mark false positive if: (1) DLP tool misconfiguration, (2) Legitimate file sharing flagged, (3) Business process misunderstood'
        },
        createdBy: 'data-protection-team',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-05T00:00:00Z')
    },
    {
        id: 'playbook-005',
        name: 'Behavioral Anomaly Analysis',
        version: '2.3',
        status: 'active',
        purpose: 'Investigation procedures for behavioral and user activity anomalies',
        initialValidationSteps: [
            'Review user baseline behavior patterns',
            'Check for recent account or role changes',
            'Verify system and application context',
            'Confirm anomaly detection algorithm accuracy'
        ],
        sourceInvestigationSteps: [
            'Analyze user activity timeline and patterns',
            'Review authentication and access logs',
            'Check for privilege escalation attempts',
            'Examine system and application interactions',
            'Correlate with HR and business context'
        ],
        containmentChecks: [
            'Monitor user activity closely',
            'Review and restrict excessive privileges',
            'Implement additional access controls',
            'Notify user manager if appropriate',
            'Document behavioral baseline updates'
        ],
        decisionGuidance: {
            escalateToIncident: 'Escalate if: (1) Insider threat indicators confirmed, (2) Unauthorized system access detected, (3) Data access outside normal scope, (4) Account compromise suspected',
            resolveBenign: 'Resolve as benign if: (1) Legitimate business activity change, (2) New role or responsibility, (3) Authorized system maintenance',
            resolveFalsePositive: 'Mark false positive if: (1) Algorithm tuning needed, (2) Baseline update required, (3) Business process change not reflected'
        },
        createdBy: 'behavioral-analytics-team',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-15T00:00:00Z')
    }
];

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const classification = searchParams.get('classification');
        const status = searchParams.get('status') || 'active';

        let filteredPlaybooks = mockPlaybooks;

        // Filter by status
        if (status !== 'all') {
            filteredPlaybooks = filteredPlaybooks.filter(playbook => playbook.status === status);
        }

        // Filter by classification if provided
        if (classification) {
            // In a real implementation, this would use the junction table
            // For demo, we'll match based on playbook purpose/name
            const classificationMap: Record<string, string[]> = {
                'malware': ['playbook-001'],
                'network_intrusion': ['playbook-002'],
                'phishing': ['playbook-003'],
                'data_loss': ['playbook-004'],
                'behavioral': ['playbook-005']
            };

            const relevantPlaybookIds = classificationMap[classification] || [];
            filteredPlaybooks = filteredPlaybooks.filter(playbook =>
                relevantPlaybookIds.includes(playbook.id)
            );
        }

        // Sort by name
        filteredPlaybooks.sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({
            success: true,
            data: {
                playbooks: filteredPlaybooks,
                pagination: {
                    page: 1,
                    limit: 50,
                    total: filteredPlaybooks.length
                },
                metadata: {
                    activeCount: mockPlaybooks.filter(p => p.status === 'active').length,
                    draftCount: mockPlaybooks.filter(p => p.status === 'draft').length,
                    deprecatedCount: mockPlaybooks.filter(p => p.status === 'deprecated').length,
                    classification: classification
                }
            }
        });

    } catch (error) {
        console.error('Demo playbooks API error:', error);
        return NextResponse.json({
            success: false,
            error: {
                code: 'DEMO_ERROR',
                message: 'Demo data error'
            }
        }, { status: 500 });
    }
}