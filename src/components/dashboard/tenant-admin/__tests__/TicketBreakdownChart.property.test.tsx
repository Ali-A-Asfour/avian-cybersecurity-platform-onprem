import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import { TicketBreakdownChart } from '../TicketBreakdownChart';

/**
 * **Feature: tenant-admin-dashboard, Property 11: Ticket Breakdown Chart Accuracy**
 * **Validates: Requirements 5.1, 5.2**
 * 
 * Note: This is an additional property test for ticket breakdown functionality
 * that complements the existing 10 properties in the design document.
 */
describe('TicketBreakdownChart Property Tests', () => {
    // Generator for valid ticket breakdown data
    const ticketBreakdownDataGenerator = fc.record({
        securityTickets: fc.record({
            created: fc.nat(1000),
            resolved: fc.nat(1000)
        }),
        helpdeskTickets: fc.record({
            created: fc.nat(1000),
            resolved: fc.nat(1000)
        })
    });

    const chartTypeGenerator = fc.constantFrom('donut', 'bar');

    it('Property 11: Ticket Breakdown Chart Accuracy - should display correct ticket counts for any valid data', () => {
        fc.assert(
            fc.property(
                ticketBreakdownDataGenerator,
                chartTypeGenerator,
                (data, chartType) => {
                    const mockOnSegmentClick = jest.fn();

                    const testContainer = document.createElement('div');
                    document.body.appendChild(testContainer);

                    try {
                        const { container, getByText } = render(
                            <TicketBreakdownChart
                                data={data}
                                chartType={chartType}
                                onSegmentClick={mockOnSegmentClick}
                                loading={false}
                            />,
                            { container: testContainer }
                        );

                        // Verify chart title is present
                        expect(getByText('Ticket Breakdown')).toBeInTheDocument();

                        // Verify the chart container is present
                        const chartContainer = container.querySelector('[role="img"]');
                        expect(chartContainer).toBeInTheDocument();

                        // Verify accessibility label contains the data
                        const expectedLabel = `Ticket breakdown chart: ${data.securityTickets.created} security tickets created, ${data.securityTickets.resolved} resolved. ${data.helpdeskTickets.created} helpdesk tickets created, ${data.helpdeskTickets.resolved} resolved.`;
                        expect(chartContainer).toHaveAttribute('aria-label', expectedLabel);

                        // Verify screen reader data is present
                        const screenReaderData = container.querySelector('.sr-only');
                        expect(screenReaderData).toBeInTheDocument();
                        expect(screenReaderData?.textContent).toContain(`Security tickets: ${data.securityTickets.created} created, ${data.securityTickets.resolved} resolved`);
                        expect(screenReaderData?.textContent).toContain(`Helpdesk tickets: ${data.helpdeskTickets.created} created, ${data.helpdeskTickets.resolved} resolved`);

                        return true;
                    } finally {
                        document.body.removeChild(testContainer);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 11: Ticket Breakdown Chart Accuracy - should handle zero values correctly', () => {
        fc.assert(
            fc.property(
                fc.record({
                    securityTickets: fc.record({
                        created: fc.constantFrom(0),
                        resolved: fc.constantFrom(0)
                    }),
                    helpdeskTickets: fc.record({
                        created: fc.constantFrom(0),
                        resolved: fc.constantFrom(0)
                    })
                }),
                chartTypeGenerator,
                (data, chartType) => {
                    const mockOnSegmentClick = jest.fn();

                    const testContainer = document.createElement('div');
                    document.body.appendChild(testContainer);

                    try {
                        const { container, getByText } = render(
                            <TicketBreakdownChart
                                data={data}
                                chartType={chartType}
                                onSegmentClick={mockOnSegmentClick}
                                loading={false}
                            />,
                            { container: testContainer }
                        );

                        // Should still render the chart with zero values
                        expect(getByText('Ticket Breakdown')).toBeInTheDocument();

                        const chartContainer = container.querySelector('[role="img"]');
                        expect(chartContainer).toBeInTheDocument();

                        // Verify zero values are handled in accessibility label
                        const expectedLabel = `Ticket breakdown chart: 0 security tickets created, 0 resolved. 0 helpdesk tickets created, 0 resolved.`;
                        expect(chartContainer).toHaveAttribute('aria-label', expectedLabel);

                        return true;
                    } finally {
                        document.body.removeChild(testContainer);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 11: Ticket Breakdown Chart Accuracy - should maintain data consistency between chart types', () => {
        fc.assert(
            fc.property(
                ticketBreakdownDataGenerator,
                (data) => {
                    const mockOnSegmentClick = jest.fn();

                    // Test both chart types with the same data
                    const chartTypes: ('donut' | 'bar')[] = ['donut', 'bar'];

                    for (const chartType of chartTypes) {
                        const testContainer = document.createElement('div');
                        document.body.appendChild(testContainer);

                        try {
                            const { container } = render(
                                <TicketBreakdownChart
                                    data={data}
                                    chartType={chartType}
                                    onSegmentClick={mockOnSegmentClick}
                                    loading={false}
                                />,
                                { container: testContainer }
                            );

                            // Both chart types should have the same accessibility information
                            const chartContainer = container.querySelector('[role="img"]');
                            expect(chartContainer).toBeInTheDocument();

                            const expectedLabel = `Ticket breakdown chart: ${data.securityTickets.created} security tickets created, ${data.securityTickets.resolved} resolved. ${data.helpdeskTickets.created} helpdesk tickets created, ${data.helpdeskTickets.resolved} resolved.`;
                            expect(chartContainer).toHaveAttribute('aria-label', expectedLabel);

                        } finally {
                            document.body.removeChild(testContainer);
                        }
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 11: Ticket Breakdown Chart Accuracy - should handle loading state correctly', () => {
        fc.assert(
            fc.property(
                ticketBreakdownDataGenerator,
                chartTypeGenerator,
                (data, chartType) => {
                    const mockOnSegmentClick = jest.fn();

                    const testContainer = document.createElement('div');
                    document.body.appendChild(testContainer);

                    try {
                        const { container, getByText } = render(
                            <TicketBreakdownChart
                                data={data}
                                chartType={chartType}
                                onSegmentClick={mockOnSegmentClick}
                                loading={true}
                            />,
                            { container: testContainer }
                        );

                        // Should show loading state
                        const loadingElement = container.querySelector('.animate-pulse');
                        expect(loadingElement).toBeInTheDocument();

                        // Should have loading accessibility label
                        const statusElement = container.querySelector('[role="status"]');
                        expect(statusElement).toBeInTheDocument();
                        expect(statusElement).toHaveAttribute('aria-label', 'Loading ticket breakdown data');

                        return true;
                    } finally {
                        document.body.removeChild(testContainer);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});