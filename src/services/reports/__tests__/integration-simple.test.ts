/**
 * Simplified Integration Tests for AVIAN Reports Module
 * 
 * Task 12.1: Integration testing suite - Simplified version
 * - Basic end-to-end report generation tests
 * - Multi-tenant isolation verification
 * - PDF export validation
 */

import { ReportGenerator } from '../ReportGenerator';
import { DataAggregator } from '../DataAggregator';
import { HistoricalDataStore } from '../HistoricalDataStore';
import { TemplateEngine } from '../TemplateEngine';
import { PDFGenerator } from '../PDFGenerator';
import { ReportSnapshotService } from '../ReportSnapshotService';
import { AlertClassificationService } from '../AlertClassificationService';
import { ReportCacheService } from '../ReportCacheService';

// Mock all external dependencies
jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

jest.mock('@/lib/redis', () => ({
    redis: null,
    isConnected: false
}));

jest.mock('@/lib/cache', () => ({
    cache: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn().mockResolvedValue(false),
        invalidate: jest.fn().mockResolvedValue(undefined),
        clear: jest.fn().mockResolvedValue(undefined)
    },
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
                pdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Test PDF Content) Tj\nET\nendstream\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n250\n%%EOF')),
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
    readFile: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n179\n%%EOF')),
    access: jest.fn(),
    stat: jest.fn().mockResolvedValue({ size: 1000 }),
    unlink: jest.fn()
}));

