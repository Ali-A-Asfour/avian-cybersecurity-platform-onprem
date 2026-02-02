/**
 * Performance monitoring utilities for dashboard optimization
 * 
 * Provides tools to measure and track dashboard component performance,
 * including render times, bundle sizes, and user interaction metrics.
 */

interface PerformanceMetric {
    name: string;
    value: number;
    timestamp: number;
    component?: string;
}

class PerformanceMonitor {
    private metrics: PerformanceMetric[] = [];
    private observers: PerformanceObserver[] = [];

    constructor() {
        if (typeof window !== 'undefined') {
            this.initializeObservers();
        }
    }

    private initializeObservers() {
        // Observe paint metrics
        if ('PerformanceObserver' in window) {
            try {
                const paintObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        this.recordMetric({
                            name: entry.name,
                            value: entry.startTime,
                            timestamp: Date.now(),
                            component: 'paint'
                        });
                    }
                });
                paintObserver.observe({ entryTypes: ['paint'] });
                this.observers.push(paintObserver);
            } catch (error) {
                console.warn('Paint observer not supported:', error);
            }

            // Observe navigation metrics
            try {
                const navigationObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        const navEntry = entry as PerformanceNavigationTiming;
                        this.recordMetric({
                            name: 'dom-content-loaded',
                            value: navEntry.domContentLoadedEventEnd - (navEntry as any).navigationStart,
                            timestamp: Date.now(),
                            component: 'navigation'
                        });
                        this.recordMetric({
                            name: 'load-complete',
                            value: navEntry.loadEventEnd - (navEntry as any).navigationStart,
                            timestamp: Date.now(),
                            component: 'navigation'
                        });
                    }
                });
                navigationObserver.observe({ entryTypes: ['navigation'] });
                this.observers.push(navigationObserver);
            } catch (error) {
                console.warn('Navigation observer not supported:', error);
            }
        }
    }

    /**
     * Record a custom performance metric
     */
    recordMetric(metric: PerformanceMetric) {
        this.metrics.push(metric);

        // Keep only last 100 metrics to prevent memory leaks
        if (this.metrics.length > 100) {
            this.metrics = this.metrics.slice(-100);
        }

        // Log performance issues in development
        if (process.env.NODE_ENV === 'development') {
            if (metric.value > 1000 && metric.component) {
                console.warn(`Performance warning: ${metric.name} took ${metric.value}ms in ${metric.component}`);
            }
        }
    }

    /**
     * Measure component render time
     */
    measureRender<T>(componentName: string, renderFn: () => T): T {
        const startTime = performance.now();
        const result = renderFn();
        const endTime = performance.now();

        this.recordMetric({
            name: 'component-render',
            value: endTime - startTime,
            timestamp: Date.now(),
            component: componentName
        });

        return result;
    }

    /**
     * Measure async operation time
     */
    async measureAsync<T>(operationName: string, asyncFn: () => Promise<T>): Promise<T> {
        const startTime = performance.now();
        const result = await asyncFn();
        const endTime = performance.now();

        this.recordMetric({
            name: operationName,
            value: endTime - startTime,
            timestamp: Date.now(),
            component: 'async-operation'
        });

        return result;
    }

    /**
     * Get performance summary
     */
    getSummary(): Record<string, { avg: number; max: number; count: number }> {
        const summary: Record<string, { avg: number; max: number; count: number }> = {};

        for (const metric of this.metrics) {
            if (!summary[metric.name]) {
                summary[metric.name] = { avg: 0, max: 0, count: 0 };
            }

            const current = summary[metric.name];
            current.count++;
            current.max = Math.max(current.max, metric.value);
            current.avg = (current.avg * (current.count - 1) + metric.value) / current.count;
        }

        return summary;
    }

    /**
     * Clear all metrics
     */
    clear() {
        this.metrics = [];
    }

    /**
     * Cleanup observers
     */
    cleanup() {
        for (const observer of this.observers) {
            observer.disconnect();
        }
        this.observers = [];
    }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * React hook for measuring component performance
 */
export function usePerformanceMonitor(componentName: string) {
    const measureRender = <T>(renderFn: () => T): T => {
        return performanceMonitor.measureRender(componentName, renderFn);
    };

    const measureAsync = <T>(operationName: string, asyncFn: () => Promise<T>): Promise<T> => {
        return performanceMonitor.measureAsync(`${componentName}-${operationName}`, asyncFn);
    };

    return { measureRender, measureAsync };
}

/**
 * Higher-order component for automatic performance monitoring
 * Note: Removed JSX implementation to avoid TypeScript compilation issues
 * Can be re-implemented in a .tsx file if needed
 */

/**
 * Utility to measure bundle size impact
 */
export function logBundleInfo() {
    if (typeof window !== 'undefined' && 'performance' in window) {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

        if (navigation) {
            console.log('Bundle Performance Metrics:', {
                'DNS Lookup': `${navigation.domainLookupEnd - navigation.domainLookupStart}ms`,
                'TCP Connection': `${navigation.connectEnd - navigation.connectStart}ms`,
                'Request': `${navigation.responseStart - navigation.requestStart}ms`,
                'Response': `${navigation.responseEnd - navigation.responseStart}ms`,
                'DOM Processing': `${navigation.domContentLoadedEventEnd - navigation.responseEnd}ms`,
                'Load Complete': `${navigation.loadEventEnd - (navigation as any).navigationStart}ms`
            });
        }
    }
}