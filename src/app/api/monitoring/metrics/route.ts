import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '../../../../middleware/auth.middleware';
import { monitoring } from '../../../../lib/monitoring';
import { performanceMonitor } from '../../../../lib/performance-monitor';
// import { logger } from '../../../../lib/logger';
import { UserRole } from '../../../../types';

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

    // Only admins can access detailed metrics
    if (![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN].includes(authResult.user!.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const metricName = url.searchParams.get('name');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const format = url.searchParams.get('format') || 'json';

    let response;

    if (metricName) {
      // Get specific metric
      const metrics = monitoring.getMetrics(metricName, limit);
      response = {
        success: true,
        data: {
          name: metricName,
          metrics,
          count: metrics.length,
        },
      };
    } else {
      // Get all metrics summary
      const metricNames = monitoring.getMetricNames();
      const performanceSummary = performanceMonitor.getPerformanceSummary();
      const recentPerformance = monitoring.getPerformanceMetrics(10);

      response = {
        success: true,
        data: {
          summary: {
            totalMetrics: metricNames.length,
            performance: performanceSummary,
            recentPerformance,
          },
          availableMetrics: metricNames,
        },
      };
    }

    // Log metrics access
    logger.info('Metrics accessed', {
      userId: authResult.user!.user_id,
      metricName,
      limit,
      format,
    });

    // Handle different response formats
    if (format === 'prometheus') {
      return new NextResponse(formatPrometheusMetrics(response.data), {
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        },
      });
    }

    return NextResponse.json(response);
  } catch {
    logger.error('Failed to fetch metrics', error instanceof Error ? error : undefined);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch metrics',
        },
      },
      { status: 500 }
    );
  }
}

function formatPrometheusMetrics(data: any): string {
  // Convert metrics to Prometheus format
  let output = '';
  
  if (data.summary && data.summary.performance) {
    const perf = data.summary.performance;
    
    output += `# HELP http_requests_total Total number of HTTP requests\n`;
    output += `# TYPE http_requests_total counter\n`;
    output += `http_requests_total ${perf.totalRequests}\n\n`;
    
    output += `# HELP http_requests_active Currently active HTTP requests\n`;
    output += `# TYPE http_requests_active gauge\n`;
    output += `http_requests_active ${perf.activeRequests}\n\n`;
    
    output += `# HELP http_request_duration_ms Average HTTP request duration in milliseconds\n`;
    output += `# TYPE http_request_duration_ms gauge\n`;
    output += `http_request_duration_ms ${perf.avgResponseTime}\n\n`;
    
    output += `# HELP http_error_rate HTTP error rate as percentage\n`;
    output += `# TYPE http_error_rate gauge\n`;
    output += `http_error_rate ${perf.errorRate}\n\n`;
    
    output += `# HELP http_requests_per_minute HTTP requests per minute\n`;
    output += `# TYPE http_requests_per_minute gauge\n`;
    output += `http_requests_per_minute ${perf.requestsPerMinute}\n\n`;
  }
  
  return output;
}