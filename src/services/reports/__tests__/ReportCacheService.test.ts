/**
 * Report Cache Service Tests
 * 
 * Tests for report caching functionality including cache invalidation
 * and warming strategies.
 */

import { ReportCacheService, ReportCacheKeys } from '../ReportCacheService';
import { cache } from '@/lib/cache';
import { monitoring } from '@/lib/monitoring';
import {
    WeeklyReport,
    MonthlyReport,
    QuarterlyReport,
    EnhancedDateRange,
    ReportSnapshot
} from '@/types/reports';

// Mock dependencies
jest.mock('@/lib/cache');
jest.mock('@/lib/monitoring');
jest.mock('@/lib/logger');

const mockCache = cache as jest.Mocked<typeof cache>;
const mockMonitoring = monitoring as jest.Mocked<typeof monitoring>;

describe('ReportCacheService', () => {
    let cacheService: ReportCacheService;
    let mockDateRange: EnhancedDateRange;
    let mockWeeklyReport: WeeklyReport;
    let mockSnapshot: ReportSnapshot;

    beforeEach(() => {
        cacheService = new ReportCacheService();

        mockDateRange = {
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-07'),
            timezone: 'UTC',
            weekStart: 'monday'
        };

        mockWeeklyReport = {
            id: 'weekly-test-123',
            tenantId: 'tenant-123',
            reportType: 'weekly',
            dateRange: mockDateRange,
            generatedAt: new Date(),
            generatedBy: 'user-123',
            slides: [],
            templateVersion: '1.0.0',
            dataSchemaVersion: '1.0.0',
            executiveOverview: {} as any,
            alertsDigest: {} as any,
            updatesSummary: {} as any,
            vulnerabilityPosture: {} as any
        };

        mockSnapshot = {
            id: 'snapshot-123',
            tenantId: 'tenant-123',
            reportId: 'report-123',
            reportType: 'weekly',
            dateRange: mockDateRange,
            generatedAt: new Date(),
            generatedBy: 'user-123',
            slideData: [],
            templateVersion: '1.0.0',
            dataSchemaVersion: '1.0.0',
            isArchived: false
        };

        // Reset mocks
        jest.clearAllMocks();

        // Setup default mock implementations
        mockMonitoring.startSpan.mockReturnValue({ spanId: 'test-span' });
        mockMonitoring.finishSpan.mockImplementation(() => { });
        mockMonitoring.tagSpan.mockImplementation(() => { });
        mockMonitoring.recordMetric.mockImplementation(() => { });
    });

    describe('ReportCacheKeys', () => {
        it('should generate correct cache keys', () => {
            const reportKey = ReportCacheKeys.reportKey('tenant-123', 'weekly', mockDateRange);
            expect(reportKey).toBe('report:tenant-123:weekly:2024-01-01:2024-01-07:UTC');

            const dataKey = ReportCacheKeys.dataKey('tenant-123', 'alerts_digest', mockDateRange);
            expect(dataKey).toBe('report_data:tenant-123:alerts_digest:2024-01-01:2024-01-07:UTC');

            const snapshotKey = ReportCacheKeys.snapshotKey('snapshot-123');
            expect(snapshotKey).toBe('report_snapshot:snapshot-123');

            const metadataKey = ReportCacheKeys.metadataKey('tenant-123', 'weekly');
            expect(metadataKey).toBe('report_metadata:tenant-123:weekly');
        });
    });

    describe('cacheReport', () => {
        it('should cache a report with correct configuration', async () => {
            mockCache.set.mockResolvedValue();

            await cacheService.cacheReport('tenant-123', 'weekly', mockDateRange, mockWeeklyReport);

            expect(mockCache.set).toHaveBeenCalledTimes(2); // Report + metadata

            // Check report caching
            const reportCall = mockCache.set.mock.calls[0];
            expect(reportCall[0]).toBe('report:tenant-123:weekly:2024-01-01:2024-01-07:UTC');
            expect(reportCall[1]).toBe(mockWeeklyReport);
            expect(reportCall[2]).toMatchObject({
                ttl: 3600, // Weekly report TTL
                tags: expect.arrayContaining(['reports', 'weekly', 'tenant:tenant-123'])
            });

            // Check metadata caching
            const metadataCall = mockCache.set.mock.calls[1];
            expect(metadataCall[0]).toBe('report_metadata:tenant-123:weekly');
            expect(metadataCall[2]).toMatchObject({
                ttl: 7200, // Metadata TTL (2x report TTL)
                tags: expect.arrayContaining(['reports', 'weekly', 'tenant:tenant-123', 'metadata'])
            });
        });

        it('should handle caching errors gracefully', async () => {
            const error = new Error('Cache error');
            mockCache.set.mockRejectedValue(error);

            await expect(cacheService.cacheReport('tenant-123', 'weekly', mockDateRange, mockWeeklyReport))
                .rejects.toThrow('Cache error');

            expect(mockMonitoring.tagSpan).toHaveBeenCalledWith('test-span', { error: 'Cache error' });
        });
    });

    describe('getCachedReport', () => {
        it('should retrieve cached report and record cache hit', async () => {
            mockCache.get.mockResolvedValue(mockWeeklyReport);

            const result = await cacheService.getCachedReport<WeeklyReport>('tenant-123', 'weekly', mockDateRange);

            expect(result).toBe(mockWeeklyReport);
            expect(mockCache.get).toHaveBeenCalledWith('report:tenant-123:weekly:2024-01-01:2024-01-07:UTC');
            expect(mockMonitoring.recordMetric).toHaveBeenCalledWith('report_cache_hit', 1, { tenantId: 'tenant-123', reportType: 'weekly' });
        });

        it('should handle cache miss and record metric', async () => {
            mockCache.get.mockResolvedValue(null);

            const result = await cacheService.getCachedReport<WeeklyReport>('tenant-123', 'weekly', mockDateRange);

            expect(result).toBeNull();
            expect(mockMonitoring.recordMetric).toHaveBeenCalledWith('report_cache_miss', 1, { tenantId: 'tenant-123', reportType: 'weekly' });
        });

        it('should handle retrieval errors gracefully', async () => {
            const error = new Error('Retrieval error');
            mockCache.get.mockRejectedValue(error);

            const result = await cacheService.getCachedReport<WeeklyReport>('tenant-123', 'weekly', mockDateRange);

            expect(result).toBeNull();
            expect(mockMonitoring.tagSpan).toHaveBeenCalledWith('test-span', { error: 'Retrieval error' });
        });
    });

    describe('cacheAggregatedData', () => {
        it('should cache aggregated data with correct configuration', async () => {
            const mockAlertsDigest = {
                totalAlertsDigested: 100,
                alertClassification: {},
                alertOutcomes: {},
                weeklyTimeline: [],
                sourceBreakdown: {}
            };

            mockCache.set.mockResolvedValue();

            await cacheService.cacheAggregatedData('tenant-123', 'alerts_digest', mockDateRange, mockAlertsDigest);

            expect(mockCache.set).toHaveBeenCalledWith(
                'report_data:tenant-123:alerts_digest:2024-01-01:2024-01-07:UTC',
                mockAlertsDigest,
                expect.objectContaining({
                    ttl: 1800, // alerts_digest TTL
                    tags: expect.arrayContaining(['data', 'alerts', 'tenant:tenant-123'])
                })
            );
        });
    });

    describe('getCachedAggregatedData', () => {
        it('should retrieve cached aggregated data', async () => {
            const mockData = { test: 'data' };
            mockCache.get.mockResolvedValue(mockData);

            const result = await cacheService.getCachedAggregatedData('tenant-123', 'alerts_digest', mockDateRange);

            expect(result).toBe(mockData);
            expect(mockMonitoring.recordMetric).toHaveBeenCalledWith('aggregated_data_cache_hit', 1, { tenantId: 'tenant-123', dataType: 'alerts_digest' });
        });
    });

    describe('cacheSnapshot', () => {
        it('should cache snapshot with long TTL for audit purposes', async () => {
            mockCache.set.mockResolvedValue();

            await cacheService.cacheSnapshot(mockSnapshot);

            expect(mockCache.set).toHaveBeenCalledWith(
                'report_snapshot:snapshot-123',
                mockSnapshot,
                expect.objectContaining({
                    ttl: 86400 * 30, // 30 days
                    tags: expect.arrayContaining(['snapshots', 'tenant:tenant-123', 'audit_trail'])
                })
            );
        });
    });

    describe('getCachedSnapshot', () => {
        it('should retrieve cached snapshot', async () => {
            mockCache.get.mockResolvedValue(mockSnapshot);

            const result = await cacheService.getCachedSnapshot('snapshot-123');

            expect(result).toBe(mockSnapshot);
            expect(mockCache.get).toHaveBeenCalledWith('report_snapshot:snapshot-123');
        });
    });

    describe('invalidateCache', () => {
        it('should invalidate cache by tenant', async () => {
            mockCache.invalidateByTags.mockResolvedValue();

            await cacheService.invalidateCache({ tenantId: 'tenant-123' });

            expect(mockCache.invalidateByTags).toHaveBeenCalledWith(['tenant:tenant-123']);
        });

        it('should invalidate cache by data type', async () => {
            mockCache.invalidateByTags.mockResolvedValue();

            await cacheService.invalidateCache({ dataType: 'alerts_digest' });

            expect(mockCache.invalidateByTags).toHaveBeenCalledWith(['data_type:alerts_digest']);
        });

        it('should invalidate cache by trigger', async () => {
            mockCache.invalidateByTags.mockResolvedValue();

            await cacheService.invalidateCache({ trigger: 'new_alerts' });

            expect(mockCache.invalidateByTags).toHaveBeenCalledWith(
                expect.arrayContaining(['data_type:alerts_digest', 'data', 'alerts'])
            );
        });

        it('should combine multiple invalidation criteria', async () => {
            mockCache.invalidateByTags.mockResolvedValue();

            await cacheService.invalidateCache({
                tenantId: 'tenant-123',
                dataType: 'alerts_digest',
                tags: ['custom_tag']
            });

            expect(mockCache.invalidateByTags).toHaveBeenCalledWith([
                'tenant:tenant-123',
                'data_type:alerts_digest',
                'custom_tag'
            ]);
        });
    });

    describe('warmUpCache', () => {
        it('should warm up cache for enabled report types', async () => {
            mockCache.get.mockResolvedValue(null); // No existing cache
            mockCache.set.mockResolvedValue();

            await cacheService.warmUpCache('tenant-123', ['weekly', 'monthly']);

            // Should attempt to warm up multiple periods for each report type
            expect(mockCache.get).toHaveBeenCalled();
            expect(mockCache.set).toHaveBeenCalled();
        });

        it('should skip warm-up for disabled report types', async () => {
            await cacheService.warmUpCache('tenant-123', ['quarterly']); // quarterly has warmUpEnabled: false

            // Should not attempt any cache operations for quarterly
            expect(mockCache.get).not.toHaveBeenCalled();
            expect(mockCache.set).not.toHaveBeenCalled();
        });

        it('should handle warm-up errors gracefully', async () => {
            const error = new Error('Warm-up error');
            mockCache.get.mockRejectedValue(error);

            // Should not throw, but handle errors gracefully
            await expect(cacheService.warmUpCache('tenant-123', ['weekly'])).resolves.not.toThrow();
        });
    });

    describe('getCacheStats', () => {
        it('should return cache statistics', async () => {
            const mockStats = {
                hits: 100,
                misses: 20,
                sets: 50,
                deletes: 5,
                hitRate: 0.83
            };

            mockCache.getStats.mockReturnValue(mockStats);

            const result = await cacheService.getCacheStats();

            expect(result).toMatchObject({
                overall: mockStats,
                reportTypes: expect.any(Object),
                tenantStats: expect.any(Object)
            });
        });

        it('should handle stats errors gracefully', async () => {
            const error = new Error('Stats error');
            mockCache.getStats.mockImplementation(() => { throw error; });

            const result = await cacheService.getCacheStats();

            expect(result).toMatchObject({
                overall: {},
                reportTypes: {},
                tenantStats: {}
            });
        });
    });

    describe('clearTenantCache', () => {
        it('should clear all cache for a tenant', async () => {
            mockCache.invalidateByTags.mockResolvedValue();

            await cacheService.clearTenantCache('tenant-123');

            expect(mockCache.invalidateByTags).toHaveBeenCalledWith(['tenant:tenant-123']);
        });

        it('should handle clear errors', async () => {
            const error = new Error('Clear error');
            mockCache.invalidateByTags.mockRejectedValue(error);

            await expect(cacheService.clearTenantCache('tenant-123')).rejects.toThrow('Clear error');
        });
    });

    describe('cache configuration', () => {
        it('should use different TTL values for different report types', async () => {
            mockCache.set.mockResolvedValue();

            // Test weekly report (1 hour TTL)
            await cacheService.cacheReport('tenant-123', 'weekly', mockDateRange, mockWeeklyReport);
            expect(mockCache.set.mock.calls[0][2]).toMatchObject({ ttl: 3600 });

            // Test monthly report (2 hours TTL)
            const monthlyReport = { ...mockWeeklyReport, reportType: 'monthly' } as MonthlyReport;
            await cacheService.cacheReport('tenant-123', 'monthly', mockDateRange, monthlyReport);
            expect(mockCache.set.mock.calls[2][2]).toMatchObject({ ttl: 7200 });

            // Test quarterly report (4 hours TTL)
            const quarterlyReport = { ...mockWeeklyReport, reportType: 'quarterly' } as QuarterlyReport;
            await cacheService.cacheReport('tenant-123', 'quarterly', mockDateRange, quarterlyReport);
            expect(mockCache.set.mock.calls[4][2]).toMatchObject({ ttl: 14400 });
        });

        it('should use appropriate tags for different data types', async () => {
            mockCache.set.mockResolvedValue();

            await cacheService.cacheAggregatedData('tenant-123', 'alerts_digest', mockDateRange, {});
            expect(mockCache.set.mock.calls[0][2]).toMatchObject({
                tags: expect.arrayContaining(['data', 'alerts'])
            });

            await cacheService.cacheAggregatedData('tenant-123', 'vulnerability_posture', mockDateRange, {});
            expect(mockCache.set.mock.calls[1][2]).toMatchObject({
                tags: expect.arrayContaining(['data', 'vulnerabilities'])
            });
        });
    });
});