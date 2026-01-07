import { monitoring, PerformanceMetrics, MetricCategory } from './monitoring';
// import { logger } from './logger';

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  database: {
    activeConnections: number;
    maxConnections: number;
    avgQueryTime: number;
    slowQueries: number;
  };
  redis: {
    memoryUsed: number;
    memoryMax: number;
    connectedClients: number;
    commandsProcessed: number;
  };
  api: {
    requestsPerMinute: number;
    avgResponseTime: number;
    errorRate: number;
    activeRequests: number;
  };
}

export interface AlertThreshold {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

class PerformanceMonitor {
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;
  private requestCounts: Map<string, number> = new Map();
  private responseTimes: number[] = [];
  private errorCounts = 0;
  private totalRequests = 0;
  private activeRequests = 0;
  private alertThresholds: AlertThreshold[] = [];

  constructor() {
    this.setupDefaultThresholds();
  }

  /**
   * Start performance monitoring
   */
  start(intervalSeconds: number = 30): void {
    if (this.isRunning) {
      logger.warn('Performance monitor is already running');
      return;
    }

    logger.info('Starting performance monitor', { intervalSeconds });
    this.isRunning = true;

    // Collect metrics immediately
    this.collectMetrics();

    // Set up recurring collection
    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, intervalSeconds * 1000);
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Performance monitor is not running');
      return;
    }

    logger.info('Stopping performance monitor');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Record API request metrics
   */
  recordRequest(method: string, path: string, statusCode: number, responseTime: number): void {
    const key = `${method} ${path}`;
    this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);
    this.responseTimes.push(responseTime);
    this.totalRequests++;

    if (statusCode >= 400) {
      this.errorCounts++;
    }

