/**
 * Database Query Optimizer Tests
 * 
 * Tests for optimized database queries with pagination and indexing recommendations.
 */

import { DatabaseQueryOptimizer } from '../DatabaseQueryOptimizer';
import { db } from '@/lib/database';
import { monitoring } from '@/lib/monitoring';
import { EnhancedDateRange } from '@/types/reports';

// Mock dependencies
jest.mock('@/lib/database');
jest.mock('@/lib/monitoring');
jest.mock('@/lib/logger');

const mockDb = db as jest.Mocked<typeof db>;
const mockMonitoring = monitoring as jest.Mocked<typeof monitoring>;

describe('DatabaseQueryOptimizer', () => {
    let optimizer: DatabaseQueryOptimizer;
    let mockDateRange: EnhancedDateRange;
    let createMockQueryBuilder: () => any;

    beforeEach(() => {
        optimizer = new DatabaseQueryOptimizer({
            maxBatchSize: 5000,
            defaultPageSize: 500,
            maxPageSize: 2000,
            queryTimeout: 15000,
            enableQueryPlan: true,
            enableStatistics: true
        });

        mockDateRange = {
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-07'),
            timezone: 'UTC',
            weekStart: 'monday'
        };

        // Reset mocks
        jest.clearAllMocks();

        // Setup default mock implementations
        mockMonitoring.startSpan.mockReturnValue({ spanId: 'test-span' });
        mockMonitoring.finishSpan.mockImplementation(() => { });
        mockMonitoring.tagSpan.mockImplementation(() => { });
        mockMonitoring.recordMetric.mockImplementation(() => { });

        // Mock database query builder with proper chaining
        createMockQueryBuilder = () => ({
            select: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            innerJoin: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            offset: jest.fn().mockResolvedValue([]), // Return empty array by default
        });

        mockDb.select = jest.fn().mockImplementation(() => createMockQueryBuilder());
    });

    describe('getOptimizedAlertHistory', () => {
        it('should execute optimized alert history query with pagination', async () => {
            const mockFirewallResults = [
                {
                    id: 'fw-1',
                    tenantId: 'tenant-123',
                    alertType: 'malware',
                    severity: 'high',
                    createdAt: new Date('2024-01-01T10:00:00Z'),
                    deviceId: 'device-1',
                    acknowledged: false,
                    source: 'firewall'
                }
            ];

            const mockEdrResults = [
                {
                    id: 'edr-1',
                    tenantId: 'tenant-123',
                    alertType: 'threat',
                    severity: 'critical',
                    createdAt: new Date('2024-01-01T11:00:00Z'),
                    deviceId: 'device-2',
                    acknowledged: false,
                    source: 'edr'
                }
            ];

            // Mock the Promise.all results - need to mock the actual query execution
            const mockFirewallQueryBuilder = createMockQueryBuilder();
            mockFirewallQueryBuilder.offset = jest.fn().mockResolvedValue(mockFirewallResults);

            const mockEdrQueryBuilder = createMockQueryBuilder();
            mockEdrQueryBuilder.offset = jest.fn().mockResolvedValue(mockEdrResults);

            // Mock db.select to return different builders for different calls
            mockDb.select
                .mockReturnValueOnce(mockFirewallQueryBuilder)
                .mockReturnValueOnce(mockEdrQueryBuilder);

            // Mock the total count query
            jest.spyOn(optimizer as any, 'getOptimizedTotalCount').mockResolvedValue(150);

            const result = await optimizer.getOptimizedAlertHistory(
                'tenant-123',
                mockDateRange,
                { page: 1, pageSize: 100 }
            );

            expect(result.data).toHaveLength(2); // Combined results
            expect(result.totalCount).toBe(150);
            expect(result.hasMore).toBe(true);
            expect(result.metrics).toMatchObject({
                rowsReturned: 2,
                rowsScanned: 150,
                optimizationApplied: expect.arrayContaining(['pagination', 'index_hints', 'parallel_queries'])
            });
        });

        it('should handle pagination correctly', async () => {
            jest.spyOn(optimizer as any, 'getOptimizedTotalCount').mockResolvedValue(50);

            const mockFirewallQueryBuilder = createMockQueryBuilder();
            mockFirewallQueryBuilder.offset = jest.fn().mockResolvedValue([]);

            const mockEdrQueryBuilder = createMockQueryBuilder();
            mockEdrQueryBuilder.offset = jest.fn().mockResolvedValue([]);

            mockDb.select
                .mockReturnValueOnce(mockFirewallQueryBuilder)
                .mockReturnValueOnce(mockEdrQueryBuilder);

            const result = await optimizer.getOptimizedAlertHistory(
                'tenant-123',
                mockDateRange,
                { page: 2, pageSize: 30 }
            );

            expect(result.hasMore).toBe(false); // 30 + 30 = 60 > 50 total
            expect(result.nextCursor).toBeUndefined();
        });

        it('should enforce maximum page size limits', async () => {
            jest.spyOn(optimizer as any, 'getOptimizedTotalCount').mockResolvedValue(100);

            const mockFirewallQueryBuilder = createMockQueryBuilder();
            mockFirewallQueryBuilder.limit = jest.fn().mockReturnThis();
            mockFirewallQueryBuilder.offset = jest.fn().mockResolvedValue([]);

            const mockEdrQueryBuilder = createMockQueryBuilder();
            mockEdrQueryBuilder.limit = jest.fn().mockReturnThis();
            mockEdrQueryBuilder.offset = jest.fn().mockResolvedValue([]);

            mockDb.select
                .mockReturnValueOnce(mockFirewallQueryBuilder)
                .mockReturnValueOnce(mockEdrQueryBuilder);

            await optimizer.getOptimizedAlertHistory(
                'tenant-123',
                mockDateRange,
                { page: 1, pageSize: 5000 } // Exceeds maxPageSize of 2000
            );

            // Should use maxPageSize instead of requested pageSize
            expect(mockFirewallQueryBuilder.limit).toHaveBeenCalledWith(2000);
            expect(mockEdrQueryBuilder.limit).toHaveBeenCalledWith(2000);
        });

        it('should handle query errors gracefully', async () => {
            const error = new Error('Database connection failed');
            mockDb.select.mockImplementation(() => {
                throw error;
            });

            await expect(optimizer.getOptimizedAlertHistory('tenant-123', mockDateRange))
                .rejects.toThrow('Database connection failed');

            expect(mockMonitoring.tagSpan).toHaveBeenCalledWith('test-span', { error: 'Database connection failed' });
        });
    });

    describe('getOptimizedMetricsHistory', () => {
        it('should execute optimized metrics query with aggregation', async () => {
            const mockResults = [
                {
                    date: '2024-01-01',
                    threatsBlocked: 100,
                    malwareBlocked: 50,
                    ipsBlocked: 25,
                    webFilterHits: 200,
                    blockedConnections: 75,
                    deviceCount: 5
                }
            ];

            const mockQueryBuilder = createMockQueryBuilder();
            mockQueryBuilder.offset = jest.fn().mockResolvedValue(mockResults);

            // Mock total count query
            const mockCountQueryBuilder = createMockQueryBuilder();
            mockCountQueryBuilder.where = jest.fn().mockResolvedValue([{ count: 30 }]);

            mockDb.select.mockReturnValueOnce(mockQueryBuilder).mockReturnValueOnce(mockCountQueryBuilder);

            const result = await optimizer.getOptimizedMetricsHistory(
                'tenant-123',
                mockDateRange,
                'daily',
                { page: 1, pageSize: 50 }
            );

            expect(result.data).toEqual(mockResults);
            expect(result.totalCount).toBe(30);
            expect(result.aggregationSummary).toMatchObject({
                totalThreatsBlocked: 100,
                totalMalwareBlocked: 50,
                avgDeviceCount: 5
            });
            expect(result.metrics.optimizationApplied).toContain('aggregation');
        });

        it('should handle different aggregation levels', async () => {
            const mockQueryBuilder = createMockQueryBuilder();
            mockQueryBuilder.offset = jest.fn().mockResolvedValue([]);

            const mockCountQueryBuilder = createMockQueryBuilder();
            mockCountQueryBuilder.where = jest.fn().mockResolvedValue([{ count: 0 }]);

            mockDb.select.mockReturnValueOnce(mockQueryBuilder).mockReturnValueOnce(mockCountQueryBuilder);

            await optimizer.getOptimizedMetricsHistory('tenant-123', mockDateRange, 'weekly');

            // Should use weekly date grouping
            expect(mockQueryBuilder.groupBy).toHaveBeenCalled();
        });
    });

    describe('getOptimizedVulnerabilityHistory', () => {
        it('should execute optimized vulnerability query with filters', async () => {
            const mockResults = [
                {
                    id: 'vuln-1',
                    cveId: 'CVE-2024-0001',
                    severity: 'critical',
                    cvssScore: 9.8,
                    description: 'Critical vulnerability',
                    detectedAt: new Date('2024-01-01'),
                    deviceId: 'device-1',
                    deviceName: 'Test Device'
                }
            ];

            const mockSeverityResults = [
                { severity: 'critical', count: 5 },
                { severity: 'high', count: 10 }
            ];

            const mockQueryBuilder = createMockQueryBuilder();
            mockQueryBuilder.offset = jest.fn().mockResolvedValue(mockResults);

            const mockSeverityQueryBuilder = createMockQueryBuilder();
            mockSeverityQueryBuilder.groupBy = jest.fn().mockResolvedValue(mockSeverityResults);

            const mockCountQueryBuilder = createMockQueryBuilder();
            mockCountQueryBuilder.where = jest.fn().mockResolvedValue([{ count: 25 }]);

            mockDb.select
                .mockReturnValueOnce(mockQueryBuilder)
                .mockReturnValueOnce(mockSeverityQueryBuilder)
                .mockReturnValueOnce(mockCountQueryBuilder);

            const result = await optimizer.getOptimizedVulnerabilityHistory(
                'tenant-123',
                mockDateRange,
                {
                    severity: ['critical', 'high'],
                    deviceIds: ['device-1', 'device-2']
                },
                { page: 1, pageSize: 20 }
            );

            expect(result.data).toEqual(mockResults);
            expect(result.severityBreakdown).toEqual({
                critical: 5,
                high: 10
            });
            expect(result.totalCount).toBe(25);
            expect(result.metrics.optimizationApplied).toContain('filtered_joins');
        });

        it('should handle empty filters', async () => {
            const mockQueryBuilder = createMockQueryBuilder();
            mockQueryBuilder.offset = jest.fn().mockResolvedValue([]);

            const mockSeverityQueryBuilder = createMockQueryBuilder();
            mockSeverityQueryBuilder.groupBy = jest.fn().mockResolvedValue([]);

            const mockCountQueryBuilder = createMockQueryBuilder();
            mockCountQueryBuilder.where = jest.fn().mockResolvedValue([{ count: 0 }]);

            mockDb.select
                .mockReturnValueOnce(mockQueryBuilder)
                .mockReturnValueOnce(mockSeverityQueryBuilder)
                .mockReturnValueOnce(mockCountQueryBuilder);

            const result = await optimizer.getOptimizedVulnerabilityHistory(
                'tenant-123',
                mockDateRange,
                {}, // No filters
                { page: 1, pageSize: 20 }
            );

            expect(result.data).toEqual([]);
            expect(result.severityBreakdown).toEqual({});
        });
    });

    describe('generateIndexingRecommendations', () => {
        it('should generate comprehensive indexing recommendations', async () => {
            const recommendations = await optimizer.generateIndexingRecommendations('tenant-123');

            expect(recommendations).toHaveLength(12); // Updated expected number of recommendations

            // Check high priority recommendations
            const highPriorityRecs = recommendations.filter(r => r.priority === 1);
            expect(highPriorityRecs.length).toBeGreaterThan(0);

            // Check that recommendations include essential indexes
            const tableNames = recommendations.map(r => r.tableName);
            expect(tableNames).toContain('firewall_alerts');
            expect(tableNames).toContain('edr_alerts');
            expect(tableNames).toContain('firewall_metrics_rollup');
            expect(tableNames).toContain('report_snapshots');

            // Check SQL commands are provided
            recommendations.forEach(rec => {
                expect(rec.sqlCommand).toMatch(/CREATE INDEX/);
                expect(rec.reason).toBeTruthy();
                expect(['high', 'medium', 'low']).toContain(rec.estimatedImpact);
            });
        });

        it('should sort recommendations by priority', async () => {
            const recommendations = await optimizer.generateIndexingRecommendations();

            for (let i = 1; i < recommendations.length; i++) {
                expect(recommendations[i].priority).toBeGreaterThanOrEqual(recommendations[i - 1].priority);
            }
        });

        it('should handle errors gracefully', async () => {
            // Mock analyzer to throw error
            jest.spyOn(optimizer as any, 'analyzeQueryPatterns').mockImplementation(() => {
                throw new Error('Analysis failed');
            });

            const recommendations = await optimizer.generateIndexingRecommendations();

            // Should still return basic recommendations even if analysis fails
            expect(Array.isArray(recommendations)).toBe(true);
        });
    });

    describe('query performance tracking', () => {
        it('should record query metrics', async () => {
            jest.spyOn(optimizer as any, 'getOptimizedTotalCount').mockResolvedValue(10);

            const mockFirewallQueryBuilder = createMockQueryBuilder();
            mockFirewallQueryBuilder.offset = jest.fn().mockResolvedValue([]);

            const mockEdrQueryBuilder = createMockQueryBuilder();
            mockEdrQueryBuilder.offset = jest.fn().mockResolvedValue([]);

            mockDb.select
                .mockReturnValueOnce(mockFirewallQueryBuilder)
                .mockReturnValueOnce(mockEdrQueryBuilder);

            await optimizer.getOptimizedAlertHistory('tenant-123', mockDateRange);

            const stats = optimizer.getQueryPerformanceStats();
            expect(stats.totalQueries).toBe(1);
            expect(stats.averageExecutionTime).toBeGreaterThanOrEqual(0);
        });

        it('should analyze query patterns', async () => {
            // Execute multiple queries to build patterns
            jest.spyOn(optimizer as any, 'getOptimizedTotalCount').mockResolvedValue(10);

            // Mock multiple query builders for multiple calls
            const mockFirewallQueryBuilder1 = createMockQueryBuilder();
            mockFirewallQueryBuilder1.offset = jest.fn().mockResolvedValue([]);
            const mockEdrQueryBuilder1 = createMockQueryBuilder();
            mockEdrQueryBuilder1.offset = jest.fn().mockResolvedValue([]);

            const mockFirewallQueryBuilder2 = createMockQueryBuilder();
            mockFirewallQueryBuilder2.offset = jest.fn().mockResolvedValue([]);
            const mockEdrQueryBuilder2 = createMockQueryBuilder();
            mockEdrQueryBuilder2.offset = jest.fn().mockResolvedValue([]);

            mockDb.select
                .mockReturnValueOnce(mockFirewallQueryBuilder1)
                .mockReturnValueOnce(mockEdrQueryBuilder1)
                .mockReturnValueOnce(mockFirewallQueryBuilder2)
                .mockReturnValueOnce(mockEdrQueryBuilder2);

            // Execute same query type multiple times
            await optimizer.getOptimizedAlertHistory('tenant-123', mockDateRange);
            await optimizer.getOptimizedAlertHistory('tenant-456', mockDateRange);

            const stats = optimizer.getQueryPerformanceStats();
            expect(stats.queryPatterns).toHaveProperty('alert_history');
            expect(stats.queryPatterns.alert_history).toBe(2);
        });

        it('should clear query metrics', () => {
            optimizer.clearQueryMetrics();
            const stats = optimizer.getQueryPerformanceStats();
            expect(stats.totalQueries).toBe(0);
        });
    });

    describe('configuration', () => {
        it('should return current configuration', () => {
            const config = optimizer.getConfig();
            expect(config).toMatchObject({
                maxBatchSize: 5000,
                defaultPageSize: 500,
                maxPageSize: 2000,
                queryTimeout: 15000,
                enableQueryPlan: true,
                enableStatistics: true
            });
        });

        it('should use default configuration when not provided', () => {
            const defaultOptimizer = new DatabaseQueryOptimizer();
            const config = defaultOptimizer.getConfig();

            expect(config.maxBatchSize).toBe(10000);
            expect(config.defaultPageSize).toBe(1000);
            expect(config.maxPageSize).toBe(5000);
        });
    });

    describe('advanced optimization features', () => {
        it('should optimize query execution plans', async () => {
            // Mock database execute for EXPLAIN queries
            const mockExplainResult = [{
                'QUERY PLAN': [{
                    'Total Cost': 1500.50,
                    'Actual Total Time': 250.75
                }]
            }];

            mockDb.execute = jest.fn().mockResolvedValue(mockExplainResult);

            const result = await optimizer.optimizeQueryPlan(
                'SELECT * FROM firewall_alerts WHERE tenant_id = $1',
                ['tenant-123']
            );

            expect(result.originalCost).toBe(1500.50);
            expect(result.recommendations).toContain('Consider adding indexes for high-cost operations');
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                    queryChunks: expect.arrayContaining([
                        expect.objectContaining({
                            value: expect.arrayContaining([
                                expect.stringContaining('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)')
                            ])
                        })
                    ])
                })
            );
        });

        it('should handle query plan optimization errors gracefully', async () => {
            mockDb.execute = jest.fn().mockRejectedValue(new Error('EXPLAIN failed'));

            const result = await optimizer.optimizeQueryPlan('SELECT 1');

            expect(result.originalCost).toBe(0);
            expect(result.optimizedCost).toBe(0);
            expect(result.recommendations).toContain('Query plan optimization failed');
        });

        it('should batch optimize multiple queries', async () => {
            jest.spyOn(optimizer, 'getOptimizedAlertHistory').mockResolvedValue({
                data: [],
                totalCount: 0,
                hasMore: false,
                metrics: {
                    queryId: 'test',
                    executionTime: 100,
                    rowsReturned: 0,
                    rowsScanned: 0,
                    indexesUsed: [],
                    cacheHit: false,
                    optimizationApplied: []
                }
            });

            jest.spyOn(optimizer, 'getOptimizedMetricsHistory').mockResolvedValue({
                data: [],
                totalCount: 0,
                hasMore: false,
                aggregationSummary: {},
                metrics: {
                    queryId: 'test',
                    executionTime: 100,
                    rowsReturned: 0,
                    rowsScanned: 0,
                    indexesUsed: [],
                    cacheHit: false,
                    optimizationApplied: []
                }
            });

            const queries = [
                {
                    tenantId: 'tenant-123',
                    queryType: 'alerts' as const,
                    dateRange: mockDateRange
                },
                {
                    tenantId: 'tenant-123',
                    queryType: 'metrics' as const,
                    dateRange: mockDateRange
                }
            ];

            const result = await optimizer.batchOptimizeQueries(queries);

            expect(result.results).toHaveLength(2);
            expect(result.totalExecutionTime).toBeGreaterThanOrEqual(0);
            expect(result.batchOptimizations).toContain('Batched 1 alerts queries');
            expect(result.batchOptimizations).toContain('Batched 1 metrics queries');
        });

        it('should collect database statistics', async () => {
            const mockTableStats = [
                {
                    tablename: 'firewall_alerts',
                    row_count: '1000',
                    table_size: '10 MB',
                    index_size: '2 MB',
                    last_analyze: '2024-01-01T10:00:00Z'
                }
            ];

            const mockIndexUsage = [
                {
                    index_name: 'idx_firewall_alerts_tenant',
                    table_name: 'firewall_alerts',
                    scans_count: '500',
                    tuples_read: '1000',
                    tuples_returned: '800'
                }
            ];

            mockDb.execute = jest.fn()
                .mockResolvedValueOnce({ rows: mockTableStats })
                .mockResolvedValueOnce({ rows: mockIndexUsage })
                .mockRejectedValueOnce(new Error('pg_stat_statements not available'));

            const result = await optimizer.getDatabaseStatistics('tenant-123');

            expect(result.tableStats).toHaveProperty('firewall_alerts');
            expect(result.tableStats.firewall_alerts.rowCount).toBe(1000);
            expect(result.indexUsage).toHaveProperty('idx_firewall_alerts_tenant');
            expect(result.slowQueries).toEqual([]); // Should be empty due to pg_stat_statements error
        });
    });

    describe('error handling', () => {
        it('should handle database connection errors', async () => {
            const error = new Error('Connection timeout');
            mockDb.select.mockImplementation(() => {
                throw error;
            });

            await expect(optimizer.getOptimizedAlertHistory('tenant-123', mockDateRange))
                .rejects.toThrow('Connection timeout');

            expect(mockMonitoring.tagSpan).toHaveBeenCalledWith('test-span', { error: 'Connection timeout' });
        });

        it('should handle invalid pagination parameters', async () => {
            jest.spyOn(optimizer as any, 'getOptimizedTotalCount').mockResolvedValue(100);

            const mockFirewallQueryBuilder = createMockQueryBuilder();
            mockFirewallQueryBuilder.offset = jest.fn().mockResolvedValue([]);

            const mockEdrQueryBuilder = createMockQueryBuilder();
            mockEdrQueryBuilder.offset = jest.fn().mockResolvedValue([]);

            mockDb.select
                .mockReturnValueOnce(mockFirewallQueryBuilder)
                .mockReturnValueOnce(mockEdrQueryBuilder);

            // Test with negative page number
            const result = await optimizer.getOptimizedAlertHistory(
                'tenant-123',
                mockDateRange,
                { page: -1, pageSize: 50 }
            );

            // Should handle gracefully and use page 1
            expect(result).toBeDefined();
        });

        it('should handle batch optimization errors', async () => {
            jest.spyOn(optimizer, 'getOptimizedAlertHistory').mockRejectedValue(new Error('Query failed'));

            const queries = [{
                tenantId: 'tenant-123',
                queryType: 'alerts' as const,
                dateRange: mockDateRange
            }];

            await expect(optimizer.batchOptimizeQueries(queries))
                .rejects.toThrow('Query failed');
        });
    });
});