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
        quickResponseGuide: [
            'Verify the malware detection is legitimate and not a false positive by checking file reputation and sandbox analysis',
            'Check for signs of compromise including lateral movement, data access, persistence mechanisms, or system modifications',
            'If compromise detected: immediately isolate affected device, disable user account if compromised, and escalate to security incident'
        ],
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
        quickResponseGuide: [
            'Verify the network activity is unexpected by checking source IP reputation, business justification, and normal traffic patterns',
            'Check for signs of compromise including successful connections, data exfiltration, internal reconnaissance, or persistent access',
            'If compromise detected: block malicious IPs, isolate affected systems, disable compromised accounts, and escalate to security incident'
        ],
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
        quickResponseGuide: [
            'Verify the email is malicious by checking sender reputation, attachment analysis, and link safety status',
            'Check for signs of compromise including user clicks, credential entry, malware execution, or account access anomalies',
            'If compromise detected: reset user passwords, revoke sessions, isolate affected devices, and escalate to security incident'
        ],
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
        quickResponseGuide: [
            'Verify the data transfer is unauthorized by checking business justification, user permissions, and transfer destinations',
            'Check for signs of compromise including unauthorized data access, large volume transfers, external destinations, or staging activities',
            'If compromise detected: block transfer destinations, suspend user account, preserve evidence, and escalate to security incident'
        ],
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
        quickResponseGuide: [
            'Verify the behavior is unexpected by checking user baseline patterns, recent role changes, and business context',
            'Check for signs of compromise including privilege escalation, unauthorized access, data exfiltration, or insider threat indicators',
            'If compromise detected: monitor user activity, restrict privileges, disable account if necessary, and escalate to security incident'
        ],
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
    },
    {
        id: 'playbook-006',
        name: 'Brute Force Attack Response',
        version: '1.4',
        status: 'active',
        purpose: 'Response procedures for brute force and credential stuffing attacks',
        quickResponseGuide: [
            'Verify the authentication attempts are malicious by checking source IP reputation, attack patterns, and user context',
            'Check for signs of compromise including successful logins, account lockouts, credential stuffing, or coordinated attacks',
            'If compromise detected: block attacking IPs, reset targeted passwords, disable compromised accounts, and escalate to security incident'
        ],
        initialValidationSteps: [
            'Verify attack source IP and geolocation',
            'Check failed login attempt count and timeframe',
            'Confirm targeted accounts and services',
            'Review authentication system logs for patterns'
        ],
        sourceInvestigationSteps: [
            'Analyze attack vectors and protocols used',
            'Check for successful authentication attempts',
            'Review password policy compliance',
            'Examine user account lockout status',
            'Correlate with threat intelligence on attack patterns'
        ],
        containmentChecks: [
            'Block attacking IP addresses at firewall',
            'Implement rate limiting on authentication services',
            'Force password reset for targeted accounts',
            'Enable additional MFA requirements',
            'Monitor for account compromise indicators'
        ],
        decisionGuidance: {
            escalateToIncident: 'Escalate if: (1) Successful account compromise detected, (2) Administrative accounts targeted, (3) Coordinated attack from multiple sources, (4) Sensitive system access attempted',
            resolveBenign: 'Resolve as benign if: (1) User legitimately forgot password, (2) Automated system authentication retry, (3) Load testing or authorized security testing',
            resolveFalsePositive: 'Mark false positive if: (1) Legitimate user with connectivity issues, (2) Application misconfiguration causing retries, (3) VPN reconnection attempts'
        },
        createdBy: 'authentication-security-team',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-18T00:00:00Z')
    },
    {
        id: 'playbook-007',
        name: 'Privilege Escalation Investigation',
        version: '2.0',
        status: 'active',
        purpose: 'Investigation procedures for unauthorized privilege escalation attempts',
        quickResponseGuide: [
            'Verify the privilege escalation is unauthorized by checking user permissions, business justification, and escalation methods',
            'Check for signs of compromise including successful escalation, administrative access, vulnerability exploitation, or lateral movement',
            'If compromise detected: revoke elevated privileges, isolate affected systems, disable user account, and escalate to security incident'
        ],
        initialValidationSteps: [
            'Verify user current vs. attempted privilege levels',
            'Check recent role or permission changes',
            'Review system and application access logs',
            'Confirm escalation method and tools used'
        ],
        sourceInvestigationSteps: [
            'Analyze privilege escalation techniques employed',
            'Review user activity leading up to attempt',
            'Check for exploitation of known vulnerabilities',
            'Examine system configuration and security controls',
            'Correlate with endpoint detection and response data'
        ],
        containmentChecks: [
            'Revoke elevated privileges immediately',
            'Isolate affected systems if compromise suspected',
            'Review and patch vulnerable components',
            'Implement additional access controls',
            'Monitor user activity for further attempts'
        ],
        decisionGuidance: {
            escalateToIncident: 'Escalate if: (1) Successful privilege escalation confirmed, (2) Administrative access gained, (3) System compromise indicators present, (4) Multiple escalation attempts detected',
            resolveBenign: 'Resolve as benign if: (1) Legitimate administrative request, (2) Authorized system maintenance, (3) Application normal operation requiring elevation',
            resolveFalsePositive: 'Mark false positive if: (1) Security tool misconfiguration, (2) Normal application behavior flagged, (3) Legitimate service account activity'
        },
        createdBy: 'privilege-management-team',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-20T00:00:00Z')
    },
    {
        id: 'playbook-008',
        name: 'Suspicious File Activity Response',
        version: '1.7',
        status: 'active',
        purpose: 'Investigation procedures for suspicious file creation, modification, or execution',
        quickResponseGuide: [
            'Verify the file activity is malicious by checking file reputation, digital signatures, and execution context',
            'Check for signs of compromise including malware execution, system modifications, persistence mechanisms, or data access',
            'If compromise detected: quarantine files, isolate affected endpoints, disable user account if compromised, and escalate to security incident'
        ],
        initialValidationSteps: [
            'Verify file hash and digital signature',
            'Check file location and naming patterns',
            'Review file creation and modification timestamps',
            'Confirm user context and process execution'
        ],
        sourceInvestigationSteps: [
            'Analyze file content and behavior in sandbox',
            'Check file reputation in threat intelligence',
            'Review parent process and execution chain',
            'Examine file system and registry changes',
            'Correlate with network activity and communications'
        ],
        containmentChecks: [
            'Quarantine suspicious files immediately',
            'Block file hash across all systems',
            'Isolate affected endpoints if needed',
            'Update endpoint protection signatures',
            'Preserve forensic evidence for analysis'
        ],
        decisionGuidance: {
            escalateToIncident: 'Escalate if: (1) Malicious file confirmed by analysis, (2) System compromise indicators present, (3) Data access or modification detected, (4) Persistence mechanisms identified',
            resolveBenign: 'Resolve as benign if: (1) Legitimate business file flagged, (2) Known good software component, (3) Authorized system administration tool',
            resolveFalsePositive: 'Mark false positive if: (1) Security tool heuristic error, (2) Legitimate file incorrectly flagged, (3) Business application component misidentified'
        },
        createdBy: 'file-analysis-team',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-22T00:00:00Z')
    },
    {
        id: 'playbook-009',
        name: 'DNS Anomaly Investigation',
        version: '1.6',
        status: 'active',
        purpose: 'Investigation procedures for suspicious DNS queries and domain communications',
        quickResponseGuide: [
            'Verify the DNS activity is malicious by checking domain reputation, query patterns, and requesting system context',
            'Check for signs of compromise including command and control communication, DNS tunneling, data exfiltration, or malware beaconing',
            'If compromise detected: block malicious domains, isolate affected systems, disable compromised accounts, and escalate to security incident'
        ],
        initialValidationSteps: [
            'Verify DNS query patterns and frequency',
            'Check domain reputation and categorization',
            'Review requesting system and user context',
            'Confirm DNS resolution and response data'
        ],
        sourceInvestigationSteps: [
            'Analyze domain registration and infrastructure',
            'Check for domain generation algorithm patterns',
            'Review DNS tunneling or exfiltration indicators',
            'Examine related network communications',
            'Correlate with threat intelligence feeds'
        ],
        containmentChecks: [
            'Block malicious domains at DNS resolver',
            'Monitor systems making suspicious queries',
            'Update DNS filtering and security policies',
            'Check for malware or compromise indicators',
            'Implement additional network monitoring'
        ],
        decisionGuidance: {
            escalateToIncident: 'Escalate if: (1) Malware command and control confirmed, (2) Data exfiltration via DNS detected, (3) Multiple systems affected, (4) Advanced persistent threat indicators',
            resolveBenign: 'Resolve as benign if: (1) Legitimate business domain access, (2) CDN or cloud service communication, (3) Authorized security testing',
            resolveFalsePositive: 'Mark false positive if: (1) DNS security tool misconfiguration, (2) Legitimate domain incorrectly categorized, (3) Business application communication flagged'
        },
        createdBy: 'network-security-team',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-25T00:00:00Z')
    },
    {
        id: 'playbook-010',
        name: 'Account Compromise Investigation',
        version: '2.2',
        status: 'active',
        purpose: 'Investigation procedures for suspected user account compromise and unauthorized access',
        quickResponseGuide: [
            'Verify the account activity is unauthorized by checking login patterns, locations, and user-reported suspicious activity',
            'Check for signs of compromise including unauthorized data access, concurrent sessions, credential theft, or lateral movement',
            'If compromise detected: force password reset, revoke sessions, isolate affected devices, and escalate to security incident'
        ],
        initialValidationSteps: [
            'Verify unusual login patterns and locations',
            'Check for concurrent sessions from different locations',
            'Review recent password changes and MFA status',
            'Confirm user-reported suspicious activity'
        ],
        sourceInvestigationSteps: [
            'Analyze authentication logs and session data',
            'Review user activity and data access patterns',
            'Check for credential theft or phishing indicators',
            'Examine email and communication activity',
            'Correlate with endpoint security events'
        ],
        containmentChecks: [
            'Force immediate password reset and logout',
            'Revoke active sessions and tokens',
            'Enable enhanced MFA requirements',
            'Monitor account activity closely',
            'Notify user and provide security guidance'
        ],
        decisionGuidance: {
            escalateToIncident: 'Escalate if: (1) Unauthorized data access confirmed, (2) Administrative account compromised, (3) Lateral movement detected, (4) Persistent access mechanisms found',
            resolveBenign: 'Resolve as benign if: (1) User traveling or working remotely, (2) Legitimate device or location change, (3) User-initiated security actions',
            resolveFalsePositive: 'Mark false positive if: (1) Geolocation service error, (2) VPN or proxy usage flagged, (3) Mobile device location variance'
        },
        createdBy: 'identity-security-team',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-28T00:00:00Z')
    },
    {
        id: 'playbook-011',
        name: 'Ransomware Response Protocol',
        version: '3.1',
        status: 'active',
        purpose: 'Emergency response procedures for ransomware detection and containment',
        quickResponseGuide: [
            'Verify ransomware activity by confirming file encryption, ransom notes, and infection indicators',
            'Check for signs of lateral movement including network propagation, additional infected systems, or persistence mechanisms',
            'IMMEDIATELY isolate all affected systems, shut down network shares, disable user accounts, and escalate to security incident - NO EXCEPTIONS'
        ],
        initialValidationSteps: [
            'Confirm ransomware indicators and file encryption',
            'Identify patient zero and initial infection vector',
            'Assess scope of affected systems and data',
            'Verify backup integrity and availability'
        ],
        sourceInvestigationSteps: [
            'Analyze ransomware variant and capabilities',
            'Trace lateral movement and propagation methods',
            'Review network segmentation effectiveness',
            'Examine persistence and recovery mechanisms',
            'Coordinate with threat intelligence and law enforcement'
        ],
        containmentChecks: [
            'Immediately isolate all affected systems',
            'Shut down network shares and remote access',
            'Preserve forensic evidence and memory dumps',
            'Activate incident response team and communications',
            'Begin backup restoration procedures'
        ],
        decisionGuidance: {
            escalateToIncident: 'ALWAYS ESCALATE - Ransomware requires immediate incident response with executive notification and potential external assistance',
            resolveBenign: 'DO NOT resolve as benign - All ransomware alerts require full investigation and incident escalation',
            resolveFalsePositive: 'Mark false positive ONLY if: (1) Security tool testing confirmed, (2) Simulation exercise verified, (3) File corruption misidentified as encryption'
        },
        createdBy: 'incident-response-team',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-30T00:00:00Z')
    },
    {
        id: 'playbook-012',
        name: 'Insider Threat Assessment',
        version: '1.9',
        status: 'active',
        purpose: 'Investigation procedures for potential insider threat activities and policy violations',
        quickResponseGuide: [
            'Verify the activity is unauthorized by checking job requirements, business justification, and employee status',
            'Check for signs of malicious intent including unauthorized data access, policy violations, suspicious communications, or data staging',
            'If malicious activity detected: monitor without alerting subject, preserve evidence, coordinate with HR/legal, and escalate to security incident'
        ],
        initialValidationSteps: [
            'Review employee status and recent changes',
            'Check data access patterns against job requirements',
            'Verify business justification for activities',
            'Confirm detection accuracy and context'
        ],
        sourceInvestigationSteps: [
            'Analyze user behavior patterns and deviations',
            'Review data download and transfer activities',
            'Check for policy violations and unauthorized access',
            'Examine communication and collaboration patterns',
            'Coordinate with HR and legal teams as appropriate'
        ],
        containmentChecks: [
            'Monitor user activity without alerting subject',
            'Preserve audit logs and evidence',
            'Implement additional access controls if needed',
            'Coordinate with management and legal counsel',
            'Document all investigative activities'
        ],
        decisionGuidance: {
            escalateToIncident: 'Escalate if: (1) Unauthorized data access confirmed, (2) Policy violations with security impact, (3) Malicious intent suspected, (4) Legal or regulatory implications',
            resolveBenign: 'Resolve as benign if: (1) Legitimate business activity confirmed, (2) Job role change explains behavior, (3) Authorized project work',
            resolveFalsePositive: 'Mark false positive if: (1) Behavioral analytics tuning needed, (2) Business process change not reflected, (3) System configuration issue'
        },
        createdBy: 'insider-threat-team',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-02-01T00:00:00Z')
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
            // Each classification gets exactly one most relevant playbook
            const classificationMap: Record<string, string[]> = {
                'malware': ['playbook-001'], // Malware Detection Response (most specific)
                'network_intrusion': ['playbook-002'], // Network Intrusion Investigation
                'phishing': ['playbook-003'], // Phishing Email Response
                'data_loss': ['playbook-004'], // Data Exfiltration Investigation
                'behavioral': ['playbook-005'], // Behavioral Anomaly Analysis
                'brute_force': ['playbook-006'], // Brute Force Attack Response
                'privilege_escalation': ['playbook-007'], // Privilege Escalation Investigation
                'suspicious_file': ['playbook-008'], // Suspicious File Activity Response
                'dns_anomaly': ['playbook-009'], // DNS Anomaly Investigation
                'account_compromise': ['playbook-010'], // Account Compromise Investigation
                'ransomware': ['playbook-011'], // Ransomware Response Protocol
                'insider_threat': ['playbook-012'] // Insider Threat Assessment
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

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { playbook, classifications } = body;

        // In demo mode, simulate creating a new playbook
        const newPlaybook: InvestigationPlaybook = {
            id: `playbook-${Date.now()}`,
            name: playbook.name,
            version: playbook.version || '1.0',
            status: playbook.status || 'draft',
            purpose: playbook.purpose,
            quickResponseGuide: playbook.quickResponseGuide || [],
            initialValidationSteps: playbook.initialValidationSteps || [],
            sourceInvestigationSteps: playbook.sourceInvestigationSteps || [],
            containmentChecks: playbook.containmentChecks || [],
            decisionGuidance: playbook.decisionGuidance || {
                escalateToIncident: '',
                resolveBenign: '',
                resolveFalsePositive: ''
            },
            createdBy: playbook.createdBy || 'demo-user',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // In a real implementation, this would save to database
        // For demo, we'll just return success
        console.log('Demo: Created playbook', newPlaybook.name, 'with classifications', classifications);

        return NextResponse.json({
            success: true,
            data: {
                id: newPlaybook.id,
                message: 'Playbook created successfully (demo mode)'
            }
        }, { status: 201 });

    } catch (error) {
        console.error('Demo create playbook error:', error);
        return NextResponse.json({
            success: false,
            error: {
                code: 'DEMO_ERROR',
                message: 'Failed to create playbook in demo mode'
            }
        }, { status: 500 });
    }
}