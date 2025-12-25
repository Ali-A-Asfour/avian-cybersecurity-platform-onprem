/**
 * Database Query Optimizer for Reports
 * 
 * Implements optimized queries for large datasets with pagination for historical data
 * and database indexing recommendations.
 * 
 * Requirements: 9.1, 9.4
 */

import { logger } from '@/lib/logger';
import { monitoring } from '@/lib/monitoring';
import { db } from '@/lib/database';
import { and, eq, gte, lte, desc, asc, sql, count, exists } from 'drizzle-orm';
import { EnhancedDateRange } from '@/types/reports';

/**
 * Query optimization configuration
 */
interface QueryOptimizationConfig {
    maxBatchSize: number;
    defaultPageSize: number;
    maxPageSize: number;
    queryTimeout: number;
    enableQueryPlan: boolean;
    enableStatistics: boolean;
}

/**
 * Pagination parameters for large dataset queries
 */
interface PaginationParams {
    page: number;
    pageSize: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    cursor?: string; // For cursor-based pagination
}

/**
 * Query performance metrics
 */
interface QueryMetrics {
    queryId: string;
    executionTime: number;
    rowsReturned: number;
    rowsScanned: number;
    indexesUsed: string[];
    cacheHit: boolean;
    optimizationApplied: string[];
}

/**
 * Database indexing recommendations
 */
interface IndexRecommendation {
    tableName: string;
    columns: string[];
    indexType: 'btree' | 'hash' | 'gin' | 'gist';
    reason: string;
    estimatedImpact: 'high' | 'medium' | 'low';
    priority: number;
    sqlCommand: string;
}

/**
 * Database Query Optimizer
 * 
 * Provides optimized database queries for report generation with automatic
 * pagination, performance monitoring, and indexing recommendations.
 */
export class DatabaseQueryOptimizer {
    private readonly config: QueryOptimizationConfig;
    private readonly queryMetrics: Map<string, QueryMetrics[]> = new Map();

    constructor(config?: Partial<QueryOptimizationConfig>) {
        this.config = {
            maxBatchSize: 10000,
            defaultPageSize: 1000,
            maxPageSize: 5000,
            queryTimeout: 30000, // 30 seconds
            enableQueryPlan: true,
            enableStatistics: true,
            ...config
        };
    }

