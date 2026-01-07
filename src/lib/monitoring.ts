/**
 * Monitoring and Metrics Collection Service
 * 
 * Provides metrics collection, error tracking, and performance monitoring
 * for the AVIAN platform.
 */

import { getClient } from './database';

// Metric types
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  TIMER = 'timer',
}

// Metric categories
export enum MetricCategory {
  HTTP = 'http',
  DATABASE = 'database',
  REDIS = 'redis',
  AUTH = 'auth',
  EMAIL = 'email',
  BUSINESS = 'business',
}

interface Metric {
  name: string;
  type: MetricType;
  category: MetricCategory;
  value: number;
  tags?: Record<string, string>;
  timestamp: Date;
}

interface ErrorEvent {
  error: Error;
  context?: Record<string, any>;
  userId?: string;
  tenantId?: string;
  requestId?: string;
}

interface PerformanceEvent {
  operation: string;
  duration: number;
  category: MetricCategory;
  metadata?: Record<string, any>;
}

/**
 * Monitoring Service
 * 
 * Collects metrics, tracks errors, and monitors performance.
 * In production, this would integrate with services like:
 * - Prometheus for metrics
 * - Sentry for error tracking
 * - Grafana for visualization
 */
export class MonitoringService {
  private static instance: MonitoringService;
  private metrics: Metric[] = [];
  private readonly BATCH_SIZE = 100;
  private readonly FLUSH_INTERVAL = 60000; // 1 minute
  private flushTimer?: NodeJS.Timeout;

