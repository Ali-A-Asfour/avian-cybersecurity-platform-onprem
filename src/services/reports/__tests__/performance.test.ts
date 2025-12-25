/**
 * Performance Tests for AVIAN Reports Module
 * 
 * Tests report generation performance with large datasets, PDF export performance,
 * and concurrent user scenarios to ensure system scalability
 * 
 * Requirements: 9.2, 9.5 - Performance and scalability testing
 */

import { ReportGenerator } from '../ReportGenerator';
import { DataAggregator } from '../DataAggregator';
import { HistoricalDataStore } from '../HistoricalDataStore';
import { TemplateEngine } from '../TemplateEngine';
import { PDFGenerator } from '../PDFGenerator';
import { ReportSnapshotService } from '../ReportSnapshotService';
import { AlertClassificationService } from '../AlertClassificationService';
import { ReportCacheService } from '../ReportCacheService';
import { EnhancedDateRange, AlertRecord, MetricsRecord } from '@/types/reports';

// Mock external dependencies
jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

jest.mock('@/lib/database', () => ({
    db: {
        select: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
    },
    withTransaction: jest.fn()
}));

jest.mock('playwright', () => ({
    chromium: {
        launch: jest.fn().mockResolvedValue({
            newPage: jest.fn().mockResolvedValue({
                setContent: jest.fn(),
                pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
                close: jest.fn(),
                evaluate: jest.fn().mockResolvedValue(undefined),
                waitForTimeout: jest.fn(),
                waitForLoadState: jest.fn(),
                addInitScript: jest.fn()
            }),
            close: jest.fn(),
            version: jest.fn().mockReturnValue('1.0.0')
        })
    }
}));

jest.mock('fs/promises', () => ({
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
    access: jest.fn(),
    stat: jest.fn().mockResolvedValue({ size: 1000 }),
    unlink: jest.fn()
}));

