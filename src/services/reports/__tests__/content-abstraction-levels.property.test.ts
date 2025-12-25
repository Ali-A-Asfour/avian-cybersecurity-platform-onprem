/**
 * Property-Based Test: Content Abstraction Levels
 * 
 * **Feature: avian-reports-module, Property 12: Content abstraction levels**
 * **Validates: Requirements 5.4**
 * 
 * This test validates that monthly reports provide incident summaries rather than raw alert details,
 * ensuring appropriate abstraction levels for different report types.
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
    MonthlyReport,
    WeeklyReport,
    IncidentSummary,
    AlertRecord,
    AlertClassification,
    AlertSeverity,
    AlertOutcome
} from '@/types/reports';

// Mock dependencies
jest.mock('../HistoricalDataStore');
jest.mock('../ReportSnapshotService');
jest.mock('../ReportCacheService');

describe('Property-Based Test: Content Abstraction Levels', () => {
    let reportGenerator: ReportGenerator;
    let mockDataAggregator: jest.Mocked<DataAggregator>;
    let mockTemplateEngine: jest.Mocked<TemplateEngine>;
    let mockHistoricalDataStore: jest.Mocked<HistoricalDataStore>;
    let mockSnapshotService: jest.Mocked<ReportSnapshotService>;
    let mockCacheService: jest.Mocked<ReportCacheService>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create mocked dependencies using actual class instances
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
            reportType: 'monthly',
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
     * Property 12: Content abstraction levels
     * For any monthly report incident data, the system should provide summaries rather than raw alert details
     */
    it('should provide incident summaries rather than raw alert details in monthly reports', () => {
        /**
         * **Feature: avian-reports-module, Property 12: Content abstraction levels**
         * **Validates: Requirements 5.4**
         */
        fc.assert(
            fc.asyncProperty(
                generators.tenantId,
                generators.enhancedDateRange,
                generators.userId,
                fc.array(generators.alertRecord, { minLength: 5, maxLength: 50 }),
                async (tenantId, dateRange, userId, rawAlerts) => {
                    // Setup mock data for monthly report generation
                    const mockAlertsDigest = {
                        totalAlertsDigested: rawAlerts.length,
                        alertClassification: {
                            [AlertClassification.PHISHING]: Math.floor(rawAlerts.length * 0.3),
                            [AlertClassification.MALWARE]: Math.floor(rawAlerts.length * 0.2),
                            [AlertClassification.SPYWARE]: Math.floor(rawAlerts.length * 0.1),
                            [AlertClassification.AUTHENTICATION]: Math.floor(rawAlerts.length * 0.15),
                            [AlertClassification.NETWORK]: Math.floor(rawAlerts.length * 0.15),
                            [AlertClassification.OTHER]: Math.floor(rawAlerts.length * 0.1)
                        },
                        alertOutcomes: {
                            securityIncidents: Math.floor(rawAlerts.length * 0.2),
                            benignActivity: Math.floor(rawAlerts.length * 0.6),
                            falsePositives: Math.floor(rawAlerts.length * 0.2)
                        },
                        weeklyTimeline: Array(7).fill(null).map((_, i) => ({
                            date: new Date(2024, 0, 1 + i).toISOString().split('T')[0],
                            dayOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][i] as any,
                            count: Math.floor(rawAlerts.length / 7)
                        })),
                        sourceBreakdown: {
                            defender: Math.floor(rawAlerts.length * 0.4),
                            sonicwall: Math.floor(rawAlerts.length * 0.3),
                            avast: Math.floor(rawAlerts.length * 0.2),
                            firewall_email: Math.floor(rawAlerts.length * 0.1)
                        }
                    };

                    const mockUpdatesSummary = {
                        totalUpdatesApplied: 50,
                        updatesBySource: {
                            windows: 20,
                            microsoftOffice: 15,
                            firewall: 10,
                            other: 5
                        }
                    };

                    const mockVulnerabilityPosture = {
                        totalDetected: 25,
                        totalMitigated: 20,
                        severityBreakdown: {
                            critical: 5,
                            high: 10,
                            medium: 10
                        },
                        classBreakdown: {
                            'Web Application': 8,
                            'Network Service': 7,
                            'Operating System': 10
                        }
                    };

                    const mockTrendAnalysis = {
                        weekOverWeekTrends: [
                            {
                                metric: 'Alerts',
                                currentPeriod: rawAlerts.length,
                                previousPeriod: Math.floor(rawAlerts.length * 0.8),
                                changePercentage: 20,
                                trend: 'up' as const
                            }
                        ],
                        recurringAlertTypes: [
                            {
                                alertType: AlertClassification.PHISHING,
                                count: Math.floor(rawAlerts.length * 0.3),
                                trend: 'increasing' as const
                            }
                        ],
                        vulnerabilityAging: {
                            newVulnerabilities: 5,
                            ageingVulnerabilities: 3,
                            resolvedVulnerabilities: 7
                        }
                    };

                    // Create abstracted incident summaries (not raw alerts)
                    const incidentTypes = ['Phishing Attempt', 'Malware Detection', 'Authentication Failure', 'Network Intrusion'];
                    const mockIncidentSummaries: IncidentSummary[] = incidentTypes.map((type, index) => ({
                        incidentType: type,
                        count: Math.floor(rawAlerts.length / incidentTypes.length) + (index === 0 ? rawAlerts.length % incidentTypes.length : 0),
                        averageResolutionTime: 15 + (index * 5), // 15, 20, 25, 30 minutes
                        severity: [AlertSeverity.HIGH, AlertSeverity.MEDIUM, AlertSeverity.LOW, AlertSeverity.CRITICAL][index],
                        description: `Summary of ${type.toLowerCase()} incidents during the reporting period`
                    }));

                    const mockTopAffectedAssets = [
                        {
                            deviceId: 'device-001',
                            deviceName: 'Web Server 1',
                            alertCount: Math.floor(rawAlerts.length * 0.3),
                            incidentCount: 3,
                            riskScore: 85
                        },
                        {
                            deviceId: 'device-002',
                            deviceName: 'Database Server',
                            alertCount: Math.floor(rawAlerts.length * 0.2),
                            incidentCount: 2,
                            riskScore: 70
                        }
                    ];

                    // Setup mocks
                    mockDataAggregator.getAlertsDigest.mockResolvedValue(mockAlertsDigest);
                    mockDataAggregator.getUpdatesSummary.mockResolvedValue(mockUpdatesSummary);
                    mockDataAggregator.getVulnerabilityPosture.mockResolvedValue(mockVulnerabilityPosture);
                    mockDataAggregator.getTrendAnalysis.mockResolvedValue(mockTrendAnalysis);

                    // Mock the historical data store to return incident summaries, not raw alerts
                    (mockHistoricalDataStore as any).getIncidentSummaries = jest.fn().mockResolvedValue(mockIncidentSummaries);
                    (mockHistoricalDataStore as any).getTopAffectedAssets = jest.fn().mockResolvedValue(mockTopAffectedAssets);
                    mockHistoricalDataStore.getAlertHistory.mockResolvedValue(rawAlerts.map(alert => ({
                        ...alert,
                        deviceId: alert.deviceId || undefined
                    })));

                    // Generate monthly report
                    const monthlyReport = await reportGenerator.generateMonthlyReport(tenantId, dateRange, userId);

                    // Property: Monthly report must contain incident summaries, not raw alert details
                    expect(monthlyReport.incidentSummary).toBeDefined();
                    expect(monthlyReport.incidentSummary.incidentSummaries).toBeDefined();
                    expect(Array.isArray(monthlyReport.incidentSummary.incidentSummaries)).toBe(true);

                    // Verify abstraction: incident summaries should be aggregated, not individual alerts
                    monthlyReport.incidentSummary.incidentSummaries.forEach(summary => {
                        // Each summary should represent multiple incidents, not individual alerts
                        expect(summary.incidentType).toBeDefined();
                        expect(typeof summary.incidentType).toBe('string');
                        expect(summary.incidentType.length).toBeGreaterThan(0);

                        // Should have aggregated count, not individual alert IDs
                        expect(summary.count).toBeDefined();
                        expect(typeof summary.count).toBe('number');
                        expect(summary.count).toBeGreaterThan(0);

                        // Should have average resolution time (abstracted metric)
                        expect(summary.averageResolutionTime).toBeDefined();
                        expect(typeof summary.averageResolutionTime).toBe('number');
                        expect(summary.averageResolutionTime).toBeGreaterThan(0);

                        // Should have severity level (abstracted from individual alert severities)
                        expect(summary.severity).toBeDefined();
                        expect(Object.values(AlertSeverity)).toContain(summary.severity);

                        // Should have executive-friendly description, not technical alert details
                        expect(summary.description).toBeDefined();
                        expect(typeof summary.description).toBe('string');
                        expect(summary.description.length).toBeGreaterThan(0);

                        // Description should not contain raw alert IDs or technical identifiers
                        expect(summary.description).not.toMatch(/alert-\d+/i);
                        expect(summary.description).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i); // UUID pattern
                    });

                    // Verify that incident summaries are abstracted from raw alerts
                    const totalIncidentCount = monthlyReport.incidentSummary.incidentSummaries
                        .reduce((sum, summary) => sum + summary.count, 0);

                    // Total incident count should be reasonable compared to raw alerts
                    // (incidents are typically a subset of all alerts)
                    expect(totalIncidentCount).toBeLessThanOrEqual(rawAlerts.length);
                    expect(totalIncidentCount).toBeGreaterThan(0);

                    // Verify top affected assets are also abstracted
                    expect(monthlyReport.incidentSummary.topAffectedAssets).toBeDefined();
                    expect(Array.isArray(monthlyReport.incidentSummary.topAffectedAssets)).toBe(true);

                    monthlyReport.incidentSummary.topAffectedAssets.forEach(asset => {
                        // Should have device identification
                        expect(asset.deviceId).toBeDefined();
                        expect(typeof asset.deviceId).toBe('string');
                        expect(asset.deviceName).toBeDefined();
                        expect(typeof asset.deviceName).toBe('string');

                        // Should have aggregated metrics, not individual alert references
                        expect(asset.alertCount).toBeDefined();
                        expect(typeof asset.alertCount).toBe('number');
                        expect(asset.alertCount).toBeGreaterThan(0);

                        expect(asset.incidentCount).toBeDefined();
                        expect(typeof asset.incidentCount).toBe('number');
                        expect(asset.incidentCount).toBeGreaterThan(0);

                        // Should have risk score (abstracted metric)
                        expect(asset.riskScore).toBeDefined();
                        expect(typeof asset.riskScore).toBe('number');
                        expect(asset.riskScore).toBeGreaterThanOrEqual(0);
                        expect(asset.riskScore).toBeLessThanOrEqual(100);
                    });

                    // Verify that the historical data store was called for summaries, not raw alerts for incident slide
                    expect((mockHistoricalDataStore as any).getIncidentSummaries).toHaveBeenCalledWith(tenantId, dateRange);
                    expect((mockHistoricalDataStore as any).getTopAffectedAssets).toHaveBeenCalledWith(tenantId, dateRange);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Weekly reports should not have incident summaries (content abstraction is monthly-specific)
     */
    it('should not include incident summaries in weekly reports', () => {
        fc.assert(
            fc.asyncProperty(
                generators.tenantId,
                generators.enhancedDateRange,
                generators.userId,
                fc.array(generators.alertRecord, { minLength: 1, maxLength: 20 }),
                async (tenantId, dateRange, userId, rawAlerts) => {
                    // Setup mock data for weekly report generation
                    const mockAlertsDigest = {
                        totalAlertsDigested: rawAlerts.length,
                        alertClassification: {
                            [AlertClassification.PHISHING]: Math.floor(rawAlerts.length * 0.3),
                            [AlertClassification.MALWARE]: Math.floor(rawAlerts.length * 0.2),
                            [AlertClassification.SPYWARE]: Math.floor(rawAlerts.length * 0.1),
                            [AlertClassification.AUTHENTICATION]: Math.floor(rawAlerts.length * 0.15),
                            [AlertClassification.NETWORK]: Math.floor(rawAlerts.length * 0.15),
                            [AlertClassification.OTHER]: Math.floor(rawAlerts.length * 0.1)
                        },
                        alertOutcomes: {
                            securityIncidents: Math.floor(rawAlerts.length * 0.2),
                            benignActivity: Math.floor(rawAlerts.length * 0.6),
                            falsePositives: Math.floor(rawAlerts.length * 0.2)
                        },
                        weeklyTimeline: Array(7).fill(null).map((_, i) => ({
                            date: new Date(2024, 0, 1 + i).toISOString().split('T')[0],
                            dayOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][i] as any,
                            count: Math.floor(rawAlerts.length / 7)
                        })),
                        sourceBreakdown: {
                            defender: Math.floor(rawAlerts.length * 0.4),
                            sonicwall: Math.floor(rawAlerts.length * 0.3),
                            avast: Math.floor(rawAlerts.length * 0.2),
                            firewall_email: Math.floor(rawAlerts.length * 0.1)
                        }
                    };

                    const mockUpdatesSummary = {
                        totalUpdatesApplied: 25,
                        updatesBySource: {
                            windows: 10,
                            microsoftOffice: 8,
                            firewall: 5,
                            other: 2
                        }
                    };

                    const mockVulnerabilityPosture = {
                        totalDetected: 15,
                        totalMitigated: 12,
                        severityBreakdown: {
                            critical: 2,
                            high: 6,
                            medium: 7
                        }
                    };

                    // Setup mocks
                    mockDataAggregator.getAlertsDigest.mockResolvedValue(mockAlertsDigest);
                    mockDataAggregator.getUpdatesSummary.mockResolvedValue(mockUpdatesSummary);
                    mockDataAggregator.getVulnerabilityPosture.mockResolvedValue(mockVulnerabilityPosture);

                    // Generate weekly report
                    const weeklyReport = await reportGenerator.generateWeeklyReport(tenantId, dateRange, userId);

                    // Property: Weekly reports should not have incident summaries
                    expect((weeklyReport as any).incidentSummary).toBeUndefined();

                    // Weekly reports should have direct alert data, not abstracted incident summaries
                    expect(weeklyReport.alertsDigest).toBeDefined();
                    expect(weeklyReport.alertsDigest.alertsDigest).toBeDefined();
                    expect(weeklyReport.alertsDigest.alertsDigest.totalAlertsDigested).toBe(rawAlerts.length);

                    // Verify that incident summary methods were not called for weekly reports
                    expect((mockHistoricalDataStore as any).getIncidentSummaries).not.toHaveBeenCalled();
                    expect((mockHistoricalDataStore as any).getTopAffectedAssets).not.toHaveBeenCalled();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Incident summaries should aggregate multiple alerts into meaningful categories
     */
    it('should aggregate multiple alerts into meaningful incident categories', () => {
        fc.assert(
            fc.asyncProperty(
                generators.tenantId,
                generators.enhancedDateRange,
                generators.userId,
                fc.array(generators.alertRecord, { minLength: 10, maxLength: 100 }),
                async (tenantId, dateRange, userId, rawAlerts) => {
                    // Create diverse alert types to test aggregation
                    const diverseAlerts = rawAlerts.map((alert, index) => ({
                        ...alert,
                        normalizedType: Object.values(AlertClassification)[index % Object.values(AlertClassification).length],
                        severity: Object.values(AlertSeverity)[index % Object.values(AlertSeverity).length],
                        outcome: (['security_incident', 'benign_activity', 'false_positive'] as AlertOutcome[])[index % 3]
                    }));

                    // Setup mocks with diverse data
                    const mockAlertsDigest = {
                        totalAlertsDigested: diverseAlerts.length,
                        alertClassification: Object.values(AlertClassification).reduce((acc, type) => {
                            acc[type] = diverseAlerts.filter(a => a.normalizedType === type).length;
                            return acc;
                        }, {} as Record<AlertClassification, number>),
                        alertOutcomes: {
                            securityIncidents: diverseAlerts.filter(a => a.outcome === 'security_incident').length,
                            benignActivity: diverseAlerts.filter(a => a.outcome === 'benign_activity').length,
                            falsePositives: diverseAlerts.filter(a => a.outcome === 'false_positive').length
                        },
                        weeklyTimeline: Array(7).fill(null).map((_, i) => ({
                            date: new Date(2024, 0, 1 + i).toISOString().split('T')[0],
                            dayOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][i] as any,
                            count: Math.floor(diverseAlerts.length / 7)
                        })),
                        sourceBreakdown: {
                            defender: Math.floor(diverseAlerts.length * 0.4),
                            sonicwall: Math.floor(diverseAlerts.length * 0.3),
                            avast: Math.floor(diverseAlerts.length * 0.2),
                            firewall_email: Math.floor(diverseAlerts.length * 0.1)
                        }
                    };

                    // Create incident summaries that aggregate alerts by type
                    const incidentSummariesByType = Object.values(AlertClassification).map(type => {
                        const alertsOfType = diverseAlerts.filter(a => a.normalizedType === type);
                        if (alertsOfType.length === 0) return null;

                        return {
                            incidentType: type.charAt(0).toUpperCase() + type.slice(1) + ' Incidents',
                            count: alertsOfType.length,
                            averageResolutionTime: 15 + Math.floor(Math.random() * 20),
                            severity: alertsOfType.reduce((maxSev, alert) => {
                                const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
                                return severityOrder[alert.severity] > severityOrder[maxSev] ? alert.severity : maxSev;
                            }, AlertSeverity.LOW),
                            description: `Aggregated summary of ${type} incidents during the reporting period`
                        };
                    }).filter(Boolean) as IncidentSummary[];

                    mockDataAggregator.getAlertsDigest.mockResolvedValue(mockAlertsDigest);
                    mockDataAggregator.getUpdatesSummary.mockResolvedValue({
                        totalUpdatesApplied: 30,
                        updatesBySource: { windows: 15, microsoftOffice: 8, firewall: 5, other: 2 }
                    });
                    mockDataAggregator.getVulnerabilityPosture.mockResolvedValue({
                        totalDetected: 20,
                        totalMitigated: 15,
                        severityBreakdown: { critical: 3, high: 8, medium: 9 }
                    });
                    mockDataAggregator.getTrendAnalysis.mockResolvedValue({
                        weekOverWeekTrends: [{
                            metric: 'Alerts',
                            currentPeriod: diverseAlerts.length,
                            previousPeriod: Math.floor(diverseAlerts.length * 0.9),
                            changePercentage: 10,
                            trend: 'up' as const
                        }],
                        recurringAlertTypes: [{
                            alertType: AlertClassification.PHISHING,
                            count: Math.floor(diverseAlerts.length * 0.3),
                            trend: 'increasing' as const
                        }],
                        vulnerabilityAging: {
                            newVulnerabilities: 8,
                            ageingVulnerabilities: 4,
                            resolvedVulnerabilities: 12
                        }
                    });

                    (mockHistoricalDataStore as any).getIncidentSummaries = jest.fn().mockResolvedValue(incidentSummariesByType);
                    (mockHistoricalDataStore as any).getTopAffectedAssets = jest.fn().mockResolvedValue([]);
                    mockHistoricalDataStore.getAlertHistory.mockResolvedValue(diverseAlerts.map(alert => ({
                        ...alert,
                        deviceId: alert.deviceId || undefined
                    })));

                    // Generate monthly report
                    const monthlyReport = await reportGenerator.generateMonthlyReport(tenantId, dateRange, userId);

                    // Property: Incident summaries should aggregate alerts meaningfully
                    expect(monthlyReport.incidentSummary.incidentSummaries.length).toBeGreaterThan(0);
                    expect(monthlyReport.incidentSummary.incidentSummaries.length).toBeLessThanOrEqual(Object.values(AlertClassification).length);

                    // Each incident summary should represent aggregated data
                    monthlyReport.incidentSummary.incidentSummaries.forEach(summary => {
                        // Should have meaningful incident type names (not raw alert types)
                        expect(summary.incidentType).toMatch(/incidents?/i);
                        expect(summary.incidentType).not.toMatch(/alert-\d+/);

                        // Count should represent multiple alerts aggregated
                        expect(summary.count).toBeGreaterThan(0);

                        // Should have calculated average resolution time
                        expect(summary.averageResolutionTime).toBeGreaterThan(0);
                        expect(summary.averageResolutionTime).toBeLessThan(1440); // Less than 24 hours in minutes

                        // Description should be executive-friendly, not technical
                        expect(summary.description).toMatch(/summary|period|incidents?/i);
                        expect(summary.description).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}/i); // No UUIDs
                    });

                    // Total incident count should be reasonable compared to raw alerts
                    const totalIncidents = monthlyReport.incidentSummary.incidentSummaries
                        .reduce((sum, summary) => sum + summary.count, 0);
                    expect(totalIncidents).toBeLessThanOrEqual(diverseAlerts.length);
                    expect(totalIncidents).toBeGreaterThan(0);
                }
            ),
            { numRuns: 100 }
        );
    });
});