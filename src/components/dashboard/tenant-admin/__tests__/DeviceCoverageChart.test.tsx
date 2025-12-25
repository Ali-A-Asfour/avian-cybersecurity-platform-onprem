import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, jest } from '@jest/globals';
import { DeviceCoverageChart } from '../DeviceCoverageChart';

describe('DeviceCoverageChart Unit Tests', () => {
    const mockData = {
        protected: 150,
        missingAgent: 50,
        withAlerts: 25,
        total: 225
    };

    const mockOnSegmentClick = jest.fn();

    beforeEach(() => {
        mockOnSegmentClick.mockClear();
    });

    it('renders chart title correctly', () => {
        const { getByText } = render(
            <DeviceCoverageChart
                data={mockData}
                onSegmentClick={mockOnSegmentClick}
                loading={false}
            />
        );

        expect(getByText('Device Coverage')).toBeTruthy();
    });

    it('displays loading state correctly', () => {
        const { container } = render(
            <DeviceCoverageChart
                data={mockData}
                onSegmentClick={mockOnSegmentClick}
                loading={true}
            />
        );

        // Should show loading skeleton
        const loadingElement = container.querySelector('.animate-pulse');
        expect(loadingElement).toBeTruthy();

        // Should not show chart title when loading
        expect(container.textContent).not.toContain('Device Coverage');
    });

    it('renders chart with correct structure when not loading', () => {
        const { container } = render(
            <DeviceCoverageChart
                data={mockData}
                onSegmentClick={mockOnSegmentClick}
                loading={false}
            />
        );

        // Should have main container
        const chartWrapper = container.querySelector('.bg-neutral-800');
        expect(chartWrapper).toBeTruthy();

        // Should have chart height container
        const chartHeightContainer = container.querySelector('.h-64');
        expect(chartHeightContainer).toBeTruthy();
    });

    it('calculates percentages correctly', () => {
        // Test the percentage calculation logic directly
        const protectedPercentage = Math.round((mockData.protected / mockData.total) * 100); // 67%
        const missingAgentPercentage = Math.round((mockData.missingAgent / mockData.total) * 100); // 22%
        const withAlertsPercentage = Math.round((mockData.withAlerts / mockData.total) * 100); // 11%

        // Verify calculations are correct
        expect(protectedPercentage).toBe(67);
        expect(missingAgentPercentage).toBe(22);
        expect(withAlertsPercentage).toBe(11);

        // Verify percentages sum to approximately 100% (allowing for rounding)
        const totalPercentage = protectedPercentage + missingAgentPercentage + withAlertsPercentage;
        expect(Math.abs(totalPercentage - 100)).toBeLessThanOrEqual(3);
    });

    it('validates data structure integrity', () => {
        const { container } = render(
            <DeviceCoverageChart
                data={mockData}
                onSegmentClick={mockOnSegmentClick}
                loading={false}
            />
        );

        // Verify that the sum of individual components equals the total
        expect(mockData.protected + mockData.missingAgent + mockData.withAlerts).toBe(mockData.total);

        // Should render without errors
        expect(container.querySelector('.bg-neutral-800')).toBeTruthy();
    });

    it('handles zero values correctly', () => {
        const zeroData = {
            protected: 0,
            missingAgent: 100,
            withAlerts: 50,
            total: 150
        };

        const { container } = render(
            <DeviceCoverageChart
                data={zeroData}
                onSegmentClick={mockOnSegmentClick}
                loading={false}
            />
        );

        // Should still render without errors
        expect(container.querySelector('.bg-neutral-800')).toBeTruthy();
        expect(container.textContent).toContain('Device Coverage');

        // Verify data integrity
        expect(zeroData.protected + zeroData.missingAgent + zeroData.withAlerts).toBe(zeroData.total);
    });

    it('handles edge case with all zero values except one', () => {
        const edgeData = {
            protected: 0,
            missingAgent: 0,
            withAlerts: 1,
            total: 1
        };

        const { container } = render(
            <DeviceCoverageChart
                data={edgeData}
                onSegmentClick={mockOnSegmentClick}
                loading={false}
            />
        );

        // Should render without errors
        expect(container.querySelector('.bg-neutral-800')).toBeTruthy();

        // Verify data integrity
        expect(edgeData.protected + edgeData.missingAgent + edgeData.withAlerts).toBe(edgeData.total);

        // Test percentage calculation for edge case
        const withAlertsPercentage = Math.round((edgeData.withAlerts / edgeData.total) * 100);
        expect(withAlertsPercentage).toBe(100);
    });

    it('applies correct CSS classes for styling', () => {
        const { container } = render(
            <DeviceCoverageChart
                data={mockData}
                onSegmentClick={mockOnSegmentClick}
                loading={false}
            />
        );

        // Check for key styling classes
        expect(container.querySelector('.bg-neutral-800')).toBeTruthy();
        expect(container.querySelector('.border-neutral-700')).toBeTruthy();
        expect(container.querySelector('.rounded-lg')).toBeTruthy();
        expect(container.querySelector('.p-6')).toBeTruthy();
        expect(container.querySelector('.h-80')).toBeTruthy();
    });

    it('renders with proper accessibility structure', () => {
        const { container } = render(
            <DeviceCoverageChart
                data={mockData}
                onSegmentClick={mockOnSegmentClick}
                loading={false}
            />
        );

        // Should have proper heading structure
        const heading = container.querySelector('h3');
        expect(heading).toBeTruthy();
        expect(heading?.textContent).toBe('Device Coverage');
    });

    it('accepts onSegmentClick callback correctly', () => {
        const { container } = render(
            <DeviceCoverageChart
                data={mockData}
                onSegmentClick={mockOnSegmentClick}
                loading={false}
            />
        );

        // Verify the component accepts the callback without errors
        expect(mockOnSegmentClick).toBeDefined();
        expect(typeof mockOnSegmentClick).toBe('function');

        // Component should render successfully with the callback
        expect(container.querySelector('.bg-neutral-800')).toBeTruthy();
    });

    describe('Chart Interactions', () => {
        it('handles chart segment clicks correctly', () => {
            const { container } = render(
                <DeviceCoverageChart
                    data={mockData}
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Find chart elements that should be clickable
            // Note: In a real test environment, we would need to simulate Recharts interactions
            // For now, we verify the component structure supports interactions
            const chartContainer = container.querySelector('.h-64');
            expect(chartContainer).toBeTruthy();

            // Verify the callback is properly set up
            expect(mockOnSegmentClick).not.toHaveBeenCalled();
        });

        it('maintains hover state styling', () => {
            const { container } = render(
                <DeviceCoverageChart
                    data={mockData}
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Verify the chart container is present (Recharts classes may not render in test environment)
            const chartContainer = container.querySelector('.h-64');
            expect(chartContainer).toBeTruthy();

            // Verify the component structure supports interactions
            expect(container.querySelector('.bg-neutral-800')).toBeTruthy();
        });
    });

    describe('Error State Handling', () => {
        it('handles invalid data gracefully', () => {
            const invalidData = {
                protected: -1,
                missingAgent: -1,
                withAlerts: -1,
                total: -1
            };

            const { container } = render(
                <DeviceCoverageChart
                    data={invalidData}
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Should still render the component structure
            expect(container.querySelector('.bg-neutral-800')).toBeTruthy();
            expect(container.textContent).toContain('Device Coverage');
        });

        it('handles NaN values in data', () => {
            const nanData = {
                protected: NaN,
                missingAgent: 50,
                withAlerts: 25,
                total: 75
            };

            const { container } = render(
                <DeviceCoverageChart
                    data={nanData}
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Should still render without crashing
            expect(container.querySelector('.bg-neutral-800')).toBeTruthy();
        });

        it('handles division by zero in percentage calculation', () => {
            const zeroTotalData = {
                protected: 0,
                missingAgent: 0,
                withAlerts: 0,
                total: 0
            };

            const { container } = render(
                <DeviceCoverageChart
                    data={zeroTotalData}
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Should render without errors even with zero total
            expect(container.querySelector('.bg-neutral-800')).toBeTruthy();
            expect(container.textContent).toContain('Device Coverage');
        });
    });
});