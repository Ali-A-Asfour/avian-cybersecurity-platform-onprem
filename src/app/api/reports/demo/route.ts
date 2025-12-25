import { NextRequest, NextResponse } from 'next/server';
import { WeeklyReport, EnhancedDateRange, Slide, AlertsDigest, UpdatesSummary, VulnerabilityPosture } from '@/types/reports';

/**
 * Demo Reports API Endpoint
 * 
 * Generates a sample weekly report with realistic mock data
 * for testing the executive presentation and PDF export functionality.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const reportType = searchParams.get('type') || 'weekly';

        // Create realistic mock data
        const mockDateRange: EnhancedDateRange = {
            startDate: new Date('2024-12-09'),
            endDate: new Date('2024-12-15'),
            timezone: 'America/Toronto',
            weekStart: 'monday'
        };

        // Generate mock report based on type
        let report: WeeklyReport;

        if (reportType === 'weekly') {
            report = generateMockWeeklyReport(mockDateRange);
        } else if (reportType === 'monthly') {
            report = generateMockMonthlyReport(mockDateRange);
        } else if (reportType === 'quarterly') {
            report = generateMockQuarterlyReport(mockDateRange);
        } else {
            // Default to weekly for demo
            report = generateMockWeeklyReport(mockDateRange);
        }

        return NextResponse.json({
            success: true,
            data: report,
            message: 'Demo report generated successfully'
        });

    } catch (error) {
        console.error('Failed to generate demo report:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to generate demo report',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

function generateMockWeeklyReport(dateRange: EnhancedDateRange): WeeklyReport {
    const reportId = `demo-weekly-${Date.now()}`;

    // Mock alerts digest data
    const alertsDigest: AlertsDigest = {
        totalAlerts: 47,
        securityIncidents: 3,
        benignActivity: 41,
        falsePositives: 3,
        alertsByType: {
            phishing: 18,
            malware: 12,
            network: 8,
            authentication: 6,
            spyware: 2,
            other: 1
        },
        alertsBySource: {
            defender: 32,
            firewall: 15
        },
        weeklyTimeline: [
            { date: '2024-12-09', count: 8 },
            { date: '2024-12-10', count: 12 },
            { date: '2024-12-11', count: 6 },
            { date: '2024-12-12', count: 9 },
            { date: '2024-12-13', count: 7 },
            { date: '2024-12-14', count: 3 },
            { date: '2024-12-15', count: 2 }
        ]
    };

    // Mock updates summary data
    const updatesSummary: UpdatesSummary = {
        totalUpdatesApplied: 156,
        updatesByCategory: {
            windows: 89,
            office: 34,
            firewall: 18,
            other: 15
        },
        devicesUpdated: 24,
        totalDevices: 28,
        updateCompletionRate: 85.7
    };

    // Mock vulnerability posture data
    const vulnerabilityPosture: VulnerabilityPosture = {
        totalDetected: 23,
        totalMitigated: 18,
        mitigationRate: 78.3,
        severityBreakdown: {
            critical: 2,
            high: 7,
            medium: 14
        },
        topVulnerabilities: [
            { cveId: 'CVE-2024-1234', severity: 'critical', affectedDevices: 3 },
            { cveId: 'CVE-2024-5678', severity: 'high', affectedDevices: 8 },
            { cveId: 'CVE-2024-9012', severity: 'high', affectedDevices: 5 }
        ]
    };

    // Generate slides with executive presentation styling
    const slides: Slide[] = [
        // Executive Overview Slide
        {
            id: 'executive-overview',
            title: 'Executive Security Overview',
            layout: {
                type: 'executive-overview',
                orientation: 'landscape',
                theme: 'dark',
                branding: 'avian'
            },
            content: {
                heading: 'Weekly Security Performance Summary',
                subheading: 'December 9-15, 2024 | Reporting Period: 7 Days',
                summary: 'AVIAN\'s cybersecurity platform delivered exceptional protection this week, successfully processing 47 security alerts with 94% effectiveness, deploying 156 critical updates across your infrastructure, and maintaining robust vulnerability management with 78% mitigation rate. Your security investment continues to demonstrate measurable business value through proactive threat prevention and rapid response capabilities.',
                keyPoints: [
                    'Threat Protection: 47 alerts digested with 3 security incidents contained and resolved',
                    'Infrastructure Hardening: 156 updates deployed across 24 devices (86% completion rate)',
                    'Risk Reduction: 23 vulnerabilities identified with 18 successfully mitigated (78% resolution)',
                    'Business Continuity: Zero successful breaches or operational disruptions'
                ],
                callouts: [
                    {
                        type: 'success',
                        text: 'Security effectiveness 14% above industry benchmark',
                        icon: '📈'
                    },
                    {
                        type: 'highlight',
                        text: 'Recommended Action: Complete 4 pending device updates by end of week',
                        icon: '⚡'
                    }
                ]
            },
            charts: [
                {
                    id: 'security-overview-kpi',
                    type: 'progress',
                    title: 'Security Health Score',
                    data: {
                        labels: ['Threat Protection', 'Update Compliance', 'Vulnerability Management'],
                        datasets: [{
                            data: [94, 86, 78],
                            backgroundColor: ['#22c55e', '#fbbf24', '#FF6B35']
                        }]
                    },
                    styling: {
                        theme: 'dark',
                        colors: ['#22c55e', '#fbbf24', '#FF6B35'],
                        fontSize: 14
                    }
                }
            ]
        },

        // Alerts Digest Slide
        {
            id: 'alerts-digest',
            title: 'Security Alerts Analysis',
            layout: {
                type: 'alerts-digest',
                orientation: 'landscape',
                theme: 'dark',
                branding: 'avian'
            },
            content: {
                heading: 'Alerts Digested & Threat Response',
                summary: 'AVIAN\'s advanced threat detection systems successfully digested 47 security alerts this week, demonstrating the value of proactive monitoring. With 94% of alerts classified as benign activity or false positives, our intelligent filtering prevented alert fatigue while ensuring genuine threats received immediate attention. All 3 security incidents were contained within established SLA timeframes.',
                keyPoints: [
                    'Phishing Prevention: 18 attempts blocked before reaching users (38% of total alerts)',
                    'Malware Protection: 12 malicious files quarantined and neutralized',
                    'Network Security: 8 anomalies investigated with zero business impact',
                    'Access Control: 6 authentication events validated for compliance'
                ],
                callouts: [
                    {
                        type: 'success',
                        text: '47 alerts digested with 94% accuracy - delivering measurable security value',
                        icon: '🛡️'
                    },
                    {
                        type: 'info',
                        text: 'Trend Alert: Phishing attempts increased 15% - enhanced training recommended',
                        icon: '📊'
                    }
                ]
            },
            charts: [
                {
                    id: 'alerts-by-type',
                    type: 'donut',
                    title: 'Alert Distribution by Type',
                    data: {
                        labels: ['Phishing', 'Malware', 'Network', 'Authentication', 'Spyware', 'Other'],
                        datasets: [{
                            data: [18, 12, 8, 6, 2, 1],
                            backgroundColor: ['#ef4444', '#FF6B35', '#fbbf24', '#22c55e', '#8b5cf6', '#6b7280']
                        }]
                    },
                    styling: {
                        theme: 'dark',
                        colors: ['#ef4444', '#FF6B35', '#fbbf24', '#22c55e', '#8b5cf6', '#6b7280'],
                        fontSize: 12
                    }
                },
                {
                    id: 'weekly-timeline',
                    type: 'bar',
                    title: 'Daily Alert Volume',
                    data: {
                        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                        datasets: [{
                            label: 'Alerts',
                            data: [8, 12, 6, 9, 7, 3, 2],
                            backgroundColor: '#00D4FF'
                        }]
                    },
                    styling: {
                        theme: 'dark',
                        colors: ['#00D4FF'],
                        fontSize: 12
                    }
                }
            ]
        },

        // Updates Summary Slide
        {
            id: 'updates-summary',
            title: 'Security Updates & Maintenance',
            layout: {
                type: 'updates-summary',
                orientation: 'landscape',
                theme: 'dark',
                branding: 'avian'
            },
            content: {
                heading: 'Updates Applied & Infrastructure Hardening',
                summary: 'AVIAN delivered comprehensive infrastructure protection this week through strategic deployment of 156 critical updates across your environment. With 86% device compliance achieved, your organization maintains robust defense against known vulnerabilities and emerging threats, demonstrating proactive security management.',
                keyPoints: [
                    'Windows Updates: 89 security patches deployed across workstations and servers',
                    'Microsoft Office Updates: 34 productivity and security enhancements applied',
                    'Firewall Updates: 18 firmware and security rule improvements implemented',
                    'Device Coverage: 24 of 28 devices updated (4 scheduled for maintenance window)'
                ],
                callouts: [
                    {
                        type: 'success',
                        text: 'Update deployment rate 14% above industry benchmark',
                        icon: '🚀'
                    },
                    {
                        type: 'highlight',
                        text: 'Business Value: 156 updates applied with zero operational disruption',
                        icon: '💼'
                    }
                ]
            },
            charts: [
                {
                    id: 'updates-by-category',
                    type: 'bar',
                    title: 'Updates by Category',
                    data: {
                        labels: ['Windows', 'Office', 'Firewall', 'Other'],
                        datasets: [{
                            label: 'Updates Applied',
                            data: [89, 34, 18, 15],
                            backgroundColor: ['#00D4FF', '#22c55e', '#FF6B35', '#8b5cf6']
                        }]
                    },
                    styling: {
                        theme: 'dark',
                        colors: ['#00D4FF', '#22c55e', '#FF6B35', '#8b5cf6'],
                        fontSize: 12
                    }
                },
                {
                    id: 'device-compliance',
                    type: 'progress',
                    title: 'Device Update Compliance',
                    data: {
                        labels: ['Updated', 'Pending'],
                        datasets: [{
                            data: [86, 14],
                            backgroundColor: ['#22c55e', '#fbbf24']
                        }]
                    },
                    styling: {
                        theme: 'dark',
                        colors: ['#22c55e', '#fbbf24'],
                        fontSize: 14
                    }
                }
            ]
        },

        // Vulnerability Management Slide
        {
            id: 'vulnerability-posture',
            title: 'Vulnerability Management',
            layout: {
                type: 'vulnerability-posture',
                orientation: 'landscape',
                theme: 'dark',
                branding: 'avian'
            },
            content: {
                heading: 'Vulnerability Management & Risk Reduction',
                summary: 'AVIAN\'s proactive vulnerability management program identified and addressed 23 security exposures this week, achieving a 78% mitigation rate that significantly reduces your organization\'s attack surface. Our rapid response capabilities ensure critical vulnerabilities are patched within 24 hours, maintaining strong defensive posture.',
                keyPoints: [
                    'Critical Risk Elimination: 2 critical vulnerabilities detected and patched within 24 hours',
                    'High-Risk Mitigation: 7 high-severity exposures identified with 6 successfully resolved',
                    'Proactive Defense: 14 medium-risk items addressed through automated remediation',
                    'Continuous Protection: Advanced monitoring active for zero-day threats'
                ],
                callouts: [
                    {
                        type: 'success',
                        text: 'Vulnerability response time 40% faster than industry benchmark',
                        icon: '🎯'
                    },
                    {
                        type: 'highlight',
                        text: 'Risk Reduction: 78% mitigation rate demonstrates effective security investment',
                        icon: '📉'
                    }
                ]
            },
            charts: [
                {
                    id: 'vulnerability-severity',
                    type: 'donut',
                    title: 'Vulnerabilities by Severity',
                    data: {
                        labels: ['Critical', 'High', 'Medium'],
                        datasets: [{
                            data: [2, 7, 14],
                            backgroundColor: ['#ef4444', '#FF6B35', '#fbbf24']
                        }]
                    },
                    styling: {
                        theme: 'dark',
                        colors: ['#ef4444', '#FF6B35', '#fbbf24'],
                        fontSize: 12
                    }
                },
                {
                    id: 'mitigation-progress',
                    type: 'progress',
                    title: 'Mitigation Progress',
                    data: {
                        labels: ['Resolved', 'In Progress'],
                        datasets: [{
                            data: [78, 22],
                            backgroundColor: ['#22c55e', '#fbbf24']
                        }]
                    },
                    styling: {
                        theme: 'dark',
                        colors: ['#22c55e', '#fbbf24'],
                        fontSize: 14
                    }
                }
            ]
        }
    ];

    return {
        id: reportId,
        tenantId: 'demo-tenant',
        reportType: 'weekly',
        dateRange,
        slides,
        generatedAt: new Date(),
        templateVersion: '2.0.0',
        dataSchemaVersion: '2.0.0',
        alertsDigest,
        updatesSummary,
        vulnerabilityPosture,
        executiveSummary: 'This week demonstrated the strength of your cybersecurity investment, with AVIAN successfully protecting against 47 security threats while maintaining 86% update compliance and achieving a 78% vulnerability mitigation rate. Your security posture remains excellent with zero successful breaches.',
        keyTakeaways: [
            'Threat protection operating at 94% effectiveness with rapid incident response',
            'Infrastructure hardening progressing ahead of schedule with strong update compliance',
            'Vulnerability management exceeding industry benchmarks for response time'
        ],
        recommendedActions: [
            'Complete pending updates on 4 remaining devices by end of week',
            'Consider additional phishing awareness training due to increased activity',
            'Schedule quarterly security review to maintain current excellence'
        ]
    };
}