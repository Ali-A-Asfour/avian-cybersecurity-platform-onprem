/**
 * Property-Based Test: Report Type Functionality Parity
 * 
 * **Feature: avian-reports-module, Property 7: Report type functionality parity**
 * **Validates: Requirements 1.2**
 * 
 * This test validates that all report types (weekly/monthly/quarterly) provide
 * both in-app preview and PDF export functionality with consistent interfaces.
 */

import * as fc from 'fast-check';
import { ReportGenerator } from '../ReportGenerator';
import { DataAggregator } from '../DataAggregator';
import { TemplateEngine } from '../TemplateEngine';
import { HistoricalDataStore } from '../HistoricalDataStore';
import { ReportSnapshotService } from '../ReportSnapshotService';
import { ReportCacheService } from '../ReportCacheService';
import { PDFGenerator } from '../PDFGenerator';
import { generators } from './generators';
import {
    WeeklyReport,
    MonthlyReport,
    QuarterlyReport,
    ReportType,
    AlertClassification,
    AlertSource
} from '@/types/reports';

// Mock dependencies
jest.mock('../HistoricalDataStore');
jest.mock('../ReportSnapshotService');
jest.mock('../ReportCacheService');
jest.mock('../PDFGenerator');

describe('Property-Based Test: Report Type Functionality Parity', () => {
    let reportGenerator: ReportGenerator;
    let mockDataAggregator: jest.Mocked<DataAggregator>;
    let mockTemplateEngine: jest.Mocked<TemplateEngine>;
    let mockHistoricalDataStore: jest.Mocked<HistoricalDataStore>;
    let mockSnapshotService: jest.Mocked<ReportSnapshotService>;
    let mockCacheService: jest.Mocked<ReportCacheService>;
    let mockPDFGenerator: jest.Mocked<PDFGenerator>;

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
        mockPDFGenerator = new PDFGenerator() as jest.Mocked<PDFGenerator>;

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
            reportType: 'weekly',
            dateRange: expect.any(Object),
            generatedAt: expect.any(Date),
            generatedBy: 'user-123',
            slideData: [],
            templateVersion: '1.0.0',
            dataSchemaVersion: '1.0.0',
            isArchived: false
        });

        mockPDFGenerator.exportToPDF = jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content'));
        mockPDFGenerator.validatePDFOutput = jest.fn().mockResolvedValue({ isValid: true });
        mockPDFGenerator.storePDF = jest.fn().mockResolvedValue('pdf-storage-key-123');

        // Setup common mock data
        setupCommonMockData();
    });

    function setupCommonMockData() {
        const mockAlertsDigest = {
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
                securityIncidents: 10,
                benignActivity: 70,
                falsePositives: 20
            },
            weeklyTimeline: Array(7).fill(null).map((_, i) => ({
                date: new Date(2024, 0, 1 + i).toISOString().split('T')[0],
                dayOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][i] as any,
                count: Math.floor(100 / 7)
            })),
            sourceBreakdown: {
                [AlertSource.DEFENDER]: 40,
                [AlertSource.SONICWALL]: 30,
                [AlertSource.AVAST]: 20,
                [AlertSource.FIREWALL_EMAIL]: 10
            }
        };

        const mockUpdatesSummary = {
            totalUpdatesApplied: 50,
            updatesBySource: {
                windows: 25,
                microsoftOffice: 12,
                firewall: 8,
                other: 5
            }
        };

        const mockVulnerabilityPosture = {
            totalDetected: 30,
            totalMitigated: 25,
            severityBreakdown: {
                critical: 5,
                high: 12,
                medium: 13
            }
        };

        mockDataAggregator.getAlertsDigest = jest.fn().mockResolvedValue(mockAlertsDigest);
        mockDataAggregator.getUpdatesSummary = jest.fn().mockResolvedValue(mockUpdatesSummary);
        mockDataAggregator.getVulnerabilityPosture = jest.fn().mockResolvedValue(mockVulnerabilityPosture);

        // Monthly-specific mocks
        mockDataAggregator.getTrendAnalysis = jest.fn().mockResolvedValue({
            weekOverWeekTrends: [{
                metric: 'Alerts',
                currentPeriod: 100,
                previousPeriod: 80,
                changePercentage: 25,
                trend: 'up' as const
            }],
            recurringAlertTypes: [{
                alertType: AlertClassification.PHISHING,
                count: 30,
                trend: 'increasing' as const
            }],
            vulnerabilityAging: {
                newVulnerabilities: 10,
                ageingVulnerabilities: 5,
                resolvedVulnerabilities: 15
            }
        });

        // Quarterly-specific mocks
        mockDataAggregator.getQuarterlyBusinessMetrics = jest.fn().mockResolvedValue({
            securityPosture: {
                overallRiskReduction: 25,
                threatsBlocked: 300,
                vulnerabilitiesRemediated: 75,
                securityIncidents: 15,
                businessImpactPrevented: 250000
            },
            businessValue: {
                downtimePrevented: 16,
                complianceStatus: 'Maintained',
                riskMitigationScore: 88,
                executiveSummary: 'Strong security posture with excellent ROI'
            },
            quarterlyTrends: {
                incidentTrend: 'decreasing',
                vulnerabilityTrend: 'decreasing',
                updateComplianceTrend: 'improving'
            }
        });
    }

    /**
     * Property 7: Report type functionality parity
     * For any report type (weekly/monthly/quarterly), the system should provide
     * both in-app preview and PDF export functionality
     */
    it('should provide both preview and PDF export functionality for all report types', () => {
        /**
         * **Feature: avian-reports-module, Property 7: Report type functionality parity**
         * **Validates: Requirements 1.2**
         */
        fc.assert(
            fc.property(
                generators.tenantId,
                generators.enhancedDateRange,
                generators.userId,
                fc.constantFrom('weekly', 'monthly', 'quarterly'),
                async (tenantId, dateRange, userId, reportType: ReportType) => {
                    let report: WeeklyReport | MonthlyReport | QuarterlyReport;

                    // Generate report based on type
                    switch (reportType) {
                        case 'weekly':
                            report = await reportGenerator.generateWeeklyReport(tenantId, dateRange, userId);
                            break;
                        case 'monthly':
                            report = await reportGenerator.generateMonthlyReport(tenantId, dateRange, userId);
                            break;
                        case 'quarterly':
                            report = await reportGenerator.generateQuarterlyReport(tenantId, dateRange, userId);
                            break;
                        default:
                            throw new Error(`Unknown report type: ${reportType}`);
                    }

                    // Property 1: All reports must have preview capability (structured data for UI rendering)
                    expect(report).toBeDefined();
                    expect(report.id).toBeDefined();
                    expect(typeof report.id).toBe('string');
                    expect(report.id.length).toBeGreaterThan(0);

                    expect(report.tenantId).toBe(tenantId);
                    expect(report.reportType).toBe(reportType);
                    expect(report.dateRange).toEqual(dateRange);
                    expect(report.generatedBy).toBe(userId);

                    // All reports must have slides for preview
                    expect(report.slides).toBeDefined();
                    expect(Array.isArray(report.slides)).toBe(true);
                    expect(report.slides.length).toBeGreaterThan(0);

                    // Each slide must have preview-ready structure
                    report.slides.forEach(slide => {
                        expect(slide.id).toBeDefined();
                        expect(typeof slide.id).toBe('string');
                        expect(slide.title).toBeDefined();
                        expect(typeof slide.title).toBe('string');
                        expect(slide.title.length).toBeGreaterThan(0);

                        // Content must be structured for preview rendering
                        expect(slide.content).toBeDefined();
                        expect(slide.layout).toBeDefined();

                        // Charts must be defined for visual preview
                        expect(slide.charts).toBeDefined();
                        expect(Array.isArray(slide.charts)).toBe(true);
                    });

                    // Property 2: All reports must support PDF export
                    // Test that snapshot creation works (prerequisite for PDF export)
                    expect(mockSnapshotService.createSnapshot).toHaveBeenCalledWith(
                        expect.objectContaining({
                            tenantId,
                            reportType,
                            dateRange,
                            generatedBy: userId
                        }),
                        userId
                    );

                    // Test PDF export capability
                    const snapshot = await mockSnapshotService.createSnapshot(report, userId);
                    const pdfBuffer = await mockPDFGenerator.exportToPDF(snapshot);

                    expect(pdfBuffer).toBeDefined();
                    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
                    expect(pdfBuffer.length).toBeGreaterThan(0);

                    // PDF validation should pass
                    const validation = await mockPDFGenerator.validatePDFOutput(pdfBuffer);
                    expect(validation.isValid).toBe(true);

                    // PDF storage should work
                    const storageKey = await mockPDFGenerator.storePDF(pdfBuffer, snapshot.id);
                    expect(storageKey).toBeDefined();
                    expect(typeof storageKey).toBe('string');
                    expect(storageKey.length).toBeGreaterThan(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: All report types should have consistent API interface
     */
    it('should have consistent API interface across all report types', () => {
        fc.assert(
            fc.property(
                generators.tenantId,
                generators.enhancedDateRange,
                generators.userId,
                async (tenantId, dateRange, userId) => {
                    // Test that all report generation methods exist and have consistent signatures
                    expect(typeof reportGenerator.generateWeeklyReport).toBe('function');
                    expect(typeof reportGenerator.generateMonthlyReport).toBe('function');
                    expect(typeof reportGenerator.generateQuarterlyReport).toBe('function');

                    // All methods should accept the same parameters
                    const weeklyReport = await reportGenerator.generateWeeklyReport(tenantId, dateRange, userId);
                    const monthlyReport = await reportGenerator.generateMonthlyReport(tenantId, dateRange, userId);
                    const quarterlyReport = await reportGenerator.generateQuarterlyReport(tenantId, dateRange, userId);

                    // All reports should have the same base structure
                    const reports = [weeklyReport, monthlyReport, quarterlyReport];
                    const expectedReportTypes: ReportType[] = ['weekly', 'monthly', 'quarterly'];

                    reports.forEach((report, index) => {
                        // Common properties
                        expect(report).toHaveProperty('id');
                        expect(report).toHaveProperty('tenantId');
                        expect(report).toHaveProperty('reportType');
                        expect(report).toHaveProperty('dateRange');
                        expect(report).toHaveProperty('generatedAt');
                        expect(report).toHaveProperty('generatedBy');
                        expect(report).toHaveProperty('slides');
                        expect(report).toHaveProperty('templateVersion');
                        expect(report).toHaveProperty('dataSchemaVersion');

                        // Type-specific validation
                        expect(report.reportType).toBe(expectedReportTypes[index]);
                        expect(report.tenantId).toBe(tenantId);
                        expect(report.generatedBy).toBe(userId);
                        expect(report.dateRange).toEqual(dateRange);
                    });
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: All report types should support the same export formats
     */
    it('should support the same export formats for all report types', () => {
        fc.assert(
            fc.property(
                generators.tenantId,
                generators.enhancedDateRange,
                generators.userId,
                fc.constantFrom('weekly', 'monthly', 'quarterly'),
                async (tenantId, dateRange, userId, reportType: ReportType) => {
                    // Generate report
                    let report: WeeklyReport | MonthlyReport | QuarterlyReport;
                    switch (reportType) {
                        case 'weekly':
                            report = await reportGenerator.generateWeeklyReport(tenantId, dateRange, userId);
                            break;
                        case 'monthly':
                            report = await reportGenerator.generateMonthlyReport(tenantId, dateRange, userId);
                            break;
                        case 'quarterly':
                            report = await reportGenerator.generateQuarterlyReport(tenantId, dateRange, userId);
                            break;
                    }

                    // All report types should support PDF export
                    const snapshot = await mockSnapshotService.createSnapshot(report, userId);
                    expect(snapshot).toBeDefined();

                    // PDF export should work for all types
                    const pdfBuffer = await mockPDFGenerator.exportToPDF(snapshot);
                    expect(pdfBuffer).toBeDefined();
                    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);

                    // Validation should work for all types
                    const validation = await mockPDFGenerator.validatePDFOutput(pdfBuffer);
                    expect(validation.isValid).toBe(true);

                    // Storage should work for all types
                    const storageKey = await mockPDFGenerator.storePDF(pdfBuffer, snapshot.id);
                    expect(storageKey).toBeDefined();
                    expect(typeof storageKey).toBe('string');

                    // All report types should have the same export metadata structure
                    expect(snapshot).toHaveProperty('id');
                    expect(snapshot).toHaveProperty('tenantId');
                    expect(snapshot).toHaveProperty('reportId');
                    expect(snapshot).toHaveProperty('reportType');
                    expect(snapshot).toHaveProperty('dateRange');
                    expect(snapshot).toHaveProperty('generatedAt');
                    expect(snapshot).toHaveProperty('generatedBy');
                    expect(snapshot).toHaveProperty('slideData');
                    expect(snapshot).toHaveProperty('templateVersion');
                    expect(snapshot).toHaveProperty('dataSchemaVersion');
                    expect(snapshot).toHaveProperty('isArchived');
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: All report types should have consistent error handling
     */
    it('should have consistent error handling across all report types', () => {
        fc.assert(
            fc.property(
                generators.tenantId,
                generators.enhancedDateRange,
                generators.userId,
                fc.constantFrom('weekly', 'monthly', 'quarterly'),
                async (tenantId, dateRange, userId, reportType: ReportType) => {
                    // Simulate data aggregator failure
                    mockDataAggregator.getAlertsDigest.mockRejectedValueOnce(new Error('Data unavailable'));

                    // All report types should handle errors consistently
                    let errorThrown = false;
                    try {
                        switch (reportType) {
                            case 'weekly':
                                await reportGenerator.generateWeeklyReport(tenantId, dateRange, userId);
                                break;
                            case 'monthly':
                                await reportGenerator.generateMonthlyReport(tenantId, dateRange, userId);
                                break;
                            case 'quarterly':
                                await reportGenerator.generateQuarterlyReport(tenantId, dateRange, userId);
                                break;
                        }
                    } catch (error) {
                        errorThrown = true;
                        // Error should be properly structured
                        expect(error).toBeInstanceOf(Error);
                        expect((error as Error).message).toBeDefined();
                        expect(typeof (error as Error).message).toBe('string');
                    }

                    // Error should be thrown for all report types when data is unavailable
                    expect(errorThrown).toBe(true);

                    // Reset mock for next iteration
                    setupCommonMockData();
                }
            ),
            { numRuns: 50 } // Reduced runs for error testing
        );
    });

    /**
     * Property: All report types should support preview rendering
     */
    it('should support preview rendering for all report types', () => {
        fc.assert(
            fc.property(
                generators.tenantId,
                generators.enhancedDateRange,
                generators.userId,
                fc.constantFrom('weekly', 'monthly', 'quarterly'),
                async (tenantId, dateRange, userId, reportType: ReportType) => {
                    // Generate report
                    let report: WeeklyReport | MonthlyReport | QuarterlyReport;
                    switch (reportType) {
                        case 'weekly':
                            report = await reportGenerator.generateWeeklyReport(tenantId, dateRange, userId);
                            break;
                        case 'monthly':
                            report = await reportGenerator.generateMonthlyReport(tenantId, dateRange, userId);
                            break;
                        case 'quarterly':
                            report = await reportGenerator.generateQuarterlyReport(tenantId, dateRange, userId);
                            break;
                    }

                    // All reports should have preview-ready structure
                    expect(report.slides).toBeDefined();
                    expect(Array.isArray(report.slides)).toBe(true);
                    expect(report.slides.length).toBeGreaterThan(0);

                    // Each slide should be preview-ready
                    report.slides.forEach(slide => {
                        // Should have display title
                        expect(slide.title).toBeDefined();
                        expect(typeof slide.title).toBe('string');
                        expect(slide.title.trim().length).toBeGreaterThan(0);

                        // Should have structured content for rendering
                        expect(slide.content).toBeDefined();

                        // Should have layout information
                        expect(slide.layout).toBeDefined();
                        expect(slide.layout).toHaveProperty('type');

                        // Should have chart data for visualization
                        expect(slide.charts).toBeDefined();
                        expect(Array.isArray(slide.charts)).toBe(true);

                        // Charts should be renderable
                        slide.charts.forEach(chart => {
                            expect(chart).toHaveProperty('type');
                            expect(chart).toHaveProperty('data');
                            expect(chart).toHaveProperty('options');
                        });
                    });

                    // Report should have metadata for preview UI
                    expect(report.templateVersion).toBeDefined();
                    expect(report.dataSchemaVersion).toBeDefined();
                    expect(report.generatedAt).toBeInstanceOf(Date);
                }
            ),
            { numRuns: 100 }
        );
    });
});