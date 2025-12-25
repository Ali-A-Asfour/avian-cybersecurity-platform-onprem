// Use Web Performance API for Edge Runtime compatibility
const getPerformance = () => {
  if (typeof performance !== 'undefined') {
    return performance;
  }
  // Fallback for environments without performance API
  return {
    now: () => Date.now(),
    mark: () => {},
    measure: () => {},
  };
};

export interface MetricData {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
  unit?: string;
}

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: Array<{
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    fields?: Record<string, any>;
  }>;
}

export interface PerformanceMetrics {
  requestCount: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
  memoryUsage: number;
  cpuUsage: number;
}

class MonitoringService {
  private metrics: Map<string, MetricData[]> = new Map();
  private traces: Map<string, TraceSpan> = new Map();
  private activeSpans: Map<string, TraceSpan> = new Map();
  private performanceData: PerformanceMetrics[] = [];
  private maxMetricsHistory = 1000;
  private maxTraceHistory = 500;

  /**
   * Record a metric value
   */
  recordMetric(name: string, value: number, labels?: Record<string, string>, unit?: string): void {
    const metric: MetricData = {
      name,
      value,
      timestamp: Date.now(),
      labels,
      unit,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricHistory = this.metrics.get(name)!;
    metricHistory.push(metric);

    // Keep only recent metrics
    if (metricHistory.length > this.maxMetricsHistory) {
      metricHistory.shift();
    }
  }

  /**
   * Start a new trace span
   */
  startSpan(operationName: string, parentSpanId?: string): TraceSpan {
    const traceId = parentSpanId ? 
      this.activeSpans.get(parentSpanId)?.traceId || this.generateId() : 
      this.generateId();
    const spanId = this.generateId();

    const span: TraceSpan = {
      traceId,
      spanId,
      parentSpanId,
      operationName,
      startTime: getPerformance().now(),
      tags: {},
      logs: [],
    };

    this.activeSpans.set(spanId, span);
    return span;
  }

  /**
   * Finish a trace span
   */
  finishSpan(spanId: string, tags?: Record<string, any>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = getPerformance().now();
    span.duration = span.endTime - span.startTime;
    
    if (tags) {
      span.tags = { ...span.tags, ...tags };
    }

    this.traces.set(spanId, span);
    this.activeSpans.delete(spanId);

    // Keep only recent traces
    if (this.traces.size > this.maxTraceHistory) {
      const oldestKey = this.traces.keys().next().value;
      if (oldestKey) {
        this.traces.delete(oldestKey);
      }
    }
  }

  /**
   * Add a log entry to a span
   */
  logToSpan(spanId: string, level: 'info' | 'warn' | 'error' | 'debug', message: string, fields?: Record<string, any>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.logs.push({
      timestamp: getPerformance().now(),
      level,
      message,
      fields,
    });
  }

  /**
   * Add tags to a span
   */
  tagSpan(spanId: string, tags: Record<string, any>): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.tags = { ...span.tags, ...tags };
    }
  }

  /**
   * Get metrics by name
   */
  getMetrics(name: string, limit?: number): MetricData[] {
    const metrics = this.metrics.get(name) || [];
    return limit ? metrics.slice(-limit) : metrics;
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Get traces by operation name
   */
  getTraces(operationName?: string, limit?: number): TraceSpan[] {
    let traces = Array.from(this.traces.values());
    
    if (operationName) {
      traces = traces.filter(trace => trace.operationName === operationName);
    }

    traces.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
    return limit ? traces.slice(0, limit) : traces;
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): TraceSpan[] {
    return Array.from(this.traces.values()).filter(span => span.traceId === traceId);
  }

  /**
   * Record performance metrics
   */
  recordPerformanceMetrics(metrics: PerformanceMetrics): void {
    this.performanceData.push({
      ...metrics,
    });

    // Keep only recent performance data
    if (this.performanceData.length > 100) {
      this.performanceData.shift();
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(limit?: number): PerformanceMetrics[] {
    return limit ? this.performanceData.slice(-limit) : this.performanceData;
  }

  /**
   * Get system health summary
   */
  getHealthSummary(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: {
      avgResponseTime: number;
      errorRate: number;
      throughput: number;
      memoryUsage: number;
    };
    checks: Array<{
      name: string;
      status: 'pass' | 'fail';
      message?: string;
    }>;
  } {
    const recentMetrics = this.getPerformanceMetrics(10);
    
    if (recentMetrics.length === 0) {
      return {
        status: 'healthy',
        metrics: {
          avgResponseTime: 0,
          errorRate: 0,
          throughput: 0,
          memoryUsage: 0,
        },
        checks: [
          { name: 'metrics_collection', status: 'pass' },
        ],
      };
    }

    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length;
    const avgErrorRate = recentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / recentMetrics.length;
    const avgThroughput = recentMetrics.reduce((sum, m) => sum + m.throughput, 0) / recentMetrics.length;
    const avgMemoryUsage = recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length;

    const checks: Array<{
      name: string;
      status: 'pass' | 'fail';
      message?: string;
    }> = [
      {
        name: 'response_time',
        status: avgResponseTime < 1000 ? 'pass' : 'fail',
        message: avgResponseTime >= 1000 ? `High response time: ${avgResponseTime.toFixed(2)}ms` : undefined,
      },
      {
        name: 'error_rate',
        status: avgErrorRate < 0.05 ? 'pass' : 'fail',
        message: avgErrorRate >= 0.05 ? `High error rate: ${(avgErrorRate * 100).toFixed(2)}%` : undefined,
      },
      {
        name: 'memory_usage',
        status: avgMemoryUsage < 0.8 ? 'pass' : 'fail',
        message: avgMemoryUsage >= 0.8 ? `High memory usage: ${(avgMemoryUsage * 100).toFixed(2)}%` : undefined,
      },
    ];

    const failedChecks = checks.filter(check => check.status === 'fail').length;
    const status = failedChecks === 0 ? 'healthy' : failedChecks <= 1 ? 'degraded' : 'unhealthy';

    return {
      status,
      metrics: {
        avgResponseTime,
        errorRate: avgErrorRate,
        throughput: avgThroughput,
        memoryUsage: avgMemoryUsage,
      },
      checks,
    };
  }

  /**
   * Clear all metrics and traces
   */
  clear(): void {
    this.metrics.clear();
    this.traces.clear();
    this.activeSpans.clear();
    this.performanceData = [];
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}

// Singleton instance
export const monitoring = new MonitoringService();

/**
 * Decorator for automatic method tracing
 */
export function trace(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const traceName = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const span = monitoring.startSpan(traceName);
      
      try {
        monitoring.tagSpan(span.spanId, {
          method: propertyKey,
          class: target.constructor.name,
        });

        const _result = await originalMethod.apply(this, args);
        
        monitoring.tagSpan(span.spanId, { success: true });
        monitoring.finishSpan(span.spanId);
        
        return result;
      } catch {
        monitoring.tagSpan(span.spanId, { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        monitoring.logToSpan(span.spanId, 'error', 'Method execution failed', { error });
        monitoring.finishSpan(span.spanId);
        
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Middleware for request tracing
 */
export function createRequestTracer() {
  return (req: any, res: any, next: any) => {
    const span = monitoring.startSpan(`HTTP ${req.method} ${req.path}`);
    const startTime = getPerformance().now();

    monitoring.tagSpan(span.spanId, {
      'http.method': req.method,
      'http.url': req.url,
      'http.path': req.path,
      'user.agent': req.headers['user-agent'],
    });

    // Override res.end to capture response metrics
    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      const endTime = getPerformance().now();
      const duration = endTime - startTime;

      monitoring.tagSpan(span.spanId, {
        'http.status_code': res.statusCode,
        'response.time_ms': duration,
      });

      monitoring.recordMetric('http_requests_total', 1, {
        method: req.method,
        status: res.statusCode.toString(),
        path: req.path,
      });

      monitoring.recordMetric('http_request_duration_ms', duration, {
        method: req.method,
        path: req.path,
      });

      monitoring.finishSpan(span.spanId);
      originalEnd.apply(res, args);
    };

    next();
  };
}