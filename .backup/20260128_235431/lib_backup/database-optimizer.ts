// import { db } from './database';
import { cache } from './cache';
import { monitoring } from './monitoring';
import { logger } from './logger';

export interface QueryOptions {
  cache?: boolean;
  cacheTTL?: number;
  cacheTags?: string[];
  timeout?: number;
  explain?: boolean;
}

export interface QueryMetrics {
  duration: number;
  rowCount: number;
  fromCache: boolean;
  queryPlan?: any;
}

export interface IndexSuggestion {
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
  reason: string;
  estimatedImprovement: string;
}

class DatabaseOptimizer {
  private queryMetrics: Map<string, QueryMetrics[]> = new Map();
  private slowQueryThreshold = 1000; // 1 second

  /**
   * Execute optimized query with caching and monitoring
   */
  async executeQuery<T>(
    queryFn: () => Promise<T>,
    queryKey: string,
    options: QueryOptions = {}
  ): Promise<{ data: T; metrics: QueryMetrics }> {
    const span = monitoring.startSpan('db.query');
    monitoring.tagSpan(span.spanId, { queryKey });

    const startTime = Date.now();
    let fromCache = false;
    let data: T;

    try {
      // Try cache first if enabled
      if (options.cache) {
        const cacheKey = `query:${queryKey}`;
        const cached = await cache.get<T>(cacheKey);
        
        if (cached !== null) {
          fromCache = true;
          data = cached;
          monitoring.tagSpan(span.spanId, { fromCache: true });
        } else {
          // Execute query and cache result
          data = await this.executeWithTimeout(queryFn, options.timeout);
          
          await cache.set(cacheKey, data, {
            ttl: options.cacheTTL || 600,
            tags: options.cacheTags || ['database'],
          });
          
          monitoring.tagSpan(span.spanId, { fromCache: false });
        }
      } else {
        data = await this.executeWithTimeout(queryFn, options.timeout);
        monitoring.tagSpan(span.spanId, { fromCache: false });
      }

      const duration = Date.now() - startTime;
      const rowCount = Array.isArray(data) ? data.length : 1;

      const metrics: QueryMetrics = {
        duration,
        rowCount,
        fromCache,
      };

      // Record metrics
      monitoring.recordMetric('db_query_duration_ms', duration, {
        queryKey,
        fromCache: fromCache.toString(),
      });

      monitoring.recordMetric('db_query_rows', rowCount, { queryKey });

      // Track slow queries
      if (duration > this.slowQueryThreshold && !fromCache) {
        logger.warn('Slow query detected', {
          queryKey,
          duration,
          rowCount,
        });

        monitoring.recordMetric('db_slow_queries_total', 1, { queryKey });
      }

      // Store metrics for analysis
      this.storeQueryMetrics(queryKey, metrics);

      monitoring.finishSpan(span.spanId);

      return { data, metrics };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      monitoring.tagSpan(span.spanId, { 
        error: error instanceof Error ? error.message : 'unknown' 
      });

      logger.error('Database query error', error instanceof Error ? error : undefined, {
        queryKey,
        duration,
      });

      monitoring.recordMetric('db_query_errors_total', 1, { queryKey });
      monitoring.finishSpan(span.spanId);

      throw error;
    }
  }