describe('Simplified Integration Tests - Reports Module', () => {
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

        // Initialize services with proper mocks
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

        // Setup comprehensive database mocks
        const mockDb = require('@/lib/database').db;

        // Mock alert records with proper structure
        const mockAlertRecords = [
            {
                id: 'alert-test-1',
                tenant_id: 'test-tenant',
                raw_alert_type: 'Phishing Email Detected',
                normalized_type: 'phishing',
                severity: 'high',
                outcome: 'security_incident',
                created_at: new Date('2024-01-02T10:00:00Z'),
                resolved_at: new Date('2024-01-02T11:00:00Z'),
                device_id: 'device-test-1',
                source: 'defender'
            }
        ];

        // Mock metrics records
        const mockMetricsRecords = [
            {
                id: 'metrics-test-1',
                tenant_id: 'test-tenant',
                device_id: 'device-test-1',
                date: new Date('2024-01-02'),
                threats_blocked: 10,
                updates_applied: 5,
                vulnerabilities_detected: 3,
                vulnerabilities_mitigated: 2,
                source: 'firewall'
            }
        ];

        // Setup comprehensive database mocks for different query patterns
        let queryCallCount = 0;
        mockDb.select.mockImplementation(() => {
            queryCallCount++;

            // Different queries return different data structures
            if (queryCallCount <= 2) {
                // Alert queries (firewall and EDR)
                return {
                    from: jest.fn().mockReturnThis(),
                    where: jest.fn().mockReturnThis(),
                    orderBy: jest.fn().mockResolvedValue(mockAlertRecords),
                    limit: jest.fn().mockReturnThis(),
                    innerJoin: jest.fn().mockReturnThis()
                };
            } else if (queryCallCount <= 4) {
                // Metrics queries
                return {
                    from: jest.fn().mockReturnThis(),
                    where: jest.fn().mockReturnThis(),
                    orderBy: jest.fn().mockResolvedValue(mockMetricsRecords),
                    limit: jest.fn().mockReturnThis(),
                    innerJoin: jest.fn().mockReturnThis()
                };
            } else {
                // Vulnerability queries
                return {
                    from: jest.fn().mockReturnThis(),
                    where: jest.fn().mockReturnThis(),
                    innerJoin: jest.fn().mockReturnThis(),
                    orderBy: jest.fn().mockResolvedValue([
                        {
                            id: 'vuln-1',
                            tenant_id: 'test-tenant',
                            cve_id: 'CVE-2024-0001',
                            severity: 'high',
                            detected_at: new Date('2024-01-02'),
                            mitigated_at: null,
                            device_id: 'device-test-1'
                        }
                    ]),
                    limit: jest.fn().mockReturnThis()
                };
            }
        });
        mockDb.insert.mockReturnValue({
            values: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([{ id: 'new-snapshot-id' }])
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

        jest.clearAllTimers();
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

    describe('Basic Report Generation', () => {
        it('should generate a weekly report successfully', async () => {
            const tenantId = 'test-tenant-basic';
            const userId = 'test-user-basic';

            // Mock cache operations
            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();

            // Mock snapshot creation
            const mockSnapshot = {
                id: 'snapshot-basic-test',
                tenantId,
                reportId: 'report-basic-test',
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

            // Generate report
            const report = await reportGenerator.generateWeeklyReport(
                tenantId,
                mockDateRange,
                userId
            );

            // Validate basic report structure
            expect(report).toBeDefined();
            expect(report.reportType).toBe('weekly');
            expect(report.tenantId).toBe(tenantId);
            expect(report.slides).toBeDefined();
            expect(report.slides.length).toBeGreaterThan(0);

            // Verify snapshot was created
            expect(snapshotService.createSnapshot).toHaveBeenCalled();
        }, 10000);

        it('should handle tenant isolation correctly', async () => {
            const tenant1 = 'tenant-isolation-1';
            const tenant2 = 'tenant-isolation-2';
            const userId = 'user-isolation';

            // Mock different data for each tenant
            const mockDb = require('@/lib/database').db;
            let callCount = 0;

            const mockQueryChain = {
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockImplementation(() => {
                    callCount++;
                    return {
                        orderBy: jest.fn().mockReturnThis(),
                        limit: jest.fn().mockResolvedValue([{
                            id: `alert-isolation-${callCount}`,
                            tenant_id: callCount === 1 ? tenant1 : tenant2,
                            raw_alert_type: `Tenant ${callCount} Alert`,
                            normalized_type: 'phishing',
                            severity: 'medium',
                            outcome: 'benign_activity',
                            created_at: new Date('2024-01-02T10:00:00Z'),
                            resolved_at: new Date('2024-01-02T10:30:00Z'),
                            device_id: `device-${callCount}`,
                            source: 'defender'
                        }])
                    };
                }),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn(),
                innerJoin: jest.fn().mockReturnThis()
            };

            mockDb.select.mockReturnValue(mockQueryChain);

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();

            // Mock snapshot creation for each tenant
            jest.spyOn(snapshotService, 'createSnapshot')
                .mockResolvedValueOnce({
                    id: 'snapshot-tenant-1',
                    tenantId: tenant1,
                    reportId: 'report-tenant-1',
                    reportType: 'weekly',
                    dateRange: mockDateRange,
                    generatedAt: new Date(),
                    generatedBy: userId,
                    slideData: [],
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false
                })
                .mockResolvedValueOnce({
                    id: 'snapshot-tenant-2',
                    tenantId: tenant2,
                    reportId: 'report-tenant-2',
                    reportType: 'weekly',
                    dateRange: mockDateRange,
                    generatedAt: new Date(),
                    generatedBy: userId,
                    slideData: [],
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false
                });

            // Generate reports for both tenants
            const report1 = await reportGenerator.generateWeeklyReport(tenant1, mockDateRange, userId);
            const report2 = await reportGenerator.generateWeeklyReport(tenant2, mockDateRange, userId);

            // Validate tenant isolation
            expect(report1.tenantId).toBe(tenant1);
            expect(report2.tenantId).toBe(tenant2);
            expect(report1.slides).toBeDefined();
            expect(report2.slides).toBeDefined();
        }, 10000);
    });

    describe('PDF Export Validation', () => {
        it('should export PDF successfully', async () => {
            const mockSnapshot = {
                id: 'snapshot-pdf-test',
                tenantId: 'tenant-pdf',
                reportId: 'report-pdf',
                reportType: 'weekly' as const,
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: 'user-pdf',
                slideData: [
                    {
                        slideId: 'slide-pdf-1',
                        slideType: 'executive-overview',
                        title: 'PDF Test Report',
                        subtitle: 'Testing PDF Export',
                        summary: 'This is a test report for PDF export validation.',
                        keyPoints: ['Test point 1', 'Test point 2'],
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

            // Export PDF
            const pdfBuffer = await pdfGenerator.exportToPDF(mockSnapshot);

            // Validate PDF output
            expect(pdfBuffer).toBeInstanceOf(Buffer);
            expect(pdfBuffer.length).toBeGreaterThan(0);

            // Validate PDF quality
            const validation = await pdfGenerator.validatePDFOutput(pdfBuffer);
            expect(validation.isValid).toBe(true);
        }, 10000);

        it('should handle PDF generation errors gracefully', async () => {
            const mockSnapshot = {
                id: 'snapshot-error-test',
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

            // Mock browser launch failure
            const mockChromium = require('playwright').chromium;
            mockChromium.launch.mockRejectedValueOnce(new Error('Browser launch failed'));

            // Expect proper error handling
            await expect(pdfGenerator.exportToPDF(mockSnapshot))
                .rejects.toThrow('Failed to initialize browser');
        }, 10000);
    });

    describe('Performance Validation', () => {
        it('should handle moderate dataset efficiently', async () => {
            const tenantId = 'tenant-performance';
            const userId = 'user-performance';

            // Mock moderate dataset (100 alerts)
            const mockAlerts = Array.from({ length: 100 }, (_, i) => ({
                id: `alert-perf-${i}`,
                tenant_id: tenantId,
                raw_alert_type: `Performance Alert ${i}`,
                normalized_type: 'phishing',
                severity: 'medium',
                outcome: 'benign_activity',
                created_at: new Date(`2024-01-0${(i % 7) + 1}T10:00:00Z`),
                resolved_at: new Date(`2024-01-0${(i % 7) + 1}T10:30:00Z`),
                device_id: `device-${i % 10}`,
                source: 'defender'
            }));

            const mockDb = require('@/lib/database').db;
            const mockQueryChain = {
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue(mockAlerts),
                innerJoin: jest.fn().mockReturnThis()
            };
            mockDb.select.mockReturnValue(mockQueryChain);

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();
            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue({
                id: 'snapshot-performance',
                tenantId,
                reportId: 'report-performance',
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
            const report = await reportGenerator.generateWeeklyReport(tenantId, mockDateRange, userId);
            const endTime = Date.now();
            const processingTime = endTime - startTime;

            expect(report).toBeDefined();
            expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
        }, 15000);
    });
});