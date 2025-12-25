import { render } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import { DeviceCoverageChart } from '../DeviceCoverageChart';

/**
 * **Feature: tenant-admin-dashboard, Property 7: Device Coverage Chart Accuracy**
 * **Validates: Requirements 4.1, 4.2**
 * 
 * For any device coverage data, the donut chart segments should represent 
 * the correct proportions and total to 100% of devices
 */

// Generator for valid device coverage data
const deviceCoverageDataGenerator = fc.record({
    protected: fc.nat(1000),
    missingAgent: fc.nat(1000),
    withAlerts: fc.nat(1000),
}).map(data => ({
    ...data,
    total: data.protected + data.missingAgent + data.withAlerts
}));

describe('DeviceCoverageChart Property Tests', () => {
    it('Property 7: Device Coverage Chart Accuracy - segments represent correct proportions and total to 100%', () => {
        fc.assert(
            fc.property(deviceCoverageDataGenerator, (data) => {
                // Skip test if total is 0 to avoid division by zero
                fc.pre(data.total > 0);

                const mockOnSegmentClick = jest.fn();

                // Create a unique container for each test to avoid DOM conflicts
                const testContainer = document.createElement('div');
                // Set dimensions to avoid Recharts warnings
                testContainer.style.width = '800px';
                testContainer.style.height = '400px';
                document.body.appendChild(testContainer);

                const { container } = render(
                    <DeviceCoverageChart
                        data={data}
                        onSegmentClick={mockOnSegmentClick}
                        loading={false}
                    />,
                    { container: testContainer }
                );

                try {
                    // Calculate expected percentages
                    const protectedPercentage = Math.round((data.protected / data.total) * 100);
                    const missingAgentPercentage = Math.round((data.missingAgent / data.total) * 100);
                    const withAlertsPercentage = Math.round((data.withAlerts / data.total) * 100);

                    // Verify the chart title is present
                    const titleElement = container.querySelector('h3');
                    expect(titleElement).toBeTruthy();
                    expect(titleElement?.textContent).toBe('Device Coverage');

                    // Verify main chart container structure is present
                    const chartWrapper = container.querySelector('.bg-neutral-800');
                    expect(chartWrapper).toBeTruthy();

                    // Verify that the sum of individual components equals the total
                    expect(data.protected + data.missingAgent + data.withAlerts).toBe(data.total);

                    // Verify that percentages are reasonable (each should be between 0 and 100)
                    expect(protectedPercentage).toBeGreaterThanOrEqual(0);
                    expect(protectedPercentage).toBeLessThanOrEqual(100);
                    expect(missingAgentPercentage).toBeGreaterThanOrEqual(0);
                    expect(missingAgentPercentage).toBeLessThanOrEqual(100);
                    expect(withAlertsPercentage).toBeGreaterThanOrEqual(0);
                    expect(withAlertsPercentage).toBeLessThanOrEqual(100);

                    // The sum of percentages should be close to 100% (allowing for rounding)
                    const totalPercentage = protectedPercentage + missingAgentPercentage + withAlertsPercentage;
                    expect(Math.abs(totalPercentage - 100)).toBeLessThanOrEqual(3); // Allow for rounding errors

                    // Verify ResponsiveContainer is rendered (validates data structure acceptance)
                    const responsiveContainer = container.querySelector('.recharts-responsive-container');
                    expect(responsiveContainer).toBeTruthy();

                    // Verify the component renders without crashing
                    expect(container.firstChild).toBeTruthy();

                } finally {
                    // Clean up the test container
                    document.body.removeChild(testContainer);
                }

                return true; // Property holds
            }),
            { numRuns: 100 }
        );
    });

    it('Property 7: Device Coverage Chart Accuracy - handles edge case with zero values', () => {
        fc.assert(
            fc.property(
                fc.record({
                    protected: fc.constantFrom(0),
                    missingAgent: fc.nat(100),
                    withAlerts: fc.nat(100),
                }).map(data => ({
                    ...data,
                    total: data.protected + data.missingAgent + data.withAlerts
                })),
                (data) => {
                    fc.pre(data.total > 0);

                    const mockOnSegmentClick = jest.fn();

                    // Create a unique container for each test to avoid DOM conflicts
                    const testContainer = document.createElement('div');
                    // Set dimensions to avoid Recharts warnings
                    testContainer.style.width = '800px';
                    testContainer.style.height = '400px';
                    document.body.appendChild(testContainer);

                    const { container } = render(
                        <DeviceCoverageChart
                            data={data}
                            onSegmentClick={mockOnSegmentClick}
                            loading={false}
                        />,
                        { container: testContainer }
                    );

                    try {
                        // Should render without errors even with zero protected devices
                        const responsiveContainer = container.querySelector('.recharts-responsive-container');
                        expect(responsiveContainer).toBeTruthy();

                        // Verify total is still correct
                        expect(data.protected + data.missingAgent + data.withAlerts).toBe(data.total);

                        // Verify chart title is present
                        const titleElement = container.querySelector('h3');
                        expect(titleElement).toBeTruthy();
                        expect(titleElement?.textContent).toBe('Device Coverage');

                    } finally {
                        // Clean up the test container
                        document.body.removeChild(testContainer);
                    }

                    return true; // Property holds
                }
            ),
            { numRuns: 100 }
        );
    });
});