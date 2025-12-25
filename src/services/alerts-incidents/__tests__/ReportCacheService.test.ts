/**
 * Unit Tests for Report Cache Service
 * 
 * Tests caching functionality including:
 * - Cache key generation
 * - Cache hit/miss behavior
 * - Performance optimization logic
 * - Cache invalidation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ReportCacheService } from '../ReportCacheService';

// Mock logger
jest.mock('../../../lib/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    }
}));

describe('ReportCacheService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Cache Key Generation', () => {
        it('should generate consistent cache keys for same parameters', () => {
            const params = {
                reportType: 'weekly' as const,
                tenantId: 'tenant-123',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                options: { includeResolved: true, includeDismissed: false },
            };

            const key1 = ReportCacheService.generateCacheKey(params);
            const key2 = ReportCacheService.generateCacheKey(params);

            expect(key1).toBe(key2);
            expect(key1).toContain('alerts-incidents:reports:weekly');
            expect(key1).toContain('tenant-123');
            expect(key1).toContain('2024-01-01');
            expect(key1).toContain('2024-01-07');
        });

        it('should generate different cache keys for different parameters', () => {
            const params1 = {
                reportType: 'weekly' as const,
                tenantId: 'tenant-123',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
            };

            const params2 = {
                reportType: 'monthly' as const,
                tenantId: 'tenant-123',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
            };

            const key1 = ReportCacheService.generateCacheKey(params1);
            const key2 = ReportCacheService.generateCacheKey(params2);

            expect(key1).not.toBe(key2);
        });

        it('should generate different keys for different options', () => {
            const baseParams = {
                reportType: 'weekly' as const,
                tenantId: 'tenant-123',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
            };

            const params1 = { ...baseParams, options: { includeResolved: true } };
            const params2 = { ...baseParams, options: { includeResolved: false } };

            const key1 = ReportCacheService.generateCacheKey(params1);
            const key2 = ReportCacheService.generateCacheKey(params2);

            expect(key1).not.toBe(key2);
        });
    });

    describe('Cache Operations', () => {
        it('should return null for cache miss', async () => {
            const params = {
                reportType: 'weekly' as const,
                tenantId: 'tenant-123',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
            };

            const result = await ReportCacheService.getCachedReport(params);
            expect(result).toBeNull();
        });

        it('should handle cache set operation without errors', async () => {
            const params = {
                reportType: 'weekly' as const,
                tenantId: 'tenant-123',
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
            };

            const mockReport = {
                id: 'report-123',
                tenantId: 'tenant-123',
                reportType: 'weekly',
                data: { alerts: 100, incidents: 10 },
            };

            await expect(
                ReportCacheService.setCachedReport(params, mockReport)
            ).resolves.not.toThrow();
        });

        it('should handle cache invalidation without errors', async () => {
            await expect(
                ReportCacheService.invalidateTenantReports('tenant-123')
            ).resolves.not.toThrow();

            await expect(
                ReportCacheService.invalidateTenantReports('tenant-123', 'weekly')
            ).resolves.not.toThrow();
        });

        it('should handle global cache invalidation without errors', async () => {
            await expect(
                ReportCacheService.invalidateAllReports()
            ).resolves.not.toThrow();
        });
    });

    describe('Performance Optimization', () => {
        it('should recommend caching for large reports', () => {
            const largeReportSize = 200 * 1024; // 200KB
            const normalGenerationTime = 1000; // 1 second

            const shouldCache = ReportCacheService.shouldCacheReport(
                largeReportSize,
                normalGenerationTime
            );

            expect(shouldCache).toBe(true);
        });

        it('should recommend caching for slow-generating reports', () => {
            const normalReportSize = 50 * 1024; // 50KB
            const slowGenerationTime = 10000; // 10 seconds

            const shouldCache = ReportCacheService.shouldCacheReport(
                normalReportSize,
                slowGenerationTime
            );

            expect(shouldCache).toBe(true);
        });

        it('should not recommend caching for small, fast reports', () => {
            const smallReportSize = 10 * 1024; // 10KB
            const fastGenerationTime = 500; // 0.5 seconds

            const shouldCache = ReportCacheService.shouldCacheReport(
                smallReportSize,
                fastGenerationTime
            );

            expect(shouldCache).toBe(false);
        });

        it('should calculate optimal TTL based on data freshness', () => {
            const baseTTL = ReportCacheService.getOptimalTTL('weekly', 24); // 24 hours old data (baseline)
            const freshTTL = ReportCacheService.getOptimalTTL('weekly', 12); // 12 hours old data (fresher)
            const staleTTL = ReportCacheService.getOptimalTTL('weekly', 48); // 48 hours old data (staler)

            expect(freshTTL).toBeLessThan(baseTTL);
            expect(staleTTL).toBeGreaterThan(baseTTL);
        });
    });

    describe('Cache Statistics', () => {
        it('should return cache statistics', async () => {
            const stats = await ReportCacheService.getCacheStatistics('tenant-123');

            expect(stats).toHaveProperty('hitRate');
            expect(stats).toHaveProperty('totalRequests');
            expect(stats).toHaveProperty('cacheSize');
            expect(stats).toHaveProperty('reportTypes');

            expect(typeof stats.hitRate).toBe('number');
            expect(typeof stats.totalRequests).toBe('number');
            expect(typeof stats.cacheSize).toBe('number');
            expect(typeof stats.reportTypes).toBe('object');
        });

        it('should handle cache warm-up without errors', async () => {
            await expect(
                ReportCacheService.warmUpCache('tenant-123')
            ).resolves.not.toThrow();
        });
    });

    describe('Metadata Cache Keys', () => {
        it('should generate metadata cache keys', () => {
            const key = ReportCacheService.generateMetadataCacheKey('tenant-123', 'weekly');

            expect(key).toContain('alerts-incidents:reports:metadata');
            expect(key).toContain('weekly');
            expect(key).toContain('tenant-123');
        });
    });
});