    // Keep only recent response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-500);
    }

    // Record individual metrics
    monitoring.counter('http.requests', MetricCategory.HTTP, 1, {
      method,
      path,
      status: statusCode.toString(),
    });

    monitoring.timer('http.request_duration', MetricCategory.HTTP, responseTime, {
      method,
      path,
    });
  }

  /**
   * Track active requests
   */
  incrementActiveRequests(): void {
    this.activeRequests++;
    monitoring.gauge('http.active_requests', MetricCategory.HTTP, this.activeRequests);
  }

  /**
   * Track completed requests
   */
  decrementActiveRequests(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    monitoring.gauge('http.active_requests', MetricCategory.HTTP, this.activeRequests);
  }

  /**
   * Collect system metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.gatherSystemMetrics();
      
      // Record metrics
      monitoring.gauge('memory.usage_percentage', MetricCategory.BUSINESS, metrics.memory.percentage);
      monitoring.gauge('cpu.usage_percentage', MetricCategory.BUSINESS, metrics.cpu.usage);
      monitoring.gauge('database.connections', MetricCategory.DATABASE, metrics.database.activeConnections);
      monitoring.timer('database.avg_query_time', MetricCategory.DATABASE, metrics.database.avgQueryTime);
      monitoring.gauge('redis.memory_used', MetricCategory.REDIS, metrics.redis.memoryUsed);
      monitoring.gauge('redis.connected_clients', MetricCategory.REDIS, metrics.redis.connectedClients);

      // Calculate API metrics
      const avgResponseTime = this.responseTimes.length > 0 
        ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length 
        : 0;
      
      const errorRate = this.totalRequests > 0 ? this.errorCounts / this.totalRequests : 0;
      const requestsPerMinute = this.calculateRequestsPerMinute();

      const performanceMetrics: PerformanceMetrics = {
        requestCount: this.totalRequests,
        responseTime: avgResponseTime,
        errorRate,
        throughput: requestsPerMinute,
        memoryUsage: metrics.memory.percentage / 100,
        cpuUsage: metrics.cpu.usage / 100,
      };

      monitoring.recordPerformanceMetrics(performanceMetrics);

      // Check alert thresholds
      this.checkAlertThresholds(metrics, performanceMetrics);

      logger.debug('Performance metrics collected', {
        memory: metrics.memory.percentage,
        cpu: metrics.cpu.usage,
        avgResponseTime,
        errorRate,
        requestsPerMinute,
      });

    } catch (error) {
      logger.error('Failed to collect performance metrics', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Gather system metrics
   */
  private async gatherSystemMetrics(): Promise<SystemMetrics> {
    // In a real implementation, these would gather actual system metrics
    // For now, we'll simulate realistic values
    
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    const memoryTotalMB = memoryUsage.heapTotal / 1024 / 1024;

    return {
      memory: {
        used: memoryUsedMB,
        total: memoryTotalMB,
        percentage: (memoryUsedMB / memoryTotalMB) * 100,
      },
      cpu: {
        usage: Math.random() * 30 + 10, // Simulate 10-40% CPU usage
      },
      database: {
        activeConnections: Math.floor(Math.random() * 20) + 5,
        maxConnections: 100,
        avgQueryTime: Math.random() * 50 + 10,
        slowQueries: Math.floor(Math.random() * 3),
      },
      redis: {
        memoryUsed: Math.floor(Math.random() * 100000000) + 50000000, // 50-150MB
        memoryMax: 500000000, // 500MB
        connectedClients: Math.floor(Math.random() * 10) + 2,
        commandsProcessed: Math.floor(Math.random() * 1000) + 500,
      },
      api: {
        requestsPerMinute: this.calculateRequestsPerMinute(),
        avgResponseTime: this.responseTimes.length > 0 
          ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length 
          : 0,
        errorRate: this.totalRequests > 0 ? (this.errorCounts / this.totalRequests) * 100 : 0,
        activeRequests: this.activeRequests,
      },
    };
  }

  /**
   * Calculate requests per minute
   */
  private calculateRequestsPerMinute(): number {
    // Simple calculation based on recent request counts
    // In a real implementation, this would be more sophisticated
    return Math.floor(this.totalRequests / Math.max(1, Date.now() / 60000));
  }

  /**
   * Setup default alert thresholds
   */
  private setupDefaultThresholds(): void {
    this.alertThresholds = [
      {
        metric: 'memory_percentage',
        operator: 'gt',
        value: 80,
        severity: 'high',
        message: 'High memory usage detected',
      },
      {
        metric: 'cpu_usage',
        operator: 'gt',
        value: 70,
        severity: 'medium',
        message: 'High CPU usage detected',
      },
      {
        metric: 'avg_response_time',
        operator: 'gt',
        value: 1000,
        severity: 'medium',
        message: 'High response time detected',
      },
      {
        metric: 'error_rate',
        operator: 'gt',
        value: 5,
        severity: 'high',
        message: 'High error rate detected',
      },
      {
        metric: 'database_connections',
        operator: 'gt',
        value: 80,
        severity: 'medium',
        message: 'High database connection usage',
      },
    ];
  }

  /**
   * Check alert thresholds
   */
  private checkAlertThresholds(systemMetrics: SystemMetrics, perfMetrics: PerformanceMetrics): void {
    for (const threshold of this.alertThresholds) {
      let value: number;

      switch (threshold.metric) {
        case 'memory_percentage':
          value = systemMetrics.memory.percentage;
          break;
        case 'cpu_usage':
          value = systemMetrics.cpu.usage;
          break;
        case 'avg_response_time':
          value = perfMetrics.responseTime;
          break;
        case 'error_rate':
          value = perfMetrics.errorRate * 100;
          break;
        case 'database_connections':
          value = systemMetrics.database.activeConnections;
          break;
        default:
          continue;
      }

      if (this.evaluateThreshold(value, threshold)) {
        this.triggerAlert(threshold, value);
      }
    }
  }

  /**
   * Evaluate threshold condition
   */
  private evaluateThreshold(value: number, threshold: AlertThreshold): boolean {
    switch (threshold.operator) {
      case 'gt':
        return value > threshold.value;
      case 'gte':
        return value >= threshold.value;
      case 'lt':
        return value < threshold.value;
      case 'lte':
        return value <= threshold.value;
      case 'eq':
        return value === threshold.value;
      default:
        return false;
    }
  }

  /**
   * Trigger performance alert
   */
  private triggerAlert(threshold: AlertThreshold, currentValue: number): void {
    const alertMessage = `${threshold.message}: ${currentValue.toFixed(2)} (threshold: ${threshold.value})`;
    
    logger.warn('Performance alert triggered', {
      metric: threshold.metric,
      severity: threshold.severity,
      currentValue,
      threshold: threshold.value,
      message: alertMessage,
    });

    // Record alert metric
    monitoring.counter('performance.alerts', MetricCategory.BUSINESS, 1, {
      metric: threshold.metric,
      severity: threshold.severity,
    });
  }

  /**
   * Get current performance summary
   */
  getPerformanceSummary(): {
    isRunning: boolean;
    totalRequests: number;
    activeRequests: number;
    avgResponseTime: number;
    errorRate: number;
    requestsPerMinute: number;
  } {
    const avgResponseTime = this.responseTimes.length > 0 
      ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length 
      : 0;

    return {
      isRunning: this.isRunning,
      totalRequests: this.totalRequests,
      activeRequests: this.activeRequests,
      avgResponseTime,
      errorRate: this.totalRequests > 0 ? (this.errorCounts / this.totalRequests) * 100 : 0,
      requestsPerMinute: this.calculateRequestsPerMinute(),
    };
  }

  /**
   * Add custom alert threshold
   */
  addAlertThreshold(threshold: AlertThreshold): void {
    this.alertThresholds.push(threshold);
    logger.info('Added custom alert threshold', threshold);
  }

  /**
   * Remove alert threshold
   */
  removeAlertThreshold(metric: string): void {
    this.alertThresholds = this.alertThresholds.filter(t => t.metric !== metric);
    logger.info('Removed alert threshold', { metric });
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.requestCounts.clear();
    this.responseTimes = [];
    this.errorCounts = 0;
    this.totalRequests = 0;
    this.activeRequests = 0;
    logger.info('Performance metrics reset');
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Middleware for automatic performance monitoring
 */
export function performanceMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    performanceMonitor.incrementActiveRequests();

    // Override res.end to capture metrics
    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      performanceMonitor.recordRequest(
        req.method,
        req.path || req.url,
        res.statusCode,
        responseTime
      );

      performanceMonitor.decrementActiveRequests();
      originalEnd.apply(res, args);
    };

    next();
  };
}