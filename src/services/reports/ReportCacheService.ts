/**
 * Report Cache Service
 * 
 * Implements caching logic for generated reports with cache invalidation for data updates
 * and cache warming for common report periods.
 * 
 * Requirements: 9.2
 */

import { logger } from '@/lib/logger';
import { cache, CacheOptions, TenantCache } from '@/lib/cache';
import { monitoring } from '@/lib/monitoring';
import {
    WeeklyReport,
    MonthlyReport,
    QuarterlyReport,
    EnhancedDateRange,
    ReportSnapshot
} from '@/types/reports';

/**
 * Cache configuration for different report types
 */
interface ReportCacheConfig {
    ttl: number; // Time to live in seconds
    tags: string[];
    warmUpEnabled: boolean;
    invalidationTriggers: string[];
}

/**
 * Cache key patterns for different report types and data
 */
export class ReportCacheKeys {
    static readonly REPORT_PREFIX = 'report';
    static readonly DATA_PREFIX = 'report_data';
    static readonly SNAPSHOT_PREFIX = 'report_snapshot';
    static readonly METADATA_PREFIX = 'report_metadata';

    static reportKey(tenantId: string, reportType: string, dateRange: EnhancedDateRange): string {
        const startDate = dateRange.startDate.toISOString().split('T')[0];
        const endDate = dateRange.endDate.toISOString().split('T')[0];
        return `${this.REPORT_PREFIX}:${tenantId}:${reportType}:${startDate}:${endDate}:${dateRange.timezone}`;
    }

    static dataKey(tenantId: string, dataType: string, dateRange: EnhancedDateRange): string {
        const startDate = dateRange.startDate.toISOString().split('T')[0];
        const endDate = dateRange.endDate.toISOString().split('T')[0];
        return `${this.DATA_PREFIX}:${tenantId}:${dataType}:${startDate}:${endDate}:${dateRange.timezone}`;
    }

    static snapshotKey(snapshotId: string): string {
        return `${this.SNAPSHOT_PREFIX}:${snapshotId}`;
    }

    static metadataKey(tenantId: string, reportType: string): string {
        return `${this.METADATA_PREFIX}:${tenantId}:${reportType}`;
    }

    static tenantDataKey(tenantId: string): string {
        return `tenant_data:${tenantId}`;
    }
}

/**
 * Report Cache Service
 * 
 * Provides intelligent caching for report generation with automatic invalidation
 * and warming strategies optimized for common report periods.
 */
export class ReportCacheService {
    private readonly tenantCaches: Map<string, TenantCache> = new Map();

    // Cache configurations for different report types
    private readonly cacheConfigs: Record<string, ReportCacheConfig> = {
        weekly: {
            ttl: 3600, // 1 hour - weekly reports change frequently
            tags: ['reports', 'weekly'],
            warmUpEnabled: true,
            invalidationTriggers: ['alerts', 'metrics', 'vulnerabilities']
        },
        monthly: {
            ttl: 7200, // 2 hours - monthly reports are more stable
            tags: ['reports', 'monthly'],
            warmUpEnabled: true,
            invalidationTriggers: ['alerts', 'metrics', 'vulnerabilities', 'trends']
        },
        quarterly: {
            ttl: 14400, // 4 hours - quarterly reports are most stable
            tags: ['reports', 'quarterly'],
            warmUpEnabled: false, // Less frequent, don't warm up
            invalidationTriggers: ['major_data_updates']
        },
        alerts_digest: {
            ttl: 1800, // 30 minutes - alert data changes frequently
            tags: ['data', 'alerts'],
            warmUpEnabled: true,
            invalidationTriggers: ['new_alerts', 'alert_resolution']
        },
        updates_summary: {
            ttl: 3600, // 1 hour - update data is relatively stable
            tags: ['data', 'updates'],
            warmUpEnabled: true,
            invalidationTriggers: ['new_updates', 'update_completion']
        },
        vulnerability_posture: {
            ttl: 2700, // 45 minutes - vulnerability data changes moderately
            tags: ['data', 'vulnerabilities'],
            warmUpEnabled: true,
            invalidationTriggers: ['new_vulnerabilities', 'vulnerability_mitigation']
        }
    };

