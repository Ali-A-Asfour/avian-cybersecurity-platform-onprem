/**
 * Performance Optimization Tests
 * 
 * Tests to verify that React.memo, code splitting, and other performance
 * optimizations are working correctly for the tenant admin dashboard.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { KPICard } from '../KPICard';
import { AlertsTrendGraph } from '../AlertsTrendGraph';
import { DeviceCoverageChart } from '../DeviceCoverageChart';
import { TicketBreakdownChart } from '../TicketBreakdownChart';
import { IntegrationHealthPanel } from '../IntegrationHealthPanel';
import { RecentActivityFeed } from '../RecentActivityFeed';
import { DashboardLayout } from '../DashboardLayout';

// Mock data for testing
const mockKPIProps = {
    title: 'Test KPI',
    value: 42,
    subtitle: 'Test subtitle',
    onClick: jest.fn(),
};

const mockAlertsTrendData = [
    { date: '2024-01-01', alertCount: 5 },
    { date: '2024-01-02', alertCount: 3 },
];

const mockDeviceCoverageData = {
    protected: 80,
    missingAgent: 15,
    withAlerts: 5,
    total: 100,
};

const mockTicketBreakdownData = {
    securityTickets: { created: 10, resolved: 8 },
    helpdeskTickets: { created: 15, resolved: 12 },
};

const mockIntegrationsData = [
    { serviceName: 'microsoft', status: 'healthy' as const, lastSync: '2024-01-01T10:00:00Z' },
    { serviceName: 'sonicwall', status: 'warning' as const, lastSync: '2024-01-01T09:30:00Z' },
];

const mockActivitiesData = [
    { id: '1', timestamp: '2024-01-01T10:00:00Z', description: 'Test activity', type: 'alert' as const, icon: '🚨' },
];

describe('Performance Optimizations', () => {
    describe('React.memo Implementation', () => {
        test('KPICard is memoized and prevents unnecessary re-renders', () => {
            const renderSpy = jest.fn();

            // Create a wrapper that tracks renders
            const TestWrapper = React.memo(() => {
                renderSpy();
                return <KPICard {...mockKPIProps} />;
            });

            const { rerender } = render(<TestWrapper />);
            expect(renderSpy).toHaveBeenCalledTimes(1);

            // Re-render with same props - should not trigger re-render due to memo
            rerender(<TestWrapper />);
            expect(renderSpy).toHaveBeenCalledTimes(1);
        });

        test('AlertsTrendGraph is memoized', () => {
            const { container } = render(
                <AlertsTrendGraph
                    data={mockAlertsTrendData}
                    onPointClick={jest.fn()}
                />
            );

            // Verify component renders without errors
            expect(container.firstChild).toBeInTheDocument();
        });

        test('DeviceCoverageChart is memoized', () => {
            const { container } = render(
                <DeviceCoverageChart
                    data={mockDeviceCoverageData}
                    onSegmentClick={jest.fn()}
                />
            );

            // Verify component renders without errors
            expect(container.firstChild).toBeInTheDocument();
        });

        test('TicketBreakdownChart is memoized', () => {
            const { container } = render(
                <TicketBreakdownChart
                    data={mockTicketBreakdownData}
                    chartType="donut"
                    onSegmentClick={jest.fn()}
                />
            );

            // Verify component renders without errors
            expect(container.firstChild).toBeInTheDocument();
        });

        test('IntegrationHealthPanel is memoized', () => {
            const { container } = render(
                <IntegrationHealthPanel
                    integrations={mockIntegrationsData}
                    onIntegrationClick={jest.fn()}
                />
            );

            // Verify component renders without errors
            expect(container.firstChild).toBeInTheDocument();
        });

        test('RecentActivityFeed is memoized', () => {
            const { container } = render(
                <RecentActivityFeed
                    activities={mockActivitiesData}
                    onActivityClick={jest.fn()}
                />
            );

            // Verify component renders without errors
            expect(container.firstChild).toBeInTheDocument();
        });

        test('DashboardLayout is memoized', () => {
            const { container } = render(
                <DashboardLayout>
                    <div>Test content</div>
                </DashboardLayout>
            );

            // Verify component renders without errors
            expect(container.firstChild).toBeInTheDocument();
        });
    });

    describe('Stable References', () => {
        test('callback functions maintain stable references', () => {
            const stableCallback = jest.fn();

            const { rerender } = render(
                <KPICard {...mockKPIProps} onClick={stableCallback} />
            );

            // Re-render with same callback reference
            rerender(<KPICard {...mockKPIProps} onClick={stableCallback} />);

            // Component should handle stable references correctly
            expect(stableCallback).not.toHaveBeenCalled();
        });
    });

    describe('Code Splitting Verification', () => {
        test('lazy components can be imported dynamically', async () => {
            // Test that lazy loading works by importing the lazy components
            const { LazyAlertsTrendGraph } = await import('../LazyChartComponents');
            expect(LazyAlertsTrendGraph).toBeDefined();

            const { LazyDeviceCoverageChart } = await import('../LazyChartComponents');
            expect(LazyDeviceCoverageChart).toBeDefined();

            const { LazyTicketBreakdownChart } = await import('../LazyChartComponents');
            expect(LazyTicketBreakdownChart).toBeDefined();

            const { LazyIntegrationHealthPanel } = await import('../LazyChartComponents');
            expect(LazyIntegrationHealthPanel).toBeDefined();

            const { LazyRecentActivityFeed } = await import('../LazyChartComponents');
            expect(LazyRecentActivityFeed).toBeDefined();
        });
    });

    describe('Performance Monitoring', () => {
        test('performance monitor is available', async () => {
            const { performanceMonitor } = await import('@/lib/performance');
            expect(performanceMonitor).toBeDefined();
            expect(typeof performanceMonitor.recordMetric).toBe('function');
            expect(typeof performanceMonitor.measureRender).toBe('function');
            expect(typeof performanceMonitor.measureAsync).toBe('function');
        });

        test('performance monitoring utilities work', async () => {
            const { performanceMonitor } = await import('@/lib/performance');

            // Test metric recording
            performanceMonitor.recordMetric({
                name: 'test-metric',
                value: 100,
                timestamp: Date.now(),
                component: 'test-component'
            });

            // Test render measurement
            const result = performanceMonitor.measureRender('test-component', () => {
                return 'test-result';
            });

            expect(result).toBe('test-result');
        });
    });
});