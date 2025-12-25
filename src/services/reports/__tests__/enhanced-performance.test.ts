/**
 * Performance Testing for Enhanced Features
 * 
 * Tests report generation performance with narrative layer
 * Validates PDF export performance with enhanced formatting
 * Tests concurrent user scenarios with new UI components
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { performance } from 'perf_hooks';
import { ReportGenerator } from '../ReportGenerator';
import { NarrativeGenerator } from '../NarrativeGenerator';
import { PDFGenerator } from '../PDFGenerator';
import { ReportSnapshotService } from '../ReportSnapshotService';
import { CustomBrandingService } from '../CustomBrandingService';
import { PerformanceMonitor } from '../PerformanceMonitor';
import type { EnhancedDateRange, PerformanceMetrics } from '../../types/reports';

describe('Enhanced Features Performance Tests', () => {
    let reportGenerator: ReportGenerator;
    let narrativeGenerator: NarrativeGenerator;
    let pdfGenerator: PDFGenerator;
    let snapshotService: ReportSnapshotService;
    let brandingService: CustomBrandingService;
    let performanceMonitor: PerformanceMonitor;

    const mockTenantId = 'perf-test-tenant';
    const mockUserId = 'perf-test-user';

    // Performance thresholds (in milliseconds)
    const PERFORMANCE_THRESHOLDS = {
        weeklyReportGeneration: 5000,    // 5 seconds
        monthlyReportGeneration: 8000,   // 8 seconds
        quarterlyReportGeneration: 10000, // 10 seconds
        narrativeGeneration: 2000,       // 2 seconds
        pdfExport: 15000,               // 15 seconds
        snapshotCreation: 1000,         // 1 second
        concurrentUsers: 20000          // 20 seconds for 10 concurrent users
    };

    beforeEach(() => {
        reportGenerator = new ReportGenerator();
        narrativeGenerator = new NarrativeGenerator();
        pdfGenerator = new PDFGenerator();
        snapshotService = new ReportSnapshotService();
        brandingService = new CustomBrandingService();
        performanceMonitor = new PerformanceMonitor();
    });

    afterEach(() => {
        performanceMonitor.reset();
    });

    describe('Report Generation Performance with Narrative Layer', () => {
        it('should generate weekly reports with narrative within performance threshold', async () => {
            const dateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            const startTime = performance.now();

            // Generate report with enhanced narrative features
            const report = await reportGenerator.generateWeeklyReport(mockTenantId, dateRange);

            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.weeklyReportGeneration);
            expect(report).toBeDefined();
            expect(report.slides).toHaveLength(4);

            // Verify narrative components are included
            const executiveSlide = report.slides.find(s => s.title.includes('Executive Overview'));
            expect(executiveSlide?.content.executiveSummary).toBeDefined();
            expect(executiveSlide?.content.keyTakeaways).toHaveLength(3);

            // Log performance metrics
            performanceMonitor.recordMetric('weekly_report_generation', duration);
        });

        it('should generate monthly reports with trends within performance threshold', async () => {
            const dateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            const startTime = performance.now();

            // Generate monthly report with trend analysis
            const report = await reportGenerator.generateMonthlyReport(mockTenantId, dateRange);

            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.monthlyReportGeneration);
            expect(report).toBeDefined();
            expect(report.reportType).toBe('monthly');

            // Verify trend analysis components
            const trendsSlide = report.slides.find(s => s.title.includes('Trends'));
            expect(trendsSlide?.content.weekOverWeekComparison).toBeDefined();

            performanceMonitor.recordMetric('monthly_report_generation', duration);
        });

        it('should generate quarterly reports with executive focus within performance threshold', async () => {
            const dateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-03-31'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            const startTime = performance.now();

            // Generate quarterly report (business-focused)
            const report = await reportGenerator.generateQuarterlyReport(mockTenantId, dateRange);

            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.quarterlyReportGeneration);
            expect(report).toBeDefined();
            expect(report.slides.length).toBeLessThanOrEqual(5);

            // Verify executive focus
            const businessImpactSlide = report.slides.find(s => s.title.includes('Business Impact'));
            expect(businessImpactSlide?.content.riskReduction).toBeDefined();

            performanceMonitor.recordMetric('quarterly_report_generation', duration);
        });

        it('should generate narrative content within performance threshold', async () => {
            const mockData = {
                alertsDigested: 150,
                securityIncidents: 5,
                vulnerabilitiesDetected: 25,
                vulnerabilitiesMitigated: 20,
                riskTrend: 'decreasing' as const
            };

            const startTime = performance.now();

            // Generate narrative content
            const narrative = await narrativeGenerator.generateExecutiveSummary(mockData);
            const keyTakeaways = await narrativeGenerator.generateKeyTakeaways(mockData);
            const recommendations = await narrativeGenerator.generateRecommendations(mockData);

            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.narrativeGeneration);
            expect(narrative).toBeDefined();
            expect(keyTakeaways).toHaveLength(3);
            expect(recommendations).toBeDefined();

            performanceMonitor.recordMetric('narrative_generation', duration);
        });
    });

    describe('PDF Export Performance with Enhanced Formatting', () => {
        it('should export enhanced PDFs within performance threshold', async () => {
            // Generate report with all enhanced features
            const dateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            const report = await reportGenerator.generateWeeklyReport(mockTenantId, dateRange);
            const snapshot = await snapshotService.createSnapshot(report, mockUserId);

            // Apply custom branding
            const brandedSnapshot = await brandingService.applyCustomBranding(snapshot, mockTenantId);

            const startTime = performance.now();

            // Export to PDF with enhanced formatting
            const pdfBuffer = await pdfGenerator.exportToPDF(brandedSnapshot);

            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.pdfExport);
            expect(pdfBuffer).toBeDefined();
            expect(pdfBuffer.length).toBeGreaterThan(1000);

            // Verify PDF quality
            const validation = await pdfGenerator.validatePDFOutput(pdfBuffer);
            expect(validation.isClientReady).toBe(true);
            expect(validation.hasProperBranding).toBe(true);

            performanceMonitor.recordMetric('pdf_export_enhanced', duration);
        });

        it('should handle large datasets in PDF export efficiently', async () => {
            // Create report with large dataset simulation
            const largeDatasetRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-03-31'), // Full quarter
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            const report = await reportGenerator.generateQuarterlyReport(mockTenantId, largeDatasetRange);
            const snapshot = await snapshotService.createSnapshot(report, mockUserId);

            const startTime = performance.now();

            const pdfBuffer = await pdfGenerator.exportToPDF(snapshot);

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Should still be within threshold even with large dataset
            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.pdfExport * 1.5); // 50% tolerance for large data
            expect(pdfBuffer).toBeDefined();

            performanceMonitor.recordMetric('pdf_export_large_dataset', duration);
        });

        it('should optimize PDF storage and retrieval performance', async () => {
            const dateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            const report = await reportGenerator.generateWeeklyReport(mockTenantId, dateRange);
            const snapshot = await snapshotService.createSnapshot(report, mockUserId);
            const pdfBuffer = await pdfGenerator.exportToPDF(snapshot);

            // Test storage performance
            const storageStartTime = performance.now();
            const storageKey = await pdfGenerator.storePDF(pdfBuffer, snapshot.id);
            const storageEndTime = performance.now();
            const storageDuration = storageEndTime - storageStartTime;

            expect(storageDuration).toBeLessThan(2000); // 2 seconds for storage
            expect(storageKey).toBeDefined();

            // Test retrieval performance
            const retrievalStartTime = performance.now();
            const retrievedPDF = await pdfGenerator.downloadFromSnapshot(snapshot.id);
            const retrievalEndTime = performance.now();
            const retrievalDuration = retrievalEndTime - retrievalStartTime;

            expect(retrievalDuration).toBeLessThan(1000); // 1 second for retrieval
            expect(Buffer.compare(retrievedPDF, pdfBuffer)).toBe(0);

            performanceMonitor.recordMetric('pdf_storage', storageDuration);
            performanceMonitor.recordMetric('pdf_retrieval', retrievalDuration);
        });
    });

    describe('Concurrent User Scenarios', () => {
        it('should handle multiple concurrent report generations', async () => {
            const dateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            const concurrentUsers = 10;
            const tenantIds = Array.from({ length: concurrentUsers }, (_, i) => `tenant-${i}`);

            const startTime = performance.now();

            // Simulate concurrent report generation
            const reportPromises = tenantIds.map(tenantId =>
                reportGenerator.generateWeeklyReport(tenantId, dateRange)
            );

            const reports = await Promise.all(reportPromises);

            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.concurrentUsers);
            expect(reports).toHaveLength(concurrentUsers);

            // Verify all reports are valid
            reports.forEach((report, index) => {
                expect(report.tenantId).toBe(`tenant-${index}`);
                expect(report.slides).toHaveLength(4);
            });

            performanceMonitor.recordMetric('concurrent_report_generation', duration);
        });

        it('should handle concurrent PDF exports efficiently', async () => {
            const dateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            // Pre-generate reports and snapshots
            const concurrentExports = 5;
            const snapshots = await Promise.all(
                Array.from({ length: concurrentExports }, async (_, i) => {
                    const report = await reportGenerator.generateWeeklyReport(`tenant-${i}`, dateRange);
                    return snapshotService.createSnapshot(report, `user-${i}`);
                })
            );

            const startTime = performance.now();

            // Concurrent PDF exports
            const pdfPromises = snapshots.map(snapshot =>
                pdfGenerator.exportToPDF(snapshot)
            );

            const pdfs = await Promise.all(pdfPromises);

            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.pdfExport * 2); // Allow 2x time for concurrent
            expect(pdfs).toHaveLength(concurrentExports);

            // Verify all PDFs are valid
            pdfs.forEach(pdf => {
                expect(pdf).toBeDefined();
                expect(pdf.length).toBeGreaterThan(1000);
            });

            performanceMonitor.recordMetric('concurrent_pdf_export', duration);
        });

        it('should maintain performance under mixed workload', async () => {
            const dateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            const startTime = performance.now();

            // Mixed workload: report generation, PDF export, snapshot operations
            const mixedPromises = [
                // Report generations
                reportGenerator.generateWeeklyReport('tenant-1', dateRange),
                reportGenerator.generateMonthlyReport('tenant-2', {
                    ...dateRange,
                    endDate: new Date('2024-01-31')
                }),

                // Snapshot operations
                (async () => {
                    const report = await reportGenerator.generateWeeklyReport('tenant-3', dateRange);
                    return snapshotService.createSnapshot(report, 'user-3');
                })(),

                // PDF export
                (async () => {
                    const report = await reportGenerator.generateWeeklyReport('tenant-4', dateRange);
                    const snapshot = await snapshotService.createSnapshot(report, 'user-4');
                    return pdfGenerator.exportToPDF(snapshot);
                })(),

                // Narrative generation
                narrativeGenerator.generateExecutiveSummary({
                    alertsDigested: 100,
                    securityIncidents: 3,
                    vulnerabilitiesDetected: 15,
                    vulnerabilitiesMitigated: 12,
                    riskTrend: 'stable' as const
                })
            ];

            const results = await Promise.all(mixedPromises);

            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.concurrentUsers);
            expect(results).toHaveLength(5);

            // Verify all operations completed successfully
            expect(results[0]).toBeDefined(); // Weekly report
            expect(results[1]).toBeDefined(); // Monthly report
            expect(results[2]).toBeDefined(); // Snapshot
            expect(results[3]).toBeDefined(); // PDF
            expect(results[4]).toBeDefined(); // Narrative

            performanceMonitor.recordMetric('mixed_workload', duration);
        });
    });

    describe('Memory and Resource Usage', () => {
        it('should maintain reasonable memory usage during report generation', async () => {
            const dateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            const initialMemory = process.memoryUsage();

            // Generate multiple reports to test memory usage
            const reports = await Promise.all([
                reportGenerator.generateWeeklyReport('tenant-1', dateRange),
                reportGenerator.generateMonthlyReport('tenant-2', {
                    ...dateRange,
                    endDate: new Date('2024-01-31')
                }),
                reportGenerator.generateQuarterlyReport('tenant-3', {
                    ...dateRange,
                    endDate: new Date('2024-03-31')
                })
            ]);

            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

            // Memory increase should be reasonable (less than 100MB)
            expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
            expect(reports).toHaveLength(3);

            performanceMonitor.recordMetric('memory_usage_reports', memoryIncrease);
        });

        it('should clean up resources after PDF generation', async () => {
            const dateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            const report = await reportGenerator.generateWeeklyReport(mockTenantId, dateRange);
            const snapshot = await snapshotService.createSnapshot(report, mockUserId);

            const initialMemory = process.memoryUsage();

            // Generate PDF and measure memory
            const pdfBuffer = await pdfGenerator.exportToPDF(snapshot);

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

            // Memory increase should be minimal after cleanup
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
            expect(pdfBuffer).toBeDefined();

            performanceMonitor.recordMetric('memory_usage_pdf', memoryIncrease);
        });
    });

    describe('Performance Monitoring and Metrics', () => {
        it('should collect comprehensive performance metrics', async () => {
            const dateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            // Perform various operations while monitoring
            await performanceMonitor.measureOperation('full_workflow', async () => {
                const report = await reportGenerator.generateWeeklyReport(mockTenantId, dateRange);
                const snapshot = await snapshotService.createSnapshot(report, mockUserId);
                const pdfBuffer = await pdfGenerator.exportToPDF(snapshot);
                await pdfGenerator.storePDF(pdfBuffer, snapshot.id);
            });

            const metrics = performanceMonitor.getMetrics();

            expect(metrics.full_workflow).toBeDefined();
            expect(metrics.full_workflow.duration).toBeGreaterThan(0);
            expect(metrics.full_workflow.operations).toBeGreaterThan(0);
        });

        it('should identify performance bottlenecks', async () => {
            const dateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            // Measure individual components
            const dataAggregationTime = await performanceMonitor.measureOperation('data_aggregation', async () => {
                return reportGenerator.aggregateData(mockTenantId, dateRange);
            });

            const narrativeTime = await performanceMonitor.measureOperation('narrative_generation', async () => {
                return narrativeGenerator.generateExecutiveSummary({
                    alertsDigested: 200,
                    securityIncidents: 8,
                    vulnerabilitiesDetected: 30,
                    vulnerabilitiesMitigated: 25,
                    riskTrend: 'improving' as const
                });
            });

            const templateTime = await performanceMonitor.measureOperation('template_rendering', async () => {
                const report = await reportGenerator.generateMonthlyReport(mockTenantId, dateRange);
                return report.slides;
            });

            // Analyze bottlenecks
            const bottlenecks = performanceMonitor.identifyBottlenecks();

            expect(bottlenecks).toBeDefined();
            expect(Array.isArray(bottlenecks)).toBe(true);

            // Log performance analysis
            console.log('Performance Analysis:', {
                dataAggregation: dataAggregationTime,
                narrativeGeneration: narrativeTime,
                templateRendering: templateTime,
                bottlenecks
            });
        });
    });

    afterAll(() => {
        // Generate performance report
        const performanceReport = performanceMonitor.generateReport();
        console.log('Enhanced Features Performance Report:', performanceReport);

        // Verify all operations met performance thresholds
        const failedThresholds = performanceReport.metrics.filter(
            (metric: any) => metric.duration > PERFORMANCE_THRESHOLDS[metric.operation as keyof typeof PERFORMANCE_THRESHOLDS]
        );

        if (failedThresholds.length > 0) {
            console.warn('Performance thresholds exceeded:', failedThresholds);
        }
    });
});