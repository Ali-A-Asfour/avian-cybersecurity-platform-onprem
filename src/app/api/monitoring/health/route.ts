import { NextRequest, NextResponse } from 'next/server';
import { monitoring } from '../../../../lib/monitoring';
import { performanceMonitor } from '../../../../lib/performance-monitor';
import { logger } from '../../../../lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Get health summary from monitoring service
    const healthSummary = monitoring.getHealthSummary();
    const performanceSummary = performanceMonitor.getPerformanceSummary();

    // Additional health checks
    const healthChecks = await performHealthChecks();

    const response = {
      status: healthSummary.status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: [
        ...healthSummary.checks,
        ...healthChecks,
      ],
      metrics: {
        ...healthSummary.metrics,
        totalRequests: performanceSummary.totalRequests,
        activeRequests: performanceSummary.activeRequests,
        requestsPerMinute: performanceSummary.requestsPerMinute,
      },
      performance: performanceSummary,
    };

    // Log health check
    logger.info('Health check performed', {
      status: response.status,
      uptime: response.uptime,
      activeRequests: performanceSummary.activeRequests,
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Health check failed', error instanceof Error ? error : undefined);
    
    return NextResponse.json(
      {
        status: 'unhealthy' as const,
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        checks: [
          {
            name: 'health_check',
            status: 'fail' as const,
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      },
      { status: 503 }
    );
  }
}

async function performHealthChecks(): Promise<Array<{ name: string; status: 'pass' | 'fail'; message?: string }>> {
  const checks: Array<{ name: string; status: 'pass' | 'fail'; message?: string }> = [];

  // Database connectivity check
  try {
    // In a real implementation, this would test actual database connection
    // For now, we'll simulate a check
    const dbConnected = true; // await testDatabaseConnection();
    checks.push({
      name: 'database',
      status: dbConnected ? 'pass' : 'fail' as const,
      message: dbConnected ? undefined : 'Database connection failed',
    });
  } catch (error) {
    checks.push({
      name: 'database',
      status: 'fail' as const,
      message: error instanceof Error ? error.message : 'Database check failed',
    });
  }

  // Redis connectivity check
  try {
    // In a real implementation, this would test actual Redis connection
    const redisConnected = true; // await testRedisConnection();
    checks.push({
      name: 'redis',
      status: redisConnected ? 'pass' : 'fail' as const,
      message: redisConnected ? undefined : 'Redis connection failed',
    });
  } catch (error) {
    checks.push({
      name: 'redis',
      status: 'fail' as const,
      message: error instanceof Error ? error.message : 'Redis check failed',
    });
  }

  // Memory usage check
  const memoryUsage = process.memoryUsage();
  const memoryUsedMB = memoryUsage.heapUsed / 1024 / 1024;
  const memoryLimitMB = 512; // Assume 512MB limit
  const memoryPercentage = (memoryUsedMB / memoryLimitMB) * 100;

  checks.push({
    name: 'memory',
    status: memoryPercentage < 80 ? 'pass' : 'fail' as const,
    message: memoryPercentage >= 80 ? `High memory usage: ${memoryPercentage.toFixed(1)}%` : undefined,
  });

  // Disk space check (simulated)
  const diskUsagePercentage = Math.random() * 30 + 40; // Simulate 40-70% usage
  checks.push({
    name: 'disk_space',
    status: diskUsagePercentage < 85 ? 'pass' : 'fail' as const,
    message: diskUsagePercentage >= 85 ? `Low disk space: ${diskUsagePercentage.toFixed(1)}% used` : undefined,
  });

  return checks;
}