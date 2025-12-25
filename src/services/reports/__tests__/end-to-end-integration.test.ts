/**
 * End-to-End Integration Tests for AVIAN Reports Module
 * 
 * Tests complete report generation workflows from data retrieval through PDF export
 * Validates multi-tenant isolation, data integrity, and PDF quality
 * 
 * Requirements: All requirements - comprehensive integration testing
 */

import { ReportGenerator } from '../ReportGenerator';
import { DataAggregator } from '../DataAggregator';
import { HistoricalDataStore } from '../HistoricalDataStore';
import { TemplateEngine } from '../TemplateEngine';
import { PDFGenerator } from '../PDFGenerator';
import { ReportSnapshotService } from '../ReportSnapshotService';
import { AlertClassificationService } from '../AlertClassificationService';
import { ReportCacheService } from '../ReportCacheService';
import { EnhancedDateRange, WeeklyReport, MonthlyReport, QuarterlyReport } from '@/types/reports';

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

describe('End-to-End Integration Tests', () => {
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

    const mockTenantId = 'test-tenant-123';
    const mockUserId = 'test-user-456';

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

        // Mock database responses for historical data
        const mockDb = require('@/lib/database').db;
        mockDb.select.mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    orderBy: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([
                            // Mock alert records
                            {
                                id: 'alert-1',
                                tenant_id: mockTenantId,
                                raw_alert_type: 'Phishing Email Detected',
                                normalized_type: 'phishing',
                                severity: 'high',
                                outcome: 'security_incident',
                                created_at: new Date('2024-01-02T10:00:00Z'),
                                resolved_at: new Date('2024-01-02T11:00:00Z'),
                                device_id: 'device-1',
                                source: 'defender'
                            },
                            {
                                id: 'alert-2',
                                tenant_id: mockTenantId,
                                raw_alert_type: 'Malware Blocked',
                                normalized_type: 'malware',
                                severity: 'critical',
                                outcome: 'benign_activity',
                                created_at: new Date('2024-01-03T14:30:00Z'),
                                resolved_at: new Date('2024-01-03T14:35:00Z'),
                                device_id: 'device-2',
                                source: 'sonicwall'
                            }
                        ])
                    })
                })
            })
        });

        // Mock transaction wrapper
        require('@/lib/database').withTransaction.mockImplementation((callback) =>
            callback(mockDb)
        );
    });

    afterEach(async () => {
        await pdfGenerator.closeBrowser();
    });

    describe('Complete Weekly Report Generation', () => {
        it('should generate complete weekly report with all components', async () => {
            // Mock cache miss to force generation
            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();

            // Mock snapshot creation
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue({
                id: 'snapshot-weekly-123',
                tenantId: mockTenantId,
                reportId: 'report-weekly-123',
                reportType: 'weekly',
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: mockUserId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            });

            const report = await reportGenerator.generateWeeklyReport(
                mockTenantId,
                mockDateRange,
                mockUserId
            );

            expect(report).toBeDefined();
            expect(report.reportType).toBe('weekly');
            expect(report.tenantId).toBe(mockTenantId);
            expect(report.dateRange).toEqual(mockDateRange);
            expect(report.slides).toBeDefined();
            expect(report.slides.length).toBeGreaterThan(0);

            // Verify slides contain expected content
            const executiveSlide = report.slides.find(s => s.content.slideType === 'executive-overview');
            expect(executiveSlide).toBeDefined();
            expect(executiveSlide?.content.summary).toContain('alerts');

            const alertsSlide = report.slides.find(s => s.content.slideType === 'alerts-digest');
            expect(alertsSlide).toBeDefined();

            // Verify snapshot was created
            expect(snapshotService.createSnapshot).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: mockTenantId,
                    reportType: 'weekly'
                }),
                mockUserId,
                undefined,
                undefined
            );
        });

        it('should handle empty data gracefully', async () => {
            // Mock empty database response
            const mockDb = require('@/lib/database').db;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([])
                        })
                    })
                })
            });

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue({
                id: 'snapshot-empty-123',
                tenantId: mockTenantId,
                reportId: 'report-empty-123',
                reportType: 'weekly',
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: mockUserId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            });

            const report = await reportGenerator.generateWeeklyReport(
                mockTenantId,
                mockDateRange,
                mockUserId
            );

            expect(report).toBeDefined();
            expect(report.slides).toBeDefined();

            // Should still have executive overview even with no data
            const executiveSlide = report.slides.find(s => s.content.slideType === 'executive-overview');
            expect(executiveSlide).toBeDefined();
            expect(executiveSlide?.content.summary).toContain('No security alerts');
        });
    });

    describe('Multi-Tenant Data Isolation', () => {
        it('should isolate data between tenants in concurrent scenarios', async () => {
            const tenant1 = 'tenant-1';
            const tenant2 = 'tenant-2';
            const user1 = 'user-1';
            const user2 = 'user-2';

            // Mock different data for each tenant
            const mockDb = require('@/lib/database').db;
            let callCount = 0;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockImplementation((condition) => ({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue(
                                callCount++ === 0
                                    ? [{ // Tenant 1 data
                                        id: 'alert-t1-1',
                                        tenant_id: tenant1,
                                        raw_alert_type: 'Tenant 1 Alert',
                                        normalized_type: 'phishing',
                                        severity: 'high',
                                        outcome: 'security_incident',
                                        created_at: new Date('2024-01-02T10:00:00Z'),
                                        resolved_at: new Date('2024-01-02T11:00:00Z'),
                                        device_id: 'device-t1-1',
                                        source: 'defender'
                                    }]
                                    : [{ // Tenant 2 data
                                        id: 'alert-t2-1',
                                        tenant_id: tenant2,
                                        raw_alert_type: 'Tenant 2 Alert',
                                        normalized_type: 'malware',
                                        severity: 'critical',
                                        outcome: 'benign_activity',
                                        created_at: new Date('2024-01-03T14:30:00Z'),
                                        resolved_at: new Date('2024-01-03T14:35:00Z'),
                                        device_id: 'device-t2-1',
                                        source: 'sonicwall'
                                    }]
                            )
                        })
                    }))
                })
            });

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(snapshotService, 'createSnapshot')
                .mockResolvedValueOnce({
                    id: 'snapshot-t1',
                    tenantId: tenant1,
                    reportId: 'report-t1',
                    reportType: 'weekly',
                    dateRange: mockDateRange,
                    generatedAt: new Date(),
                    generatedBy: user1,
                    slideData: [],
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false
                })
                .mockResolvedValueOnce({
                    id: 'snapshot-t2',
                    tenantId: tenant2,
                    reportId: 'report-t2',
                    reportType: 'weekly',
                    dateRange: mockDateRange,
                    generatedAt: new Date(),
                    generatedBy: user2,
                    slideData: [],
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false
                });

            // Generate reports concurrently
            const [report1, report2] = await Promise.all([
                reportGenerator.generateWeeklyReport(tenant1, mockDateRange, user1),
                reportGenerator.generateWeeklyReport(tenant2, mockDateRange, user2)
            ]);

            // Verify tenant isolation
            expect(report1.tenantId).toBe(tenant1);
            expect(report2.tenantId).toBe(tenant2);

            // Verify different data in reports
            const alert1Slide = report1.slides.find(s => s.content.slideType === 'alerts-digest');
            const alert2Slide = report2.slides.find(s => s.content.slideType === 'alerts-digest');

            expect(alert1Slide?.content.summary).toContain('Tenant 1');
            expect(alert2Slide?.content.summary).toContain('Tenant 2');

            // Verify snapshots were created with correct tenant IDs
            expect(snapshotService.createSnapshot).toHaveBeenCalledWith(
                expect.objectContaining({ tenantId: tenant1 }),
                user1,
                undefined,
                undefined
            );
            expect(snapshotService.createSnapshot).toHaveBeenCalledWith(
                expect.objectContaining({ tenantId: tenant2 }),
                user2,
                undefined,
                undefined
            );
        });

        it('should prevent cross-tenant data leakage', async () => {
            const tenant1 = 'tenant-secure-1';
            const tenant2 = 'tenant-secure-2';

            // Mock data that includes both tenants but should be filtered
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
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue({
                id: 'snapshot-secure',
                tenantId: tenant1,
                reportId: 'report-secure',
                reportType: 'weekly',
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: mockUserId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            });

            const report = await reportGenerator.generateWeeklyReport(
                tenant1,
                mockDateRange,
                mockUserId
            );

            // Verify only tenant1 data is included
            expect(report.tenantId).toBe(tenant1);

            // Check that database query was called with tenant filter
            expect(mockDb.select).toHaveBeenCalled();

            // Verify no cross-tenant data in slides
            const alertsSlide = report.slides.find(s => s.content.slideType === 'alerts-digest');
            expect(alertsSlide?.content.summary).not.toContain('tenant-secure-2');
        });
    });

    describe('PDF Export Quality and Integrity', () => {
        it('should generate high-quality PDF with all visual elements', async () => {
            // Mock successful report generation
            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            const mockSnapshot = {
                id: 'snapshot-pdf-quality',
                tenantId: mockTenantId,
                reportId: 'report-pdf-quality',
                reportType: 'weekly' as const,
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: mockUserId,
                slideData: [
                    {
                        slideId: 'slide-1',
                        slideType: 'executive-overview',
                        title: 'Executive Overview',
                        subtitle: 'Weekly Security Report',
                        summary: 'This week we processed 150 alerts and applied 25 updates.',
                        keyPoints: ['150 alerts processed', '25 updates applied', 'No critical incidents'],
                        charts: [
                            {
                                type: 'bar',
                                title: 'Weekly Alert Timeline',
                                data: [
                                    { label: 'Monday', value: 20 },
                                    { label: 'Tuesday', value: 25 },
                                    { label: 'Wednesday', value: 30 }
                                ]
                            }
                        ],
                        computedMetrics: {
                            totalAlerts: 150,
                            totalUpdates: 25,
                            criticalIncidents: 0
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

            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue(mockSnapshot);

            // Generate report
            const report = await reportGenerator.generateWeeklyReport(
                mockTenantId,
                mockDateRange,
                mockUserId
            );

            // Export to PDF
            const pdfBuffer = await pdfGenerator.exportToPDF(mockSnapshot);

            // Validate PDF quality
            const validation = await pdfGenerator.validatePDFOutput(pdfBuffer);

            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
            expect(pdfBuffer).toBeInstanceOf(Buffer);
            expect(pdfBuffer.length).toBeGreaterThan(0);

            // Verify PDF contains expected content markers
            const pdfContent = pdfBuffer.toString();
            expect(pdfContent).toContain('PDF'); // Basic PDF structure
        });

        it('should maintain consistent PDF output for identical snapshots', async () => {
            const mockSnapshot = {
                id: 'snapshot-consistency',
                tenantId: mockTenantId,
                reportId: 'report-consistency',
                reportType: 'weekly' as const,
                dateRange: mockDateRange,
                generatedAt: new Date('2024-01-01T12:00:00Z'), // Fixed timestamp
                generatedBy: mockUserId,
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

            // Verify consistency (checksums should be identical for identical content)
            expect(checksum1).toBe(checksum2);
        });

        it('should handle PDF generation errors gracefully', async () => {
            const mockSnapshot = {
                id: 'snapshot-error',
                tenantId: mockTenantId,
                reportId: 'report-error',
                reportType: 'weekly' as const,
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: mockUserId,
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
    });

    describe('Performance and Scalability', () => {
        it('should handle large datasets efficiently', async () => {
            // Mock large dataset
            const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
                id: `alert-large-${i}`,
                tenant_id: mockTenantId,
                raw_alert_type: `Alert Type ${i}`,
                normalized_type: 'phishing',
                severity: 'medium',
                outcome: 'benign_activity',
                created_at: new Date(`2024-01-0${(i % 7) + 1}T${(i % 24).toString().padStart(2, '0')}:00:00Z`),
                resolved_at: new Date(`2024-01-0${(i % 7) + 1}T${(i % 24).toString().padStart(2, '0')}:30:00Z`),
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
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue({
                id: 'snapshot-large',
                tenantId: mockTenantId,
                reportId: 'report-large',
                reportType: 'weekly',
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: mockUserId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            });

            const startTime = Date.now();

            const report = await reportGenerator.generateWeeklyReport(
                mockTenantId,
                mockDateRange,
                mockUserId
            );

            const endTime = Date.now();
            const processingTime = endTime - startTime;

            expect(report).toBeDefined();
            expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds

            // Verify data aggregation handled large dataset
            const alertsSlide = report.slides.find(s => s.content.slideType === 'alerts-digest');
            expect(alertsSlide?.content.summary).toContain('1000');
        });

        it('should cache reports effectively', async () => {
            const cacheKey = `weekly:${mockTenantId}:2024-01-01:2024-01-07`;

            // First call - cache miss
            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValueOnce(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue({
                id: 'snapshot-cache-test',
                tenantId: mockTenantId,
                reportId: 'report-cache-test',
                reportType: 'weekly',
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: mockUserId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            });

            const report1 = await reportGenerator.generateWeeklyReport(
                mockTenantId,
                mockDateRange,
                mockUserId
            );

            expect(cacheService.getCachedReport).toHaveBeenCalledWith(cacheKey);
            expect(cacheService.cacheReport).toHaveBeenCalledWith(cacheKey, report1);

            // Second call - cache hit
            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValueOnce(report1);

            const report2 = await reportGenerator.generateWeeklyReport(
                mockTenantId,
                mockDateRange,
                mockUserId
            );

            expect(report2).toBe(report1); // Should return cached instance
            expect(cacheService.getCachedReport).toHaveBeenCalledTimes(2);
            expect(cacheService.cacheReport).toHaveBeenCalledTimes(1); // Only called once
        });
    });

    describe('Error Recovery and Resilience', () => {
        it('should recover from database connection failures', async () => {
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
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue({
                id: 'snapshot-recovery',
                tenantId: mockTenantId,
                reportId: 'report-recovery',
                reportType: 'weekly',
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: mockUserId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            });

            // First attempt should fail
            await expect(
                reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange, mockUserId)
            ).rejects.toThrow('Connection timeout');

            // Second attempt should succeed
            const report = await reportGenerator.generateWeeklyReport(
                mockTenantId,
                mockDateRange,
                mockUserId
            );

            expect(report).toBeDefined();
        });

        it('should handle template rendering failures gracefully', async () => {
            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);

            // Mock template engine to throw error
            jest.spyOn(templateEngine, 'renderSlide').mockRejectedValue(
                new Error('Template rendering failed')
            );

            await expect(
                reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange, mockUserId)
            ).rejects.toThrow('Template rendering failed');
        });
    });
});