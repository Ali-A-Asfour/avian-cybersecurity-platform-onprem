/**
 * Multi-Tenant Concurrency Stress Tests
 * 
 * Task 12.1: Integration testing suite - Multi-tenant isolation in concurrent scenarios
 * Tests system behavior under high concurrency with multiple tenants
 * 
 * Requirements: All requirements - Multi-tenant data isolation and concurrency
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

// Mock external dependencies
jest.mock('@/lib/logger');
jest.mock('@/lib/database');
jest.mock('playwright');
jest.mock('fs/promises');

describe('Multi-Tenant Concurrency Stress Tests', () => {
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
    });

    afterEach(async () => {
        await pdfGenerator.closeBrowser();
    });

    describe('High Concurrency Multi-Tenant Scenarios', () => {
        it('should handle 50 concurrent report generations across 10 tenants', async () => {
            const tenantCount = 10;
            const reportsPerTenant = 5;
            const totalReports = tenantCount * reportsPerTenant;

            // Generate tenant and user data
            const tenants = Array.from({ length: tenantCount }, (_, i) => ({
                id: `stress-tenant-${i + 1}`,
                users: Array.from({ length: reportsPerTenant }, (_, j) => `stress-user-${i + 1}-${j + 1}`)
            }));

            // Mock database responses with tenant-specific data
            const mockDb = require('@/lib/database').db;
            let queryCount = 0;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockImplementation((condition) => ({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockImplementation(() => {
                                queryCount++;
                                const tenantIndex = (queryCount - 1) % tenantCount;
                                const reportIndex = Math.floor((queryCount - 1) / tenantCount);

                                return Promise.resolve([{
                                    id: `alert-stress-${queryCount}`,
                                    tenant_id: tenants[tenantIndex].id,
                                    raw_alert_type: `Stress Test Alert ${queryCount}`,
                                    normalized_type: 'phishing',
                                    severity: 'medium',
                                    outcome: 'benign_activity',
                                    created_at: new Date(`2024-01-0${(queryCount % 7) + 1}T10:00:00Z`),
                                    resolved_at: new Date(`2024-01-0${(queryCount % 7) + 1}T10:30:00Z`),
                                    device_id: `device-stress-${queryCount}`,
                                    source: 'defender'
                                }]);
                            })
                        })
                    }))
                })
            });

            require('@/lib/database').withTransaction.mockImplementation((callback) =>
                callback(mockDb)
            );

            // Mock cache misses to force generation
            jest.spyOn(cacheService, 'getCachedReport').mockResolvedValue(null);
            jest.spyOn(cacheService, 'cacheReport').mockResolvedValue();

            // Mock snapshot creation
            let snapshotCount = 0;
            jest.spyOn(snapshotService, 'createSnapshot').mockImplementation(() => {
                snapshotCount++;
                const tenantIndex = (snapshotCount - 1) % tenantCount;
                return Promise.resolve({
                    id: `snapshot-stress-${snapshotCount}`,
                    tenantId: tenants[tenantIndex].id,
                    reportId: `report-stress-${snapshotCount}`,
                    reportType: 'weekly',
                    dateRange: mockDateRange,
                    generatedAt: new Date(),
                    generatedBy: tenants[tenantIndex].users[(snapshotCount - 1) % reportsPerTenant],
                    slideData: [],
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false
                });
            });

            // Create all report generation promises
            const reportPromises: Promise<any>[] = [];
            tenants.forEach(tenant => {
                tenant.users.forEach(user => {
                    reportPromises.push(
                        reportGenerator.generateWeeklyReport(tenant.id, mockDateRange, user)
                    );
                });
            });

            // Execute all reports concurrently
            const startTime = Date.now();
            const reports = await Promise.all(reportPromises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Validate all reports completed successfully
            expect(reports).toHaveLength(totalReports);
            expect(totalTime).toBeLessThan(60000); // Should complete within 60 seconds

            // Verify tenant isolation
            reports.forEach((report, index) => {
                const expectedTenantIndex = index % tenantCount;
                const expectedTenant = tenants[expectedTenantIndex];

                expect(report.tenantId).toBe(expectedTenant.id);
                expect(report.slides).toBeDefined();
                expect(report.slides.length).toBeGreaterThan(0);
            });

            // Verify no cross-tenant data contamination
            const tenantReportGroups = new Map();
            reports.forEach(report => {
                if (!tenantReportGroups.has(report.tenantId)) {
                    tenantReportGroups.set(report.tenantId, []);
                }
                tenantReportGroups.get(report.tenantId).push(report);
            });

            // Each tenant should have exactly reportsPerTenant reports
            expect(tenantReportGroups.size).toBe(tenantCount);
            tenantReportGroups.forEach((tenantReports, tenantId) => {
                expect(tenantReports).toHaveLength(reportsPerTenant);
                tenantReports.forEach((report: any) => {
                    expect(report.tenantId).toBe(tenantId);
                });
            });

            // Verify database queries were properly isolated
            expect(queryCount).toBe(totalReports);
            expect(snapshotCount).toBe(totalReports);
        });

        it('should maintain data integrity under database connection pressure', async () => {
            const concurrentTenants = 20;
            const tenants = Array.from({ length: concurrentTenants }, (_, i) => ({
                id: `pressure-tenant-${i + 1}`,
                user: `pressure-user-${i + 1}`
            }));

            // Mock database with simulated connection pressure
            const mockDb = require('@/lib/database').db;
            let connectionAttempts = 0;
            const maxConnections = 5; // Simulate limited connection pool

            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockImplementation(() => {
                                connectionAttempts++;

                                // Simulate connection pressure with delays
                                const delay = connectionAttempts > maxConnections ?
                                    Math.random() * 500 + 200 : // 200-700ms delay when over limit
                                    Math.random() * 100; // 0-100ms normal delay

                                return new Promise(resolve => {
                                    setTimeout(() => {
                                        const tenantIndex = (connectionAttempts - 1) % concurrentTenants;
                                        resolve([{
                                            id: `alert-pressure-${connectionAttempts}`,
                                            tenant_id: tenants[tenantIndex].id,
                                            raw_alert_type: `Pressure Test Alert ${connectionAttempts}`,
                                            normalized_type: 'network',
                                            severity: 'high',
                                            outcome: 'security_incident',
                                            created_at: new Date('2024-01-02T10:00:00Z'),
                                            resolved_at: new Date('2024-01-02T10:30:00Z'),
                                            device_id: `device-pressure-${connectionAttempts}`,
                                            source: 'sonicwall'
                                        }]);
                                    }, delay);
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

            // Mock snapshot creation with tenant validation
            jest.spyOn(snapshotService, 'createSnapshot').mockImplementation((report, userId) => {
                const tenantId = report.tenantId;
                const expectedUser = tenants.find(t => t.id === tenantId)?.user;
                expect(userId).toBe(expectedUser);

                return Promise.resolve({
                    id: `snapshot-pressure-${tenantId}`,
                    tenantId,
                    reportId: report.id,
                    reportType: 'weekly',
                    dateRange: mockDateRange,
                    generatedAt: new Date(),
                    generatedBy: userId,
                    slideData: [],
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false
                });
            });

            // Generate reports concurrently with connection pressure
            const reportPromises = tenants.map(tenant =>
                reportGenerator.generateWeeklyReport(tenant.id, mockDateRange, tenant.user)
            );

            const reports = await Promise.all(reportPromises);

            // Validate all reports completed despite connection pressure
            expect(reports).toHaveLength(concurrentTenants);

            // Verify tenant isolation was maintained under pressure
            reports.forEach((report, index) => {
                expect(report.tenantId).toBe(tenants[index].id);
                expect(report.slides).toBeDefined();

                // Verify tenant-specific data
                const alertsSlide = report.slides.find(s => s.content.slideType === 'alerts-digest');
                expect(alertsSlide?.content.summary).toContain(`Pressure Test Alert`);
            });

            // Verify all database connections were handled
            expect(connectionAttempts).toBe(concurrentTenants);
        });

        it('should handle concurrent PDF exports without cross-tenant contamination', async () => {
            const exportTenants = 15;
            const tenants = Array.from({ length: exportTenants }, (_, i) => ({
                id: `export-tenant-${i + 1}`,
                user: `export-user-${i + 1}`,
                reportId: `export-report-${i + 1}`,
                snapshotId: `export-snapshot-${i + 1}`
            }));

            // Mock snapshots for each tenant
            jest.spyOn(snapshotService, 'getSnapshotByReportId').mockImplementation((reportId) => {
                const tenant = tenants.find(t => t.reportId === reportId);
                if (!tenant) return Promise.resolve(null);

                return Promise.resolve({
                    id: tenant.snapshotId,
                    tenantId: tenant.id,
                    reportId: tenant.reportId,
                    reportType: 'weekly' as const,
                    dateRange: mockDateRange,
                    generatedAt: new Date(),
                    generatedBy: tenant.user,
                    slideData: [{
                        slideId: `slide-${tenant.id}`,
                        slideType: 'executive-overview',
                        title: `Report for ${tenant.id}`,
                        subtitle: 'Tenant-specific content',
                        summary: `This is confidential data for ${tenant.id} only.`,
                        keyPoints: [`Tenant: ${tenant.id}`, `User: ${tenant.user}`],
                        charts: [],
                        computedMetrics: { tenantId: tenant.id },
                        chartData: [],
                        templateData: {
                            layout: {
                                type: 'executive-overview' as const,
                                orientation: 'landscape' as const,
                                theme: 'dark' as const,
                                branding: 'avian' as const
                            }
                        }
                    }],
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false
                });
            });

            // Mock PDF generation with tenant-specific content
            const mockChromium = require('playwright').chromium;
            let pdfGenerationCount = 0;
            const mockPage = {
                setContent: jest.fn().mockImplementation((html) => {
                    pdfGenerationCount++;
                    // Verify HTML contains only the correct tenant's data
                    const tenantIndex = (pdfGenerationCount - 1) % exportTenants;
                    const expectedTenant = tenants[tenantIndex];
                    expect(html).toContain(expectedTenant.id);

                    // Ensure no other tenant data is present
                    tenants.forEach((otherTenant, otherIndex) => {
                        if (otherIndex !== tenantIndex) {
                            expect(html).not.toContain(otherTenant.id);
                        }
                    });
                }),
                pdf: jest.fn().mockImplementation(() => {
                    const tenantIndex = (pdfGenerationCount - 1) % exportTenants;
                    const tenant = tenants[tenantIndex];
                    return Promise.resolve(Buffer.from(`pdf-content-for-${tenant.id}`));
                }),
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

            // Generate PDFs concurrently for all tenants
            const pdfPromises = tenants.map(async (tenant) => {
                const snapshot = await snapshotService.getSnapshotByReportId(tenant.reportId);
                return pdfGenerator.exportToPDF(snapshot!);
            });

            const pdfs = await Promise.all(pdfPromises);

            // Validate all PDFs were generated
            expect(pdfs).toHaveLength(exportTenants);

            // Verify each PDF contains only the correct tenant's data
            pdfs.forEach((pdf, index) => {
                const expectedTenant = tenants[index];
                const pdfContent = pdf.toString();
                expect(pdfContent).toContain(expectedTenant.id);

                // Ensure no cross-tenant contamination
                tenants.forEach((otherTenant, otherIndex) => {
                    if (otherIndex !== index) {
                        expect(pdfContent).not.toContain(otherTenant.id);
                    }
                });
            });

            // Verify PDF generation count matches tenant count
            expect(pdfGenerationCount).toBe(exportTenants);
        });
    });
    describe('Cache Isolation Under Concurrency', () => {
        it('should maintain cache isolation with concurrent cache operations', async () => {
            const cacheTenants = 12;
            const tenants = Array.from({ length: cacheTenants }, (_, i) => ({
                id: `cache-tenant-${i + 1}`,
                user: `cache-user-${i + 1}`,
                cacheKey: `weekly:cache-tenant-${i + 1}:2024-01-01:2024-01-07`
            }));

            // Mock database responses
            const mockDb = require('@/lib/database').db;
            let dbQueryCount = 0;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockImplementation(() => {
                                dbQueryCount++;
                                const tenantIndex = (dbQueryCount - 1) % cacheTenants;
                                const tenant = tenants[tenantIndex];

                                return Promise.resolve([{
                                    id: `alert-cache-${dbQueryCount}`,
                                    tenant_id: tenant.id,
                                    raw_alert_type: `Cache Alert for ${tenant.id}`,
                                    normalized_type: 'malware',
                                    severity: 'critical',
                                    outcome: 'security_incident',
                                    created_at: new Date('2024-01-03T14:00:00Z'),
                                    resolved_at: new Date('2024-01-03T14:15:00Z'),
                                    device_id: `device-cache-${dbQueryCount}`,
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

            // Mock cache operations with strict isolation validation
            const cacheStorage = new Map<string, any>();

            jest.spyOn(cacheService, 'getCachedReport').mockImplementation((key) => {
                // Verify cache key format and tenant isolation
                expect(key).toMatch(/^weekly:cache-tenant-\d+:2024-01-01:2024-01-07$/);
                return Promise.resolve(cacheStorage.get(key) || null);
            });

            jest.spyOn(cacheService, 'cacheReport').mockImplementation((key, report) => {
                // Verify cache key matches report tenant
                const tenantMatch = key.match(/weekly:(cache-tenant-\d+):/);
                expect(tenantMatch).toBeTruthy();
                expect(report.tenantId).toBe(tenantMatch![1]);

                cacheStorage.set(key, report);
                return Promise.resolve();
            });

            // Mock snapshot creation
            jest.spyOn(snapshotService, 'createSnapshot').mockImplementation((report, userId) => {
                return Promise.resolve({
                    id: `snapshot-cache-${report.tenantId}`,
                    tenantId: report.tenantId,
                    reportId: report.id,
                    reportType: 'weekly',
                    dateRange: mockDateRange,
                    generatedAt: new Date(),
                    generatedBy: userId,
                    slideData: [],
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false
                });
            });

            // First round: Generate reports (cache misses)
            const firstRoundPromises = tenants.map(tenant =>
                reportGenerator.generateWeeklyReport(tenant.id, mockDateRange, tenant.user)
            );

            const firstRoundReports = await Promise.all(firstRoundPromises);

            // Verify all reports were generated and cached
            expect(firstRoundReports).toHaveLength(cacheTenants);
            expect(cacheStorage.size).toBe(cacheTenants);

            // Verify cache isolation
            tenants.forEach((tenant, index) => {
                const report = firstRoundReports[index];
                expect(report.tenantId).toBe(tenant.id);
                expect(cacheStorage.has(tenant.cacheKey)).toBe(true);
                expect(cacheStorage.get(tenant.cacheKey)).toBe(report);
            });

            // Second round: Generate same reports (cache hits)
            const secondRoundPromises = tenants.map(tenant =>
                reportGenerator.generateWeeklyReport(tenant.id, mockDateRange, tenant.user)
            );

            const secondRoundReports = await Promise.all(secondRoundPromises);

            // Verify cache hits returned correct tenant data
            secondRoundReports.forEach((report, index) => {
                const expectedTenant = tenants[index];
                expect(report.tenantId).toBe(expectedTenant.id);
                expect(report).toBe(firstRoundReports[index]); // Should be same instance from cache
            });

            // Verify database was only queried once per tenant (first round only)
            expect(dbQueryCount).toBe(cacheTenants);
        });

        it('should handle cache failures gracefully without affecting other tenants', async () => {
            const resilientTenants = 8;
            const tenants = Array.from({ length: resilientTenants }, (_, i) => ({
                id: `resilient-tenant-${i + 1}`,
                user: `resilient-user-${i + 1}`,
                shouldFailCache: i % 3 === 0 // Every 3rd tenant has cache failures
            }));

            // Mock database responses
            const mockDb = require('@/lib/database').db;
            let dbQueryCount = 0;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockImplementation(() => {
                                dbQueryCount++;
                                const tenantIndex = (dbQueryCount - 1) % resilientTenants;
                                const tenant = tenants[tenantIndex];

                                return Promise.resolve([{
                                    id: `alert-resilient-${dbQueryCount}`,
                                    tenant_id: tenant.id,
                                    raw_alert_type: `Resilient Alert for ${tenant.id}`,
                                    normalized_type: 'spyware',
                                    severity: 'medium',
                                    outcome: 'false_positive',
                                    created_at: new Date('2024-01-04T16:00:00Z'),
                                    resolved_at: new Date('2024-01-04T16:30:00Z'),
                                    device_id: `device-resilient-${dbQueryCount}`,
                                    source: 'avast'
                                }]);
                            })
                        })
                    })
                })
            });

            require('@/lib/database').withTransaction.mockImplementation((callback) =>
                callback(mockDb)
            );

            // Mock cache operations with selective failures
            jest.spyOn(cacheService, 'getCachedReport').mockImplementation((key) => {
                const tenantMatch = key.match(/weekly:(resilient-tenant-\d+):/);
                const tenantId = tenantMatch![1];
                const tenant = tenants.find(t => t.id === tenantId);

                if (tenant?.shouldFailCache) {
                    return Promise.reject(new Error(`Cache failure for ${tenantId}`));
                }
                return Promise.resolve(null); // Cache miss for successful tenants
            });

            jest.spyOn(cacheService, 'cacheReport').mockImplementation((key, report) => {
                const tenant = tenants.find(t => t.id === report.tenantId);

                if (tenant?.shouldFailCache) {
                    return Promise.reject(new Error(`Cache write failure for ${report.tenantId}`));
                }
                return Promise.resolve();
            });

            // Mock snapshot creation
            jest.spyOn(snapshotService, 'createSnapshot').mockImplementation((report, userId) => {
                return Promise.resolve({
                    id: `snapshot-resilient-${report.tenantId}`,
                    tenantId: report.tenantId,
                    reportId: report.id,
                    reportType: 'weekly',
                    dateRange: mockDateRange,
                    generatedAt: new Date(),
                    generatedBy: userId,
                    slideData: [],
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false
                });
            });

            // Generate reports concurrently with cache failures
            const reportPromises = tenants.map(tenant =>
                reportGenerator.generateWeeklyReport(tenant.id, mockDateRange, tenant.user)
            );

            const reports = await Promise.all(reportPromises);

            // Verify all reports completed successfully despite cache failures
            expect(reports).toHaveLength(resilientTenants);

            reports.forEach((report, index) => {
                const tenant = tenants[index];
                expect(report.tenantId).toBe(tenant.id);
                expect(report.slides).toBeDefined();

                // Verify tenant-specific content
                const alertsSlide = report.slides.find(s => s.content.slideType === 'alerts-digest');
                expect(alertsSlide?.content.summary).toContain(`Resilient Alert for ${tenant.id}`);
            });

            // Verify all database queries completed
            expect(dbQueryCount).toBe(resilientTenants);
        });
    });

    describe('Resource Contention and Performance', () => {
        it('should handle memory pressure during concurrent large report generation', async () => {
            const memoryTenants = 6; // Fewer tenants but larger reports
            const tenants = Array.from({ length: memoryTenants }, (_, i) => ({
                id: `memory-tenant-${i + 1}`,
                user: `memory-user-${i + 1}`
            }));

            // Mock large dataset for each tenant
            const mockDb = require('@/lib/database').db;
            let queryCount = 0;
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockImplementation(() => {
                                queryCount++;
                                const tenantIndex = (queryCount - 1) % memoryTenants;
                                const tenant = tenants[tenantIndex];

                                // Generate large dataset (1000 alerts per tenant)
                                const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
                                    id: `alert-memory-${queryCount}-${i}`,
                                    tenant_id: tenant.id,
                                    raw_alert_type: `Memory Test Alert ${i} for ${tenant.id}`,
                                    normalized_type: 'authentication',
                                    severity: 'low',
                                    outcome: 'benign_activity',
                                    created_at: new Date(`2024-01-0${(i % 7) + 1}T${(i % 24).toString().padStart(2, '0')}:00:00Z`),
                                    resolved_at: new Date(`2024-01-0${(i % 7) + 1}T${(i % 24).toString().padStart(2, '0')}:30:00Z`),
                                    device_id: `device-memory-${queryCount}-${i % 10}`,
                                    source: 'firewall_email'
                                }));

                                return Promise.resolve(largeDataset);
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

            // Mock snapshot creation with large slide data
            jest.spyOn(snapshotService, 'createSnapshot').mockImplementation((report, userId) => {
                return Promise.resolve({
                    id: `snapshot-memory-${report.tenantId}`,
                    tenantId: report.tenantId,
                    reportId: report.id,
                    reportType: 'weekly',
                    dateRange: mockDateRange,
                    generatedAt: new Date(),
                    generatedBy: userId,
                    slideData: report.slides.map(slide => ({
                        slideId: slide.id,
                        slideType: slide.content.slideType,
                        title: slide.title,
                        subtitle: `Large dataset for ${report.tenantId}`,
                        summary: slide.content.summary,
                        keyPoints: Array.from({ length: 100 }, (_, i) => `Data point ${i + 1}`),
                        charts: [],
                        computedMetrics: { dataSize: 'large', tenantId: report.tenantId },
                        chartData: [],
                        templateData: {
                            layout: {
                                type: slide.content.slideType as any,
                                orientation: 'landscape' as const,
                                theme: 'dark' as const,
                                branding: 'avian' as const
                            }
                        }
                    })),
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false
                });
            });

            // Monitor memory usage during generation
            const initialMemory = process.memoryUsage();
            const startTime = Date.now();

            // Generate large reports concurrently
            const reportPromises = tenants.map(tenant =>
                reportGenerator.generateWeeklyReport(tenant.id, mockDateRange, tenant.user)
            );

            const reports = await Promise.all(reportPromises);

            const endTime = Date.now();
            const finalMemory = process.memoryUsage();
            const processingTime = endTime - startTime;

            // Validate performance under memory pressure
            expect(reports).toHaveLength(memoryTenants);
            expect(processingTime).toBeLessThan(120000); // Should complete within 2 minutes

            // Verify all reports contain large datasets
            reports.forEach((report, index) => {
                const tenant = tenants[index];
                expect(report.tenantId).toBe(tenant.id);
                expect(report.slides).toBeDefined();

                const alertsSlide = report.slides.find(s => s.content.slideType === 'alerts-digest');
                expect(alertsSlide?.content.summary).toContain('1000'); // Should mention large dataset
            });

            // Memory usage should not grow excessively
            const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
            expect(memoryGrowth).toBeLessThan(500 * 1024 * 1024); // Less than 500MB growth

            console.log(`Memory test completed: ${processingTime}ms, ${Math.round(memoryGrowth / 1024 / 1024)}MB growth`);
        });
    });
});