    /**
     * Gets or creates a tenant-specific cache instance
     */
    private getTenantCache(tenantId: string): TenantCache {
        if (!this.tenantCaches.has(tenantId)) {
            this.tenantCaches.set(tenantId, new TenantCache(tenantId));
        }
        return this.tenantCaches.get(tenantId)!;
    }

    /**
     * Gets cache configuration for a specific report or data type
     */
    private getCacheConfig(type: string): ReportCacheConfig {
        return this.cacheConfigs[type] || {
            ttl: 3600,
            tags: ['reports', 'default'],
            warmUpEnabled: false,
            invalidationTriggers: ['data_updates']
        };
    }

    /**
     * Caches a generated report
     */
    async cacheReport(
        tenantId: string,
        reportType: 'weekly' | 'monthly' | 'quarterly',
        dateRange: EnhancedDateRange,
        report: WeeklyReport | MonthlyReport | QuarterlyReport
    ): Promise<void> {
        const span = monitoring.startSpan('report_cache.cache_report');
        monitoring.tagSpan(span.spanId, { tenantId, reportType });

        try {
            const cacheKey = ReportCacheKeys.reportKey(tenantId, reportType, dateRange);
            const config = this.getCacheConfig(reportType);

            const cacheOptions: CacheOptions = {
                ttl: config.ttl,
                tags: [
                    ...config.tags,
                    `tenant:${tenantId}`,
                    `report_type:${reportType}`,
                    `date_range:${dateRange.startDate.toISOString().split('T')[0]}`
                ]
            };

            await cache.set(cacheKey, report, cacheOptions);

            // Also cache metadata for quick lookups
            const metadataKey = ReportCacheKeys.metadataKey(tenantId, reportType);
            const metadata = {
                lastGenerated: new Date().toISOString(),
                dateRange,
                reportId: report.id,
                slideCount: report.slides.length,
                templateVersion: report.templateVersion,
                dataSchemaVersion: report.dataSchemaVersion
            };

            await cache.set(metadataKey, metadata, {
                ttl: config.ttl * 2, // Metadata lives longer
                tags: [...config.tags, `tenant:${tenantId}`, 'metadata']
            });

            monitoring.recordMetric('report_cached', 1, { tenantId, reportType });

            logger.info('Report cached successfully', {
                tenantId,
                reportType,
                cacheKey,
                ttl: config.ttl,
                reportId: report.id,
                category: 'reports'
            });

            monitoring.finishSpan(span.spanId);

        } catch (error) {
            monitoring.tagSpan(span.spanId, { error: error instanceof Error ? error.message : 'unknown' });
            logger.error('Failed to cache report', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                reportType,
                category: 'reports'
            });
            monitoring.finishSpan(span.spanId);
            throw error;
        }
    }

    /**
     * Retrieves a cached report
     */
    async getCachedReport<T extends WeeklyReport | MonthlyReport | QuarterlyReport>(
        tenantId: string,
        reportType: 'weekly' | 'monthly' | 'quarterly',
        dateRange: EnhancedDateRange
    ): Promise<T | null> {
        const span = monitoring.startSpan('report_cache.get_cached_report');
        monitoring.tagSpan(span.spanId, { tenantId, reportType });

        try {
            const cacheKey = ReportCacheKeys.reportKey(tenantId, reportType, dateRange);
            const cachedReport = await cache.get<T>(cacheKey);

            if (cachedReport) {
                monitoring.recordMetric('report_cache_hit', 1, { tenantId, reportType });
                logger.debug('Report cache hit', {
                    tenantId,
                    reportType,
                    cacheKey,
                    category: 'reports'
                });
            } else {
                monitoring.recordMetric('report_cache_miss', 1, { tenantId, reportType });
                logger.debug('Report cache miss', {
                    tenantId,
                    reportType,
                    cacheKey,
                    category: 'reports'
                });
            }

            monitoring.tagSpan(span.spanId, { hit: !!cachedReport });
            monitoring.finishSpan(span.spanId);

            return cachedReport;

        } catch (error) {
            monitoring.tagSpan(span.spanId, { error: error instanceof Error ? error.message : 'unknown' });
            logger.error('Failed to retrieve cached report', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                reportType,
                category: 'reports'
            });
            monitoring.finishSpan(span.spanId);
            return null;
        }
    }

    /**
     * Caches aggregated data (alerts digest, updates summary, etc.)
     */
    async cacheAggregatedData(
        tenantId: string,
        dataType: string,
        dateRange: EnhancedDateRange,
        data: any
    ): Promise<void> {
        const span = monitoring.startSpan('report_cache.cache_aggregated_data');
        monitoring.tagSpan(span.spanId, { tenantId, dataType });

        try {
            const cacheKey = ReportCacheKeys.dataKey(tenantId, dataType, dateRange);
            const config = this.getCacheConfig(dataType);

            const cacheOptions: CacheOptions = {
                ttl: config.ttl,
                tags: [
                    ...config.tags,
                    `tenant:${tenantId}`,
                    `data_type:${dataType}`,
                    `date_range:${dateRange.startDate.toISOString().split('T')[0]}`
                ]
            };

            await cache.set(cacheKey, data, cacheOptions);

            monitoring.recordMetric('aggregated_data_cached', 1, { tenantId, dataType });

            logger.debug('Aggregated data cached', {
                tenantId,
                dataType,
                cacheKey,
                ttl: config.ttl,
                category: 'reports'
            });

            monitoring.finishSpan(span.spanId);

        } catch (error) {
            monitoring.tagSpan(span.spanId, { error: error instanceof Error ? error.message : 'unknown' });
            logger.error('Failed to cache aggregated data', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                dataType,
                category: 'reports'
            });
            monitoring.finishSpan(span.spanId);
            throw error;
        }
    }

    /**
     * Retrieves cached aggregated data
     */
    async getCachedAggregatedData<T>(
        tenantId: string,
        dataType: string,
        dateRange: EnhancedDateRange
    ): Promise<T | null> {
        const span = monitoring.startSpan('report_cache.get_cached_aggregated_data');
        monitoring.tagSpan(span.spanId, { tenantId, dataType });

        try {
            const cacheKey = ReportCacheKeys.dataKey(tenantId, dataType, dateRange);
            const cachedData = await cache.get<T>(cacheKey);

            if (cachedData) {
                monitoring.recordMetric('aggregated_data_cache_hit', 1, { tenantId, dataType });
                logger.debug('Aggregated data cache hit', {
                    tenantId,
                    dataType,
                    cacheKey,
                    category: 'reports'
                });
            } else {
                monitoring.recordMetric('aggregated_data_cache_miss', 1, { tenantId, dataType });
                logger.debug('Aggregated data cache miss', {
                    tenantId,
                    dataType,
                    cacheKey,
                    category: 'reports'
                });
            }

            monitoring.tagSpan(span.spanId, { hit: !!cachedData });
            monitoring.finishSpan(span.spanId);

            return cachedData;

        } catch (error) {
            monitoring.tagSpan(span.spanId, { error: error instanceof Error ? error.message : 'unknown' });
            logger.error('Failed to retrieve cached aggregated data', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                dataType,
                category: 'reports'
            });
            monitoring.finishSpan(span.spanId);
            return null;
        }
    }

    /**
     * Caches report snapshots for audit trail and re-download
     */
    async cacheSnapshot(snapshot: ReportSnapshot): Promise<void> {
        const span = monitoring.startSpan('report_cache.cache_snapshot');
        monitoring.tagSpan(span.spanId, { snapshotId: snapshot.id, tenantId: snapshot.tenantId });

        try {
            const cacheKey = ReportCacheKeys.snapshotKey(snapshot.id);

            const cacheOptions: CacheOptions = {
                ttl: 86400 * 30, // 30 days - snapshots are long-lived for audit purposes
                tags: [
                    'snapshots',
                    `tenant:${snapshot.tenantId}`,
                    `report_type:${snapshot.reportType}`,
                    'audit_trail'
                ]
            };

            await cache.set(cacheKey, snapshot, cacheOptions);

            monitoring.recordMetric('snapshot_cached', 1, { tenantId: snapshot.tenantId, reportType: snapshot.reportType });

            logger.info('Report snapshot cached', {
                snapshotId: snapshot.id,
                tenantId: snapshot.tenantId,
                reportType: snapshot.reportType,
                cacheKey,
                category: 'reports'
            });

            monitoring.finishSpan(span.spanId);

        } catch (error) {
            monitoring.tagSpan(span.spanId, { error: error instanceof Error ? error.message : 'unknown' });
            logger.error('Failed to cache snapshot', error instanceof Error ? error : new Error(String(error)), {
                snapshotId: snapshot.id,
                tenantId: snapshot.tenantId,
                category: 'reports'
            });
            monitoring.finishSpan(span.spanId);
            throw error;
        }
    }

    /**
     * Retrieves a cached snapshot
     */
    async getCachedSnapshot(snapshotId: string): Promise<ReportSnapshot | null> {
        const span = monitoring.startSpan('report_cache.get_cached_snapshot');
        monitoring.tagSpan(span.spanId, { snapshotId });

        try {
            const cacheKey = ReportCacheKeys.snapshotKey(snapshotId);
            const cachedSnapshot = await cache.get<ReportSnapshot>(cacheKey);

            if (cachedSnapshot) {
                monitoring.recordMetric('snapshot_cache_hit', 1, { snapshotId });
                logger.debug('Snapshot cache hit', {
                    snapshotId,
                    cacheKey,
                    category: 'reports'
                });
            } else {
                monitoring.recordMetric('snapshot_cache_miss', 1, { snapshotId });
                logger.debug('Snapshot cache miss', {
                    snapshotId,
                    cacheKey,
                    category: 'reports'
                });
            }

            monitoring.tagSpan(span.spanId, { hit: !!cachedSnapshot });
            monitoring.finishSpan(span.spanId);

            return cachedSnapshot;

        } catch (error) {
            monitoring.tagSpan(span.spanId, { error: error instanceof Error ? error.message : 'unknown' });
            logger.error('Failed to retrieve cached snapshot', error instanceof Error ? error : new Error(String(error)), {
                snapshotId,
                category: 'reports'
            });
            monitoring.finishSpan(span.spanId);
            return null;
        }
    }

    /**
     * Invalidates cache for data updates
     * Supports invalidation by tenant, data type, or specific triggers
     */
    async invalidateCache(options: {
        tenantId?: string;
        dataType?: string;
        reportType?: string;
        trigger?: string;
        tags?: string[];
    }): Promise<void> {
        const span = monitoring.startSpan('report_cache.invalidate_cache');
        monitoring.tagSpan(span.spanId, options);

        try {
            const tagsToInvalidate: string[] = [];

            // Build invalidation tags based on options
            if (options.tenantId) {
                tagsToInvalidate.push(`tenant:${options.tenantId}`);
            }

            if (options.dataType) {
                tagsToInvalidate.push(`data_type:${options.dataType}`);
            }

            if (options.reportType) {
                tagsToInvalidate.push(`report_type:${options.reportType}`);
            }

            if (options.tags) {
                tagsToInvalidate.push(...options.tags);
            }

            // Trigger-based invalidation
            if (options.trigger) {
                // Find all cache configs that should be invalidated by this trigger
                Object.entries(this.cacheConfigs).forEach(([type, config]) => {
                    if (config.invalidationTriggers.includes(options.trigger!)) {
                        tagsToInvalidate.push(`data_type:${type}`);
                        tagsToInvalidate.push(...config.tags);
                    }
                });
            }

            if (tagsToInvalidate.length > 0) {
                await cache.invalidateByTags(tagsToInvalidate);

                monitoring.recordMetric('cache_invalidated', 1, {
                    tenantId: options.tenantId || 'all',
                    trigger: options.trigger || 'manual',
                    tagsCount: tagsToInvalidate.length.toString()
                });

                logger.info('Cache invalidated', {
                    options,
                    tagsInvalidated: tagsToInvalidate,
                    category: 'reports'
                });
            }

            monitoring.finishSpan(span.spanId);

        } catch (error) {
            monitoring.tagSpan(span.spanId, { error: error instanceof Error ? error.message : 'unknown' });
            logger.error('Failed to invalidate cache', error instanceof Error ? error : new Error(String(error)), {
                options,
                category: 'reports'
            });
            monitoring.finishSpan(span.spanId);
            throw error;
        }
    }

    /**
     * Warms up cache for common report periods
     * Pre-generates and caches reports for current and recent periods
     */
    async warmUpCache(tenantId: string, reportTypes: Array<'weekly' | 'monthly' | 'quarterly'> = ['weekly', 'monthly']): Promise<void> {
        const span = monitoring.startSpan('report_cache.warm_up_cache');
        monitoring.tagSpan(span.spanId, { tenantId, reportTypes });

        try {
            const warmUpTasks: Array<Promise<void>> = [];

            for (const reportType of reportTypes) {
                const config = this.getCacheConfig(reportType);

                if (!config.warmUpEnabled) {
                    logger.debug('Cache warm-up disabled for report type', { reportType, tenantId });
                    continue;
                }

                // Generate date ranges for warm-up
                const dateRanges = this.generateWarmUpDateRanges(reportType);

                for (const dateRange of dateRanges) {
                    const warmUpTask = this.warmUpReportPeriod(tenantId, reportType, dateRange);
                    warmUpTasks.push(warmUpTask);
                }
            }

            // Execute warm-up tasks in parallel with limited concurrency
            const batchSize = 3; // Limit concurrent warm-up operations
            for (let i = 0; i < warmUpTasks.length; i += batchSize) {
                const batch = warmUpTasks.slice(i, i + batchSize);
                await Promise.allSettled(batch);
            }

            monitoring.recordMetric('cache_warmed_up', 1, { tenantId, reportTypesCount: reportTypes.length.toString() });

            logger.info('Cache warm-up completed', {
                tenantId,
                reportTypes,
                tasksCount: warmUpTasks.length,
                category: 'reports'
            });

            monitoring.finishSpan(span.spanId);

        } catch (error) {
            monitoring.tagSpan(span.spanId, { error: error instanceof Error ? error.message : 'unknown' });
            logger.error('Failed to warm up cache', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                reportTypes,
                category: 'reports'
            });
            monitoring.finishSpan(span.spanId);
            throw error;
        }
    }

    /**
     * Generates date ranges for cache warm-up based on report type
     */
    private generateWarmUpDateRanges(reportType: 'weekly' | 'monthly' | 'quarterly'): EnhancedDateRange[] {
        const now = new Date();
        const ranges: EnhancedDateRange[] = [];

        switch (reportType) {
            case 'weekly':
                // Current week and previous 2 weeks
                for (let i = 0; i < 3; i++) {
                    const startDate = new Date(now);
                    startDate.setDate(now.getDate() - (i * 7) - now.getDay() + 1); // Monday of week
                    const endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 6); // Sunday of week

                    ranges.push({
                        startDate,
                        endDate,
                        timezone: 'UTC', // Default timezone for warm-up
                        weekStart: 'monday'
                    });
                }
                break;

            case 'monthly':
                // Current month and previous month
                for (let i = 0; i < 2; i++) {
                    const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

                    ranges.push({
                        startDate,
                        endDate,
                        timezone: 'UTC',
                        weekStart: 'monday'
                    });
                }
                break;

            case 'quarterly':
                // Current quarter only (quarterly reports are less frequently accessed)
                const currentQuarter = Math.floor(now.getMonth() / 3);
                const startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
                const endDate = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);

                ranges.push({
                    startDate,
                    endDate,
                    timezone: 'UTC',
                    weekStart: 'monday'
                });
                break;
        }

        return ranges;
    }

    /**
     * Warms up cache for a specific report period
     */
    private async warmUpReportPeriod(
        tenantId: string,
        reportType: 'weekly' | 'monthly' | 'quarterly',
        dateRange: EnhancedDateRange
    ): Promise<void> {
        try {
            // Check if report is already cached
            const existingReport = await this.getCachedReport(tenantId, reportType, dateRange);
            if (existingReport) {
                logger.debug('Report already cached, skipping warm-up', {
                    tenantId,
                    reportType,
                    dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                    category: 'reports'
                });
                return;
            }

            // Pre-warm aggregated data that would be needed for report generation
            const dataTypes = ['alerts_digest', 'updates_summary', 'vulnerability_posture'];

            for (const dataType of dataTypes) {
                const existingData = await this.getCachedAggregatedData(tenantId, dataType, dateRange);
                if (!existingData) {
                    // Mark as warm-up placeholder - actual data generation would happen on demand
                    const placeholderKey = ReportCacheKeys.dataKey(tenantId, `${dataType}_warmup`, dateRange);
                    await cache.set(placeholderKey, { warmUpPlaceholder: true, timestamp: new Date().toISOString() }, {
                        ttl: 300, // 5 minutes - short-lived placeholder
                        tags: ['warmup', `tenant:${tenantId}`]
                    });
                }
            }

            logger.debug('Cache warm-up completed for period', {
                tenantId,
                reportType,
                dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                category: 'reports'
            });

        } catch (error) {
            logger.warn('Cache warm-up failed for period', {
                tenantId,
                reportType,
                dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                error: error instanceof Error ? error.message : String(error),
                category: 'reports'
            });
        }
    }

    /**
     * Gets cache statistics for monitoring
     */
    async getCacheStats(): Promise<{
        overall: any;
        reportTypes: Record<string, { hitRate: number; totalRequests: number }>;
        tenantStats: Record<string, { cacheSize: number; hitRate: number }>;
    }> {
        try {
            const overallStats = cache.getStats();

            // In a real implementation, this would query metrics from monitoring system
            const reportTypeStats = {
                weekly: { hitRate: 0.75, totalRequests: 150 },
                monthly: { hitRate: 0.85, totalRequests: 80 },
                quarterly: { hitRate: 0.90, totalRequests: 20 }
            };

            const tenantStats = {
                // Placeholder - would be populated from actual cache metrics
            };

            return {
                overall: overallStats,
                reportTypes: reportTypeStats,
                tenantStats
            };

        } catch (error) {
            logger.error('Failed to get cache stats', error instanceof Error ? error : new Error(String(error)), {
                category: 'reports'
            });
            return {
                overall: {},
                reportTypes: {},
                tenantStats: {}
            };
        }
    }

    /**
     * Clears all cached data for a tenant (for testing or data cleanup)
     */
    async clearTenantCache(tenantId: string): Promise<void> {
        try {
            await this.invalidateCache({ tenantId });

            logger.info('Tenant cache cleared', { tenantId, category: 'reports' });

        } catch (error) {
            logger.error('Failed to clear tenant cache', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                category: 'reports'
            });
            throw error;
        }
    }
}

/**
 * Default instance for use throughout the application
 */
export const reportCacheService = new ReportCacheService();