  private constructor() {
    // Start periodic flush
    this.startPeriodicFlush();
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Record a counter metric (increments)
   */
  counter(
    name: string,
    category: MetricCategory,
    value: number = 1,
    tags?: Record<string, string>
  ): void {
    this.recordMetric({
      name,
      type: MetricType.COUNTER,
      category,
      value,
      tags,
      timestamp: new Date(),
    });
  }

  /**
   * Record a gauge metric (current value)
   */
  gauge(
    name: string,
    category: MetricCategory,
    value: number,
    tags?: Record<string, string>
  ): void {
    this.recordMetric({
      name,
      type: MetricType.GAUGE,
      category,
      value,
      tags,
      timestamp: new Date(),
    });
  }

  /**
   * Record a histogram metric (distribution)
   */
  histogram(
    name: string,
    category: MetricCategory,
    value: number,
    tags?: Record<string, string>
  ): void {
    this.recordMetric({
      name,
      type: MetricType.HISTOGRAM,
      category,
      value,
      tags,
      timestamp: new Date(),
    });
  }

  /**
   * Record a timer metric (duration in milliseconds)
   */
  timer(
    name: string,
    category: MetricCategory,
    duration: number,
    tags?: Record<string, string>
  ): void {
    this.recordMetric({
      name,
      type: MetricType.TIMER,
      category,
      value: duration,
      tags,
      timestamp: new Date(),
    });
  }

  /**
   * Track an error event
   */
  async trackError(event: ErrorEvent): Promise<void> {
    const { error, context, userId, tenantId, requestId } = event;

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error tracked:', {
        message: error.message,
        stack: error.stack,
        context,
        userId,
        tenantId,
        requestId,
      });
    }

    // Record error metric
    this.counter('errors.total', MetricCategory.BUSINESS, 1, {
      error_type: error.name,
      user_id: userId || 'anonymous',
      tenant_id: tenantId || 'none',
    });

    // Store error in database for analysis
    try {
      const client = await getClient();
      
      // Verify client is properly initialized
      if (!client || typeof client !== 'function') {
        throw new Error('Database client not properly initialized');
      }
      
      await client`
        INSERT INTO error_tracking (
          error_type,
          error_message,
          error_stack,
          context,
          user_id,
          tenant_id,
          request_id,
          created_at
        ) VALUES (
          ${error.name},
          ${error.message},
          ${error.stack || null},
          ${JSON.stringify(context || {})},
          ${userId || null},
          ${tenantId || null},
          ${requestId || null},
          NOW()
        )
      `;
    } catch (dbError) {
      // Silently fail - don't let error tracking break the application
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to store error in database:', dbError);
      }
    }
  }

  /**
   * Track a performance event
   */
  trackPerformance(event: PerformanceEvent): void {
    const { operation, duration, category, metadata } = event;

    // Record timer metric
    this.timer(`performance.${operation}`, category, duration, {
      operation,
      ...metadata,
    });

    // Log slow operations
    const slowThreshold = this.getSlowThreshold(category);
    if (duration > slowThreshold) {
      console.warn(`Slow operation detected: ${operation} took ${duration}ms`, {
        category,
        metadata,
      });

      this.counter('performance.slow_operations', category, 1, {
        operation,
        category,
      });
    }
  }

  /**
   * Create a timer for measuring operation duration
   */
  startTimer(operation: string, category: MetricCategory): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.trackPerformance({ operation, duration, category });
    };
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number
  ): void {
    this.counter('http.requests.total', MetricCategory.HTTP, 1, {
      method,
      path,
      status: statusCode.toString(),
    });

    this.timer('http.request.duration', MetricCategory.HTTP, duration, {
      method,
      path,
      status: statusCode.toString(),
    });

    // Track error responses
    if (statusCode >= 400) {
      this.counter('http.errors.total', MetricCategory.HTTP, 1, {
        method,
        path,
        status: statusCode.toString(),
      });
    }
  }

  /**
   * Record database query metrics
   */
  recordDatabaseQuery(query: string, duration: number, success: boolean): void {
    this.counter('database.queries.total', MetricCategory.DATABASE, 1, {
      success: success.toString(),
    });

    this.timer('database.query.duration', MetricCategory.DATABASE, duration);

    if (!success) {
      this.counter('database.errors.total', MetricCategory.DATABASE, 1);
    }
  }

  /**
   * Record Redis operation metrics
   */
  recordRedisOperation(
    operation: string,
    duration: number,
    success: boolean
  ): void {
    this.counter('redis.operations.total', MetricCategory.REDIS, 1, {
      operation,
      success: success.toString(),
    });

    this.timer('redis.operation.duration', MetricCategory.REDIS, duration, {
      operation,
    });

    if (!success) {
      this.counter('redis.errors.total', MetricCategory.REDIS, 1, {
        operation,
      });
    }
  }

  /**
   * Record authentication metrics
   */
  recordAuthEvent(
    event: 'login' | 'logout' | 'register' | 'password_reset',
    success: boolean,
    userId?: string
  ): void {
    this.counter('auth.events.total', MetricCategory.AUTH, 1, {
      event,
      success: success.toString(),
    });

    if (!success) {
      this.counter('auth.failures.total', MetricCategory.AUTH, 1, {
        event,
      });
    }
  }

  /**
   * Record email metrics
   */
  recordEmailSent(type: string, success: boolean): void {
    this.counter('email.sent.total', MetricCategory.EMAIL, 1, {
      type,
      success: success.toString(),
    });

    if (!success) {
      this.counter('email.failures.total', MetricCategory.EMAIL, 1, {
        type,
      });
    }
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): Metric[] {
    return [...this.metrics];
  }

  /**
   * Get metrics summary for health checks
   */
  async getMetricsSummary(): Promise<Record<string, any>> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    const recentMetrics = this.metrics.filter(
      (m) => m.timestamp.getTime() > oneMinuteAgo
    );

    const summary: Record<string, any> = {
      total_metrics: this.metrics.length,
      recent_metrics: recentMetrics.length,
      by_category: {} as Record<string, number>,
      by_type: {} as Record<string, number>,
    };

    // Count by category
    for (const metric of recentMetrics) {
      summary.by_category[metric.category] =
        (summary.by_category[metric.category] || 0) + 1;
      summary.by_type[metric.type] = (summary.by_type[metric.type] || 0) + 1;
    }

    // Get error count from database
    try {
      const client = await getClient();
      
      // Verify client is properly initialized
      if (!client || typeof client !== 'function') {
        throw new Error('Database client not properly initialized');
      }
      
      const result = await client`
        SELECT COUNT(*) as count
        FROM error_tracking
        WHERE created_at > NOW() - INTERVAL '1 hour'
      `;
      summary.errors_last_hour = parseInt(result[0]?.count || '0');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to get error count:', error);
      }
      summary.errors_last_hour = 0;
    }

    return summary;
  }

  /**
   * Clear all metrics (for testing)
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Flush metrics to storage
   */
  private async flushMetrics(): Promise<void> {
    if (this.metrics.length === 0) {
      return;
    }

    const metricsToFlush = this.metrics.splice(0, this.BATCH_SIZE);

    try {
      const client = await getClient();

      // Verify client is a function (postgres.js uses tagged templates)
      if (!client || typeof client !== 'function') {
        throw new Error('Database client not properly initialized');
      }

      // Filter out invalid metrics BEFORE attempting to insert
      const validMetrics = metricsToFlush.filter(metric => {
        const isValid = !!(metric && metric.name && metric.type && metric.category && metric.value !== undefined);
        
        if (!isValid && process.env.NODE_ENV === 'development') {
          console.warn('Filtering out invalid metric before flush:', {
            name: metric?.name,
            type: metric?.type,
            category: metric?.category,
            value: metric?.value,
            timestamp: metric?.timestamp,
            tags: metric?.tags,
            fullMetric: JSON.stringify(metric),
          });
        }
        
        return isValid;
      });

      // Store valid metrics in database
      for (const metric of validMetrics) {
        await client`
          INSERT INTO metrics (
            name,
            type,
            category,
            value,
            tags,
            created_at
          ) VALUES (
            ${metric.name},
            ${metric.type},
            ${metric.category},
            ${metric.value},
            ${JSON.stringify(metric.tags || {})},
            ${metric.timestamp}
          )
        `;
      }
    } catch (error) {
      // Only log in development to avoid spam
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to flush metrics:', error);
        console.error('Metrics that failed to flush:', JSON.stringify(metricsToFlush, null, 2));
      }
      // Put metrics back if flush failed
      this.metrics.unshift(...metricsToFlush);
    }
  }

  /**
   * Start periodic metric flushing
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushMetrics().catch((error) => {
        console.error('Error in periodic flush:', error);
      });
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Stop periodic flushing (for cleanup)
   */
  stopPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Record a metric
   */
  private recordMetric(metric: Metric): void {
    // Validate metric object exists
    if (!metric) {
      console.warn('Attempted to record null/undefined metric');
      return;
    }

    // Validate metric has required fields with strict checks
    if (!metric.name || typeof metric.name !== 'string' ||
        !metric.type || typeof metric.type !== 'string' ||
        !metric.category || typeof metric.category !== 'string' ||
        metric.value === undefined || metric.value === null || typeof metric.value !== 'number') {
      console.warn('Attempted to record invalid metric:', {
        name: metric.name,
        nameType: typeof metric.name,
        type: metric.type,
        typeType: typeof metric.type,
        category: metric.category,
        categoryType: typeof metric.category,
        value: metric.value,
        valueType: typeof metric.value,
        timestamp: metric.timestamp,
        tags: metric.tags,
        fullMetric: JSON.stringify(metric),
      });
      return;
    }

    this.metrics.push(metric);

    // Flush if batch size reached
    if (this.metrics.length >= this.BATCH_SIZE) {
      this.flushMetrics().catch((error) => {
        console.error('Error flushing metrics:', error);
      });
    }
  }

  /**
   * Get slow operation threshold for category
   */
  private getSlowThreshold(category: MetricCategory): number {
    const thresholds: Record<MetricCategory, number> = {
      [MetricCategory.HTTP]: 1000, // 1 second
      [MetricCategory.DATABASE]: 500, // 500ms
      [MetricCategory.REDIS]: 100, // 100ms
      [MetricCategory.AUTH]: 2000, // 2 seconds
      [MetricCategory.EMAIL]: 5000, // 5 seconds
      [MetricCategory.BUSINESS]: 1000, // 1 second
    };

    return thresholds[category] || 1000;
  }

  /**
   * Start a distributed tracing span
   * Returns a span object with spanId for tagging
   */
  startSpan(operation: string): { spanId: string; startTime: number } {
    const spanId = `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    return { spanId, startTime };
  }

  /**
   * Finish a distributed tracing span
   * Records the span duration as a timer metric
   */
  finishSpan(span: { spanId: string; startTime: number }, operation: string, category: MetricCategory = MetricCategory.BUSINESS): void {
    const duration = Date.now() - span.startTime;
    this.timer(operation, category, duration, { span_id: span.spanId });
  }

  /**
   * Add tags to a span
   * Tags are stored for later use when the span is finished
   */
  tagSpan(spanId: string, tags: Record<string, any>): void {
    // In a full distributed tracing implementation, this would store tags
    // For now, we just log them in development
    if (process.env.NODE_ENV === 'development') {
      console.debug(`Span ${spanId} tagged:`, tags);
    }
  }
}

// Export singleton instance
export const monitoring = MonitoringService.getInstance();

// Export convenience functions
export const trackError = (event: ErrorEvent) => monitoring.trackError(event);
export const trackPerformance = (event: PerformanceEvent) =>
  monitoring.trackPerformance(event);
export const startTimer = (operation: string, category: MetricCategory) =>
  monitoring.startTimer(operation, category);