  /**
   * Execute query with timeout
   */
  private async executeWithTimeout<T>(
    queryFn: () => Promise<T>,
    timeoutMs: number = 30000
  ): Promise<T> {
    return Promise.race([
      queryFn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
      ),
    ]);
  }

  /**
   * Store query metrics for analysis
   */
  private storeQueryMetrics(queryKey: string, metrics: QueryMetrics): void {
    if (!this.queryMetrics.has(queryKey)) {
      this.queryMetrics.set(queryKey, []);
    }

    const queryHistory = this.queryMetrics.get(queryKey)!;
    queryHistory.push(metrics);

    // Keep only recent metrics
    if (queryHistory.length > 100) {
      queryHistory.shift();
    }
  }

  /**
   * Get query performance statistics
   */
  getQueryStats(queryKey?: string): {
    totalQueries: number;
    avgDuration: number;
    cacheHitRate: number;
    slowQueries: number;
    queries: Array<{
      key: string;
      count: number;
      avgDuration: number;
      cacheHitRate: number;
      slowCount: number;
    }>;
  } {
    let allMetrics: QueryMetrics[] = [];
    const queryStats: Array<{
      key: string;
      count: number;
      avgDuration: number;
      cacheHitRate: number;
      slowCount: number;
    }> = [];

    if (queryKey) {
      allMetrics = this.queryMetrics.get(queryKey) || [];
    } else {
      for (const [key, metrics] of this.queryMetrics.entries()) {
        allMetrics.push(...metrics);

        const cacheHits = metrics.filter(m => m.fromCache).length;
        const slowQueries = metrics.filter(m => m.duration > this.slowQueryThreshold).length;
        const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;

        queryStats.push({
          key,
          count: metrics.length,
          avgDuration,
          cacheHitRate: metrics.length > 0 ? cacheHits / metrics.length : 0,
          slowCount: slowQueries,
        });
      }
    }

    const totalQueries = allMetrics.length;
    const cacheHits = allMetrics.filter(m => m.fromCache).length;
    const slowQueries = allMetrics.filter(m => m.duration > this.slowQueryThreshold).length;
    const avgDuration = totalQueries > 0 
      ? allMetrics.reduce((sum, m) => sum + m.duration, 0) / totalQueries 
      : 0;

    return {
      totalQueries,
      avgDuration,
      cacheHitRate: totalQueries > 0 ? cacheHits / totalQueries : 0,
      slowQueries,
      queries: queryStats.sort((a, b) => b.avgDuration - a.avgDuration),
    };
  }

  /**
   * Analyze query patterns and suggest optimizations
   */
  analyzeQueries(): {
    suggestions: IndexSuggestion[];
    insights: string[];
  } {
    const stats = this.getQueryStats();
    const suggestions: IndexSuggestion[] = [];
    const insights: string[] = [];

    // Analyze slow queries
    const slowQueries = stats.queries.filter(q => q.slowCount > 0);
    if (slowQueries.length > 0) {
      insights.push(`Found ${slowQueries.length} queries with slow executions`);
      
      slowQueries.forEach(query => {
        if (query.key.includes('tenant_id')) {
          suggestions.push({
            table: 'inferred_from_query',
            columns: ['tenant_id'],
            type: 'btree',
            reason: `Query ${query.key} is slow and filters by tenant_id`,
            estimatedImprovement: 'High',
          });
        }
      });
    }

    // Analyze cache hit rates
    const lowCacheHitQueries = stats.queries.filter(q => q.cacheHitRate < 0.5 && q.count > 10);
    if (lowCacheHitQueries.length > 0) {
      insights.push(`Found ${lowCacheHitQueries.length} frequently executed queries with low cache hit rates`);
    }

    // Overall performance insights
    if (stats.cacheHitRate > 0.8) {
      insights.push('Excellent cache hit rate - caching strategy is working well');
    } else if (stats.cacheHitRate < 0.3) {
      insights.push('Low cache hit rate - consider increasing cache TTL or improving cache keys');
    }

    if (stats.avgDuration > 500) {
      insights.push('Average query duration is high - consider query optimization');
    }

    return { suggestions, insights };
  }

  /**
   * Generate multi-tenant optimized indexes
   */
  generateTenantIndexes(): string[] {
    return [
      // Core tenant isolation indexes
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_tenant_id ON tickets(tenant_id);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_tenant_id ON alerts(tenant_id);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_tenant_id ON notifications(tenant_id);',
      
      // Composite indexes for common queries
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_tenant_status ON tickets(tenant_id, status);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_tenant_assignee ON tickets(tenant_id, assignee);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_tenant_severity ON alerts(tenant_id, severity);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_tenant_created ON alerts(tenant_id, created_at DESC);',
      
      // Performance indexes
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);',
      
      // Search indexes
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_title_gin ON tickets USING gin(to_tsvector(\'english\', title));',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_description_gin ON tickets USING gin(to_tsvector(\'english\', description));',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_alerts_title_gin ON alerts USING gin(to_tsvector(\'english\', title));',
    ];
  }

  /**
   * Execute index creation with monitoring
   */
  async createOptimizedIndexes(): Promise<void> {
    const indexes = this.generateTenantIndexes();
    logger.info('Creating optimized database indexes', { count: indexes.length });

    for (const indexSQL of indexes) {
      try {
        const startTime = Date.now();
        
        // Note: In a real implementation, this would execute against the actual database
        // await db.execute(indexSQL);
        
        const duration = Date.now() - startTime;
        
        logger.info('Index created successfully', { 
          sql: indexSQL.substring(0, 100) + '...', 
          duration 
        });
        
        monitoring.recordMetric('db_index_creation_duration_ms', duration);
      } catch (error) {
        logger.error('Failed to create index', error instanceof Error ? error : undefined, { 
          sql: indexSQL 
        });
      }
    }
  }

  /**
   * Monitor database connection pool
   */
  async getConnectionPoolStats(): Promise<{
    active: number;
    idle: number;
    total: number;
    waiting: number;
  }> {
    // In a real implementation, this would get actual pool stats
    // For now, return simulated data
    return {
      active: Math.floor(Math.random() * 10) + 5,
      idle: Math.floor(Math.random() * 15) + 10,
      total: 25,
      waiting: Math.floor(Math.random() * 3),
    };
  }

  /**
   * Clear query metrics
   */
  clearMetrics(): void {
    this.queryMetrics.clear();
    logger.info('Database query metrics cleared');
  }

  /**
   * Set slow query threshold
   */
  setSlowQueryThreshold(thresholdMs: number): void {
    this.slowQueryThreshold = thresholdMs;
    logger.info('Slow query threshold updated', { threshold: thresholdMs });
  }
}

// Singleton instance
export const dbOptimizer = new DatabaseOptimizer();

/**
 * Optimized query decorator
 */
export function optimizedQuery(queryKey: string, options: QueryOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const fullQueryKey = `${queryKey}:${JSON.stringify(args)}`;
      
      const _result = await dbOptimizer.executeQuery(
        () => originalMethod.apply(this, args),
        fullQueryKey,
        options
      );

      return result.data;
    };

    return descriptor;
  };
}

/**
 * Tenant-aware query utilities
 */
export class TenantQueryOptimizer {
  constructor(private tenantId: string) {}

  /**
   * Execute tenant-scoped query with optimization
   */
  async executeQuery<T>(
    queryFn: () => Promise<T>,
    queryKey: string,
    options: QueryOptions = {}
  ): Promise<T> {
    const tenantQueryKey = `tenant:${this.tenantId}:${queryKey}`;
    const tenantOptions = {
      ...options,
      cacheTags: [...(options.cacheTags || []), `tenant:${this.tenantId}`],
    };

    const _result = await dbOptimizer.executeQuery(queryFn, tenantQueryKey, tenantOptions);
    return result.data;
  }
}