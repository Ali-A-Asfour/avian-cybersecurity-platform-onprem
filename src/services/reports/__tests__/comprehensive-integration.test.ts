/**
 * Comprehensive Integration Testing Suite for AVIAN Reports Module
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
import { EnhancedDateRange } from '@/types/reports';
import { DataAvailabilityValidator } from '../DataAvailabilityValidator';
import { ReportErrorHandler } from '../ReportErrorHandler';
import { DataAvailabilityValidator } from '../DataAvailabilityValidator';
import { ReportErrorHandler } from '../ReportErrorHandler';

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

describe('Comprehensive Integration Tests - Reports Module', () => {
    let reportGenerator: ReportGenerator;
    let dataAggregator: DataAggregator;
    let historicalDataStore: HistoricalDataStore;
    let templateEngine: TemplateEngine;
    let pdfGenerator: PDFGenerator;
    let snapshotService: ReportSnapshotService;
    let alertClassificationService: AlertClassificationService;
    let cacheService: ReportCacheService;
    let errorHandler: ReportErrorHandler;
    let dataValidator: DataAvailabilityValidator;

    const mockDateRange: EnhancedDateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        timezone: 'America/Toronto',
        weekStart: 'monday'
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Initialize all services
        historicalDataStore = new HistoricalDataStore();
        alertClassificationService = new AlertClassificationService();
        dataAggregator = new DataAggregator(historicalDataStore, alertClassificationService);
        templateEngine = new TemplateEngine();
        pdfGenerator = new PDFGenerator(templateEngine);
        snapshotService = new ReportSnapshotService();
        cacheService = new ReportCacheService();
        errorHandler = new ReportErrorHandler();
        dataValidator = new DataAvailabilityValidator(historicalDataStore);

        reportGenerator = new ReportGenerator(
            dataAggregator,
            templateEngine,
            snapshotService,
            cacheService
        );
    });

    afterEach(async () => {
        await pdfGenerator.closeBrowser();
    });
    describe('End-to-End Report Generation Workflows', () => {
        it('should complete full weekly report generation workflow', async () => {
            const tenantId = 'integration-tenant-weekly';
            const userId = 'integration-user-weekly';

            // Mock comprehensive data for weekly report
            const mockDb = require('@/lib/database').db;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([
                                {
                                    id: 'alert-weekly-1',
                                    tenant_id: tenantId,
                                    raw_alert_type: 'Phishing Email Detected',
                                    normalized_type: 'phishing',
                                    severity: 'high',
                                    outcome: 'security_incident',
                                    created_at: new Date('2024-01-02T10:00:00Z'),
                                    resolved_at: new Date('2024-01-02T11:00:00Z'),
                                    device_id: 'device-weekly-1',
                                    source: 'defender'
                                },
                                {
                                    id: 'alert-weekly-2',
                                    tenant_id: tenantId,
                                    raw_alert_type: 'Malware Blocked',
                                    normalized_type: 'malware',
                                    severity: 'critical',
                                    outcome: 'benign_activity',
                                    created_at: new Date('2024-01-03T14:30:00Z'),
                                    resolved_at: new Date('2024-01-03T14:35:00Z'),
                                    device_id: 'device-weekly-2',
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

            // Mock cache miss
            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();

            // Mock snapshot creation
            const mockSnapshot = {
                id: 'snapshot-weekly-integration',
                tenantId,
                reportId: 'report-weekly-integration',
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

            // Execute full workflow
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
            expect(report.slides.length).toBeGreaterThan(0);

            // Validate required slides exist
            const executiveSlide = report.slides.find(s => s.content.slideType === 'executive-overview');
            const alertsSlide = report.slides.find(s => s.content.slideType === 'alerts-digest');
            const updatesSlide = report.slides.find(s => s.content.slideType === 'updates-summary');
            const vulnerabilitySlide = report.slides.find(s => s.content.slideType === 'vulnerability-posture');

            expect(executiveSlide).toBeDefined();
            expect(alertsSlide).toBeDefined();
            expect(updatesSlide).toBeDefined();
            expect(vulnerabilitySlide).toBeDefined();

            // Validate content quality
            expect(executiveSlide?.content.summary).toContain('alerts');
            expect(alertsSlide?.content.summary).toContain('Alerts Digested');

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
            expect(cacheService.cacheReport).toHaveBeenCalled();
        });

        it('should complete full monthly report generation with trends', async () => {
            const tenantId = 'integration-tenant-monthly';
            const userId = 'integration-user-monthly';
            const monthlyDateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
                timezone: 'America/Toronto',
                weekStart: 'monday'
            };

            // Mock historical data for trend analysis
            const mockDb = require('@/lib/database').db;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([
                                // Week 1 data
                                {
                                    id: 'alert-monthly-w1-1',
                                    tenant_id: tenantId,
                                    raw_alert_type: 'Authentication Failure',
                                    normalized_type: 'authentication',
                                    severity: 'medium',
                                    outcome: 'false_positive',
                                    created_at: new Date('2024-01-02T09:00:00Z'),
                                    resolved_at: new Date('2024-01-02T09:15:00Z'),
                                    device_id: 'device-monthly-1',
                                    source: 'defender'
                                },
                                // Week 2 data
                                {
                                    id: 'alert-monthly-w2-1',
                                    tenant_id: tenantId,
                                    raw_alert_type: 'Network Intrusion Attempt',
                                    normalized_type: 'network',
                                    severity: 'high',
                                    outcome: 'security_incident',
                                    created_at: new Date('2024-01-09T15:30:00Z'),
                                    resolved_at: new Date('2024-01-09T16:00:00Z'),
                                    device_id: 'device-monthly-2',
                                    source: 'sonicwall'
                                }
                            ])
                        })
                    })
                })
            });

            require('@/lib/database').withTransaction.mockImplementation((callback) =>
                callback(mockDb)
            );

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();

            const mockSnapshot = {
                id: 'snapshot-monthly-integration',
                tenantId,
                reportId: 'report-monthly-integration',
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

            // Validate monthly-specific features
            expect(report.reportType).toBe('monthly');
            expect(report.slides.length).toBeGreaterThan(4); // Should have more slides than weekly

            // Validate trend analysis content
            const trendsSlide = report.slides.find(s => s.content.slideType === 'trends-analysis');
            expect(trendsSlide).toBeDefined();
            expect(trendsSlide?.content.summary).toContain('trend');
        });

        it('should complete full quarterly report generation with executive focus', async () => {
            const tenantId = 'integration-tenant-quarterly';
            const userId = 'integration-user-quarterly';
            const quarterlyDateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-03-31'),
                timezone: 'America/Toronto',
                weekStart: 'monday'
            };

            // Mock quarterly aggregated data
            const mockDb = require('@/lib/database').db;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([
                                {
                                    id: 'alert-quarterly-1',
                                    tenant_id: tenantId,
                                    raw_alert_type: 'Quarterly Summary Alert',
                                    normalized_type: 'other',
                                    severity: 'low',
                                    outcome: 'benign_activity',
                                    created_at: new Date('2024-02-15T12:00:00Z'),
                                    resolved_at: new Date('2024-02-15T12:30:00Z'),
                                    device_id: 'device-quarterly-1',
                                    source: 'defender'
                                }
                            ])
                        })
                    })
                })
            });

            require('@/lib/database').withTransaction.mockImplementation((callback) =>
                callback(mockDb)
            );

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();

            const mockSnapshot = {
                id: 'snapshot-quarterly-integration',
                tenantId,
                reportId: 'report-quarterly-integration',
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

            // Validate quarterly-specific features
            expect(report.reportType).toBe('quarterly');
            expect(report.slides.length).toBeLessThanOrEqual(5); // Should be 3-5 slides max

            // Validate executive focus
            const executiveSlide = report.slides.find(s => s.content.slideType === 'executive-overview');
            expect(executiveSlide).toBeDefined();
            expect(executiveSlide?.content.summary).not.toContain('technical');
            expect(executiveSlide?.content.summary).toContain('business');
        });
    });
    describe('Multi-Tenant Isolation in Concurrent Scenarios', () => {
        it('should maintain strict tenant isolation under high concurrency', async () => {
            const tenants = [
                { id: 'tenant-concurrent-1', user: 'user-concurrent-1' },
                { id: 'tenant-concurrent-2', user: 'user-concurrent-2' },
                { id: 'tenant-concurrent-3', user: 'user-concurrent-3' },
                { id: 'tenant-concurrent-4', user: 'user-concurrent-4' }
            ];

            // Mock different data for each tenant
            const mockDb = require('@/lib/database').db;
            let callCount = 0;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockImplementation((condition) => ({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([{
                                id: `alert-concurrent-${callCount}`,
                                tenant_id: tenants[callCount % tenants.length].id,
                                raw_alert_type: `Tenant ${callCount + 1} Alert`,
                                normalized_type: 'phishing',
                                severity: 'medium',
                                outcome: 'benign_activity',
                                created_at: new Date(`2024-01-0${(callCount % 7) + 1}T10:00:00Z`),
                                resolved_at: new Date(`2024-01-0${(callCount % 7) + 1}T10:30:00Z`),
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

            // Generate reports concurrently for all tenants
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

                // Verify no cross-tenant data contamination
                const alertsSlide = report.slides.find(s => s.content.slideType === 'alerts-digest');
                expect(alertsSlide?.content.summary).toContain(`Tenant ${index + 1}`);

                // Ensure other tenant data is not present
                tenants.forEach((otherTenant, otherIndex) => {
                    if (otherIndex !== index) {
                        expect(alertsSlide?.content.summary).not.toContain(`Tenant ${otherIndex + 1}`);
                    }
                });
            });

            // Verify snapshots were created with correct tenant isolation
            expect(snapshotService.createSnapshot).toHaveBeenCalledTimes(tenants.length);
            tenants.forEach((tenant, index) => {
                expect(snapshotService.createSnapshot).toHaveBeenNthCalledWith(
                    index + 1,
                    expect.objectContaining({ tenantId: tenant.id }),
                    tenant.user,
                    undefined,
                    undefined
                );
            });
        });

        it('should handle concurrent report generation with database contention', async () => {
            const tenant1 = 'tenant-contention-1';
            const tenant2 = 'tenant-contention-2';
            const user1 = 'user-contention-1';
            const user2 = 'user-contention-2';

            // Mock database with simulated contention
            const mockDb = require('@/lib/database').db;
            let dbCallCount = 0;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockImplementation(() => {
                                dbCallCount++;
                                // Simulate database delay for contention
                                return new Promise(resolve => {
                                    setTimeout(() => {
                                        resolve([{
                                            id: `alert-contention-${dbCallCount}`,
                                            tenant_id: dbCallCount % 2 === 1 ? tenant1 : tenant2,
                                            raw_alert_type: `Contention Alert ${dbCallCount}`,
                                            normalized_type: 'network',
                                            severity: 'high',
                                            outcome: 'security_incident',
                                            created_at: new Date('2024-01-02T10:00:00Z'),
                                            resolved_at: new Date('2024-01-02T10:30:00Z'),
                                            device_id: `device-contention-${dbCallCount}`,
                                            source: 'sonicwall'
                                        }]);
                                    }, Math.random() * 100); // Random delay up to 100ms
                                });
                            })
                        })
                    })
                })
            });

            require('@/lib/database').withTransaction.mockImplementation((callback) =>
                callback(mockDb)
            );

            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();

            jest.spyOn(snapshotService, 'createSnapshot')
                .mockResolvedValueOnce({
                    id: 'snapshot-contention-1',
                    tenantId: tenant1,
                    reportId: 'report-contention-1',
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
                    id: 'snapshot-contention-2',
                    tenantId: tenant2,
                    reportId: 'report-contention-2',
                    reportType: 'weekly',
                    dateRange: mockDateRange,
                    generatedAt: new Date(),
                    generatedBy: user2,
                    slideData: [],
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false
                });

            // Generate reports concurrently with database contention
            const [report1, report2] = await Promise.all([
                reportGenerator.generateWeeklyReport(tenant1, mockDateRange, user1),
                reportGenerator.generateWeeklyReport(tenant2, mockDateRange, user2)
            ]);

            // Validate both reports completed successfully despite contention
            expect(report1.tenantId).toBe(tenant1);
            expect(report2.tenantId).toBe(tenant2);
            expect(report1.slides).toBeDefined();
            expect(report2.slides).toBeDefined();

            // Verify tenant isolation was maintained
            const alert1Slide = report1.slides.find(s => s.content.slideType === 'alerts-digest');
            const alert2Slide = report2.slides.find(s => s.content.slideType === 'alerts-digest');

            expect(alert1Slide?.content.summary).toContain('Contention Alert 1');
            expect(alert2Slide?.content.summary).toContain('Contention Alert 2');
        });

        it('should prevent data leakage between tenants during cache operations', async () => {
            const tenant1 = 'tenant-cache-isolation-1';
            const tenant2 = 'tenant-cache-isolation-2';
            const user1 = 'user-cache-isolation-1';
            const user2 = 'user-cache-isolation-2';

            // Mock different cache keys for each tenant
            const cacheKey1 = `weekly:${tenant1}:2024-01-01:2024-01-07`;
            const cacheKey2 = `weekly:${tenant2}:2024-01-01:2024-01-07`;

            // Mock database responses
            const mockDb = require('@/lib/database').db;
            let queryCount = 0;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockImplementation(() => {
                                queryCount++;
                                return Promise.resolve([{
                                    id: `alert-cache-${queryCount}`,
                                    tenant_id: queryCount === 1 ? tenant1 : tenant2,
                                    raw_alert_type: `Cache Test Alert ${queryCount}`,
                                    normalized_type: 'malware',
                                    severity: 'critical',
                                    outcome: 'security_incident',
                                    created_at: new Date('2024-01-03T14:00:00Z'),
                                    resolved_at: new Date('2024-01-03T14:15:00Z'),
                                    device_id: `device-cache-${queryCount}`,
                                    source: 'defender'
                                }]);
                            })
                        })
                    })
                })
            });

            require('@/lib/database').withTransaction.mockImplementation((callback) =>
                callback(mockDb)
            );

            // Mock cache operations with proper isolation
            jest.spyOn(cacheService, 'getCachedReport')
                .mockImplementation((key) => {
                    // Ensure cache keys are tenant-specific
                    expect(key).toMatch(new RegExp(`^weekly:(${tenant1}|${tenant2}):`));
                    return Promise.resolve(null); // Cache miss
                });

            jest.spyOn(cacheService, 'cacheReport')
                .mockImplementation((key, report) => {
                    // Verify cache key matches report tenant
                    if (key.includes(tenant1)) {
                        expect(report.tenantId).toBe(tenant1);
                    } else if (key.includes(tenant2)) {
                        expect(report.tenantId).toBe(tenant2);
                    }
                    return Promise.resolve();
                });

            jest.spyOn(snapshotService, 'createSnapshot')
                .mockResolvedValueOnce({
                    id: 'snapshot-cache-1',
                    tenantId: tenant1,
                    reportId: 'report-cache-1',
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
                    id: 'snapshot-cache-2',
                    tenantId: tenant2,
                    reportId: 'report-cache-2',
                    reportType: 'weekly',
                    dateRange: mockDateRange,
                    generatedAt: new Date(),
                    generatedBy: user2,
                    slideData: [],
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false
                });

            // Generate reports for both tenants
            const [report1, report2] = await Promise.all([
                reportGenerator.generateWeeklyReport(tenant1, mockDateRange, user1),
                reportGenerator.generateWeeklyReport(tenant2, mockDateRange, user2)
            ]);

            // Validate cache isolation
            expect(cacheService.getCachedReport).toHaveBeenCalledWith(cacheKey1);
            expect(cacheService.getCachedReport).toHaveBeenCalledWith(cacheKey2);
            expect(cacheService.cacheReport).toHaveBeenCalledWith(cacheKey1, report1);
            expect(cacheService.cacheReport).toHaveBeenCalledWith(cacheKey2, report2);

            // Verify no cross-tenant contamination
            expect(report1.tenantId).toBe(tenant1);
            expect(report2.tenantId).toBe(tenant2);
        });
    });
    describe('PDF Export Quality and Integrity Validation', () => {
        it('should generate high-quality PDFs with all visual elements intact', async () => {
            const tenantId = 'tenant-pdf-quality';
            const userId = 'user-pdf-quality';

            // Mock comprehensive slide data for PDF generation
            const mockSnapshot = {
                id: 'snapshot-pdf-quality-test',
                tenantId,
                reportId: 'report-pdf-quality-test',
                reportType: 'weekly' as const,
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: userId,
                slideData: [
                    {
                        slideId: 'slide-executive',
                        slideType: 'executive-overview',
                        title: 'Executive Overview',
                        subtitle: 'Weekly Security Report - January 1-7, 2024',
                        summary: 'This week we processed 250 alerts and applied 45 updates across all managed devices.',
                        keyPoints: [
                            '250 alerts processed with 95% automation',
                            '45 security updates applied',
                            '3 critical incidents resolved',
                            'Zero data breaches detected'
                        ],
                        charts: [
                            {
                                type: 'bar',
                                title: 'Weekly Alert Timeline',
                                data: [
                                    { label: 'Monday', value: 35 },
                                    { label: 'Tuesday', value: 42 },
                                    { label: 'Wednesday', value: 38 },
                                    { label: 'Thursday', value: 45 },
                                    { label: 'Friday', value: 50 },
                                    { label: 'Saturday', value: 25 },
                                    { label: 'Sunday', value: 15 }
                                ]
                            }
                        ],
                        computedMetrics: {
                            totalAlerts: 250,
                            totalUpdates: 45,
                            criticalIncidents: 3,
                            automationRate: 95
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
                    },
                    {
                        slideId: 'slide-alerts',
                        slideType: 'alerts-digest',
                        title: 'Alerts Digested',
                        subtitle: 'Security Alert Processing Summary',
                        summary: 'Successfully processed 250 alerts across all categories with high automation rates.',
                        keyPoints: [
                            'Phishing: 85 alerts (34%)',
                            'Malware: 65 alerts (26%)',
                            'Network: 45 alerts (18%)',
                            'Authentication: 35 alerts (14%)',
                            'Other: 20 alerts (8%)'
                        ],
                        charts: [
                            {
                                type: 'donut',
                                title: 'Alert Classification Breakdown',
                                data: [
                                    { label: 'Phishing', value: 85 },
                                    { label: 'Malware', value: 65 },
                                    { label: 'Network', value: 45 },
                                    { label: 'Authentication', value: 35 },
                                    { label: 'Other', value: 20 }
                                ]
                            }
                        ],
                        computedMetrics: {
                            totalAlerts: 250,
                            securityIncidents: 15,
                            benignActivity: 200,
                            falsePositives: 35
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
            };

            // Mock Playwright PDF generation
            const mockPdfBuffer = Buffer.from('high-quality-pdf-content-with-charts-and-branding');
            const mockChromium = require('playwright').chromium;
            const mockPage = {
                setContent: jest.fn(),
                pdf: jest.fn().mockResolvedValue(mockPdfBuffer),
                close: jest.fn(),
                evaluate: jest.fn().mockResolvedValue(undefined),
                waitForTimeout: jest.fn(),
                waitForLoadState: jest.fn(),
                addInitScript: jest.fn()
            };
            const mockBrowser = {
                newPage: jest.fn().mockResolvedValue(mockPage),
                close: jest.fn(),
                version: jest.fn().mockReturnValue('1.40.0')
            };
            mockChromium.launch.mockResolvedValue(mockBrowser);

            // Generate PDF
            const pdfBuffer = await pdfGenerator.exportToPDF(mockSnapshot);

            // Validate PDF generation process
            expect(mockChromium.launch).toHaveBeenCalledWith({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            expect(mockPage.setContent).toHaveBeenCalled();
            expect(mockPage.pdf).toHaveBeenCalledWith({
                format: 'A4',
                landscape: true,
                printBackground: true,
                margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
            });

            // Validate PDF quality
            const validation = await pdfGenerator.validatePDFOutput(pdfBuffer);
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
            expect(pdfBuffer).toBeInstanceOf(Buffer);
            expect(pdfBuffer.length).toBeGreaterThan(0);

            // Verify PDF contains expected content structure
            expect(mockPage.setContent).toHaveBeenCalledWith(
                expect.stringContaining('Executive Overview')
            );
            expect(mockPage.setContent).toHaveBeenCalledWith(
                expect.stringContaining('Alerts Digested')
            );
        });

        it('should maintain PDF consistency across multiple exports of same snapshot', async () => {
            const mockSnapshot = {
                id: 'snapshot-consistency-test',
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
                        title: 'Consistency Test Report',
                        subtitle: 'Reproducible PDF Generation',
                        summary: 'This report tests PDF generation consistency.',
                        keyPoints: ['Point 1', 'Point 2', 'Point 3'],
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

            // Mock consistent PDF generation
            const consistentPdfContent = 'consistent-pdf-content-for-reproducibility-testing';
            const mockPdfBuffer = Buffer.from(consistentPdfContent);

            const mockChromium = require('playwright').chromium;
            const mockPage = {
                setContent: jest.fn(),
                pdf: jest.fn().mockResolvedValue(mockPdfBuffer),
                close: jest.fn(),
                evaluate: jest.fn().mockResolvedValue(undefined),
                waitForTimeout: jest.fn(),
                waitForLoadState: jest.fn(),
                addInitScript: jest.fn()
            };
            const mockBrowser = {
                newPage: jest.fn().mockResolvedValue(mockPage),
                close: jest.fn(),
                version: jest.fn().mockReturnValue('1.40.0')
            };
            mockChromium.launch.mockResolvedValue(mockBrowser);

            // Generate PDF multiple times
            const pdf1 = await pdfGenerator.exportToPDF(mockSnapshot);
            const pdf2 = await pdfGenerator.exportToPDF(mockSnapshot);
            const pdf3 = await pdfGenerator.exportToPDF(mockSnapshot);

            // Generate checksums for consistency verification
            const checksum1 = pdfGenerator.generateFileChecksum(pdf1);
            const checksum2 = pdfGenerator.generateFileChecksum(pdf2);
            const checksum3 = pdfGenerator.generateFileChecksum(pdf3);

            // Verify all checksums are identical
            expect(checksum1).toBe(checksum2);
            expect(checksum2).toBe(checksum3);
            expect(pdf1.equals(pdf2)).toBe(true);
            expect(pdf2.equals(pdf3)).toBe(true);
        });

        it('should handle PDF generation failures gracefully with proper error reporting', async () => {
            const mockSnapshot = {
                id: 'snapshot-error-handling',
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
            mockChromium.launch.mockRejectedValue(new Error('Browser launch failed: insufficient memory'));

            // Attempt PDF generation and expect proper error handling
            await expect(pdfGenerator.exportToPDF(mockSnapshot))
                .rejects.toThrow('PDF generation failed');

            // Verify error was logged and handled appropriately
            expect(mockChromium.launch).toHaveBeenCalled();
        });

        it('should validate PDF output quality and reject invalid PDFs', async () => {
            const mockSnapshot = {
                id: 'snapshot-validation-test',
                tenantId: 'tenant-validation',
                reportId: 'report-validation',
                reportType: 'weekly' as const,
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: 'user-validation',
                slideData: [
                    {
                        slideId: 'slide-validation',
                        slideType: 'executive-overview',
                        title: 'Validation Test',
                        subtitle: 'PDF Quality Validation',
                        summary: 'Testing PDF validation logic.',
                        keyPoints: ['Validation Point 1'],
                        charts: [],
                        computedMetrics: { totalAlerts: 50 },
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

            // Mock invalid PDF generation
            const invalidPdfBuffer = Buffer.from('invalid-pdf-content-not-a-real-pdf');

            const mockChromium = require('playwright').chromium;
            const mockPage = {
                setContent: jest.fn(),
                pdf: jest.fn().mockResolvedValue(invalidPdfBuffer),
                close: jest.fn(),
                evaluate: jest.fn().mockResolvedValue(undefined),
                waitForTimeout: jest.fn(),
                waitForLoadState: jest.fn(),
                addInitScript: jest.fn()
            };
            const mockBrowser = {
                newPage: jest.fn().mockResolvedValue(mockPage),
                close: jest.fn(),
                version: jest.fn().mockReturnValue('1.40.0')
            };
            mockChromium.launch.mockResolvedValue(mockBrowser);

            // Generate PDF
            const pdfBuffer = await pdfGenerator.exportToPDF(mockSnapshot);

            // Validate PDF and expect validation failure
            const validation = await pdfGenerator.validatePDFOutput(pdfBuffer);
            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
            expect(validation.errors[0]).toContain('Invalid PDF structure');
        });

        it('should handle large reports with complex charts efficiently', async () => {
            const tenantId = 'tenant-large-report';
            const userId = 'user-large-report';

            // Create large snapshot with multiple complex slides
            const largeSlideData = Array.from({ length: 10 }, (_, i) => ({
                slideId: `slide-large-${i}`,
                slideType: i % 2 === 0 ? 'alerts-digest' : 'vulnerability-posture',
                title: `Large Report Slide ${i + 1}`,
                subtitle: `Complex Data Visualization ${i + 1}`,
                summary: `This slide contains complex charts and large datasets for performance testing. Slide ${i + 1} of 10.`,
                keyPoints: Array.from({ length: 5 }, (_, j) => `Key point ${j + 1} for slide ${i + 1}`),
                charts: [
                    {
                        type: 'bar',
                        title: `Chart ${i + 1}`,
                        data: Array.from({ length: 50 }, (_, k) => ({
                            label: `Data Point ${k + 1}`,
                            value: Math.floor(Math.random() * 100)
                        }))
                    }
                ],
                computedMetrics: {
                    totalAlerts: 1000 + i * 100,
                    processedItems: 500 + i * 50
                },
                chartData: [],
                templateData: {
                    layout: {
                        type: (i % 2 === 0 ? 'alerts-digest' : 'vulnerability-posture') as const,
                        orientation: 'landscape' as const,
                        theme: 'dark' as const,
                        branding: 'avian' as const
                    }
                }
            }));

            const largeSnapshot = {
                id: 'snapshot-large-performance',
                tenantId,
                reportId: 'report-large-performance',
                reportType: 'monthly' as const,
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: userId,
                slideData: largeSlideData,
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            };

            // Mock PDF generation with performance tracking
            const largePdfBuffer = Buffer.from('large-complex-pdf-with-multiple-charts-and-data');
            const mockChromium = require('playwright').chromium;
            const mockPage = {
                setContent: jest.fn(),
                pdf: jest.fn().mockResolvedValue(largePdfBuffer),
                close: jest.fn(),
                evaluate: jest.fn().mockResolvedValue(undefined),
                waitForTimeout: jest.fn(),
                waitForLoadState: jest.fn(),
                addInitScript: jest.fn()
            };
            const mockBrowser = {
                newPage: jest.fn().mockResolvedValue(mockPage),
                close: jest.fn(),
                version: jest.fn().mockReturnValue('1.40.0')
            };
            mockChromium.launch.mockResolvedValue(mockBrowser);

            // Measure PDF generation performance
            const startTime = Date.now();
            const pdfBuffer = await pdfGenerator.exportToPDF(largeSnapshot);
            const endTime = Date.now();
            const processingTime = endTime - startTime;

            // Validate performance and quality
            expect(pdfBuffer).toBeInstanceOf(Buffer);
            expect(pdfBuffer.length).toBeGreaterThan(0);
            expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds

            // Verify all slides were processed
            expect(mockPage.setContent).toHaveBeenCalledWith(
                expect.stringContaining('Large Report Slide')
            );

            const validation = await pdfGenerator.validatePDFOutput(pdfBuffer);
            expect(validation.isValid).toBe(true);
        });
    });

    describe('Error Recovery and System Resilience', () => {
        it('should recover from transient database failures', async () => {
            const tenantId = 'tenant-db-recovery';
            const userId = 'user-db-recovery';

            // Mock database failure followed by recovery
            const mockDb = require('@/lib/database').db;
            let attemptCount = 0;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockImplementation(() => {
                                attemptCount++;
                                if (attemptCount === 1) {
                                    return Promise.reject(new Error('Database connection timeout'));
                                }
                                return Promise.resolve([{
                                    id: 'alert-recovery-1',
                                    tenant_id: tenantId,
                                    raw_alert_type: 'Recovery Test Alert',
                                    normalized_type: 'phishing',
                                    severity: 'medium',
                                    outcome: 'benign_activity',
                                    created_at: new Date('2024-01-02T10:00:00Z'),
                                    resolved_at: new Date('2024-01-02T10:30:00Z'),
                                    device_id: 'device-recovery-1',
                                    source: 'defender'
                                }]);
                            })
                        })
                    })
                })
            });

            require('@/lib/database').withTransaction.mockImplementation((callback) =>
                callback(mockDb)
            );

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
            ).rejects.toThrow('Database connection timeout');

            // Second attempt should succeed
            const report = await reportGenerator.generateWeeklyReport(tenantId, mockDateRange, userId);

            expect(report).toBeDefined();
            expect(report.tenantId).toBe(tenantId);
            expect(attemptCount).toBe(2); // Verify retry occurred
        });

        it('should handle service degradation gracefully', async () => {
            const tenantId = 'tenant-degradation';
            const userId = 'user-degradation';

            // Mock partial service failures
            const mockDb = require('@/lib/database').db;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([]) // Empty data
                        })
                    })
                })
            });

            require('@/lib/database').withTransaction.mockImplementation((callback) =>
                callback(mockDb)
            );

            // Mock cache service failure
            jest.spyOn(cacheService, 'getCachedReport').mockRejectedValue(
                new Error('Cache service unavailable')
            );
            jest.spyOn(cacheService, 'cacheReport').mockRejectedValue(
                new Error('Cache service unavailable')
            );

            jest.spyOn(snapshotService, 'createSnapshot').mockResolvedValue({
                id: 'snapshot-degradation',
                tenantId,
                reportId: 'report-degradation',
                reportType: 'weekly',
                dateRange: mockDateRange,
                generatedAt: new Date(),
                generatedBy: userId,
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            });

            // Report generation should succeed despite cache failures
            const report = await reportGenerator.generateWeeklyReport(tenantId, mockDateRange, userId);

            expect(report).toBeDefined();
            expect(report.tenantId).toBe(tenantId);
            expect(report.slides).toBeDefined();

            // Should still have executive overview with "no data" message
            const executiveSlide = report.slides.find(s => s.content.slideType === 'executive-overview');
            expect(executiveSlide).toBeDefined();
            expect(executiveSlide?.content.summary).toContain('No security alerts');
        });
    });
});