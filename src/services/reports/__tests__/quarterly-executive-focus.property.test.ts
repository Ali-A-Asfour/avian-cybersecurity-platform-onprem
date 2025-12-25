/**
 * Property-Based Test: Quarterly Executive Focus
 * 
 * **Feature: avian-reports-module, Property 10: Quarterly executive focus**
 * **Validates: Requirements 6.1, 6.2, 6.3**
 * 
 * This test validates that quarterly reports are 3-5 slides focused on business impact,
 * excluding technical details and individual alert information.
 */

import * as fc from 'fast-check';
import { ReportGenerator } from '../ReportGenerator';
import { DataAggregator } from '../DataAggregator';
import { TemplateEngine } from '../TemplateEngine';
import { HistoricalDataStore } from '../HistoricalDataStore';
import { ReportSnapshotService } from '../ReportSnapshotService';
import { ReportCacheService } from '../ReportCacheService';
import { generators } from './generators';
import {
    QuarterlyReport,
    AlertClassification,
    AlertSeverity,
    AlertSource
} from '@/types/reports';

// Mock dependencies
jest.mock('../HistoricalDataStore');
jest.mock('../ReportSnapshotService');
jest.mock('../ReportCacheService');

describe('Property-Based Test: Quarterly Executive Focus', () => {
    let reportGenerator: ReportGenerator;
    let mockDataAggregator: jest.Mocked<DataAggregator>;
    let mockTemplateEngine: jest.Mocked<TemplateEngine>;
    let mockHistoricalDataStore: jest.Mocked<HistoricalDataStore>;
    let mockSnapshotService: jest.Mocked<ReportSnapshotService>;
    let mockCacheService: jest.Mocked<ReportCacheService>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mocked dependencies
        mockHistoricalDataStore = new HistoricalDataStore() as jest.Mocked<HistoricalDataStore>;
        mockDataAggregator = new DataAggregator(
            mockHistoricalDataStore,
            {} as any,
            {} as any
        ) as jest.Mocked<DataAggregator>;
        mockTemplateEngine = new TemplateEngine() as jest.Mocked<TemplateEngine>;
        mockSnapshotService = new ReportSnapshotService() as jest.Mocked<ReportSnapshotService>;
        mockCacheService = new ReportCacheService() as jest.Mocked<ReportCacheService>;

        reportGenerator = new ReportGenerator(
            mockDataAggregator,
            mockTemplateEngine,
            mockHistoricalDataStore,
            mockSnapshotService,
            mockCacheService
        );

        // Setup default mocks
        mockCacheService.getCachedReport = jest.fn().mockResolvedValue(null);
        mockCacheService.cacheReport = jest.fn().mockResolvedValue(undefined);
        mockSnapshotService.createSnapshot = jest.fn().mockResolvedValue({
            id: 'snapshot-123',
            tenantId: 'tenant-123',
            reportId: 'report-123',
            reportType: 'quarterly',
            dateRange: expect.any(Object),
            generatedAt: expect.any(Date),
            generatedBy: 'user-123',
            slideData: [],
            templateVersion: '1.0.0',
            dataSchemaVersion: '1.0.0',
            isArchived: false
        });
    });

    /**
     * Property 10: Quarterly executive focus
     * For any quarterly report, the output should be 3-5 slides focused on business impact,
     * excluding technical details and individual alert information
     */
    it('should generate 3-5 slides focused on business impact without technical details', () => {
        /**
         * **Feature: avian-reports-module, Property 10: Quarterly executive focus**
         * **Validates: Requirements 6.1, 6.2, 6.3**
         */
        fc.assert(
            fc.property(
                generators.tenantId,
                generators.enhancedDateRange,
                generators.userId,
                fc.integer({ min: 50, max: 500 }), // Total alerts for quarter
                fc.integer({ min: 10, max: 100 }), // Total vulnerabilities
                fc.integer({ min: 100, max: 1000 }), // Total updates
                async (tenantId, dateRange, userId, totalAlerts, totalVulns, totalUpdates) => {
                    // Setup quarterly business-focused data (no technical details)
                    const mockQuarterlyData = {
                        securityPosture: {
                            overallRiskReduction: fc.sample(fc.integer({ min: 10, max: 50 }), 1)[0], // 10-50% reduction
                            threatsBlocked: totalAlerts,
                            vulnerabilitiesRemediated: Math.floor(totalVulns * 0.8), // 80% remediation rate
                            securityIncidents: Math.floor(totalAlerts * 0.05), // 5% escalation rate
                            businessImpactPrevented: fc.sample(fc.integer({ min: 50000, max: 500000 }), 1)[0] // Dollar value
                        },
                        businessValue: {
                            downtimePrevented: fc.sample(fc.integer({ min: 2, max: 24 }), 1)[0], // Hours
                            complianceStatus: 'Maintained',
                            riskMitigationScore: fc.sample(fc.integer({ min: 75, max: 95 }), 1)[0], // Score out of 100
                            executiveSummary: 'Security posture strengthened with proactive threat management'
                        },
                        quarterlyTrends: {
                            incidentTrend: fc.sample(['decreasing', 'stable', 'improving'], 1)[0],
                            vulnerabilityTrend: 'decreasing',
                            updateComplianceTrend: 'improving'
                        }
                    };

                    // Mock aggregator methods to return business-focused data
                    mockDataAggregator.getQuarterlyBusinessMetrics = jest.fn().mockResolvedValue(mockQuarterlyData);

                    // Mock basic data (should be abstracted in quarterly report)
                    mockDataAggregator.getAlertsDigest = jest.fn().mockResolvedValue({
                        totalAlertsDigested: totalAlerts,
                        alertClassification: {
                            [AlertClassification.PHISHING]: Math.floor(totalAlerts * 0.3),
                            [AlertClassification.MALWARE]: Math.floor(totalAlerts * 0.25),
                            [AlertClassification.SPYWARE]: Math.floor(totalAlerts * 0.15),
                            [AlertClassification.AUTHENTICATION]: Math.floor(totalAlerts * 0.1),
                            [AlertClassification.NETWORK]: Math.floor(totalAlerts * 0.1),
                            [AlertClassification.OTHER]: Math.floor(totalAlerts * 0.1)
                        },
                        alertOutcomes: {
                            securityIncidents: Math.floor(totalAlerts * 0.05),
                            benignActivity: Math.floor(totalAlerts * 0.8),
                            falsePositives: Math.floor(totalAlerts * 0.15)
                        },
                        weeklyTimeline: [], // Not relevant for quarterly
                        sourceBreakdown: {
                            [AlertSource.DEFENDER]: Math.floor(totalAlerts * 0.4),
                            [AlertSource.SONICWALL]: Math.floor(totalAlerts * 0.3),
                            [AlertSource.AVAST]: Math.floor(totalAlerts * 0.2),
                            [AlertSource.FIREWALL_EMAIL]: Math.floor(totalAlerts * 0.1)
                        }
                    });

                    mockDataAggregator.getVulnerabilityPosture = jest.fn().mockResolvedValue({
                        totalDetected: totalVulns,
                        totalMitigated: Math.floor(totalVulns * 0.8),
                        riskReductionTrend: {
                            quarterStart: totalVulns,
                            quarterEnd: Math.floor(totalVulns * 0.2), // 80% reduction
                            percentReduction: 80
                        }
                    });

                    mockDataAggregator.getUpdatesSummary = jest.fn().mockResolvedValue({
                        totalUpdatesApplied: totalUpdates,
                        updatesBySource: {
                            windows: Math.floor(totalUpdates * 0.5),
                            microsoftOffice: Math.floor(totalUpdates * 0.2),
                            firewall: Math.floor(totalUpdates * 0.2),
                            other: Math.floor(totalUpdates * 0.1)
                        }
                    });

                    // Generate quarterly report
                    const quarterlyReport = await reportGenerator.generateQuarterlyReport(tenantId, dateRange, userId);

                    // Property 1: Report should have 3-5 slides
                    expect(quarterlyReport.slides).toBeDefined();
                    expect(Array.isArray(quarterlyReport.slides)).toBe(true);
                    expect(quarterlyReport.slides.length).toBeGreaterThanOrEqual(3);
                    expect(quarterlyReport.slides.length).toBeLessThanOrEqual(5);

                    // Property 2: Focus on business impact, not technical details
                    quarterlyReport.slides.forEach(slide => {
                        // Slide titles should be business-focused
                        expect(slide.title).toBeDefined();
                        expect(typeof slide.title).toBe('string');

                        // Should contain business terms, not technical jargon
                        const businessTerms = /security posture|risk reduction|business value|executive summary|compliance|downtime|incidents prevented/i;
                        const technicalTerms = /alert-\d+|CVE-\d+|vulnerability scan|firewall rule|registry key|process id|memory dump/i;

                        expect(slide.title).toMatch(businessTerms);
                        expect(slide.title).not.toMatch(technicalTerms);

                        // Content should be executive-friendly
                        if (slide.content) {
                            const contentStr = JSON.stringify(slide.content);

                            // Should not contain technical identifiers
                            expect(contentStr).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i); // UUIDs
                            expect(contentStr).not.toMatch(/alert-\d+/i); // Alert IDs
                            expect(contentStr).not.toMatch(/CVE-\d{4}-\d+/i); // CVE numbers
                            expect(contentStr).not.toMatch(/0x[0-9a-f]+/i); // Hex addresses
                            expect(contentStr).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/); // IP addresses
                        }
                    });

                    // Property 3: Should exclude individual alert information
                    const reportStr = JSON.stringify(quarterlyReport);

                    // Should not contain individual alert details
                    expect(reportStr).not.toMatch(/individual alert/i);
                    expect(reportStr).not.toMatch(/alert details/i);
                    expect(reportStr).not.toMatch(/specific alert/i);

                    // Should not contain raw alert data structures
                    expect(quarterlyReport).not.toHaveProperty('alertDetails');
                    expect(quarterlyReport).not.toHaveProperty('individualAlerts');
                    expect(quarterlyReport).not.toHaveProperty('alertList');

                    // Property 4: Should emphasize overall security posture and risk reduction
                    const hasSecurityPosture = quarterlyReport.slides.some(slide =>
                        slide.title.toLowerCase().includes('security posture') ||
                        slide.title.toLowerCase().includes('risk reduction') ||
                        slide.title.toLowerCase().includes('security overview')
                    );
                    expect(hasSecurityPosture).toBe(true);

                    // Property 5: Should use plain-language explanations
                    quarterlyReport.slides.forEach(slide => {
                        if (slide.content && typeof slide.content === 'object') {
                            const contentStr = JSON.stringify(slide.content);

                            // Should contain plain language terms
                            const plainLanguageTerms = /improved|reduced|prevented|protected|maintained|strengthened|enhanced/i;
                            expect(contentStr).toMatch(plainLanguageTerms);

                            // Should not contain technical acronyms without explanation
                            const unexplainedAcronyms = /\b[A-Z]{3,}\b/g;
                            const acronyms = contentStr.match(unexplainedAcronyms) || [];
                            const allowedAcronyms = ['CEO', 'CTO', 'CISO', 'IT', 'API', 'PDF', 'URL'];

                            acronyms.forEach(acronym => {
                                if (!allowedAcronyms.includes(acronym)) {
                                    // If technical acronym is used, it should be explained or avoided
                                    expect(allowedAcronyms).toContain(acronym);
                                }
                            });
                        }
                    });

                    // Property 6: Should highlight incident trends and vulnerability reduction achievements
                    const hasTrends = quarterlyReport.slides.some(slide =>
                        slide.title.toLowerCase().includes('trend') ||
                        slide.title.toLowerCase().includes('improvement') ||
                        slide.title.toLowerCase().includes('achievement')
                    );
                    expect(hasTrends).toBe(true);

                    // Verify that quarterly-specific methods were called
                    expect(mockDataAggregator.getQuarterlyBusinessMetrics).toHaveBeenCalledWith(tenantId, dateRange);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Quarterly reports should not include weekly timeline data
     */
    it('should not include weekly timeline data in quarterly reports', () => {
        fc.assert(
            fc.property(
                generators.tenantId,
                generators.enhancedDateRange,
                generators.userId,
                async (tenantId, dateRange, userId) => {
                    // Setup minimal mock data
                    mockDataAggregator.getQuarterlyBusinessMetrics = jest.fn().mockResolvedValue({
                        securityPosture: {
                            overallRiskReduction: 25,
                            threatsBlocked: 100,
                            vulnerabilitiesRemediated: 80,
                            securityIncidents: 5,
                            businessImpactPrevented: 100000
                        },
                        businessValue: {
                            downtimePrevented: 8,
                            complianceStatus: 'Maintained',
                            riskMitigationScore: 85,
                            executiveSummary: 'Strong security posture maintained'
                        },
                        quarterlyTrends: {
                            incidentTrend: 'decreasing',
                            vulnerabilityTrend: 'decreasing',
                            updateComplianceTrend: 'improving'
                        }
                    });

                    mockDataAggregator.getAlertsDigest = jest.fn().mockResolvedValue({
                        totalAlertsDigested: 100,
                        alertClassification: {
                            [AlertClassification.PHISHING]: 30,
                            [AlertClassification.MALWARE]: 25,
                            [AlertClassification.SPYWARE]: 15,
                            [AlertClassification.AUTHENTICATION]: 10,
                            [AlertClassification.NETWORK]: 10,
                            [AlertClassification.OTHER]: 10
                        },
                        alertOutcomes: {
                            securityIncidents: 5,
                            benignActivity: 80,
                            falsePositives: 15
                        },
                        weeklyTimeline: [], // Should be empty for quarterly
                        sourceBreakdown: {
                            [AlertSource.DEFENDER]: 40,
                            [AlertSource.SONICWALL]: 30,
                            [AlertSource.AVAST]: 20,
                            [AlertSource.FIREWALL_EMAIL]: 10
                        }
                    });

                    mockDataAggregator.getVulnerabilityPosture = jest.fn().mockResolvedValue({
                        totalDetected: 50,
                        totalMitigated: 40,
                        riskReductionTrend: {
                            quarterStart: 50,
                            quarterEnd: 10,
                            percentReduction: 80
                        }
                    });

                    mockDataAggregator.getUpdatesSummary = jest.fn().mockResolvedValue({
                        totalUpdatesApplied: 200,
                        updatesBySource: {
                            windows: 100,
                            microsoftOffice: 40,
                            firewall: 40,
                            other: 20
                        }
                    });

                    // Generate quarterly report
                    const quarterlyReport = await reportGenerator.generateQuarterlyReport(tenantId, dateRange, userId);

                    // Property: Quarterly reports should not include weekly timeline
                    const reportStr = JSON.stringify(quarterlyReport);
                    expect(reportStr).not.toMatch(/weeklyTimeline/i);
                    expect(reportStr).not.toMatch(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/i);
                    expect(reportStr).not.toMatch(/daily.*count/i);

                    // Should not have weekly-specific slides
                    quarterlyReport.slides.forEach(slide => {
                        expect(slide.title).not.toMatch(/weekly|daily|day-by-day/i);
                    });
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Quarterly reports should emphasize business metrics over technical metrics
     */
    it('should emphasize business metrics over technical metrics', () => {
        fc.assert(
            fc.property(
                generators.tenantId,
                generators.enhancedDateRange,
                generators.userId,
                fc.integer({ min: 10000, max: 1000000 }), // Business impact value
                async (tenantId, dateRange, userId, businessImpact) => {
                    // Setup business-focused mock data
                    mockDataAggregator.getQuarterlyBusinessMetrics = jest.fn().mockResolvedValue({
                        securityPosture: {
                            overallRiskReduction: 30,
                            threatsBlocked: 500,
                            vulnerabilitiesRemediated: 200,
                            securityIncidents: 10,
                            businessImpactPrevented: businessImpact
                        },
                        businessValue: {
                            downtimePrevented: 12,
                            complianceStatus: 'Maintained',
                            riskMitigationScore: 90,
                            executiveSummary: 'Excellent security performance with strong ROI'
                        },
                        quarterlyTrends: {
                            incidentTrend: 'decreasing',
                            vulnerabilityTrend: 'decreasing',
                            updateComplianceTrend: 'improving'
                        }
                    });

                    // Setup other required mocks
                    mockDataAggregator.getAlertsDigest = jest.fn().mockResolvedValue({
                        totalAlertsDigested: 500,
                        alertClassification: {
                            [AlertClassification.PHISHING]: 150,
                            [AlertClassification.MALWARE]: 125,
                            [AlertClassification.SPYWARE]: 75,
                            [AlertClassification.AUTHENTICATION]: 50,
                            [AlertClassification.NETWORK]: 50,
                            [AlertClassification.OTHER]: 50
                        },
                        alertOutcomes: {
                            securityIncidents: 10,
                            benignActivity: 400,
                            falsePositives: 90
                        },
                        weeklyTimeline: [],
                        sourceBreakdown: {
                            [AlertSource.DEFENDER]: 200,
                            [AlertSource.SONICWALL]: 150,
                            [AlertSource.AVAST]: 100,
                            [AlertSource.FIREWALL_EMAIL]: 50
                        }
                    });

                    mockDataAggregator.getVulnerabilityPosture = jest.fn().mockResolvedValue({
                        totalDetected: 100,
                        totalMitigated: 80,
                        riskReductionTrend: {
                            quarterStart: 100,
                            quarterEnd: 20,
                            percentReduction: 80
                        }
                    });

                    mockDataAggregator.getUpdatesSummary = jest.fn().mockResolvedValue({
                        totalUpdatesApplied: 300,
                        updatesBySource: {
                            windows: 150,
                            microsoftOffice: 60,
                            firewall: 60,
                            other: 30
                        }
                    });

                    // Generate quarterly report
                    const quarterlyReport = await reportGenerator.generateQuarterlyReport(tenantId, dateRange, userId);

                    // Property: Should emphasize business metrics
                    const reportStr = JSON.stringify(quarterlyReport);

                    // Should contain business-focused terms
                    const businessTerms = [
                        'business impact',
                        'downtime prevented',
                        'compliance',
                        'risk reduction',
                        'security posture',
                        'value delivered',
                        'cost avoidance'
                    ];

                    let businessTermCount = 0;
                    businessTerms.forEach(term => {
                        if (reportStr.toLowerCase().includes(term)) {
                            businessTermCount++;
                        }
                    });

                    expect(businessTermCount).toBeGreaterThan(0);

                    // Should minimize technical terms
                    const technicalTerms = [
                        'memory usage',
                        'cpu utilization',
                        'network latency',
                        'disk i/o',
                        'process id',
                        'registry key',
                        'system call'
                    ];

                    let technicalTermCount = 0;
                    technicalTerms.forEach(term => {
                        if (reportStr.toLowerCase().includes(term)) {
                            technicalTermCount++;
                        }
                    });

                    // Technical terms should be minimal or absent
                    expect(technicalTermCount).toBeLessThanOrEqual(1);

                    // Should include financial/business impact metrics
                    expect(reportStr).toMatch(/\$|dollar|cost|savings|prevented|roi|return on investment/i);
                }
            ),
            { numRuns: 100 }
        );
    });
});