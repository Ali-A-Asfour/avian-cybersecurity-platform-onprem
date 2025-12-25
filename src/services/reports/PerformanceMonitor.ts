/**
 * Performance Monitor for AVIAN Reports Module
 * 
 * Provides utilities for monitoring and tracking report generation performance
 * in production environments. Supports Requirements 9.2 and 9.5.
 */

import { logger } from '@/lib/logger';

export interface PerformanceMetrics {
    operationType: 'report_generation' | 'pdf_export' | 'data_aggregation' | 'cache_operation';
    tenantId: string;
    reportType?: 'weekly' | 'monthly' | 'quarterly';
    datasetSize: number;
    executionTime: number;
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        external: number;
    };
    cacheHit?: boolean;
    timestamp: Date;
    success: boolean;
    errorMessage?: string;
}

export interface PerformanceThresholds {
    reportGeneration: {
        small: number;    // < 1,000 records
        medium: number;   // 1,000-10,000 records
        large: number;    // 10,000+ records
    };
    pdfExport: {
        standard: number;
        complex: number;
    };
    memoryUsage: {
        warning: number;  // MB
        critical: number; // MB
    };
}

export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private metrics: PerformanceMetrics[] = [];
    private thresholds: PerformanceThresholds;

    private constructor() {
        this.thresholds = {
            reportGeneration: {
                small: 5000,    // 5 seconds
                medium: 15000,  // 15 seconds
                large: 30000    // 30 seconds
            },
            pdfExport: {
                standard: 10000,  // 10 seconds
                complex: 20000    // 20 seconds
            },
            memoryUsage: {
                warning: 200,   // 200 MB
                critical: 500   // 500 MB
            }
        };
    }

    public static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    /**
     * Start monitoring a performance operation
     */
    public startOperation(
        operationType: PerformanceMetrics['operationType'],
        tenantId: string,
        datasetSize: number,
        reportType?: 'weekly' | 'monthly' | 'quarterly'
    ): PerformanceTracker {
        return new PerformanceTracker(this, {
            operationType,
            tenantId,
            datasetSize,
            reportType,
            startTime: performance.now(),
            startMemory: process.memoryUsage()
        });
    }

    /**
     * Record completed operation metrics
     */
    public recordMetrics(metrics: PerformanceMetrics): void {
        this.metrics.push(metrics);
        this.analyzePerformance(metrics);

        // Keep only last 1000 metrics to prevent memory growth
        if (this.metrics.length > 1000) {
            this.metrics = this.metrics.slice(-1000);
        }
    }

    /**
     * Analyze performance against thresholds and log warnings
     */
    private analyzePerformance(metrics: PerformanceMetrics): void {
        const { operationType, datasetSize, executionTime, memoryUsage, tenantId } = metrics;

        // Check execution time thresholds
        let threshold: number;
        if (operationType === 'report_generation') {
            if (datasetSize < 1000) {
                threshold = this.thresholds.reportGeneration.small;
            } else if (datasetSize < 10000) {
                threshold = this.thresholds.reportGeneration.medium;
            } else {
                threshold = this.thresholds.reportGeneration.large;
            }
        } else if (operationType === 'pdf_export') {
            threshold = datasetSize > 5000
                ? this.thresholds.pdfExport.complex
                : this.thresholds.pdfExport.standard;
        } else {
            return; // No thresholds defined for other operations
        }

        if (executionTime > threshold) {
            logger.warn('Performance threshold exceeded', {
                operationType,
                tenantId,
                datasetSize,
                executionTime,
                threshold,
                exceedancePercent: ((executionTime - threshold) / threshold * 100).toFixed(2)
            });
        }

        // Check memory usage
        const memoryMB = memoryUsage.heapUsed / 1024 / 1024;
        if (memoryMB > this.thresholds.memoryUsage.critical) {
            logger.error('Critical memory usage detected', {
                operationType,
                tenantId,
                memoryUsageMB: memoryMB.toFixed(2),
                threshold: this.thresholds.memoryUsage.critical
            });
        } else if (memoryMB > this.thresholds.memoryUsage.warning) {
            logger.warn('High memory usage detected', {
                operationType,
                tenantId,
                memoryUsageMB: memoryMB.toFixed(2),
                threshold: this.thresholds.memoryUsage.warning
            });
        }
    }

    /**
     * Get performance statistics for monitoring dashboards
     */
    public getPerformanceStats(timeWindow?: number): PerformanceStats {
        const cutoff = timeWindow
            ? new Date(Date.now() - timeWindow)
            : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours

        const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff);

        if (recentMetrics.length === 0) {
            return {
                totalOperations: 0,
                averageExecutionTime: 0,
                averageMemoryUsage: 0,
                successRate: 0,
                cacheHitRate: 0,
                thresholdExceedances: 0
            };
        }

        const totalOperations = recentMetrics.length;
        const successfulOperations = recentMetrics.filter(m => m.success).length;
        const cacheOperations = recentMetrics.filter(m => m.cacheHit !== undefined);
        const cacheHits = cacheOperations.filter(m => m.cacheHit).length;

        const averageExecutionTime = recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalOperations;
        const averageMemoryUsage = recentMetrics.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0) / totalOperations;

        // Count threshold exceedances
        let thresholdExceedances = 0;
        recentMetrics.forEach(metrics => {
            const { operationType, datasetSize, executionTime } = metrics;
            let threshold: number;

            if (operationType === 'report_generation') {
                if (datasetSize < 1000) {
                    threshold = this.thresholds.reportGeneration.small;
                } else if (datasetSize < 10000) {
                    threshold = this.thresholds.reportGeneration.medium;
                } else {
                    threshold = this.thresholds.reportGeneration.large;
                }
                if (executionTime > threshold) thresholdExceedances++;
            } else if (operationType === 'pdf_export') {
                threshold = datasetSize > 5000
                    ? this.thresholds.pdfExport.complex
                    : this.thresholds.pdfExport.standard;
                if (executionTime > threshold) thresholdExceedances++;
            }
        });

        return {
            totalOperations,
            averageExecutionTime,
            averageMemoryUsage: averageMemoryUsage / 1024 / 1024, // Convert to MB
            successRate: (successfulOperations / totalOperations) * 100,
            cacheHitRate: cacheOperations.length > 0 ? (cacheHits / cacheOperations.length) * 100 : 0,
            thresholdExceedances
        };
    }

    /**
     * Update performance thresholds (for tuning)
     */
    public updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
        this.thresholds = { ...this.thresholds, ...newThresholds };
        logger.info('Performance thresholds updated', { thresholds: this.thresholds });
    }
}

