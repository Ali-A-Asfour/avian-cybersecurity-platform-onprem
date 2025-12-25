/**
 * Report Generator Service Tests
 * 
 * Tests for the main report generation functionality including
 * Weekly, Monthly, and Quarterly report generation.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ReportGenerator } from '../ReportGenerator';
import { DataAggregator } from '../DataAggregator';
import { TemplateEngine } from '../TemplateEngine';
import { HistoricalDataStore } from '../HistoricalDataStore';
import { ReportSnapshotService } from '../ReportSnapshotService';
import { EnhancedDateRange } from '@/types/reports';

// Mock dependencies
jest.mock('../DataAggregator');
jest.mock('../TemplateEngine');
jest.mock('../HistoricalDataStore');
jest.mock('../ReportSnapshotService');

describe('ReportGenerator', () => {
    let reportGenerator: ReportGenerator;
    let mockDataAggregator: jest.Mocked<DataAggregator>;
    let mockTemplateEngine: jest.Mocked<TemplateEngine>;
    let mockHistoricalDataStore: jest.Mocked<HistoricalDataStore>;
    let mockSnapshotService: jest.Mocked<ReportSnapshotService>;

    const mockDateRange: EnhancedDateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        timezone: 'America/Toronto',
        weekStart: 'monday'
    };

    const mockAlertsDigest = {
        totalAlertsDigested: 25,
        alertClassification: {
            phishing: 5,
            malware: 3,
            spyware: 2,
            authentication: 8,
            network: 4,
            other: 3
        },
        alertOutcomes: {
            securityIncidents: 2,
            benignActivity: 18,
            falsePositives: 5
        },
        weeklyTimeline: [
            { date: '2024-01-01', dayOfWeek: 'monday' as const, count: 4 },
            { date: '2024-01-02', dayOfWeek: 'tuesday' as const, count: 3 },
            { date: '2024-01-03', dayOfWeek: 'wednesday' as const, count: 5 },
            { date: '2024-01-04', dayOfWeek: 'thursday' as const, count: 2 },
            { date: '2024-01-05', dayOfWeek: 'friday' as const, count: 6 },
            { date: '2024-01-06', dayOfWeek: 'saturday' as const, count: 3 },
            { date: '2024-01-07', dayOfWeek: 'sunday' as const, count: 2 }
        ],
        sourceBreakdown: {
            defender: 10,
            sonicwall: 8,
            avast: 4,
            firewall_email: 3
        }
    };

    const mockUpdatesSummary = {
        totalUpdatesApplied: 45,
        updatesBySource: {
            windows: 20,
            microsoftOffice: 12,
            firewall: 8,
            other: 5
        }
    };

    const mockVulnerabilityPosture = {
        totalDetected: 15,
        totalMitigated: 12,
        severityBreakdown: {
            critical: 2,
            high: 5,
            medium: 8
        }
    };

    beforeEach(() => {
        // Create mocked instances
        mockDataAggregator = new DataAggregator({} as any, {} as any) as jest.Mocked<DataAggregator>;
        mockTemplateEngine = new TemplateEngine() as jest.Mocked<TemplateEngine>;
        mockHistoricalDataStore = new HistoricalDataStore() as jest.Mocked<HistoricalDataStore>;
        mockSnapshotService = new ReportSnapshotService() as jest.Mocked<ReportSnapshotService>;

        // Setup mock implementations
        mockDataAggregator.getAlertsDigest = jest.fn().mockResolvedValue(mockAlertsDigest);
        mockDataAggregator.getUpdatesSummary = jest.fn().mockResolvedValue(mockUpdatesSummary);
        mockDataAggregator.getVulnerabilityPosture = jest.fn().mockResolvedValue(mockVulnerabilityPosture);

        mockTemplateEngine.formatExecutiveFriendly = jest.fn().mockImplementation((text: string) => text);
        mockTemplateEngine.createWeeklyTimelineChart = jest.fn().mockReturnValue({
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{ label: 'Alerts Digested', data: [4, 3, 5, 2, 6, 3, 2] }]
        });
        mockTemplateEngine.createUpdatesProgressChart = jest.fn().mockReturnValue({
            labels: ['Windows', 'Microsoft Office', 'Firewall', 'Other'],
            datasets: [{ label: 'Updates Applied', data: [20, 12, 8, 5] }]
        });
        mockTemplateEngine.createVulnerabilityBreakdownChart = jest.fn().mockReturnValue({
            labels: ['Critical', 'High', 'Medium'],
            datasets: [{ label: 'Vulnerabilities', data: [2, 5, 8] }]
        });
        mockTemplateEngine.createEnhancedChartData = jest.fn().mockReturnValue({
            labels: [],
            datasets: []
        });

        mockSnapshotService.createSnapshot = jest.fn().mockResolvedValue({
            id: 'snapshot-123',
            tenantId: 'tenant-123',
            reportId: 'report-123'
        });

        // Create ReportGenerator instance with mocked dependencies
        reportGenerator = new ReportGenerator(
            mockDataAggregator,
            mockTemplateEngine,
            mockHistoricalDataStore,
            mockSnapshotService
        );
    });

    describe('generateWeeklyReport', () => {
        it('should generate a complete weekly report', async () => {
            const result = await reportGenerator.generateWeeklyReport(
                'tenant-123',
                mockDateRange,
                'user-123'
            );

            expect(result).toBeDefined();
            expect(result.reportType).toBe('weekly');
            expect(result.tenantId).toBe('tenant-123');
            expect(result.generatedBy).toBe('user-123');
            expect(result.slides).toHaveLength(4); // Executive, Alerts, Updates, Vulnerability

            // Verify data aggregation calls
            expect(mockDataAggregator.getAlertsDigest).toHaveBeenCalledWith('tenant-123', mockDateRange);
            expect(mockDataAggregator.getUpdatesSummary).toHaveBeenCalledWith('tenant-123', mockDateRange);
            expect(mockDataAggregator.getVulnerabilityPosture).toHaveBeenCalledWith('tenant-123', mockDateRange, 'weekly');

            // Verify snapshot creation
            expect(mockSnapshotService.createSnapshot).toHaveBeenCalled();
        });

        it('should validate input parameters', async () => {
            await expect(
                reportGenerator.generateWeeklyReport('', mockDateRange, 'user-123')
            ).rejects.toThrow('Valid tenant ID is required');

            await expect(
                reportGenerator.generateWeeklyReport('tenant-123', {
                    ...mockDateRange,
                    startDate: new Date('2024-01-07'),
                    endDate: new Date('2024-01-01')
                }, 'user-123')
            ).rejects.toThrow('Start date must be before end date');
        });

        it('should use proper terminology in slides', async () => {
            const result = await reportGenerator.generateWeeklyReport(
                'tenant-123',
                mockDateRange,
                'user-123'
            );

            // Check that alerts digest slide uses "Alerts Digested" terminology
            const alertsSlide = result.slides.find(slide => slide.title === 'Alerts Digested');
            expect(alertsSlide).toBeDefined();
            expect(alertsSlide?.title).toBe('Alerts Digested');

            // Check that updates slide uses "Updates Applied" terminology
            const updatesSlide = result.slides.find(slide => slide.title === 'Updates Applied');
            expect(updatesSlide).toBeDefined();
            expect(updatesSlide?.title).toBe('Updates Applied');
        });
    });

    describe('generateMonthlyReport', () => {
        beforeEach(() => {
            // Add trend analysis mock
            mockDataAggregator.getTrendAnalysis = jest.fn().mockResolvedValue({
                weekOverWeekTrends: [
                    {
                        metric: 'Total Alerts',
                        currentPeriod: 25,
                        previousPeriod: 30,
                        changePercentage: -16.67,
                        trend: 'down'
                    }
                ],
                recurringAlertTypes: [
                    {
                        alertType: 'authentication',
                        frequency: 8,
                        averageSeverity: 'medium',
                        topDevices: ['device-1', 'device-2']
                    }
                ],
                vulnerabilityAging: {
                    openVulnerabilities: {
                        lessThan30Days: 5,
                        thirtyTo90Days: 3,
                        moreThan90Days: 2
                    },
                    mitigatedThisPeriod: 12
                }
            });
        });

        it('should generate a complete monthly report with trends', async () => {
            const monthlyDateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
                timezone: 'America/Toronto',
                weekStart: 'monday'
            };

            const result = await reportGenerator.generateMonthlyReport(
                'tenant-123',
                monthlyDateRange,
                'user-123'
            );

            expect(result).toBeDefined();
            expect(result.reportType).toBe('monthly');
            expect(result.slides).toHaveLength(6); // Executive, Alerts, Updates, Vulnerability, Trends, Incidents

            // Verify trend analysis was called
            expect(mockDataAggregator.getTrendAnalysis).toHaveBeenCalledWith('tenant-123', monthlyDateRange);

            // Check for trend analysis slide
            const trendSlide = result.slides.find(slide => slide.title === 'Trend Analysis');
            expect(trendSlide).toBeDefined();
        });
    });

    describe('generateQuarterlyReport', () => {
        it('should generate a business-focused quarterly report', async () => {
            const quarterlyDateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-03-31'),
                timezone: 'America/Toronto',
                weekStart: 'monday'
            };

            const result = await reportGenerator.generateQuarterlyReport(
                'tenant-123',
                quarterlyDateRange,
                'user-123'
            );

            expect(result).toBeDefined();
            expect(result.reportType).toBe('quarterly');
            expect(result.slides).toHaveLength(4); // Executive, Security Posture, Risk Reduction, Business Value

            // Verify business-focused slides
            const businessValueSlide = result.slides.find(slide => slide.title === 'Business Value Delivered');
            expect(businessValueSlide).toBeDefined();

            const riskReductionSlide = result.slides.find(slide => slide.title === 'Risk Reduction Achievements');
            expect(riskReductionSlide).toBeDefined();
        });

        it('should exclude technical details in quarterly reports', async () => {
            const quarterlyDateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-03-31'),
                timezone: 'America/Toronto',
                weekStart: 'monday'
            };

            const result = await reportGenerator.generateQuarterlyReport(
                'tenant-123',
                quarterlyDateRange,
                'user-123'
            );

            // Should not include technical slides like individual alerts or updates
            const alertsSlide = result.slides.find(slide => slide.title === 'Alerts Digested');
            expect(alertsSlide).toBeUndefined();

            const updatesSlide = result.slides.find(slide => slide.title === 'Updates Applied');
            expect(updatesSlide).toBeUndefined();
        });
    });

    describe('validateReportGenerationParameters', () => {
        it('should validate all required parameters', () => {
            const validation = reportGenerator.validateReportGenerationParameters(
                'weekly',
                'tenant-123',
                mockDateRange,
                'user-123'
            );

            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        it('should detect invalid report types', () => {
            const validation = reportGenerator.validateReportGenerationParameters(
                'invalid' as any,
                'tenant-123',
                mockDateRange,
                'user-123'
            );

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Invalid report type. Must be weekly, monthly, or quarterly.');
        });

        it('should validate date range appropriateness', () => {
            const shortDateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-02'), // Only 1 day
                timezone: 'America/Toronto',
                weekStart: 'monday'
            };

            const validation = reportGenerator.validateReportGenerationParameters(
                'weekly',
                'tenant-123',
                shortDateRange,
                'user-123'
            );

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Weekly reports should cover approximately 7 days.');
        });
    });

    describe('getReportPreview', () => {
        it('should generate preview data for all report types', async () => {
            const preview = await reportGenerator.getReportPreview(
                'weekly',
                'tenant-123',
                mockDateRange
            );

            expect(preview).toBeDefined();
            expect(preview.reportingPeriod).toContain('Weekly Report');
            expect(preview.executiveSummary).toBeDefined();
            expect(preview.keyMetrics).toBeDefined();
            expect(preview.slideCount).toBe(4); // Weekly report has 4 slides
            expect(preview.estimatedGenerationTime).toBeGreaterThan(0);
        });
    });

    describe('getReportTypeCapabilities', () => {
        it('should return correct capabilities for each report type', () => {
            const weeklyCapabilities = reportGenerator.getReportTypeCapabilities('weekly');
            expect(weeklyCapabilities.supportsPreview).toBe(true);
            expect(weeklyCapabilities.supportsPDFExport).toBe(true);
            expect(weeklyCapabilities.expectedSlideCount).toBe(4);
            expect(weeklyCapabilities.includedSections).toContain('Executive Overview');
            expect(weeklyCapabilities.includedSections).toContain('Alerts Digest');

            const quarterlyCapabilities = reportGenerator.getReportTypeCapabilities('quarterly');
            expect(quarterlyCapabilities.expectedSlideCount).toBe(4);
            expect(quarterlyCapabilities.includedSections).toContain('Business Value Delivered');
            expect(quarterlyCapabilities.includedSections).not.toContain('Alerts Digest');
        });
    });
});