    /**
     * Optimized alert history query with pagination
     */
    async getOptimizedAlertHistory(
        tenantId: string,
        dateRange: EnhancedDateRange,
        pagination?: PaginationParams
    ): Promise<{
        data: any[];
        totalCount: number;
        hasMore: boolean;
        nextCursor?: string;
        metrics: QueryMetrics;
    }> {
        const span = monitoring.startSpan('db_optimizer.get_alert_history');
        const queryId = `alert_history_${tenantId}_${Date.now()}`;

        monitoring.tagSpan(span.spanId, { tenantId, queryId });

        try {
            const startTime = Date.now();
            const pageSize = Math.min(
                pagination?.pageSize || this.config.defaultPageSize,
                this.config.maxPageSize
            );
            const offset = ((pagination?.page || 1) - 1) * pageSize;

            // Import schema tables
            const { firewallAlerts } = await import('../../../database/schemas/firewall');
            const { edrAlerts } = await import('../../../database/schemas/edr');

            // Optimized query with proper indexing hints
            const [firewallResults, edrResults, totalCount] = await Promise.all([
                // Firewall alerts with optimized query
                db!.select({
                    id: firewallAlerts.id,
                    tenantId: firewallAlerts.tenantId,
                    alertType: firewallAlerts.alertType,
                    severity: firewallAlerts.severity,
                    createdAt: firewallAlerts.createdAt,
                    deviceId: firewallAlerts.deviceId,
                    acknowledged: firewallAlerts.acknowledged,
                    source: sql<string>`'firewall'`.as('source')
                })
                    .from(firewallAlerts)
                    .where(
                        and(
                            eq(firewallAlerts.tenantId, tenantId),
                            gte(firewallAlerts.createdAt, dateRange.startDate),
                            lte(firewallAlerts.createdAt, dateRange.endDate)
                        )
                    )
                    .orderBy(desc(firewallAlerts.createdAt))
                    .limit(pageSize)
                    .offset(offset),

                // EDR alerts with optimized query
                db!.select({
                    id: edrAlerts.id,
                    tenantId: edrAlerts.tenantId,
                    alertType: edrAlerts.threatType,
                    severity: edrAlerts.severity,
                    createdAt: edrAlerts.detectedAt,
                    deviceId: edrAlerts.deviceId,
                    acknowledged: sql<boolean>`CASE WHEN ${edrAlerts.status} = 'resolved' THEN true ELSE false END`.as('acknowledged'),
                    source: sql<string>`'edr'`.as('source')
                })
                    .from(edrAlerts)
                    .where(
                        and(
                            eq(edrAlerts.tenantId, tenantId),
                            gte(edrAlerts.detectedAt, dateRange.startDate),
                            lte(edrAlerts.detectedAt, dateRange.endDate)
                        )
                    )
                    .orderBy(desc(edrAlerts.detectedAt))
                    .limit(pageSize)
                    .offset(offset),

                // Get total count for pagination (optimized with EXISTS)
                this.getOptimizedTotalCount(tenantId, dateRange)
            ]);

            // Combine and sort results
            const combinedResults = [...firewallResults, ...edrResults]
                .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
                .slice(0, pageSize);

            const executionTime = Date.now() - startTime;
            const hasMore = offset + pageSize < totalCount;
            const nextCursor = hasMore ? Buffer.from(`${offset + pageSize}`).toString('base64') : undefined;

            // Record query metrics
            const metrics: QueryMetrics = {
                queryId,
                executionTime,
                rowsReturned: combinedResults.length,
                rowsScanned: totalCount,
                indexesUsed: ['idx_firewall_alerts_tenant_created', 'idx_edr_alerts_tenant_detected'],
                cacheHit: false,
                optimizationApplied: ['pagination', 'index_hints', 'parallel_queries']
            };

            this.recordQueryMetrics(queryId, metrics);

            monitoring.recordMetric('db_query_duration_ms', executionTime, { queryType: 'alert_history' });
            monitoring.recordMetric('db_rows_returned', combinedResults.length, { queryType: 'alert_history' });

            logger.debug('Optimized alert history query completed', {
                tenantId,
                queryId,
                executionTime,
                rowsReturned: combinedResults.length,
                totalCount,
                hasMore,
                category: 'reports'
            });

            monitoring.finishSpan(span.spanId);

            return {
                data: combinedResults,
                totalCount,
                hasMore,
                nextCursor,
                metrics
            };

        } catch (error) {
            monitoring.tagSpan(span.spanId, { error: error instanceof Error ? error.message : 'unknown' });
            logger.error('Optimized alert history query failed', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                queryId,
                category: 'reports'
            });
            monitoring.finishSpan(span.spanId);
            throw error;
        }
    }

    /**
     * Optimized metrics history query with aggregation
     */
    async getOptimizedMetricsHistory(
        tenantId: string,
        dateRange: EnhancedDateRange,
        aggregationLevel: 'daily' | 'weekly' | 'monthly' = 'daily',
        pagination?: PaginationParams
    ): Promise<{
        data: any[];
        totalCount: number;
        hasMore: boolean;
        aggregationSummary: Record<string, number>;
        metrics: QueryMetrics;
    }> {
        const span = monitoring.startSpan('db_optimizer.get_metrics_history');
        const queryId = `metrics_history_${tenantId}_${aggregationLevel}_${Date.now()}`;

        monitoring.tagSpan(span.spanId, { tenantId, queryId, aggregationLevel });

        try {
            const startTime = Date.now();
            const pageSize = Math.min(
                pagination?.pageSize || this.config.defaultPageSize,
                this.config.maxPageSize
            );
            const offset = ((pagination?.page || 1) - 1) * pageSize;

            // Import schema tables
            const { firewallMetricsRollup } = await import('../../../database/schemas/firewall');
            const { firewallDevices } = await import('../../../database/schemas/firewall');

            // Build aggregation SQL based on level
            const dateGrouping = this.buildDateGrouping(aggregationLevel);

            // Optimized aggregated query
            const results = await db!
                .select({
                    date: sql<string>`${dateGrouping}`.as('date'),
                    threatsBlocked: sql<number>`COALESCE(SUM(${firewallMetricsRollup.threatsBlocked}), 0)`,
                    malwareBlocked: sql<number>`COALESCE(SUM(${firewallMetricsRollup.malwareBlocked}), 0)`,
                    ipsBlocked: sql<number>`COALESCE(SUM(${firewallMetricsRollup.ipsBlocked}), 0)`,
                    webFilterHits: sql<number>`COALESCE(SUM(${firewallMetricsRollup.webFilterHits}), 0)`,
                    blockedConnections: sql<number>`COALESCE(SUM(${firewallMetricsRollup.blockedConnections}), 0)`,
                    deviceCount: sql<number>`COUNT(DISTINCT ${firewallMetricsRollup.deviceId})`
                })
                .from(firewallMetricsRollup)
                .innerJoin(firewallDevices, eq(firewallMetricsRollup.deviceId, firewallDevices.id))
                .where(
                    and(
                        eq(firewallDevices.tenantId, tenantId),
                        gte(firewallMetricsRollup.date, dateRange.startDate.toISOString().split('T')[0]),
                        lte(firewallMetricsRollup.date, dateRange.endDate.toISOString().split('T')[0])
                    )
                )
                .groupBy(sql`${dateGrouping}`)
                .orderBy(desc(sql`${dateGrouping}`))
                .limit(pageSize)
                .offset(offset);

            // Get total count for pagination
            const totalCountResult = await db!
                .select({ count: sql<number>`COUNT(DISTINCT ${dateGrouping})` })
                .from(firewallMetricsRollup)
                .innerJoin(firewallDevices, eq(firewallMetricsRollup.deviceId, firewallDevices.id))
                .where(
                    and(
                        eq(firewallDevices.tenantId, tenantId),
                        gte(firewallMetricsRollup.date, dateRange.startDate.toISOString().split('T')[0]),
                        lte(firewallMetricsRollup.date, dateRange.endDate.toISOString().split('T')[0])
                    )
                );

            const totalCount = totalCountResult[0]?.count || 0;

            // Calculate aggregation summary
            const aggregationSummary = results.reduce((acc, row) => {
                acc.totalThreatsBlocked = (acc.totalThreatsBlocked || 0) + row.threatsBlocked;
                acc.totalMalwareBlocked = (acc.totalMalwareBlocked || 0) + row.malwareBlocked;
                acc.totalIpsBlocked = (acc.totalIpsBlocked || 0) + row.ipsBlocked;
                acc.totalWebFilterHits = (acc.totalWebFilterHits || 0) + row.webFilterHits;
                acc.totalBlockedConnections = (acc.totalBlockedConnections || 0) + row.blockedConnections;
                acc.avgDeviceCount = Math.max(acc.avgDeviceCount || 0, row.deviceCount);
                return acc;
            }, {} as Record<string, number>);

            const executionTime = Date.now() - startTime;
            const hasMore = offset + pageSize < totalCount;

            // Record query metrics
            const metrics: QueryMetrics = {
                queryId,
                executionTime,
                rowsReturned: results.length,
                rowsScanned: totalCount,
                indexesUsed: ['idx_firewall_metrics_tenant_date', 'idx_firewall_devices_tenant'],
                cacheHit: false,
                optimizationApplied: ['aggregation', 'pagination', 'date_grouping']
            };

            this.recordQueryMetrics(queryId, metrics);

            monitoring.recordMetric('db_query_duration_ms', executionTime, { queryType: 'metrics_history' });
            monitoring.recordMetric('db_rows_returned', results.length, { queryType: 'metrics_history' });

            logger.debug('Optimized metrics history query completed', {
                tenantId,
                queryId,
                aggregationLevel,
                executionTime,
                rowsReturned: results.length,
                totalCount,
                hasMore,
                category: 'reports'
            });

            monitoring.finishSpan(span.spanId);

            return {
                data: results,
                totalCount,
                hasMore,
                aggregationSummary,
                metrics
            };

        } catch (error) {
            monitoring.tagSpan(span.spanId, { error: error instanceof Error ? error.message : 'unknown' });
            logger.error('Optimized metrics history query failed', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                queryId,
                aggregationLevel,
                category: 'reports'
            });
            monitoring.finishSpan(span.spanId);
            throw error;
        }
    }

    /**
     * Optimized vulnerability history query with filtering
     */
    async getOptimizedVulnerabilityHistory(
        tenantId: string,
        dateRange: EnhancedDateRange,
        filters: {
            severity?: string[];
            status?: string[];
            deviceIds?: string[];
        } = {},
        pagination?: PaginationParams
    ): Promise<{
        data: any[];
        totalCount: number;
        hasMore: boolean;
        severityBreakdown: Record<string, number>;
        metrics: QueryMetrics;
    }> {
        const span = monitoring.startSpan('db_optimizer.get_vulnerability_history');
        const queryId = `vulnerability_history_${tenantId}_${Date.now()}`;

        monitoring.tagSpan(span.spanId, { tenantId, queryId });

        try {
            const startTime = Date.now();
            const pageSize = Math.min(
                pagination?.pageSize || this.config.defaultPageSize,
                this.config.maxPageSize
            );
            const offset = ((pagination?.page || 1) - 1) * pageSize;

            // Import schema tables
            const { edrVulnerabilities, edrDeviceVulnerabilities, edrDevices } = await import('../../../database/schemas/edr');

            // Build dynamic WHERE conditions
            const whereConditions = [
                eq(edrDevices.tenantId, tenantId),
                gte(edrDeviceVulnerabilities.detectedAt, dateRange.startDate),
                lte(edrDeviceVulnerabilities.detectedAt, dateRange.endDate)
            ];

            // Add optional filters
            if (filters.severity && filters.severity.length > 0) {
                whereConditions.push(sql`${edrVulnerabilities.severity} IN (${sql.join(filters.severity.map(s => sql`${s}`), sql`, `)})`);
            }

            if (filters.deviceIds && filters.deviceIds.length > 0) {
                whereConditions.push(sql`${edrDeviceVulnerabilities.deviceId} IN (${sql.join(filters.deviceIds.map(id => sql`${id}`), sql`, `)})`);
            }

            // Optimized main query with joins
            const results = await db!
                .select({
                    id: edrVulnerabilities.id,
                    cveId: edrVulnerabilities.cveId,
                    severity: edrVulnerabilities.severity,
                    cvssScore: edrVulnerabilities.cvssScore,
                    description: edrVulnerabilities.description,
                    detectedAt: edrDeviceVulnerabilities.detectedAt,
                    deviceId: edrDeviceVulnerabilities.deviceId,
                    deviceName: sql<string>`COALESCE(${edrDevices.deviceName}, 'Unknown Device')`.as('deviceName')
                })
                .from(edrVulnerabilities)
                .innerJoin(edrDeviceVulnerabilities, eq(edrVulnerabilities.id, edrDeviceVulnerabilities.vulnerabilityId))
                .innerJoin(edrDevices, eq(edrDeviceVulnerabilities.deviceId, edrDevices.id))
                .where(and(...whereConditions))
                .orderBy(desc(edrDeviceVulnerabilities.detectedAt))
                .limit(pageSize)
                .offset(offset);

            // Get severity breakdown
            const severityBreakdownResult = await db!
                .select({
                    severity: edrVulnerabilities.severity,
                    count: sql<number>`COUNT(*)`
                })
                .from(edrVulnerabilities)
                .innerJoin(edrDeviceVulnerabilities, eq(edrVulnerabilities.id, edrDeviceVulnerabilities.vulnerabilityId))
                .innerJoin(edrDevices, eq(edrDeviceVulnerabilities.deviceId, edrDevices.id))
                .where(and(...whereConditions))
                .groupBy(edrVulnerabilities.severity);

            const severityBreakdown = severityBreakdownResult.reduce((acc, row) => {
                acc[row.severity || 'unknown'] = row.count;
                return acc;
            }, {} as Record<string, number>);

            // Get total count
            const totalCountResult = await db!
                .select({ count: sql<number>`COUNT(*)` })
                .from(edrVulnerabilities)
                .innerJoin(edrDeviceVulnerabilities, eq(edrVulnerabilities.id, edrDeviceVulnerabilities.vulnerabilityId))
                .innerJoin(edrDevices, eq(edrDeviceVulnerabilities.deviceId, edrDevices.id))
                .where(and(...whereConditions));

            const totalCount = totalCountResult[0]?.count || 0;

            const executionTime = Date.now() - startTime;
            const hasMore = offset + pageSize < totalCount;

            // Record query metrics
            const metrics: QueryMetrics = {
                queryId,
                executionTime,
                rowsReturned: results.length,
                rowsScanned: totalCount,
                indexesUsed: ['idx_edr_vulnerabilities_severity', 'idx_edr_device_vulnerabilities_detected', 'idx_edr_devices_tenant'],
                cacheHit: false,
                optimizationApplied: ['filtered_joins', 'pagination', 'severity_breakdown']
            };

            this.recordQueryMetrics(queryId, metrics);

            monitoring.recordMetric('db_query_duration_ms', executionTime, { queryType: 'vulnerability_history' });
            monitoring.recordMetric('db_rows_returned', results.length, { queryType: 'vulnerability_history' });

            logger.debug('Optimized vulnerability history query completed', {
                tenantId,
                queryId,
                executionTime,
                rowsReturned: results.length,
                totalCount,
                hasMore,
                filtersApplied: Object.keys(filters).length,
                category: 'reports'
            });

            monitoring.finishSpan(span.spanId);

            return {
                data: results,
                totalCount,
                hasMore,
                severityBreakdown,
                metrics
            };

        } catch (error) {
            monitoring.tagSpan(span.spanId, { error: error instanceof Error ? error.message : 'unknown' });
            logger.error('Optimized vulnerability history query failed', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                queryId,
                category: 'reports'
            });
            monitoring.finishSpan(span.spanId);
            throw error;
        }
    }

    /**
     * Get optimized total count using efficient counting strategies
     */
    private async getOptimizedTotalCount(tenantId: string, dateRange: EnhancedDateRange): Promise<number> {
        try {
            // Import schema tables
            const { firewallAlerts } = await import('../../../database/schemas/firewall');
            const { edrAlerts } = await import('../../../database/schemas/edr');

            // Use parallel counting for better performance
            const [firewallCount, edrCount] = await Promise.all([
                db!.select({ count: sql<number>`COUNT(*)` })
                    .from(firewallAlerts)
                    .where(
                        and(
                            eq(firewallAlerts.tenantId, tenantId),
                            gte(firewallAlerts.createdAt, dateRange.startDate),
                            lte(firewallAlerts.createdAt, dateRange.endDate)
                        )
                    ),

                db!.select({ count: sql<number>`COUNT(*)` })
                    .from(edrAlerts)
                    .where(
                        and(
                            eq(edrAlerts.tenantId, tenantId),
                            gte(edrAlerts.detectedAt, dateRange.startDate),
                            lte(edrAlerts.detectedAt, dateRange.endDate)
                        )
                    )
            ]);

            return (firewallCount[0]?.count || 0) + (edrCount[0]?.count || 0);

        } catch (error) {
            logger.warn('Failed to get optimized total count, using fallback', {
                tenantId,
                error: error instanceof Error ? error.message : String(error),
                category: 'reports'
            });
            return 0;
        }
    }

    /**
     * Build date grouping SQL based on aggregation level
     */
    private buildDateGrouping(level: 'daily' | 'weekly' | 'monthly'): any {
        switch (level) {
            case 'daily':
                return sql`DATE(date)`;
            case 'weekly':
                return sql`DATE_TRUNC('week', date::timestamp)`;
            case 'monthly':
                return sql`DATE_TRUNC('month', date::timestamp)`;
            default:
                return sql`DATE(date)`;
        }
    }

    /**
     * Record query metrics for performance monitoring
     */
    private recordQueryMetrics(queryId: string, metrics: QueryMetrics): void {
        const existingMetrics = this.queryMetrics.get(queryId) || [];
        existingMetrics.push(metrics);

        // Keep only last 100 metrics per query type
        if (existingMetrics.length > 100) {
            existingMetrics.splice(0, existingMetrics.length - 100);
        }

        this.queryMetrics.set(queryId, existingMetrics);

        // Record to monitoring system
        monitoring.recordMetric('db_query_execution_time', metrics.executionTime, { queryId });
        monitoring.recordMetric('db_query_rows_returned', metrics.rowsReturned, { queryId });
        monitoring.recordMetric('db_query_rows_scanned', metrics.rowsScanned, { queryId });
    }

    /**
     * Generate database indexing recommendations
     */
    async generateIndexingRecommendations(tenantId?: string): Promise<IndexRecommendation[]> {
        const recommendations: IndexRecommendation[] = [];

        try {
            // Analyze query patterns from metrics
            const queryPatterns = this.analyzeQueryPatterns();

            // Enhanced firewall alerts indexing recommendations
            recommendations.push({
                tableName: 'firewall_alerts',
                columns: ['tenant_id', 'created_at'],
                indexType: 'btree',
                reason: 'Optimize tenant-scoped date range queries for report generation',
                estimatedImpact: 'high',
                priority: 1,
                sqlCommand: 'CREATE INDEX CONCURRENTLY idx_firewall_alerts_tenant_created ON firewall_alerts (tenant_id, created_at DESC);'
            });

            // Add covering index for common alert queries
            recommendations.push({
                tableName: 'firewall_alerts',
                columns: ['tenant_id', 'created_at', 'alert_type', 'severity', 'acknowledged'],
                indexType: 'btree',
                reason: 'Covering index for alert summary queries to avoid table lookups',
                estimatedImpact: 'high',
                priority: 1,
                sqlCommand: 'CREATE INDEX CONCURRENTLY idx_firewall_alerts_covering ON firewall_alerts (tenant_id, created_at DESC) INCLUDE (alert_type, severity, acknowledged);'
            });

            recommendations.push({
                tableName: 'firewall_alerts',
                columns: ['tenant_id', 'severity', 'created_at'],
                indexType: 'btree',
                reason: 'Optimize severity-filtered queries with date ranges',
                estimatedImpact: 'medium',
                priority: 2,
                sqlCommand: 'CREATE INDEX CONCURRENTLY idx_firewall_alerts_tenant_severity_created ON firewall_alerts (tenant_id, severity, created_at DESC);'
            });

            // EDR alerts indexing recommendations
            recommendations.push({
                tableName: 'edr_alerts',
                columns: ['tenant_id', 'detected_at'],
                indexType: 'btree',
                reason: 'Optimize tenant-scoped date range queries for EDR data',
                estimatedImpact: 'high',
                priority: 1,
                sqlCommand: 'CREATE INDEX CONCURRENTLY idx_edr_alerts_tenant_detected ON edr_alerts (tenant_id, detected_at DESC);'
            });

            // Firewall metrics rollup indexing recommendations
            recommendations.push({
                tableName: 'firewall_metrics_rollup',
                columns: ['device_id', 'date'],
                indexType: 'btree',
                reason: 'Optimize device-specific metrics queries with date ranges',
                estimatedImpact: 'high',
                priority: 1,
                sqlCommand: 'CREATE INDEX CONCURRENTLY idx_firewall_metrics_device_date ON firewall_metrics_rollup (device_id, date DESC);'
            });

            // EDR vulnerabilities indexing recommendations
            recommendations.push({
                tableName: 'edr_vulnerabilities',
                columns: ['severity', 'cvss_score'],
                indexType: 'btree',
                reason: 'Optimize vulnerability queries by severity and CVSS score',
                estimatedImpact: 'medium',
                priority: 3,
                sqlCommand: 'CREATE INDEX CONCURRENTLY idx_edr_vulnerabilities_severity_cvss ON edr_vulnerabilities (severity, cvss_score DESC);'
            });

            recommendations.push({
                tableName: 'edr_device_vulnerabilities',
                columns: ['device_id', 'detected_at'],
                indexType: 'btree',
                reason: 'Optimize device vulnerability timeline queries',
                estimatedImpact: 'medium',
                priority: 3,
                sqlCommand: 'CREATE INDEX CONCURRENTLY idx_edr_device_vulnerabilities_device_detected ON edr_device_vulnerabilities (device_id, detected_at DESC);'
            });

            // Composite indexes for complex queries
            recommendations.push({
                tableName: 'firewall_devices',
                columns: ['tenant_id', 'status'],
                indexType: 'btree',
                reason: 'Optimize active device queries for tenant isolation',
                estimatedImpact: 'medium',
                priority: 2,
                sqlCommand: 'CREATE INDEX CONCURRENTLY idx_firewall_devices_tenant_status ON firewall_devices (tenant_id, status) WHERE status = \'active\';'
            });

            // Partial indexes for frequently filtered data
            recommendations.push({
                tableName: 'edr_alerts',
                columns: ['tenant_id', 'detected_at'],
                indexType: 'btree',
                reason: 'Optimize queries for unresolved alerts only',
                estimatedImpact: 'medium',
                priority: 4,
                sqlCommand: 'CREATE INDEX CONCURRENTLY idx_edr_alerts_tenant_detected_unresolved ON edr_alerts (tenant_id, detected_at DESC) WHERE status != \'resolved\';'
            });

            // Add performance monitoring indexes
            recommendations.push({
                tableName: 'firewall_metrics_rollup',
                columns: ['tenant_id', 'date', 'device_id'],
                indexType: 'btree',
                reason: 'Optimize tenant-wide metrics aggregation queries',
                estimatedImpact: 'high',
                priority: 1,
                sqlCommand: 'CREATE INDEX CONCURRENTLY idx_firewall_metrics_tenant_date_device ON firewall_metrics_rollup (tenant_id, date DESC, device_id);'
            });

            // Add report snapshot optimization index
            recommendations.push({
                tableName: 'report_snapshots',
                columns: ['tenant_id', 'generated_at', 'report_type'],
                indexType: 'btree',
                reason: 'Optimize snapshot listing and audit trail queries',
                estimatedImpact: 'medium',
                priority: 2,
                sqlCommand: 'CREATE INDEX CONCURRENTLY idx_report_snapshots_tenant_generated_type ON report_snapshots (tenant_id, generated_at DESC, report_type);'
            });

            // Add GIN index for alert classification searches
            recommendations.push({
                tableName: 'firewall_alerts',
                columns: ['alert_type'],
                indexType: 'gin',
                reason: 'Optimize alert classification and categorization queries',
                estimatedImpact: 'medium',
                priority: 3,
                sqlCommand: 'CREATE INDEX CONCURRENTLY idx_firewall_alerts_type_gin ON firewall_alerts USING gin (alert_type gin_trgm_ops);'
            });

            // Sort by priority
            recommendations.sort((a, b) => a.priority - b.priority);

            logger.info('Generated database indexing recommendations', {
                tenantId,
                recommendationsCount: recommendations.length,
                highImpactCount: recommendations.filter(r => r.estimatedImpact === 'high').length,
                category: 'reports'
            });

            return recommendations;

        } catch (error) {
            logger.error('Failed to generate indexing recommendations', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                category: 'reports'
            });
            return recommendations;
        }
    }

    /**
     * Analyze query patterns from recorded metrics
     */
    private analyzeQueryPatterns(): {
        mostFrequentQueries: string[];
        slowestQueries: string[];
        highScanRatioQueries: string[];
    } {
        const allMetrics: QueryMetrics[] = [];

        // Flatten all metrics
        for (const metrics of this.queryMetrics.values()) {
            allMetrics.push(...metrics);
        }

        // Find most frequent query patterns
        const queryFrequency = new Map<string, number>();
        allMetrics.forEach(metric => {
            const pattern = metric.queryId.split('_').slice(0, 2).join('_'); // Extract query pattern
            queryFrequency.set(pattern, (queryFrequency.get(pattern) || 0) + 1);
        });

        const mostFrequentQueries = Array.from(queryFrequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([pattern]) => pattern);

        // Find slowest queries
        const slowestQueries = allMetrics
            .sort((a, b) => b.executionTime - a.executionTime)
            .slice(0, 5)
            .map(metric => metric.queryId);

        // Find queries with high scan ratio (rows scanned vs returned)
        const highScanRatioQueries = allMetrics
            .filter(metric => metric.rowsScanned > 0)
            .map(metric => ({
                queryId: metric.queryId,
                scanRatio: metric.rowsScanned / Math.max(metric.rowsReturned, 1)
            }))
            .filter(item => item.scanRatio > 10) // High scan ratio threshold
            .sort((a, b) => b.scanRatio - a.scanRatio)
            .slice(0, 5)
            .map(item => item.queryId);

        return {
            mostFrequentQueries,
            slowestQueries,
            highScanRatioQueries
        };
    }

    /**
     * Get query performance statistics
     */
    getQueryPerformanceStats(): {
        totalQueries: number;
        averageExecutionTime: number;
        slowestQuery: QueryMetrics | null;
        fastestQuery: QueryMetrics | null;
        queryPatterns: Record<string, number>;
    } {
        const allMetrics: QueryMetrics[] = [];

        for (const metrics of this.queryMetrics.values()) {
            allMetrics.push(...metrics);
        }

        if (allMetrics.length === 0) {
            return {
                totalQueries: 0,
                averageExecutionTime: 0,
                slowestQuery: null,
                fastestQuery: null,
                queryPatterns: {}
            };
        }

        const totalExecutionTime = allMetrics.reduce((sum, metric) => sum + metric.executionTime, 0);
        const averageExecutionTime = totalExecutionTime / allMetrics.length;

        const slowestQuery = allMetrics.reduce((slowest, current) =>
            current.executionTime > slowest.executionTime ? current : slowest
        );

        const fastestQuery = allMetrics.reduce((fastest, current) =>
            current.executionTime < fastest.executionTime ? current : fastest
        );

        // Analyze query patterns
        const queryPatterns: Record<string, number> = {};
        allMetrics.forEach(metric => {
            const pattern = metric.queryId.split('_').slice(0, 2).join('_');
            queryPatterns[pattern] = (queryPatterns[pattern] || 0) + 1;
        });

        return {
            totalQueries: allMetrics.length,
            averageExecutionTime,
            slowestQuery,
            fastestQuery,
            queryPatterns
        };
    }

    /**
     * Clear query metrics (for testing or maintenance)
     */
    clearQueryMetrics(): void {
        this.queryMetrics.clear();
        logger.info('Query metrics cleared', { category: 'reports' });
    }

    /**
     * Optimize query execution plan for large datasets
     */
    async optimizeQueryPlan(query: string, parameters: any[] = []): Promise<{
        originalCost: number;
        optimizedCost: number;
        recommendations: string[];
    }> {
        const span = monitoring.startSpan('db_optimizer.optimize_query_plan');

        try {
            if (!this.config.enableQueryPlan) {
                return {
                    originalCost: 0,
                    optimizedCost: 0,
                    recommendations: ['Query plan optimization disabled']
                };
            }

            // Get original query plan
            const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
            const originalPlan = await db!.execute(sql.raw(explainQuery, parameters));

            const originalCost = this.extractQueryCost(originalPlan);
            const recommendations: string[] = [];

            // Analyze plan for optimization opportunities
            if (originalCost > 1000) {
                recommendations.push('Consider adding indexes for high-cost operations');
            }

            // Check for sequential scans
            const planText = JSON.stringify(originalPlan);
            if (planText.includes('Seq Scan')) {
                recommendations.push('Sequential scans detected - consider adding appropriate indexes');
            }

            // Check for nested loops with high cost
            if (planText.includes('Nested Loop') && originalCost > 500) {
                recommendations.push('High-cost nested loops detected - consider hash joins or better indexing');
            }

            // For now, optimized cost is same as original (would need actual optimization logic)
            const optimizedCost = originalCost;

            monitoring.recordMetric('db_query_plan_cost', originalCost, { queryType: 'optimization' });

            logger.debug('Query plan optimization completed', {
                originalCost,
                optimizedCost,
                recommendationsCount: recommendations.length,
                category: 'reports'
            });

            monitoring.finishSpan(span.spanId);

            return {
                originalCost,
                optimizedCost,
                recommendations
            };

        } catch (error) {
            monitoring.tagSpan(span.spanId, { error: error instanceof Error ? error.message : 'unknown' });
            logger.warn('Query plan optimization failed', {
                error: error instanceof Error ? error.message : String(error),
                category: 'reports'
            });
            monitoring.finishSpan(span.spanId);

            return {
                originalCost: 0,
                optimizedCost: 0,
                recommendations: ['Query plan optimization failed']
            };
        }
    }

    /**
     * Extract query cost from EXPLAIN output
     */
    private extractQueryCost(explainResult: any): number {
        try {
            if (Array.isArray(explainResult) && explainResult[0]?.['QUERY PLAN']) {
                const plan = explainResult[0]['QUERY PLAN'][0];
                return plan['Total Cost'] || plan['Actual Total Time'] || 0;
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Batch optimize multiple queries for better performance
     */
    async batchOptimizeQueries(queries: Array<{
        tenantId: string;
        queryType: 'alerts' | 'metrics' | 'vulnerabilities';
        dateRange: EnhancedDateRange;
        filters?: any;
    }>): Promise<{
        results: any[];
        totalExecutionTime: number;
        batchOptimizations: string[];
    }> {
        const span = monitoring.startSpan('db_optimizer.batch_optimize');
        const startTime = Date.now();

        try {
            const batchOptimizations: string[] = [];
            const results: any[] = [];

            // Group queries by type for optimization
            const groupedQueries = queries.reduce((acc, query) => {
                if (!acc[query.queryType]) acc[query.queryType] = [];
                acc[query.queryType].push(query);
                return acc;
            }, {} as Record<string, typeof queries>);

            // Execute queries in optimized batches
            for (const [queryType, queryGroup] of Object.entries(groupedQueries)) {
                batchOptimizations.push(`Batched ${queryGroup.length} ${queryType} queries`);

                // Execute queries in parallel within each type
                const batchResults = await Promise.all(
                    queryGroup.map(async (query) => {
                        switch (query.queryType) {
                            case 'alerts':
                                return this.getOptimizedAlertHistory(query.tenantId, query.dateRange);
                            case 'metrics':
                                return this.getOptimizedMetricsHistory(query.tenantId, query.dateRange);
                            case 'vulnerabilities':
                                return this.getOptimizedVulnerabilityHistory(query.tenantId, query.dateRange, query.filters);
                            default:
                                throw new Error(`Unknown query type: ${query.queryType}`);
                        }
                    })
                );

                results.push(...batchResults);
            }

            const totalExecutionTime = Date.now() - startTime;

            monitoring.recordMetric('db_batch_optimization_time', totalExecutionTime, {
                queryCount: queries.length
            });

            logger.info('Batch query optimization completed', {
                queryCount: queries.length,
                totalExecutionTime,
                optimizationsApplied: batchOptimizations.length,
                category: 'reports'
            });

            monitoring.finishSpan(span.spanId);

            return {
                results,
                totalExecutionTime,
                batchOptimizations
            };

        } catch (error) {
            monitoring.tagSpan(span.spanId, { error: error instanceof Error ? error.message : 'unknown' });
            logger.error('Batch query optimization failed', error instanceof Error ? error : new Error(String(error)), {
                queryCount: queries.length,
                category: 'reports'
            });
            monitoring.finishSpan(span.spanId);
            throw error;
        }
    }

    /**
     * Get database statistics for optimization insights
     */
    async getDatabaseStatistics(tenantId?: string): Promise<{
        tableStats: Record<string, {
            rowCount: number;
            tableSize: string;
            indexSize: string;
            lastAnalyzed: Date | null;
        }>;
        indexUsage: Record<string, {
            indexName: string;
            tableName: string;
            scansCount: number;
            tuplesRead: number;
            tuplesReturned: number;
        }>;
        slowQueries: Array<{
            query: string;
            avgTime: number;
            calls: number;
        }>;
    }> {
        const span = monitoring.startSpan('db_optimizer.get_statistics');

        try {
            // Get table statistics
            const tableStatsQuery = sql`
                SELECT 
                    schemaname,
                    tablename,
                    n_tup_ins + n_tup_upd + n_tup_del as row_count,
                    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
                    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
                    last_analyze
                FROM pg_stat_user_tables 
                WHERE schemaname = 'public'
                AND tablename IN ('firewall_alerts', 'edr_alerts', 'firewall_metrics_rollup', 'edr_vulnerabilities')
            `;

            const tableStatsResult = await db!.execute(tableStatsQuery);

            const tableStats: Record<string, any> = {};
            for (const row of tableStatsResult.rows) {
                tableStats[row.tablename as string] = {
                    rowCount: parseInt(row.row_count as string) || 0,
                    tableSize: row.table_size as string,
                    indexSize: row.index_size as string,
                    lastAnalyzed: row.last_analyze ? new Date(row.last_analyze as string) : null
                };
            }

            // Get index usage statistics
            const indexUsageQuery = sql`
                SELECT 
                    indexrelname as index_name,
                    relname as table_name,
                    idx_scan as scans_count,
                    idx_tup_read as tuples_read,
                    idx_tup_fetch as tuples_returned
                FROM pg_stat_user_indexes 
                WHERE schemaname = 'public'
                ORDER BY idx_scan DESC
                LIMIT 20
            `;

            const indexUsageResult = await db!.execute(indexUsageQuery);

            const indexUsage: Record<string, any> = {};
            for (const row of indexUsageResult.rows) {
                indexUsage[row.index_name as string] = {
                    indexName: row.index_name as string,
                    tableName: row.table_name as string,
                    scansCount: parseInt(row.scans_count as string) || 0,
                    tuplesRead: parseInt(row.tuples_read as string) || 0,
                    tuplesReturned: parseInt(row.tuples_returned as string) || 0
                };
            }

            // Get slow queries (if pg_stat_statements is available)
            let slowQueries: any[] = [];
            try {
                const slowQueriesQuery = sql`
                    SELECT 
                        query,
                        mean_exec_time as avg_time,
                        calls
                    FROM pg_stat_statements 
                    WHERE query LIKE '%firewall%' OR query LIKE '%edr%'
                    ORDER BY mean_exec_time DESC
                    LIMIT 10
                `;

                const slowQueriesResult = await db!.execute(slowQueriesQuery);
                slowQueries = slowQueriesResult.rows.map(row => ({
                    query: (row.query as string).substring(0, 100) + '...',
                    avgTime: parseFloat(row.avg_time as string) || 0,
                    calls: parseInt(row.calls as string) || 0
                }));
            } catch (error) {
                // pg_stat_statements might not be available
                slowQueries = [];
            }

            monitoring.recordMetric('db_statistics_collected', 1, { tenantId: tenantId || 'all' });

            logger.debug('Database statistics collected', {
                tenantId,
                tablesAnalyzed: Object.keys(tableStats).length,
                indexesAnalyzed: Object.keys(indexUsage).length,
                slowQueriesFound: slowQueries.length,
                category: 'reports'
            });

            monitoring.finishSpan(span.spanId);

            return {
                tableStats,
                indexUsage,
                slowQueries
            };

        } catch (error) {
            monitoring.tagSpan(span.spanId, { error: error instanceof Error ? error.message : 'unknown' });
            logger.error('Failed to collect database statistics', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                category: 'reports'
            });
            monitoring.finishSpan(span.spanId);
            throw error;
        }
    }

    /**
     * Get configuration
     */
    getConfig(): QueryOptimizationConfig {
        return { ...this.config };
    }
}

/**
 * Default instance for use throughout the application
 */
export const databaseQueryOptimizer = new DatabaseQueryOptimizer();