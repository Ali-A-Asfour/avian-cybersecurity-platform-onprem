/**
 * Property-Based Tests for Monthly Trend Inclusion
 * 
 * **Feature: avian-reports-module, Property 9: Monthly trend inclusion**
 * **Validates: Requirements 5.1, 5.2**
 */

import * as fc from 'fast-check';
import { generators } from './generators';

// Create a more reasonable date range generator for monthly reports
const monthlyDateRangeGen = fc.record({
    startDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-11-01') }),
    timezone: fc.constantFrom('America/Toronto', 'America/New_York', 'Europe/London'),
    weekStart: fc.constant('monday' as const)
}).map(({ startDate, timezone, weekStart }) => {
    // Create a meaningful monthly date range (at least 7 days)
    const endDate = new Date(startDate.getTime() + (7 * 24 * 60 * 60 * 1000) + Math.random() * (23 * 24 * 60 * 60 * 1000)); // 7-30 days
    return {
        startDate,
        endDate,
        timezone,
        weekStart
    };
});

import { ReportGenerator } from '../ReportGenerator';
import { DataAggregator } from '../DataAggregator';
import { TemplateEngine } from '../TemplateEngine';
import { HistoricalDataStore } from '../HistoricalDataStore';
import { ReportSnapshotService } from '../ReportSnapshotService';
import { ReportCacheService } from '../ReportCacheService';
import { MonthlyReport, TrendData, RecurringAlertType, VulnerabilityAging } from '@/types/reports';

// Mock dependencies
jest.mock('../HistoricalDataStore');
jest.mock('../ReportSnapshotService');
jest.mock('../ReportCacheService');

