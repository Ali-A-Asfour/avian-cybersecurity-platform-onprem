/**
 * Performance Monitor Tests
 * 
 * Tests for the performance monitoring utilities used in production
 * to track report generation performance metrics.
 */

import { PerformanceMonitor, performanceMonitor } from '../PerformanceMonitor';

describe('PerformanceMonitor', () => {
    let monitor: PerformanceMonitor;

    beforeEach(() => {
        monitor = PerformanceMonitor.getInstance();
    });

    describe('Operation Tracking', () => {
        it('should track report generation performance', async () => {
            const tracker = monitor.startOperation(
                'report_generation',
                'test-tenant',
                5000,
                'weekly'
            );

            // Simulate some work
            await new Promise(resolve => setTimeout(resolve, 100));

            tracker.complete(true);

            const stats = monitor.getPerformanceStats();
            expect(stats.totalOperations).toBeGreaterThan(0);
            expect(stats.averageExecutionTime).toBeGreaterThan(0);
            expect(stats.successRate).toBe(100);
        });

        it('should track PDF export performance', async () => {
            const tracker = monitor.startOperation(
                'pdf_export',
                'test-tenant',
                1000
            );

            // Simulate PDF generation work
            await new Promise(resolve => setTimeout(resolve, 50));

            tracker.complete(true);

            const stats = monitor.getPerformanceStats();
            expect(stats.totalOperations).toBeGreaterThan(0);
        });

        it('should track cache hit/miss rates', async () => {
            // Cache miss
            const tracker1 = monitor.startOperation(
                'report_generation',
                'test-tenant',
                1000,
                'weekly'
            );
            tracker1.setCacheHit(false);
            tracker1.complete(true);

            // Cache hit
            const tracker2 = monitor.startOperation(
                'report_generation',
                'test-tenant',
                1000,
                'weekly'
            );
            tracker2.setCacheHit(true);
            tracker2.complete(true);

            const stats = monitor.getPerformanceStats();
            expect(stats.cacheHitRate).toBe(50); // 1 hit out of 2 operations
        });

        it('should track failed operations', async () => {
            const tracker = monitor.startOperation(
                'report_generation',
                'test-tenant',
                1000,
                'weekly'
            );

            tracker.complete(false, 'Test error');

            const stats = monitor.getPerformanceStats();
            expect(stats.successRate).toBeLessThan(100);
        });
    });

    describe('Performance Analysis', () => {
        it('should calculate performance statistics correctly', () => {
            // Add some test metrics
            for (let i = 0; i < 10; i++) {
                const tracker = monitor.startOperation(
                    'report_generation',
                    `tenant-${i}`,
                    1000 + i * 100,
                    'weekly'
                );
                tracker.complete(true);
            }

            const stats = monitor.getPerformanceStats();
            expect(stats.totalOperations).toBeGreaterThanOrEqual(10);
            expect(stats.averageExecutionTime).toBeGreaterThan(0);
            expect(stats.averageMemoryUsage).toBeGreaterThan(0);
            expect(stats.successRate).toBe(100);
        });

        it('should handle empty metrics gracefully', () => {
            const newMonitor = new (PerformanceMonitor as any)();
            const stats = newMonitor.getPerformanceStats();

            expect(stats.totalOperations).toBe(0);
            expect(stats.averageExecutionTime).toBe(0);
            expect(stats.successRate).toBe(0);
        });
    });

    describe('Threshold Management', () => {
        it('should allow updating performance thresholds', () => {
            const newThresholds = {
                reportGeneration: {
                    small: 3000,
                    medium: 10000,
                    large: 25000
                }
            };

            expect(() => {
                monitor.updateThresholds(newThresholds);
            }).not.toThrow();
        });
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            const instance1 = PerformanceMonitor.getInstance();
            const instance2 = PerformanceMonitor.getInstance();

            expect(instance1).toBe(instance2);
            expect(instance1).toBe(performanceMonitor);
        });
    });
});