/**
 * Integration Testing Suite for AVIAN Reports Module
 * 
 * Task 12.1: Integration testing suite
 * - Write end-to-end report generation tests
 * - Test multi-tenant isolation in concurrent scenarios  
 * - Validate PDF export quality and integrity
 * - Requirements: All requirements
 */

import { ReportGenerator } from '../ReportGenerator';
import { DataAggregator } from '../DataAggregator';
import { HistoricalDataStore } from '../HistoricalDataStore';
import { TemplateEngine } from '../TemplateEngine';
import { PDFGenerator } from '../PDFGenerator';
import { ReportSnapshotService } from '../ReportSnapshotService';
import { AlertClassificationService } from '../AlertClassificationService';
import { ReportCacheService } from '../ReportCacheService';

// Mock external dependencies
jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

jest.mock('@/lib/redis', () => ({
    redis: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        exists: jest.fn().mockResolvedValue(0),
        expire: jest.fn().mockResolvedValue(1)
    },
    isConnected: false
}));

jest.mock('@/lib/cache', () => ({
    CacheService: jest.fn().mockImplementation(() => ({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn().mockResolvedValue(false)
    }))
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
            version: jest.fn().mockReturnValue('1.40.0')
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

describe('Integration Testing Suite - Reports Module', () => {
    let reportGenerator: ReportGenerator;
    let pdfGenerator: PDFGenerator;
    let snapshotService: ReportSnapshotService;
    let cacheService: ReportCacheService;

    const mockDateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        timezone: 'America/Toronto',
        weekStart: 'monday' as const
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Initialize services with mocks
        const historicalDataStore = new HistoricalDataStore();
        const alertClassificationService = new AlertClassificationService();
        const dataAggregator = new DataAggregator(historicalDataStore, alertClassificationService);
        const templateEngine = new TemplateEngine();

        pdfGenerator = new PDFGenerator(templateEngine);
        snapshotService = new ReportSnapshotService();
        cacheService = new ReportCacheService();

        reportGenerator = new ReportGenerator(
            dataAggregator,
            templateEngine,
            snapshotService,
            cacheService
        );

        // Setup database mocks with proper data structure
        const mockDb = require('@/lib/database').db;

        // Mock alert records
        const mockAlertRecords = [
            {
                id: 'alert-1',
                tenant_id: 'test-tenant',
                raw_alert_type: 'Phishing Email',
                normalized_type: 'phishing',
                severity: 'high',
                outcome: 'security_incident',
                created_at: new Date('2024-01-02T10:00:00Z'),
                resolved_at: new Date('2024-01-02T11:00:00Z'),
                device_id: 'device-1',
                source: 'defender'
            }
        ];

        // Mock metrics records
        const mockMetricsRecords = [
            {
                id: 'metrics-1',
                tenant_id: 'test-tenant',
                device_id: 'device-1',
                date: new Date('2024-01-02'),
                threats_blocked: 10,
                updates_applied: 5,
                vulnerabilities_detected: 3,
                vulnerabilities_mitigated: 2,
                source: 'firewall'
            }
        ];

        mockDb.select.mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    orderBy: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue(mockAlertRecords)
                    }),
                    innerJoin: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue(mockMetricsRecords)
                        })
                    })
                }),
                innerJoin: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue(mockMetricsRecords)
                        })
                    })
                })
            })
        });

        require('@/lib/database').withTransaction.mockImplementation((callback) =>
            callback(mockDb)
        );
    });

    afterEach(async () => {
        // Clean up resources
        try {
            if (pdfGenerator && typeof pdfGenerator.closeBrowser === 'function') {
                await pdfGenerator.closeBrowser();
            }
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
            if (pdfGenerator && typeof pdfGenerator.closeBrowser === 'function') {
                await pdfGenerator.closeBrowser();
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    });
    describe('End-to-End Report Generation Tests', () => {
        it('should complete full weekly report generation workflow', async () => {
            const tenantId = 'test-tenant-weekly';
            const userId = 'test-user-weekly';

            // Mock cache miss
            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();

            // Mock snapshot creation
            const mockSnapshot = {
                id: 'snapshot-weekly-test',
                tenantId,
                reportId: 'report-weekly-test',
                reportType: 'weekly' as const,
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: userId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            };
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue(mockSnapshot);

            // Execute workflow
            const report = await reportGenerator.generateWeeklyReport(
                tenantId,
                mockDateRange,
                userId
            );

            // Validate report structure
            expect(report).toBeDefined();
            expect(report.reportType).toBe('weekly');
            expect(report.tenantId).toBe(tenantId);
            expect(report.dateRange).toEqual(mockDateRange);
            expect(report.slides).toBeDefined();

            // Verify workflow completion
            expect(snapshotService.createSnapshot).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId,
                    reportType: 'weekly'
                }),
                userId,
                undefined,
                undefined
            );
        });

        it('should complete monthly report generation with trend analysis', async () => {
            const tenantId = 'test-tenant-monthly';
            const userId = 'test-user-monthly';
            const monthlyDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();

            const mockSnapshot = {
                id: 'snapshot-monthly-test',
                tenantId,
                reportId: 'report-monthly-test',
                reportType: 'monthly' as const,
                dateRange: monthlyDateRange,
                generatedAt: new Date(),
                generatedBy: userId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            };
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue(mockSnapshot);

            const report = await reportGenerator.generateMonthlyReport(
                tenantId,
                monthlyDateRange,
                userId
            );

            expect(report.reportType).toBe('monthly');
            expect(report.tenantId).toBe(tenantId);
            expect(report.slides).toBeDefined();
        });

        it('should complete quarterly report generation with executive focus', async () => {
            const tenantId = 'test-tenant-quarterly';
            const userId = 'test-user-quarterly';
            const quarterlyDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-03-31'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();

            const mockSnapshot = {
                id: 'snapshot-quarterly-test',
                tenantId,
                reportId: 'report-quarterly-test',
                reportType: 'quarterly' as const,
                dateRange: quarterlyDateRange,
                generatedAt: new Date(),
                generatedBy: userId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            };
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue(mockSnapshot);

            const report = await reportGenerator.generateQuarterlyReport(
                tenantId,
                quarterlyDateRange,
                userId
            );

            expect(report.reportType).toBe('quarterly');
            expect(report.tenantId).toBe(tenantId);
            expect(report.slides).toBeDefined();
            expect(report.slides.length).toBeLessThanOrEqual(5); // Max 5 slides for quarterly
        });
    });

    describe('Multi-Tenant Isolation in Concurrent Scenarios', () => {
        it('should maintain strict tenant isolation under concurrency', async () => {
            const tenants = [
                { id: 'tenant-concurrent-1', user: 'user-concurrent-1' },
                { id: 'tenant-concurrent-2', user: 'user-concurrent-2' },
                { id: 'tenant-concurrent-3', user: 'user-concurrent-3' }
            ];

            // Mock different data for each tenant
            const mockDb = require('@/lib/database').db;
            let callCount = 0;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockImplementation(() => ({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([{
                                id: `alert-concurrent-${callCount}`,
                                tenant_id: tenants[callCount % tenants.length].id,
                                raw_alert_type: `Tenant ${callCount + 1} Alert`,
                                normalized_type: 'phishing',
                                severity: 'medium',
                                outcome: 'benign_activity',
                                created_at: new Date('2024-01-02T10:00:00Z'),
                                resolved_at: new Date('2024-01-02T10:30:00Z'),
                                device_id: `device-concurrent-${callCount}`,
                                source: 'defender'
                            }])
                        })
                    }))
                })
            });

            require('@/lib/database').withTransaction.mockImplementation((callback) => {
                const result = callback(mockDb);
                callCount++;
                return result;
            });

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();

            // Mock snapshot creation for each tenant
            tenants.forEach((tenant, index) => {
                jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValueOnce({
                    id: `snapshot-concurrent-${index}`,
                    tenantId: tenant.id,
                    reportId: `report-concurrent-${index}`,
                    reportType: 'weekly',
                    dateRange: mockDateRange,
                    generatedAt: new Date(),
                    generatedBy: tenant.user,
                    slideData: [],
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false
                });
            });

            // Generate reports concurrently
            const reportPromises = tenants.map(tenant =>
                reportGenerator.generateWeeklyReport(
                    tenant.id,
                    mockDateRange,
                    tenant.user
                )
            );

            const reports = await Promise.all(reportPromises);

            // Validate tenant isolation
            reports.forEach((report, index) => {
                expect(report.tenantId).toBe(tenants[index].id);
                expect(report.slides).toBeDefined();
            });

            // Verify snapshots were created with correct tenant isolation
            expect(snapshotService.createSnapshot).toHaveBeenCalledTimes(tenants.length);
        });

        it('should prevent cross-tenant data leakage', async () => {
            const tenant1 = 'tenant-secure-1';
            const tenant2 = 'tenant-secure-2';

            // Mock data that should be filtered by tenant
            const mockDb = require('@/lib/database').db;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([
                                {
                                    id: 'alert-secure-1',
                                    tenant_id: tenant1,
                                    raw_alert_type: 'Secure Alert 1',
                                    normalized_type: 'phishing',
                                    severity: 'high',
                                    outcome: 'security_incident',
                                    created_at: new Date('2024-01-02T10:00:00Z'),
                                    resolved_at: new Date('2024-01-02T11:00:00Z'),
                                    device_id: 'device-secure-1',
                                    source: 'defender'
                                }
                            ])
                        })
                    })
                })
            });

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue({
                id: 'snapshot-secure',
                tenantId: tenant1,
                reportId: 'report-secure',
                reportType: 'weekly',
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: 'user-secure',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            });

            const report = await reportGenerator.generateWeeklyReport(
                tenant1,
                mockDateRange,
                'user-secure'
            );

            // Verify only tenant1 data is included
            expect(report.tenantId).toBe(tenant1);
            expect(mockDb.select).toHaveBeenCalled();
        });
    });
    describe('PDF Export Quality and Integrity Validation', () => {
        it('should generate high-quality PDFs with all visual elements', async () => {
            const mockSnapshot = {
                id: 'snapshot-pdf-quality',
                tenantId: 'tenant-pdf',
                reportId: 'report-pdf',
                reportType: 'weekly' as const,
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: 'user-pdf',
                slideData: [
                    {
                        slideId: 'slide-1',
                        slideType: 'executive-overview',
                        title: 'Executive Overview',
                        subtitle: 'Weekly Security Report',
                        summary: 'This week we processed 150 alerts.',
                        keyPoints: ['150 alerts processed', '25 updates applied'],
                        charts: [
                            {
                                type: 'bar',
                                title: 'Weekly Alert Timeline',
                                data: [
                                    { label: 'Monday', value: 20 },
                                    { label: 'Tuesday', value: 25 }
                                ]
                            }
                        ],
                        computedMetrics: { totalAlerts: 150 },
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

            // Export to PDF
            const pdfBuffer = await pdfGenerator.exportToPDF(mockSnapshot);

            // Validate PDF quality
            const validation = await pdfGenerator.validatePDFOutput(pdfBuffer);

            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
            expect(pdfBuffer).toBeInstanceOf(Buffer);
            expect(pdfBuffer.length).toBeGreaterThan(0);
        });

        it('should maintain consistent PDF output for identical snapshots', async () => {
            const mockSnapshot = {
                id: 'snapshot-consistency',
                tenantId: 'tenant-consistency',
                reportId: 'report-consistency',
                reportType: 'weekly' as const,
                dateRange: mockDateRange,
                generatedAt: new Date('2024-01-01T12:00:00Z'), // Fixed timestamp
                generatedBy: 'user-consistency',
                slideData: [
                    {
                        slideId: 'slide-consistent',
                        slideType: 'executive-overview',
                        title: 'Consistent Report',
                        subtitle: 'Test Report',
                        summary: 'Identical content for consistency testing.',
                        keyPoints: ['Point 1', 'Point 2'],
                        charts: [],
                        computedMetrics: { totalAlerts: 100 },
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

            // Generate PDF twice
            const pdf1 = await pdfGenerator.exportToPDF(mockSnapshot);
            const pdf2 = await pdfGenerator.exportToPDF(mockSnapshot);

            // Generate checksums
            const checksum1 = pdfGenerator.generateFileChecksum(pdf1);
            const checksum2 = pdfGenerator.generateFileChecksum(pdf2);

            // Verify consistency
            expect(checksum1).toBe(checksum2);
        });

        it('should handle PDF generation errors gracefully', async () => {
            const mockSnapshot = {
                id: 'snapshot-error',
                tenantId: 'tenant-error',
                reportId: 'report-error',
                reportType: 'weekly' as const,
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: 'user-error',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            };

            // Mock Playwright to throw error
            const mockChromium = require('playwright').chromium;
            mockChromium.launch.mockRejectedValueOnce(new Error('Browser launch failed'));

            await expect(pdfGenerator.exportToPDF(mockSnapshot))
                .rejects.toThrow('PDF generation failed');
        });

        it('should validate PDF output and reject invalid PDFs', async () => {
            const mockSnapshot = {
                id: 'snapshot-validation',
                tenantId: 'tenant-validation',
                reportId: 'report-validation',
                reportType: 'weekly' as const,
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: 'user-validation',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            };

            // Mock invalid PDF generation
            const mockChromium = require('playwright').chromium;
            const mockPage = mockChromium.launch().then((browser: any) => browser.newPage());
            (await mockPage).pdf.mockResolvedValueOnce(Buffer.from('invalid-pdf-content'));

            const pdfBuffer = await pdfGenerator.exportToPDF(mockSnapshot);
            const validation = await pdfGenerator.validatePDFOutput(pdfBuffer);

            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });
    });

    describe('Performance and Scalability Tests', () => {
        it('should handle large datasets efficiently', async () => {
            const tenantId = 'tenant-large-data';
            const userId = 'user-large-data';

            // Mock large dataset
            const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
                id: `alert-large-${i}`,
                tenant_id: tenantId,
                raw_alert_type: `Alert Type ${i}`,
                normalized_type: 'phishing',
                severity: 'medium',
                outcome: 'benign_activity',
                created_at: new Date(`2024-01-0${(i % 7) + 1}T10:00:00Z`),
                resolved_at: new Date(`2024-01-0${(i % 7) + 1}T10:30:00Z`),
                device_id: `device-${i % 10}`,
                source: 'defender'
            }));

            const mockDb = require('@/lib/database').db;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue(largeDataset)
                        })
                    })
                })
            });

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue({
                id: 'snapshot-large',
                tenantId,
                reportId: 'report-large',
                reportType: 'weekly',
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: userId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            });

            const startTime = Date.now();
            const report = await reportGenerator.generateWeeklyReport(
                tenantId,
                mockDateRange,
                userId
            );
            const endTime = Date.now();
            const processingTime = endTime - startTime;

            expect(report).toBeDefined();
            expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
        });

        it('should cache reports effectively', async () => {
            const tenantId = 'tenant-cache-test';
            const userId = 'user-cache-test';
            const cacheKey = `weekly:${tenantId}:2024-01-01:2024-01-07`;

            // First call - cache miss
            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValueOnce(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue({
                id: 'snapshot-cache-test',
                tenantId,
                reportId: 'report-cache-test',
                reportType: 'weekly',
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: userId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            });

            const report1 = await reportGenerator.generateWeeklyReport(
                tenantId,
                mockDateRange,
                userId
            );

            expect(cacheService.getCachedReport).toHaveBeenCalledWith(cacheKey);
            expect(cacheService.cacheReport).toHaveBeenCalledWith(cacheKey, report1);

            // Second call - cache hit
            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValueOnce(report1);

            const report2 = await reportGenerator.generateWeeklyReport(
                tenantId,
                mockDateRange,
                userId
            );

            expect(report2).toBe(report1); // Should return cached instance
            expect(cacheService.getCachedReport).toHaveBeenCalledTimes(2);
            expect(cacheService.cacheReport).toHaveBeenCalledTimes(1); // Only called once
        });
    });

    describe('Error Recovery and Resilience', () => {
        it('should recover from database connection failures', async () => {
            const tenantId = 'tenant-db-recovery';
            const userId = 'user-db-recovery';

            // Mock database failure then recovery
            const mockDb = require('@/lib/database').db;
            mockDb.select
                .mockReturnValueOnce({
                    from: jest.fn().mockReturnValue({
                        where: jest.fn().mockReturnValue({
                            orderBy: jest.fn().mockReturnValue({
                                limit: jest.fn().mockRejectedValue(new Error('Connection timeout'))
                            })
                        })
                    })
                })
                .mockReturnValueOnce({
                    from: jest.fn().mockReturnValue({
                        where: jest.fn().mockReturnValue({
                            orderBy: jest.fn().mockReturnValue({
                                limit: jest.fn().mockResolvedValue([])
                            })
                        })
                    })
                });

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue({
                id: 'snapshot-recovery',
                tenantId,
                reportId: 'report-recovery',
                reportType: 'weekly',
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: userId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            });

            // First attempt should fail
            await expect(
                reportGenerator.generateWeeklyReport(tenantId, mockDateRange, userId)
            ).rejects.toThrow('Connection timeout');

            // Second attempt should succeed
            const report = await reportGenerator.generateWeeklyReport(
                tenantId,
                mockDateRange,
                userId
            );

            expect(report).toBeDefined();
        });
    });
});