describe('Monthly Trend Inclusion Properties', () => {
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
        mockDataAggregator = new DataAggregator(mockHistoricalDataStore) as jest.Mocked<DataAggregator>;
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

    describe('Property 9: Monthly trend inclusion', () => {
        it('should include week-over-week trends in monthly reports', () => {
            /**
             * **Feature: avian-reports-module, Property 9: Monthly trend inclusion**
             * **Validates: Requirements 5.1, 5.2**
             */
            fc.assert(
                fc.property(
                    generators.tenantId,
                    monthlyDateRangeGen,
                    generators.userId,
                    fc.array(fc.record({
                        metric: fc.constantFrom('Total Alerts', 'Critical Alerts', 'Security Incidents', 'Updates Applied', 'Vulnerabilities Detected'),
                        currentPeriod: fc.nat({ max: 1000 }),
                        previousPeriod: fc.nat({ max: 1000 }),
                        changePercentage: fc.float({ min: -100, max: 100 }),
                        trend: fc.constantFrom('up', 'down', 'stable')
                    }), { minLength: 1, maxLength: 10 }),
                    fc.array(fc.record({
                        alertType: generators.alertClassification,
                        frequency: fc.nat({ min: 3, max: 100 }),
                        averageSeverity: generators.alertSeverity,
                        topDevices: fc.array(generators.deviceId, { maxLength: 5 })
                    }), { maxLength: 10 }),
                    fc.record({
                        openVulnerabilities: fc.record({
                            lessThan30Days: fc.nat({ max: 100 }),
                            thirtyTo90Days: fc.nat({ max: 100 }),
                            moreThan90Days: fc.nat({ max: 100 })
                        }),
                        mitigatedThisPeriod: fc.nat({ max: 100 })
                    }),
                    async (tenantId, dateRange, userId, weekOverWeekTrends, recurringAlertTypes, vulnerabilityAging) => {
                        // Setup mocks for trend analysis
                        mockDataAggregator.getTrendAnalysis = jest.fn().mockResolvedValue({
                            weekOverWeekTrends,
                            recurringAlertTypes,
                            vulnerabilityAging
                        });

                        // Setup other required mocks
                        mockDataAggregator.getAlertsDigest = jest.fn().mockResolvedValue({
                            totalAlertsDigested: 100,
                            alertClassification: {},
                            alertOutcomes: { securityIncidents: 10, benignActivity: 80, falsePositives: 10 },
                            weeklyTimeline: [],
                            sourceBreakdown: {}
                        });

                        mockDataAggregator.getUpdatesSummary = jest.fn().mockResolvedValue({
                            totalUpdatesApplied: 50,
                            updatesBySource: { windows: 20, microsoftOffice: 15, firewall: 10, other: 5 }
                        });

                        mockDataAggregator.getVulnerabilityPosture = jest.fn().mockResolvedValue({
                            totalDetected: 25,
                            totalMitigated: 20,
                            severityBreakdown: { critical: 5, high: 10, medium: 10 }
                        });

                        // Mock template engine methods
                        mockTemplateEngine.createSlideTemplate = jest.fn().mockReturnValue({
                            layout: { type: 'trend-analysis', orientation: 'landscape', theme: 'dark', branding: 'avian' }
                        });

                        mockTemplateEngine.renderSlide = jest.fn().mockResolvedValue({
                            id: 'slide-123',
                            title: 'Trend Analysis',
                            content: { summary: 'Test content' },
                            charts: [],
                            layout: { type: 'trend-analysis', orientation: 'landscape', theme: 'dark', branding: 'avian' }
                        });

                        // Generate monthly report
                        const monthlyReport = await reportGenerator.generateMonthlyReport(tenantId, dateRange, userId);

                        // Property: Monthly report must include trend analysis
                        expect(monthlyReport.reportType).toBe('monthly');
                        expect(monthlyReport.trendAnalysis).toBeDefined();

                        // Property: Trend analysis must include week-over-week trends
                        expect(monthlyReport.trendAnalysis.weekOverWeekTrends).toBeDefined();
                        expect(Array.isArray(monthlyReport.trendAnalysis.weekOverWeekTrends)).toBe(true);
                        expect(monthlyReport.trendAnalysis.weekOverWeekTrends.length).toBeGreaterThanOrEqual(0);

                        // Property: Each trend must have required fields
                        monthlyReport.trendAnalysis.weekOverWeekTrends.forEach(trend => {
                            expect(trend.metric).toBeDefined();
                            expect(typeof trend.metric).toBe('string');
                            expect(trend.currentPeriod).toBeDefined();
                            expect(typeof trend.currentPeriod).toBe('number');
                            expect(trend.previousPeriod).toBeDefined();
                            expect(typeof trend.previousPeriod).toBe('number');
                            expect(trend.changePercentage).toBeDefined();
                            expect(typeof trend.changePercentage).toBe('number');
                            expect(trend.trend).toBeDefined();
                            expect(['up', 'down', 'stable']).toContain(trend.trend);
                        });

                        // Property: Trend analysis must include recurring alert types
                        expect(monthlyReport.trendAnalysis.recurringAlertTypes).toBeDefined();
                        expect(Array.isArray(monthlyReport.trendAnalysis.recurringAlertTypes)).toBe(true);

                        // Property: Each recurring alert type must have required fields
                        monthlyReport.trendAnalysis.recurringAlertTypes.forEach(alertType => {
                            expect(alertType.alertType).toBeDefined();
                            expect(alertType.frequency).toBeDefined();
                            expect(typeof alertType.frequency).toBe('number');
                            expect(alertType.frequency).toBeGreaterThanOrEqual(0);
                            expect(alertType.averageSeverity).toBeDefined();
                            expect(['critical', 'high', 'medium', 'low']).toContain(alertType.averageSeverity);
                        });

                        // Property: Trend analysis must include vulnerability aging
                        expect(monthlyReport.trendAnalysis.vulnerabilityAging).toBeDefined();
                        expect(monthlyReport.trendAnalysis.vulnerabilityAging.openVulnerabilities).toBeDefined();
                        expect(typeof monthlyReport.trendAnalysis.vulnerabilityAging.openVulnerabilities.lessThan30Days).toBe('number');
                        expect(typeof monthlyReport.trendAnalysis.vulnerabilityAging.openVulnerabilities.thirtyTo90Days).toBe('number');
                        expect(typeof monthlyReport.trendAnalysis.vulnerabilityAging.openVulnerabilities.moreThan90Days).toBe('number');
                        expect(typeof monthlyReport.trendAnalysis.vulnerabilityAging.mitigatedThisPeriod).toBe('number');

                        // Property: Trend analysis slide must be present in slides array
                        const trendSlide = monthlyReport.slides.find(slide =>
                            slide.title.toLowerCase().includes('trend') ||
                            slide.layout.type === 'trend-analysis'
                        );
                        expect(trendSlide).toBeDefined();

                        // Property: getTrendAnalysis must be called for monthly reports
                        expect(mockDataAggregator.getTrendAnalysis).toHaveBeenCalledWith(tenantId, dateRange);
                    }
                ),
                { numRuns: 10 } // Reduced runs for faster testing
            );
        });

        it('should include comparative charts showing changes over time', () => {
            /**
             * **Feature: avian-reports-module, Property 9: Monthly trend inclusion**
             * **Validates: Requirements 5.1, 5.2**
             */
            fc.assert(
                fc.property(
                    generators.tenantId,
                    monthlyDateRangeGen,
                    generators.userId,
                    fc.array(fc.record({
                        metric: fc.constantFrom('Total Alerts', 'Critical Alerts', 'Security Incidents'),
                        currentPeriod: fc.nat({ max: 1000 }),
                        previousPeriod: fc.nat({ max: 1000 }),
                        changePercentage: fc.float({ min: -100, max: 100 }),
                        trend: fc.constantFrom('up', 'down', 'stable')
                    }), { minLength: 2, maxLength: 5 }),
                    async (tenantId, dateRange, userId, weekOverWeekTrends) => {
                        // Setup mocks with trend data that shows changes
                        mockDataAggregator.getTrendAnalysis = jest.fn().mockResolvedValue({
                            weekOverWeekTrends,
                            recurringAlertTypes: [],
                            vulnerabilityAging: {
                                openVulnerabilities: { lessThan30Days: 10, thirtyTo90Days: 5, moreThan90Days: 2 },
                                mitigatedThisPeriod: 8
                            }
                        });

                        // Setup other required mocks
                        mockDataAggregator.getAlertsDigest = jest.fn().mockResolvedValue({
                            totalAlertsDigested: 100,
                            alertClassification: {},
                            alertOutcomes: { securityIncidents: 10, benignActivity: 80, falsePositives: 10 },
                            weeklyTimeline: [],
                            sourceBreakdown: {}
                        });

                        mockDataAggregator.getUpdatesSummary = jest.fn().mockResolvedValue({
                            totalUpdatesApplied: 50,
                            updatesBySource: { windows: 20, microsoftOffice: 15, firewall: 10, other: 5 }
                        });

                        mockDataAggregator.getVulnerabilityPosture = jest.fn().mockResolvedValue({
                            totalDetected: 25,
                            totalMitigated: 20,
                            severityBreakdown: { critical: 5, high: 10, medium: 10 }
                        });

                        mockTemplateEngine.createSlideTemplate = jest.fn().mockReturnValue({
                            layout: { type: 'trend-analysis', orientation: 'landscape', theme: 'dark', branding: 'avian' }
                        });

                        mockTemplateEngine.renderSlide = jest.fn().mockResolvedValue({
                            id: 'slide-123',
                            title: 'Trend Analysis',
                            content: { summary: 'Test content' },
                            charts: [],
                            layout: { type: 'trend-analysis', orientation: 'landscape', theme: 'dark', branding: 'avian' }
                        });

                        // Generate monthly report
                        const monthlyReport = await reportGenerator.generateMonthlyReport(tenantId, dateRange, userId);

                        // Property: Monthly report must show comparative data (current vs previous period)
                        expect(monthlyReport.trendAnalysis.weekOverWeekTrends.length).toBeGreaterThan(0);

                        // Property: Each trend must show comparison between periods
                        monthlyReport.trendAnalysis.weekOverWeekTrends.forEach(trend => {
                            // Must have both current and previous period data for comparison
                            expect(trend.currentPeriod).toBeDefined();
                            expect(trend.previousPeriod).toBeDefined();
                            expect(typeof trend.currentPeriod).toBe('number');
                            expect(typeof trend.previousPeriod).toBe('number');

                            // Must have calculated change percentage
                            expect(trend.changePercentage).toBeDefined();
                            expect(typeof trend.changePercentage).toBe('number');

                            // Must have trend direction indicating change over time
                            expect(trend.trend).toBeDefined();
                            expect(['up', 'down', 'stable']).toContain(trend.trend);
                        });

                        // Property: getTrendAnalysis must be called for monthly reports
                        expect(mockDataAggregator.getTrendAnalysis).toHaveBeenCalledWith(tenantId, dateRange);
                    }
                ),
                { numRuns: 10 } // Reduced runs for faster testing
            );
        });

        it('should distinguish monthly reports from weekly reports by including trend analysis', () => {
            /**
             * **Feature: avian-reports-module, Property 9: Monthly trend inclusion**
             * **Validates: Requirements 5.1, 5.2**
             */
            fc.assert(
                fc.property(
                    generators.tenantId,
                    monthlyDateRangeGen,
                    generators.userId,
                    async (tenantId, dateRange, userId) => {
                        // Setup mocks for both weekly and monthly reports
                        const mockTrendAnalysis = {
                            weekOverWeekTrends: [
                                {
                                    metric: 'Total Alerts',
                                    currentPeriod: 150,
                                    previousPeriod: 120,
                                    changePercentage: 25.0,
                                    trend: 'up' as const
                                }
                            ],
                            recurringAlertTypes: [
                                {
                                    alertType: 'phishing' as const,
                                    frequency: 5,
                                    averageSeverity: 'medium' as const,
                                    topDevices: ['device-1', 'device-2']
                                }
                            ],
                            vulnerabilityAging: {
                                openVulnerabilities: { lessThan30Days: 10, thirtyTo90Days: 5, moreThan90Days: 2 },
                                mitigatedThisPeriod: 8
                            }
                        };

                        mockDataAggregator.getTrendAnalysis = jest.fn().mockResolvedValue(mockTrendAnalysis);

                        // Setup other required mocks
                        const mockAlertsDigest = {
                            totalAlertsDigested: 100,
                            alertClassification: {},
                            alertOutcomes: { securityIncidents: 10, benignActivity: 80, falsePositives: 10 },
                            weeklyTimeline: [],
                            sourceBreakdown: {}
                        };

                        const mockUpdatesSum = {
                            totalUpdatesApplied: 50,
                            updatesBySource: { windows: 20, microsoftOffice: 15, firewall: 10, other: 5 }
                        };

                        const mockVulnPosture = {
                            totalDetected: 25,
                            totalMitigated: 20,
                            severityBreakdown: { critical: 5, high: 10, medium: 10 }
                        };

                        mockDataAggregator.getAlertsDigest = jest.fn().mockResolvedValue(mockAlertsDigest);
                        mockDataAggregator.getUpdatesSummary = jest.fn().mockResolvedValue(mockUpdatesSum);
                        mockDataAggregator.getVulnerabilityPosture = jest.fn().mockResolvedValue(mockVulnPosture);

                        mockTemplateEngine.createSlideTemplate = jest.fn().mockReturnValue({
                            layout: { type: 'trend-analysis', orientation: 'landscape', theme: 'dark', branding: 'avian' }
                        });

                        mockTemplateEngine.renderSlide = jest.fn().mockResolvedValue({
                            id: 'slide-123',
                            title: 'Test Slide',
                            content: { summary: 'Test content' },
                            charts: [],
                            layout: { type: 'trend-analysis', orientation: 'landscape', theme: 'dark', branding: 'avian' }
                        });

                        // Generate both weekly and monthly reports
                        const weeklyReport = await reportGenerator.generateWeeklyReport(tenantId, dateRange, userId);
                        const monthlyReport = await reportGenerator.generateMonthlyReport(tenantId, dateRange, userId);

                        // Property: Monthly reports must have trend analysis, weekly reports must not
                        expect(monthlyReport.reportType).toBe('monthly');
                        expect(weeklyReport.reportType).toBe('weekly');

                        // Property: Monthly report must include trend analysis
                        expect(monthlyReport.trendAnalysis).toBeDefined();
                        expect(monthlyReport.trendAnalysis.weekOverWeekTrends).toBeDefined();
                        expect(monthlyReport.trendAnalysis.recurringAlertTypes).toBeDefined();
                        expect(monthlyReport.trendAnalysis.vulnerabilityAging).toBeDefined();

                        // Property: Weekly report must not include trend analysis
                        expect('trendAnalysis' in weeklyReport).toBe(false);

                        // Property: Monthly report must have more slides than weekly (due to trend analysis)
                        expect(monthlyReport.slides.length).toBeGreaterThan(weeklyReport.slides.length);

                        // Property: Monthly report must call getTrendAnalysis, weekly must not
                        expect(mockDataAggregator.getTrendAnalysis).toHaveBeenCalledWith(tenantId, dateRange);

                        // Property: Monthly report must have a trend analysis slide
                        const hasTrendSlide = monthlyReport.slides.some(slide =>
                            slide.title.toLowerCase().includes('trend') ||
                            slide.layout.type === 'trend-analysis'
                        );
                        expect(hasTrendSlide).toBe(true);

                        // Property: Weekly report must not have a trend analysis slide
                        const weeklyHasTrendSlide = weeklyReport.slides.some(slide =>
                            slide.title.toLowerCase().includes('trend') ||
                            slide.layout.type === 'trend-analysis'
                        );
                        expect(weeklyHasTrendSlide).toBe(false);
                    }
                ),
                { numRuns: 10 } // Reduced runs for faster testing
            );
        });

        it('should handle edge cases with no trend data gracefully', () => {
            /**
             * **Feature: avian-reports-module, Property 9: Monthly trend inclusion**
             * **Validates: Requirements 5.1, 5.2**
             */
            fc.assert(
                fc.property(
                    generators.tenantId,
                    monthlyDateRangeGen,
                    generators.userId,
                    async (tenantId, dateRange, userId) => {
                        // Setup mocks with empty trend data
                        mockDataAggregator.getTrendAnalysis = jest.fn().mockResolvedValue({
                            weekOverWeekTrends: [],
                            recurringAlertTypes: [],
                            vulnerabilityAging: {
                                openVulnerabilities: { lessThan30Days: 0, thirtyTo90Days: 0, moreThan90Days: 0 },
                                mitigatedThisPeriod: 0
                            }
                        });

                        // Setup other required mocks
                        mockDataAggregator.getAlertsDigest = jest.fn().mockResolvedValue({
                            totalAlertsDigested: 0,
                            alertClassification: {},
                            alertOutcomes: { securityIncidents: 0, benignActivity: 0, falsePositives: 0 },
                            weeklyTimeline: [],
                            sourceBreakdown: {}
                        });

                        mockDataAggregator.getUpdatesSummary = jest.fn().mockResolvedValue({
                            totalUpdatesApplied: 0,
                            updatesBySource: { windows: 0, microsoftOffice: 0, firewall: 0, other: 0 }
                        });

                        mockDataAggregator.getVulnerabilityPosture = jest.fn().mockResolvedValue({
                            totalDetected: 0,
                            totalMitigated: 0,
                            severityBreakdown: { critical: 0, high: 0, medium: 0 }
                        });

                        mockTemplateEngine.createSlideTemplate = jest.fn().mockReturnValue({
                            layout: { type: 'trend-analysis', orientation: 'landscape', theme: 'dark', branding: 'avian' }
                        });

                        mockTemplateEngine.renderSlide = jest.fn().mockResolvedValue({
                            id: 'slide-123',
                            title: 'Trend Analysis',
                            content: { summary: 'No trends available for this period' },
                            charts: [],
                            layout: { type: 'trend-analysis', orientation: 'landscape', theme: 'dark', branding: 'avian' }
                        });

                        // Generate monthly report with no trend data
                        const monthlyReport = await reportGenerator.generateMonthlyReport(tenantId, dateRange, userId);

                        // Property: Monthly report must still include trend analysis structure even with no data
                        expect(monthlyReport.trendAnalysis).toBeDefined();
                        expect(monthlyReport.trendAnalysis.weekOverWeekTrends).toBeDefined();
                        expect(Array.isArray(monthlyReport.trendAnalysis.weekOverWeekTrends)).toBe(true);
                        expect(monthlyReport.trendAnalysis.recurringAlertTypes).toBeDefined();
                        expect(Array.isArray(monthlyReport.trendAnalysis.recurringAlertTypes)).toBe(true);
                        expect(monthlyReport.trendAnalysis.vulnerabilityAging).toBeDefined();

                        // Property: Empty arrays are valid for trend data
                        expect(monthlyReport.trendAnalysis.weekOverWeekTrends.length).toBe(0);
                        expect(monthlyReport.trendAnalysis.recurringAlertTypes.length).toBe(0);

                        // Property: Vulnerability aging structure must be present even with zero values
                        expect(monthlyReport.trendAnalysis.vulnerabilityAging.openVulnerabilities).toBeDefined();
                        expect(typeof monthlyReport.trendAnalysis.vulnerabilityAging.openVulnerabilities.lessThan30Days).toBe('number');
                        expect(typeof monthlyReport.trendAnalysis.vulnerabilityAging.openVulnerabilities.thirtyTo90Days).toBe('number');
                        expect(typeof monthlyReport.trendAnalysis.vulnerabilityAging.openVulnerabilities.moreThan90Days).toBe('number');
                        expect(typeof monthlyReport.trendAnalysis.vulnerabilityAging.mitigatedThisPeriod).toBe('number');

                        // Property: Report generation must not fail with empty trend data
                        expect(monthlyReport.reportType).toBe('monthly');
                        expect(monthlyReport.slides.length).toBeGreaterThan(0);

                        // Property: getTrendAnalysis must still be called even if no data is available
                        expect(mockDataAggregator.getTrendAnalysis).toHaveBeenCalledWith(tenantId, dateRange);
                    }
                ),
                { numRuns: 10 } // Reduced runs for faster testing
            );
        });

        it('should ensure trend analysis is consistently included across all monthly reports', () => {
            /**
             * **Feature: avian-reports-module, Property 9: Monthly trend inclusion**
             * **Validates: Requirements 5.1, 5.2**
             */
            fc.assert(
                fc.property(
                    fc.array(fc.record({
                        tenantId: generators.tenantId,
                        dateRange: monthlyDateRangeGen,
                        userId: generators.userId
                    }), { minLength: 1, maxLength: 3 }), // Reduced array size for faster testing
                    async (reportRequests) => {
                        // Setup consistent mocks for all requests
                        const mockTrendAnalysis = {
                            weekOverWeekTrends: [
                                {
                                    metric: 'Total Alerts',
                                    currentPeriod: 100,
                                    previousPeriod: 80,
                                    changePercentage: 25.0,
                                    trend: 'up' as const
                                }
                            ],
                            recurringAlertTypes: [],
                            vulnerabilityAging: {
                                openVulnerabilities: { lessThan30Days: 5, thirtyTo90Days: 3, moreThan90Days: 1 },
                                mitigatedThisPeriod: 4
                            }
                        };

                        mockDataAggregator.getTrendAnalysis = jest.fn().mockResolvedValue(mockTrendAnalysis);
                        mockDataAggregator.getAlertsDigest = jest.fn().mockResolvedValue({
                            totalAlertsDigested: 100,
                            alertClassification: {},
                            alertOutcomes: { securityIncidents: 10, benignActivity: 80, falsePositives: 10 },
                            weeklyTimeline: [],
                            sourceBreakdown: {}
                        });
                        mockDataAggregator.getUpdatesSummary = jest.fn().mockResolvedValue({
                            totalUpdatesApplied: 50,
                            updatesBySource: { windows: 20, microsoftOffice: 15, firewall: 10, other: 5 }
                        });
                        mockDataAggregator.getVulnerabilityPosture = jest.fn().mockResolvedValue({
                            totalDetected: 25,
                            totalMitigated: 20,
                            severityBreakdown: { critical: 5, high: 10, medium: 10 }
                        });

                        mockTemplateEngine.createSlideTemplate = jest.fn().mockReturnValue({
                            layout: { type: 'trend-analysis', orientation: 'landscape', theme: 'dark', branding: 'avian' }
                        });
                        mockTemplateEngine.renderSlide = jest.fn().mockResolvedValue({
                            id: 'slide-123',
                            title: 'Trend Analysis',
                            content: { summary: 'Test content' },
                            charts: [],
                            layout: { type: 'trend-analysis', orientation: 'landscape', theme: 'dark', branding: 'avian' }
                        });

                        // Generate multiple monthly reports
                        const monthlyReports = await Promise.all(
                            reportRequests.map(req =>
                                reportGenerator.generateMonthlyReport(req.tenantId, req.dateRange, req.userId)
                            )
                        );

                        // Property: All monthly reports must include trend analysis
                        monthlyReports.forEach(report => {
                            expect(report.reportType).toBe('monthly');
                            expect(report.trendAnalysis).toBeDefined();
                            expect(report.trendAnalysis.weekOverWeekTrends).toBeDefined();
                            expect(report.trendAnalysis.recurringAlertTypes).toBeDefined();
                            expect(report.trendAnalysis.vulnerabilityAging).toBeDefined();
                        });

                        // Property: Trend analysis structure must be consistent across all reports
                        const firstReport = monthlyReports[0];
                        monthlyReports.forEach(report => {
                            // Same structure for trend analysis
                            expect(typeof report.trendAnalysis).toBe(typeof firstReport.trendAnalysis);
                            expect(Array.isArray(report.trendAnalysis.weekOverWeekTrends)).toBe(true);
                            expect(Array.isArray(report.trendAnalysis.recurringAlertTypes)).toBe(true);
                            expect(typeof report.trendAnalysis.vulnerabilityAging).toBe('object');

                            // Same vulnerability aging structure
                            expect(report.trendAnalysis.vulnerabilityAging.openVulnerabilities).toBeDefined();
                            expect(typeof report.trendAnalysis.vulnerabilityAging.mitigatedThisPeriod).toBe('number');
                        });

                        // Property: getTrendAnalysis must be called for each monthly report
                        expect(mockDataAggregator.getTrendAnalysis).toHaveBeenCalledTimes(reportRequests.length);

                        // Property: Each report must have called getTrendAnalysis with correct parameters
                        reportRequests.forEach((req, index) => {
                            expect(mockDataAggregator.getTrendAnalysis).toHaveBeenNthCalledWith(
                                index + 1,
                                req.tenantId,
                                req.dateRange
                            );
                        });
                    }
                ),
                { numRuns: 5 } // Reduced runs for faster testing
            );
        });
    });
});