describe('Performance Tests', () => {
    let reportGenerator: ReportGenerator;
    let dataAggregator: DataAggregator;
    let historicalDataStore: HistoricalDataStore;
    let templateEngine: TemplateEngine;
    let pdfGenerator: PDFGenerator;
    let snapshotService: ReportSnapshotService;
    let alertClassificationService: AlertClassificationService;
    let cacheService: ReportCacheService;

    const mockDateRange: EnhancedDateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        timezone: 'America/Toronto',
        weekStart: 'monday'
    };

    const mockTenantId = 'perf-test-tenant';
    const mockUserId = 'perf-test-user';

    beforeEach(() => {
        jest.clearAllMocks();

        // Initialize services
        historicalDataStore = new HistoricalDataStore();
        alertClassificationService = new AlertClassificationService();
        dataAggregator = new DataAggregator(historicalDataStore, alertClassificationService);
        templateEngine = new TemplateEngine();
        pdfGenerator = new PDFGenerator(templateEngine);
        snapshotService = new ReportSnapshotService();
        cacheService = new ReportCacheService();
        reportGenerator = new ReportGenerator(
            dataAggregator,
            templateEngine,
            snapshotService,
            cacheService
        );

        // Mock transaction wrapper
        require('@/lib/database').withTransaction.mockImplementation((callback) =>
            callback(require('@/lib/database').db)
        );
    });

    afterEach(async () => {
        // Clean up resources to prevent Jest hanging
        try {
            await pdfGenerator.closeBrowser();
        } catch (error) {
            // Ignore cleanup errors in tests
        }

        // Clear all timers and intervals
        jest.clearAllTimers();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        // Final cleanup
        try {
            await pdfGenerator.closeBrowser();
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    /**
     * Generate mock alert records for performance testing
     */
    const generateMockAlerts = (count: number, tenantId: string): AlertRecord[] => {
        return Array.from({ length: count }, (_, i) => ({
            id: `alert-${tenantId}-${i}`,
            tenantId,
            rawAlertType: `Alert Type ${i % 10}`,
            normalizedType: ['phishing', 'malware', 'spyware', 'authentication', 'network', 'other'][i % 6] as any,
            severity: ['low', 'medium', 'high', 'critical'][i % 4] as any,
            outcome: ['security_incident', 'benign_activity', 'false_positive'][i % 3] as any,
            createdAt: new Date(`2024-01-0${(i % 7) + 1}T${(i % 24).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}:00Z`),
            resolvedAt: new Date(`2024-01-0${(i % 7) + 1}T${(i % 24).toString().padStart(2, '0')}:${((i % 60) + 30).toString().padStart(2, '0')}:00Z`),
            deviceId: `device-${i % 100}`,
            source: ['defender', 'sonicwall', 'avast', 'firewall_email'][i % 4] as any,
            sourceSubtype: `subtype-${i % 5}`
        }));
    };

    /**
     * Generate mock metrics records for performance testing
     */
    const generateMockMetrics = (count: number, tenantId: string): MetricsRecord[] => {
        return Array.from({ length: count }, (_, i) => ({
            id: `metrics-${tenantId}-${i}`,
            tenantId,
            deviceId: `device-${i % 100}`,
            date: new Date(`2024-01-0${(i % 7) + 1}T00:00:00Z`),
            threatsBlocked: Math.floor(Math.random() * 100),
            updatesApplied: Math.floor(Math.random() * 20),
            vulnerabilitiesDetected: Math.floor(Math.random() * 50),
            vulnerabilitiesMitigated: Math.floor(Math.random() * 30),
            source: ['firewall', 'edr'][i % 2] as any
        }));
    };

    describe('Large Dataset Performance', () => {
        it('should handle 10,000 alerts within acceptable time limits', async () => {
            const alertCount = 10000;
            const mockAlerts = generateMockAlerts(alertCount, mockTenantId);

            // Mock database to return large dataset
            const mockDb = require('@/lib/database').db;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue(mockAlerts)
                        })
                    })
                })
            });

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue({
                id: 'snapshot-large-dataset',
                tenantId: mockTenantId,
                reportId: 'report-large-dataset',
                reportType: 'weekly',
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: mockUserId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            });

            const startTime = performance.now();

            const report = await reportGenerator.generateWeeklyReport(
                mockTenantId,
                mockDateRange,
                mockUserId
            );

            const endTime = performance.now();
            const processingTime = endTime - startTime;

            expect(report).toBeDefined();
            expect(processingTime).toBeLessThan(15000); // Should complete within 15 seconds

            console.log(`Large dataset (${alertCount} alerts) processing time: ${processingTime.toFixed(2)}ms`);

            // Verify data was processed correctly
            const alertsSlide = report.slides.find(s => s.content.slideType === 'alerts-digest');
            expect(alertsSlide).toBeDefined();
            expect(alertsSlide?.content.summary).toContain(alertCount.toString());
        }, 30000); // 30 second timeout

        it('should handle 50,000 metrics records efficiently', async () => {
            const metricsCount = 50000;
            const mockMetrics = generateMockMetrics(metricsCount, mockTenantId);

            // Mock database to return large metrics dataset
            const mockDb = require('@/lib/database').db;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue(mockMetrics)
                        })
                    })
                })
            });

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue({
                id: 'snapshot-large-metrics',
                tenantId: mockTenantId,
                reportId: 'report-large-metrics',
                reportType: 'monthly',
                dateRange: {
                    ...mockDateRange,
                    endDate: new Date('2024-01-31')
                },
                generatedAt: new Date(),
                generatedBy: mockUserId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            });

            const startTime = performance.now();

            const report = await reportGenerator.generateMonthlyReport(
                mockTenantId,
                {
                    ...mockDateRange,
                    endDate: new Date('2024-01-31')
                },
                mockUserId
            );

            const endTime = performance.now();
            const processingTime = endTime - startTime;

            expect(report).toBeDefined();
            expect(processingTime).toBeLessThan(20000); // Should complete within 20 seconds

            console.log(`Large metrics dataset (${metricsCount} records) processing time: ${processingTime.toFixed(2)}ms`);

            // Verify metrics were processed
            const updatesSlide = report.slides.find(s => s.content.slideType === 'updates-summary');
            expect(updatesSlide).toBeDefined();
        }, 40000); // 40 second timeout

        it('should maintain performance with complex quarterly aggregations', async () => {
            const alertCount = 25000;
            const metricsCount = 75000;

            const mockAlerts = generateMockAlerts(alertCount, mockTenantId);
            const mockMetrics = generateMockMetrics(metricsCount, mockTenantId);

            // Mock database to return both datasets
            const mockDb = require('@/lib/database').db;
            let callCount = 0;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockImplementation(() => {
                                callCount++;
                                if (callCount <= 2) {
                                    return Promise.resolve(mockAlerts);
                                } else {
                                    return Promise.resolve(mockMetrics);
                                }
                            })
                        })
                    })
                })
            });

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue({
                id: 'snapshot-quarterly-complex',
                tenantId: mockTenantId,
                reportId: 'report-quarterly-complex',
                reportType: 'quarterly',
                dateRange: {
                    ...mockDateRange,
                    endDate: new Date('2024-03-31')
                },
                generatedAt: new Date(),
                generatedBy: mockUserId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            });

            const startTime = performance.now();

            const report = await reportGenerator.generateQuarterlyReport(
                mockTenantId,
                {
                    ...mockDateRange,
                    endDate: new Date('2024-03-31')
                },
                mockUserId
            );

            const endTime = performance.now();
            const processingTime = endTime - startTime;

            expect(report).toBeDefined();
            expect(processingTime).toBeLessThan(25000); // Should complete within 25 seconds

            console.log(`Complex quarterly aggregation processing time: ${processingTime.toFixed(2)}ms`);

            // Verify quarterly report structure
            expect(report.slides.length).toBeLessThanOrEqual(5); // Quarterly should be 3-5 slides
            const executiveSlide = report.slides.find(s => s.content.slideType === 'executive-overview');
            expect(executiveSlide).toBeDefined();
        }, 50000); // 50 second timeout
    });

    describe('PDF Export Performance', () => {
        it('should export PDF within acceptable time limits', async () => {
            const mockSnapshot = {
                id: 'snapshot-pdf-perf',
                tenantId: mockTenantId,
                reportId: 'report-pdf-perf',
                reportType: 'weekly' as const,
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: mockUserId,
                slideData: [
                    {
                        slideId: 'slide-1',
                        slideType: 'executive-overview',
                        title: 'Executive Overview',
                        subtitle: 'Performance Test Report',
                        summary: 'Testing PDF export performance with complex content.',
                        keyPoints: Array.from({ length: 20 }, (_, i) => `Key point ${i + 1}`),
                        charts: [
                            {
                                type: 'bar',
                                title: 'Performance Chart 1',
                                data: Array.from({ length: 50 }, (_, i) => ({
                                    label: `Item ${i}`,
                                    value: Math.random() * 100
                                }))
                            },
                            {
                                type: 'donut',
                                title: 'Performance Chart 2',
                                data: Array.from({ length: 10 }, (_, i) => ({
                                    label: `Category ${i}`,
                                    value: Math.random() * 50
                                }))
                            }
                        ],
                        computedMetrics: {
                            totalAlerts: 5000,
                            totalUpdates: 500,
                            criticalIncidents: 25
                        },
                        chartData: [],
                        templateData: {
                            layout: {
                                type: 'executive-overview' as const,
                                orientation: 'landscape' as const,
                                theme: 'dark' as const,
                                branding: 'avian' as const
                            }
                        }
                    }
                ],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            };

            const startTime = performance.now();

            const pdfBuffer = await pdfGenerator.exportToPDF(mockSnapshot);

            const endTime = performance.now();
            const exportTime = endTime - startTime;

            expect(pdfBuffer).toBeInstanceOf(Buffer);
            expect(pdfBuffer.length).toBeGreaterThan(0);
            expect(exportTime).toBeLessThan(10000); // Should complete within 10 seconds

            console.log(`PDF export time: ${exportTime.toFixed(2)}ms`);
        }, 20000); // 20 second timeout

        it('should handle multiple concurrent PDF exports', async () => {
            const concurrentExports = 5;
            const mockSnapshots = Array.from({ length: concurrentExports }, (_, i) => ({
                id: `snapshot-concurrent-${i}`,
                tenantId: `tenant-${i}`,
                reportId: `report-concurrent-${i}`,
                reportType: 'weekly' as const,
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: `user-${i}`,
                slideData: [
                    {
                        slideId: `slide-${i}`,
                        slideType: 'executive-overview',
                        title: `Concurrent Export ${i}`,
                        subtitle: 'Performance Test',
                        summary: `Testing concurrent PDF export ${i}.`,
                        keyPoints: [`Point ${i}.1`, `Point ${i}.2`],
                        charts: [],
                        computedMetrics: { totalAlerts: 100 * i },
                        chartData: [],
                        templateData: {
                            layout: {
                                type: 'executive-overview' as const,
                                orientation: 'landscape' as const,
                                theme: 'dark' as const,
                                branding: 'avian' as const
                            }
                        }
                    }
                ],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            }));

            const startTime = performance.now();

            const exportPromises = mockSnapshots.map(snapshot =>
                pdfGenerator.exportToPDF(snapshot)
            );

            const results = await Promise.all(exportPromises);

            const endTime = performance.now();
            const totalTime = endTime - startTime;

            expect(results).toHaveLength(concurrentExports);
            results.forEach(pdf => {
                expect(pdf).toBeInstanceOf(Buffer);
                expect(pdf.length).toBeGreaterThan(0);
            });

            expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds

            console.log(`Concurrent PDF exports (${concurrentExports}) total time: ${totalTime.toFixed(2)}ms`);
            console.log(`Average time per export: ${(totalTime / concurrentExports).toFixed(2)}ms`);
        }, 60000); // 60 second timeout

        it('should validate PDF quality without significant performance impact', async () => {
            const mockSnapshot = {
                id: 'snapshot-validation-perf',
                tenantId: mockTenantId,
                reportId: 'report-validation-perf',
                reportType: 'monthly' as const,
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: mockUserId,
                slideData: [
                    {
                        slideId: 'slide-validation',
                        slideType: 'alerts-digest',
                        title: 'Alerts Digest',
                        subtitle: 'Validation Performance Test',
                        summary: 'Testing PDF validation performance.',
                        keyPoints: ['Validation test'],
                        charts: [],
                        computedMetrics: { totalAlerts: 1000 },
                        chartData: [],
                        templateData: {
                            layout: {
                                type: 'alerts-digest' as const,
                                orientation: 'landscape' as const,
                                theme: 'dark' as const,
                                branding: 'avian' as const
                            }
                        }
                    }
                ],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            };

            // Export PDF
            const exportStartTime = performance.now();
            const pdfBuffer = await pdfGenerator.exportToPDF(mockSnapshot);
            const exportEndTime = performance.now();
            const exportTime = exportEndTime - exportStartTime;

            // Validate PDF
            const validationStartTime = performance.now();
            const validation = await pdfGenerator.validatePDFOutput(pdfBuffer);
            const validationEndTime = performance.now();
            const validationTime = validationEndTime - validationStartTime;

            expect(validation.isValid).toBe(true);
            expect(validationTime).toBeLessThan(1000); // Validation should be under 1 second
            expect(validationTime).toBeLessThan(exportTime * 0.1); // Validation should be < 10% of export time

            console.log(`PDF export time: ${exportTime.toFixed(2)}ms`);
            console.log(`PDF validation time: ${validationTime.toFixed(2)}ms`);
            console.log(`Validation overhead: ${((validationTime / exportTime) * 100).toFixed(2)}%`);
        });
    });

    describe('Concurrent User Scenarios', () => {
        it('should handle multiple tenants generating reports simultaneously', async () => {
            const tenantCount = 10;
            const tenantsData = Array.from({ length: tenantCount }, (_, i) => ({
                tenantId: `concurrent-tenant-${i}`,
                userId: `user-${i}`,
                alerts: generateMockAlerts(1000, `concurrent-tenant-${i}`)
            }));

            // Mock database to return different data for each tenant
            const mockDb = require('@/lib/database').db;
            let callIndex = 0;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockImplementation(() => {
                                const data = tenantsData[callIndex % tenantCount].alerts;
                                callIndex++;
                                return Promise.resolve(data);
                            })
                        })
                    })
                })
            });

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();

            // Mock snapshot creation for each tenant
            tenantsData.forEach((tenant, i) => {
                jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValueOnce({
                    id: `snapshot-concurrent-${i}`,
                    tenantId: tenant.tenantId,
                    reportId: `report-concurrent-${i}`,
                    reportType: 'weekly',
                    dateRange: mockDateRange,
                    generatedAt: new Date(),
                    generatedBy: tenant.userId,
                    slideData: [],
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false
                });
            });

            const startTime = performance.now();

            // Generate reports concurrently for all tenants
            const reportPromises = tenantsData.map(tenant =>
                reportGenerator.generateWeeklyReport(
                    tenant.tenantId,
                    mockDateRange,
                    tenant.userId
                )
            );

            const reports = await Promise.all(reportPromises);

            const endTime = performance.now();
            const totalTime = endTime - startTime;

            expect(reports).toHaveLength(tenantCount);
            reports.forEach((report, i) => {
                expect(report.tenantId).toBe(tenantsData[i].tenantId);
                expect(report.reportType).toBe('weekly');
            });

            expect(totalTime).toBeLessThan(45000); // Should complete within 45 seconds

            console.log(`Concurrent tenant reports (${tenantCount}) total time: ${totalTime.toFixed(2)}ms`);
            console.log(`Average time per tenant: ${(totalTime / tenantCount).toFixed(2)}ms`);
        }, 60000); // 60 second timeout

        it('should maintain performance under mixed report type load', async () => {
            const mixedRequests = [
                { type: 'weekly', tenantId: 'mixed-tenant-1', userId: 'user-1' },
                { type: 'monthly', tenantId: 'mixed-tenant-2', userId: 'user-2' },
                { type: 'quarterly', tenantId: 'mixed-tenant-3', userId: 'user-3' },
                { type: 'weekly', tenantId: 'mixed-tenant-4', userId: 'user-4' },
                { type: 'monthly', tenantId: 'mixed-tenant-5', userId: 'user-5' }
            ];

            // Mock database responses
            const mockDb = require('@/lib/database').db;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue(
                                generateMockAlerts(2000, 'mixed-tenant')
                            )
                        })
                    })
                })
            });

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();

            // Mock snapshot creation
            mixedRequests.forEach((req, i) => {
                jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValueOnce({
                    id: `snapshot-mixed-${i}`,
                    tenantId: req.tenantId,
                    reportId: `report-mixed-${i}`,
                    reportType: req.type as any,
                    dateRange: req.type === 'quarterly'
                        ? { ...mockDateRange, endDate: new Date('2024-03-31') }
                        : req.type === 'monthly'
                            ? { ...mockDateRange, endDate: new Date('2024-01-31') }
                            : mockDateRange,
                    generatedAt: new Date(),
                    generatedBy: req.userId,
                    slideData: [],
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false
                });
            });

            const startTime = performance.now();

            // Generate mixed report types concurrently
            const reportPromises = mixedRequests.map(req => {
                const dateRange = req.type === 'quarterly'
                    ? { ...mockDateRange, endDate: new Date('2024-03-31') }
                    : req.type === 'monthly'
                        ? { ...mockDateRange, endDate: new Date('2024-01-31') }
                        : mockDateRange;

                switch (req.type) {
                    case 'weekly':
                        return reportGenerator.generateWeeklyReport(req.tenantId, dateRange, req.userId);
                    case 'monthly':
                        return reportGenerator.generateMonthlyReport(req.tenantId, dateRange, req.userId);
                    case 'quarterly':
                        return reportGenerator.generateQuarterlyReport(req.tenantId, dateRange, req.userId);
                    default:
                        throw new Error(`Unknown report type: ${req.type}`);
                }
            });

            const reports = await Promise.all(reportPromises);

            const endTime = performance.now();
            const totalTime = endTime - startTime;

            expect(reports).toHaveLength(mixedRequests.length);
            reports.forEach((report, i) => {
                expect(report.reportType).toBe(mixedRequests[i].type);
                expect(report.tenantId).toBe(mixedRequests[i].tenantId);
            });

            expect(totalTime).toBeLessThan(40000); // Should complete within 40 seconds

            console.log(`Mixed report types (${mixedRequests.length}) total time: ${totalTime.toFixed(2)}ms`);
        }, 60000); // 60 second timeout
    });

    describe('Memory and Resource Management', () => {
        it('should not leak memory during repeated report generation', async () => {
            const iterations = 20;
            const mockAlerts = generateMockAlerts(1000, mockTenantId);

            // Mock database
            const mockDb = require('@/lib/database').db;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue(mockAlerts)
                        })
                    })
                })
            });

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();

            // Track memory usage
            const initialMemory = process.memoryUsage();
            const memorySnapshots: number[] = [];

            for (let i = 0; i < iterations; i++) {
                jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValueOnce({
                    id: `snapshot-memory-${i}`,
                    tenantId: mockTenantId,
                    reportId: `report-memory-${i}`,
                    reportType: 'weekly',
                    dateRange: mockDateRange,
                    generatedAt: new Date(),
                    generatedBy: mockUserId,
                    slideData: [],
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false
                });

                await reportGenerator.generateWeeklyReport(
                    mockTenantId,
                    mockDateRange,
                    mockUserId
                );

                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }

                const currentMemory = process.memoryUsage();
                memorySnapshots.push(currentMemory.heapUsed);
            }

            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            const memoryIncreasePerIteration = memoryIncrease / iterations;

            console.log(`Initial memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
            console.log(`Final memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
            console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
            console.log(`Memory increase per iteration: ${(memoryIncreasePerIteration / 1024).toFixed(2)} KB`);

            // Memory increase should be reasonable (less than 1MB per iteration)
            expect(memoryIncreasePerIteration).toBeLessThan(1024 * 1024);
        }, 120000); // 2 minute timeout

        it('should handle browser resource cleanup properly', async () => {
            const mockSnapshot = {
                id: 'snapshot-cleanup',
                tenantId: mockTenantId,
                reportId: 'report-cleanup',
                reportType: 'weekly' as const,
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: mockUserId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            };

            // Generate multiple PDFs to test browser cleanup
            for (let i = 0; i < 5; i++) {
                const pdf = await pdfGenerator.exportToPDF(mockSnapshot);
                expect(pdf).toBeInstanceOf(Buffer);
            }

            // Verify browser can be closed without errors
            await expect(pdfGenerator.closeBrowser()).resolves.not.toThrow();
        });
    });

    describe('Historical Data Retention Performance (Requirement 9.5)', () => {
        it('should maintain performance with 1 year of historical data', async () => {
            const yearOfData = 365;
            const alertsPerDay = 500;
            const totalAlerts = yearOfData * alertsPerDay;

            // Generate a full year of historical data
            const mockAlerts = Array.from({ length: totalAlerts }, (_, i) => {
                const dayOffset = Math.floor(i / alertsPerDay);
                const baseDate = new Date('2023-01-01');
                baseDate.setDate(baseDate.getDate() + dayOffset);

                return {
                    id: `historical-alert-${i}`,
                    tenantId: mockTenantId,
                    rawAlertType: `Historical Alert Type ${i % 15}`,
                    normalizedType: ['phishing', 'malware', 'spyware', 'authentication', 'network', 'other'][i % 6] as any,
                    severity: ['low', 'medium', 'high', 'critical'][i % 4] as any,
                    outcome: ['security_incident', 'benign_activity', 'false_positive'][i % 3] as any,
                    createdAt: new Date(baseDate.getTime() + (i % alertsPerDay) * 60000), // Spread throughout the day
                    resolvedAt: new Date(baseDate.getTime() + (i % alertsPerDay) * 60000 + 1800000), // 30 min later
                    deviceId: `device-${i % 200}`, // 200 devices
                    source: ['defender', 'sonicwall', 'avast', 'firewall_email'][i % 4] as any,
                    sourceSubtype: `subtype-${i % 10}`
                };
            });

            // Mock database to return historical data
            const mockDb = require('@/lib/database').db;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue(mockAlerts)
                        })
                    })
                })
            });

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue({
                id: 'snapshot-historical-year',
                tenantId: mockTenantId,
                reportId: 'report-historical-year',
                reportType: 'quarterly',
                dateRange: {
                    ...mockDateRange,
                    startDate: new Date('2023-01-01'),
                    endDate: new Date('2023-12-31')
                },
                generatedAt: new Date(),
                generatedBy: mockUserId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            });

            const startTime = performance.now();

            const report = await reportGenerator.generateQuarterlyReport(
                mockTenantId,
                {
                    ...mockDateRange,
                    startDate: new Date('2023-01-01'),
                    endDate: new Date('2023-12-31')
                },
                mockUserId
            );

            const endTime = performance.now();
            const processingTime = endTime - startTime;

            expect(report).toBeDefined();
            expect(processingTime).toBeLessThan(60000); // Should complete within 60 seconds even with 1 year of data

            console.log(`Historical data (${totalAlerts} alerts over ${yearOfData} days) processing time: ${processingTime.toFixed(2)}ms`);
        }, 120000); // 2 minute timeout

        it('should handle multi-year trend analysis efficiently', async () => {
            const years = 3;
            const alertsPerYear = 50000;
            const totalAlerts = years * alertsPerYear;

            // Generate multi-year data with trends
            const mockAlerts = Array.from({ length: totalAlerts }, (_, i) => {
                const year = Math.floor(i / alertsPerYear);
                const dayOfYear = Math.floor((i % alertsPerYear) / 137); // ~137 alerts per day
                const baseDate = new Date(`${2021 + year}-01-01`);
                baseDate.setDate(baseDate.getDate() + dayOfYear);

                return {
                    id: `trend-alert-${i}`,
                    tenantId: mockTenantId,
                    rawAlertType: `Trend Alert ${i % 20}`,
                    normalizedType: ['phishing', 'malware', 'spyware', 'authentication', 'network', 'other'][i % 6] as any,
                    severity: ['low', 'medium', 'high', 'critical'][i % 4] as any,
                    outcome: ['security_incident', 'benign_activity', 'false_positive'][i % 3] as any,
                    createdAt: baseDate,
                    resolvedAt: new Date(baseDate.getTime() + 3600000), // 1 hour later
                    deviceId: `device-${i % 300}`,
                    source: ['defender', 'sonicwall', 'avast', 'firewall_email'][i % 4] as any,
                    sourceSubtype: `subtype-${i % 12}`
                };
            });

            // Mock database
            const mockDb = require('@/lib/database').db;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue(mockAlerts)
                        })
                    })
                })
            });

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue({
                id: 'snapshot-multi-year-trends',
                tenantId: mockTenantId,
                reportId: 'report-multi-year-trends',
                reportType: 'quarterly',
                dateRange: {
                    ...mockDateRange,
                    startDate: new Date('2021-01-01'),
                    endDate: new Date('2023-12-31')
                },
                generatedAt: new Date(),
                generatedBy: mockUserId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            });

            const startTime = performance.now();

            const report = await reportGenerator.generateQuarterlyReport(
                mockTenantId,
                {
                    ...mockDateRange,
                    startDate: new Date('2021-01-01'),
                    endDate: new Date('2023-12-31')
                },
                mockUserId
            );

            const endTime = performance.now();
            const processingTime = endTime - startTime;

            expect(report).toBeDefined();
            expect(processingTime).toBeLessThan(90000); // Should complete within 90 seconds

            console.log(`Multi-year trend analysis (${totalAlerts} alerts over ${years} years) processing time: ${processingTime.toFixed(2)}ms`);
        }, 150000); // 2.5 minute timeout
    });

    describe('Snapshot Reproducibility Performance (Requirement 9.2)', () => {
        it('should maintain consistent performance for snapshot re-exports', async () => {
            const mockSnapshot = {
                id: 'snapshot-reproducibility-perf',
                tenantId: mockTenantId,
                reportId: 'report-reproducibility-perf',
                reportType: 'monthly' as const,
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: mockUserId,
                slideData: [
                    {
                        slideId: 'slide-reproducibility',
                        slideType: 'executive-overview',
                        title: 'Reproducibility Test',
                        subtitle: 'Performance Consistency',
                        summary: 'Testing snapshot reproducibility performance.',
                        keyPoints: Array.from({ length: 50 }, (_, i) => `Reproducibility point ${i + 1}`),
                        charts: [
                            {
                                type: 'bar',
                                title: 'Reproducibility Chart',
                                data: Array.from({ length: 100 }, (_, i) => ({
                                    label: `Data Point ${i}`,
                                    value: Math.floor(Math.random() * 1000) // Fixed seed would be better for true reproducibility
                                }))
                            }
                        ],
                        computedMetrics: {
                            totalAlerts: 15000,
                            totalUpdates: 1200,
                            criticalIncidents: 75,
                            reproducibilityHash: 'test-hash-12345'
                        },
                        chartData: [],
                        templateData: {
                            layout: {
                                type: 'executive-overview' as const,
                                orientation: 'landscape' as const,
                                theme: 'dark' as const,
                                branding: 'avian' as const
                            }
                        }
                    }
                ],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            };

            const exportTimes: number[] = [];
            const pdfSizes: number[] = [];

            // Export the same snapshot multiple times
            for (let i = 0; i < 10; i++) {
                const startTime = performance.now();
                const pdfBuffer = await pdfGenerator.exportToPDF(mockSnapshot);
                const endTime = performance.now();

                exportTimes.push(endTime - startTime);
                pdfSizes.push(pdfBuffer.length);

                expect(pdfBuffer).toBeInstanceOf(Buffer);
                expect(pdfBuffer.length).toBeGreaterThan(0);
            }

            // Calculate performance consistency metrics
            const avgExportTime = exportTimes.reduce((a, b) => a + b, 0) / exportTimes.length;
            const maxExportTime = Math.max(...exportTimes);
            const minExportTime = Math.min(...exportTimes);
            const timeVariance = maxExportTime - minExportTime;
            const timeVariancePercent = (timeVariance / avgExportTime) * 100;

            // All PDF sizes should be identical for reproducibility
            const uniqueSizes = [...new Set(pdfSizes)];
            expect(uniqueSizes).toHaveLength(1); // All PDFs should be exactly the same size

            // Performance should be consistent (variance < 50%)
            expect(timeVariancePercent).toBeLessThan(50);

            console.log(`Snapshot re-export performance:`);
            console.log(`  Average time: ${avgExportTime.toFixed(2)}ms`);
            console.log(`  Min time: ${minExportTime.toFixed(2)}ms`);
            console.log(`  Max time: ${maxExportTime.toFixed(2)}ms`);
            console.log(`  Variance: ${timeVariancePercent.toFixed(2)}%`);
            console.log(`  PDF size consistency: ${uniqueSizes.length === 1 ? 'PASS' : 'FAIL'}`);
        }, 60000); // 1 minute timeout

        it('should handle concurrent snapshot exports without performance degradation', async () => {
            const snapshotCount = 8;
            const mockSnapshots = Array.from({ length: snapshotCount }, (_, i) => ({
                id: `snapshot-concurrent-reproducibility-${i}`,
                tenantId: `tenant-reproducibility-${i}`,
                reportId: `report-concurrent-reproducibility-${i}`,
                reportType: 'weekly' as const,
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: `user-reproducibility-${i}`,
                slideData: [
                    {
                        slideId: `slide-concurrent-${i}`,
                        slideType: 'alerts-digest',
                        title: `Concurrent Reproducibility ${i}`,
                        subtitle: 'Performance Test',
                        summary: `Testing concurrent reproducibility ${i}.`,
                        keyPoints: [`Concurrent point ${i}.1`, `Concurrent point ${i}.2`],
                        charts: [],
                        computedMetrics: {
                            totalAlerts: 1000 * (i + 1),
                            snapshotIndex: i
                        },
                        chartData: [],
                        templateData: {
                            layout: {
                                type: 'alerts-digest' as const,
                                orientation: 'landscape' as const,
                                theme: 'dark' as const,
                                branding: 'avian' as const
                            }
                        }
                    }
                ],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            }));

            // Test concurrent exports
            const startTime = performance.now();

            const exportPromises = mockSnapshots.map(snapshot =>
                pdfGenerator.exportToPDF(snapshot)
            );

            const results = await Promise.all(exportPromises);
            const endTime = performance.now();
            const totalTime = endTime - startTime;

            expect(results).toHaveLength(snapshotCount);
            results.forEach((pdf, i) => {
                expect(pdf).toBeInstanceOf(Buffer);
                expect(pdf.length).toBeGreaterThan(0);
            });

            // Concurrent exports should not take significantly longer than sequential
            const avgTimePerExport = totalTime / snapshotCount;
            expect(avgTimePerExport).toBeLessThan(15000); // Average should be under 15 seconds per export

            console.log(`Concurrent snapshot exports performance:`);
            console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
            console.log(`  Average per export: ${avgTimePerExport.toFixed(2)}ms`);
            console.log(`  Exports completed: ${results.length}/${snapshotCount}`);
        }, 120000); // 2 minute timeout
    });

    describe('Cache Performance Impact', () => {
        it('should demonstrate significant performance improvement with caching', async () => {
            const mockAlerts = generateMockAlerts(5000, mockTenantId);

            // Mock database
            const mockDb = require('@/lib/database').db;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue(mockAlerts)
                        })
                    })
                })
            });

            // First run - no cache
            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValueOnce(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue({
                id: 'snapshot-cache-test-1',
                tenantId: mockTenantId,
                reportId: 'report-cache-test-1',
                reportType: 'weekly',
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: mockUserId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            });

            const uncachedStartTime = performance.now();
            const uncachedReport = await reportGenerator.generateWeeklyReport(
                mockTenantId,
                mockDateRange,
                mockUserId
            );
            const uncachedEndTime = performance.now();
            const uncachedTime = uncachedEndTime - uncachedStartTime;

            // Second run - with cache
            const mockCachedReport = {
                ...uncachedReport,
                id: 'cached-report-id'
            };
            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValueOnce(mockCachedReport);

            const cachedStartTime = performance.now();
            const cachedReport = await reportGenerator.generateWeeklyReport(
                mockTenantId,
                mockDateRange,
                mockUserId
            );
            const cachedEndTime = performance.now();
            const cachedTime = cachedEndTime - cachedStartTime;

            expect(uncachedReport).toBeDefined();
            expect(cachedReport).toBeDefined();
            expect(cachedTime).toBeLessThan(uncachedTime * 0.1); // Cached should be at least 10x faster

            const performanceImprovement = ((uncachedTime - cachedTime) / uncachedTime) * 100;

            console.log(`Cache performance impact:`);
            console.log(`  Uncached time: ${uncachedTime.toFixed(2)}ms`);
            console.log(`  Cached time: ${cachedTime.toFixed(2)}ms`);
            console.log(`  Performance improvement: ${performanceImprovement.toFixed(2)}%`);

            expect(performanceImprovement).toBeGreaterThan(80); // Should be at least 80% improvement
        });
    });
});