export interface PerformanceStats {
    totalOperations: number;
    averageExecutionTime: number;
    averageMemoryUsage: number; // MB
    successRate: number; // percentage
    cacheHitRate: number; // percentage
    thresholdExceedances: number;
}

interface TrackerContext {
    operationType: PerformanceMetrics['operationType'];
    tenantId: string;
    datasetSize: number;
    reportType?: 'weekly' | 'monthly' | 'quarterly';
    startTime: number;
    startMemory: NodeJS.MemoryUsage;
}

export class PerformanceTracker {
    private monitor: PerformanceMonitor;
    private context: TrackerContext;
    private cacheHit?: boolean;

    constructor(monitor: PerformanceMonitor, context: TrackerContext) {
        this.monitor = monitor;
        this.context = context;
    }

    /**
     * Mark operation as cache hit/miss
     */
    public setCacheHit(hit: boolean): void {
        this.cacheHit = hit;
    }

    /**
     * Complete the operation and record metrics
     */
    public complete(success: boolean = true, errorMessage?: string): void {
        const endTime = performance.now();
        const endMemory = process.memoryUsage();

        const metrics: PerformanceMetrics = {
            operationType: this.context.operationType,
            tenantId: this.context.tenantId,
            reportType: this.context.reportType,
            datasetSize: this.context.datasetSize,
            executionTime: endTime - this.context.startTime,
            memoryUsage: {
                heapUsed: endMemory.heapUsed - this.context.startMemory.heapUsed,
                heapTotal: endMemory.heapTotal,
                external: endMemory.external
            },
            cacheHit: this.cacheHit,
            timestamp: new Date(),
            success,
            errorMessage
        };

        this.monitor.recordMetrics(metrics);
    }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();