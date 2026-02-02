import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '../../../../middleware/auth.middleware';
import { cache } from '../../../../lib/cache';
import { dbOptimizer } from '../../../../lib/database-optimizer';
import { performanceMonitor } from '../../../../lib/performance-monitor';
import { logger } from '../../../../lib/logger';
import { UserRole } from '../../../../types';

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Only admins can trigger optimizations
    if (![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN].includes(authResult.user!.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, options = {} } = body;

    let result;

    switch (action) {
      case 'clear_cache':
        await cache.clear();
        result = { message: 'Cache cleared successfully' };
        break;

      case 'warm_cache':
        await warmUpCache(options.tenantId);
        result = { message: 'Cache warmed up successfully' };
        break;

      case 'optimize_database':
        await dbOptimizer.createOptimizedIndexes();
        result = { message: 'Database indexes optimized' };
        break;

      case 'analyze_queries':
        const analysis = dbOptimizer.analyzeQueries();
        result = {
          message: 'Query analysis completed',
          analysis,
        };
        break;

      case 'reset_metrics':
        dbOptimizer.clearMetrics();
        performanceMonitor.reset();
        cache.resetStats();
        result = { message: 'Performance metrics reset' };
        break;

      case 'get_recommendations':
        const recommendations = await getPerformanceRecommendations();
        result = {
          message: 'Performance recommendations generated',
          recommendations,
        };
        break;

      default:
        return NextResponse.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid action' } },
          { status: 400 }
        );
    }

    logger.info('Performance optimization executed', {
      action,
      userId: authResult.user!.user_id,
      options,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Performance optimization failed', error instanceof Error ? error : undefined);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Performance optimization failed',
        },
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Only admins can view performance data
    if (![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN].includes(authResult.user!.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    // Get comprehensive performance data
    const performanceData = {
      cache: {
        stats: cache.getStats(),
        info: await cache.getInfo(),
      },
      database: {
        stats: dbOptimizer.getQueryStats(),
        connectionPool: await dbOptimizer.getConnectionPoolStats(),
      },
      system: {
        performance: performanceMonitor.getPerformanceSummary(),
      },
      recommendations: await getPerformanceRecommendations(),
    };

    return NextResponse.json({
      success: true,
      data: performanceData,
    });
  } catch (error) {
    logger.error('Failed to fetch performance data', error instanceof Error ? error : undefined);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch performance data',
        },
      },
      { status: 500 }
    );
  }
}

async function warmUpCache(tenantId?: string): Promise<void> {
  const warmUpData = [];

  // Common dashboard data
  if (tenantId) {
    warmUpData.push(
      { key: `dashboard:${tenantId}`, value: { cached: true }, options: { ttl: 300 } },
      { key: `tickets:summary:${tenantId}`, value: { total: 0, open: 0 }, options: { ttl: 600 } },
      { key: `alerts:summary:${tenantId}`, value: { total: 0, critical: 0 }, options: { ttl: 300 } }
    );
  } else {
    // System-wide cache warm-up
    warmUpData.push(
      { key: 'system:health', value: { status: 'healthy' }, options: { ttl: 60 } },
      { key: 'system:metrics', value: { uptime: Date.now() }, options: { ttl: 300 } }
    );
  }

  await cache.warmUp(warmUpData);
}

async function getPerformanceRecommendations(): Promise<Array<{
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  action?: string;
}>> {
  const recommendations = [];
  
  // Cache recommendations
  const cacheStats = cache.getStats();
  if (cacheStats.hitRate < 0.7) {
    recommendations.push({
      category: 'cache',
      priority: 'high' as const,
      title: 'Low Cache Hit Rate',
      description: `Cache hit rate is ${(cacheStats.hitRate * 100).toFixed(1)}%. Consider increasing TTL or improving cache keys.`,
      action: 'Review caching strategy and increase TTL for stable data',
    });
  }

  // Database recommendations
  const dbStats = dbOptimizer.getQueryStats();
  if (dbStats.slowQueries > 0) {
    recommendations.push({
      category: 'database',
      priority: 'high' as const,
      title: 'Slow Queries Detected',
      description: `Found ${dbStats.slowQueries} slow queries. Consider adding indexes or optimizing queries.`,
      action: 'Run database optimization to create recommended indexes',
    });
  }

  if (dbStats.cacheHitRate < 0.5) {
    recommendations.push({
      category: 'database',
      priority: 'medium' as const,
      title: 'Low Database Cache Hit Rate',
      description: `Database cache hit rate is ${(dbStats.cacheHitRate * 100).toFixed(1)}%. Enable query result caching.`,
      action: 'Enable caching for frequently executed queries',
    });
  }

  // Performance recommendations
  const perfSummary = performanceMonitor.getPerformanceSummary();
  if (perfSummary.avgResponseTime > 1000) {
    recommendations.push({
      category: 'performance',
      priority: 'high' as const,
      title: 'High Response Time',
      description: `Average response time is ${perfSummary.avgResponseTime.toFixed(0)}ms. Consider optimization.`,
      action: 'Investigate slow endpoints and optimize critical paths',
    });
  }

  if (perfSummary.errorRate > 0.05) {
    recommendations.push({
      category: 'performance',
      priority: 'critical' as const,
      title: 'High Error Rate',
      description: `Error rate is ${(perfSummary.errorRate * 100).toFixed(2)}%. Investigate and fix errors.`,
      action: 'Review error logs and fix underlying issues',
    });
  }

  // System recommendations
  if (recommendations.length === 0) {
    recommendations.push({
      category: 'system',
      priority: 'low' as const,
      title: 'System Performance Good',
      description: 'All performance metrics are within acceptable ranges.',
    });
  }

  return recommendations;
}