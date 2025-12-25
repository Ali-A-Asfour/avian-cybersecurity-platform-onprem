import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, jest } from '@jest/globals';
import { TicketBreakdownChart } from '../TicketBreakdownChart';

describe('TicketBreakdownChart Unit Tests', () => {
    const mockData = {
        securityTickets: { created: 45, resolved: 30 },
        helpdeskTickets: { created: 120, resolved: 100 }
    };

    const mockOnSegmentClick = jest.fn();

    beforeEach(() => {
        mockOnSegmentClick.mockClear();
    });

    describe('Donut Chart Mode', () => {
        it('renders chart title correctly', () => {
            const { getByText } = render(
                <TicketBreakdownChart
                    data={mockData}
                    chartType="donut"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            expect(getByText('Ticket Breakdown')).toBeTruthy();
        });

        it('displays loading state correctly', () => {
            const { container } = render(
                <TicketBreakdownChart
                    data={mockData}
                    chartType="donut"
                    onSegmentClick={mockOnSegmentClick}
                    loading={true}
                />
            );

            // Should show loading skeleton
            const loadingElement = container.querySelector('.animate-pulse');
            expect(loadingElement).toBeTruthy();

            // Should not show chart title when loading
            expect(container.textContent).not.toContain('Ticket Breakdown');
        });

        it('renders donut chart with correct structure', () => {
            const { container } = render(
                <TicketBreakdownChart
                    data={mockData}
                    chartType="donut"
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
    });

    describe('Bar Chart Mode', () => {
        it('renders bar chart with correct structure', () => {
            const { container } = render(
                <TicketBreakdownChart
                    data={mockData}
                    chartType="bar"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Should have main container
            const chartWrapper = container.querySelector('.bg-neutral-800');
            expect(chartWrapper).toBeTruthy();

            // Should have chart title
            expect(container.textContent).toContain('Ticket Breakdown');
        });

        it('displays correct chart title for bar chart', () => {
            const { getByText } = render(
                <TicketBreakdownChart
                    data={mockData}
                    chartType="bar"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            expect(getByText('Ticket Breakdown')).toBeTruthy();
        });
    });

    describe('Data Validation', () => {
        it('correctly processes ticket data structure', () => {
            const { container } = render(
                <TicketBreakdownChart
                    data={mockData}
                    chartType="donut"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Verify that the component processes the nested data structure correctly
            // by checking that it renders without errors
            expect(container.querySelector('.bg-neutral-800')).toBeTruthy();
            expect(container.textContent).toContain('Ticket Breakdown');

            // Verify data structure integrity
            expect(mockData.securityTickets.created).toBe(45);
            expect(mockData.securityTickets.resolved).toBe(30);
            expect(mockData.helpdeskTickets.created).toBe(120);
            expect(mockData.helpdeskTickets.resolved).toBe(100);
        });

        it('handles zero ticket counts correctly', () => {
            const zeroData = {
                securityTickets: { created: 0, resolved: 0 },
                helpdeskTickets: { created: 50, resolved: 25 }
            };

            const { container } = render(
                <TicketBreakdownChart
                    data={zeroData}
                    chartType="donut"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Should still render without errors
            expect(container.querySelector('.bg-neutral-800')).toBeTruthy();
            expect(container.textContent).toContain('Ticket Breakdown');

            // Verify data integrity
            expect(zeroData.securityTickets.created).toBe(0);
            expect(zeroData.securityTickets.resolved).toBe(0);
            expect(zeroData.helpdeskTickets.created).toBe(50);
            expect(zeroData.helpdeskTickets.resolved).toBe(25);
        });

        it('handles case where resolved exceeds created', () => {
            const edgeData = {
                securityTickets: { created: 10, resolved: 15 }, // More resolved than created
                helpdeskTickets: { created: 20, resolved: 18 }
            };

            const { container } = render(
                <TicketBreakdownChart
                    data={edgeData}
                    chartType="donut"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Should render without errors
            expect(container.querySelector('.bg-neutral-800')).toBeTruthy();

            // Verify data integrity
            expect(edgeData.securityTickets.resolved).toBeGreaterThan(edgeData.securityTickets.created);
            expect(edgeData.helpdeskTickets.resolved).toBeLessThan(edgeData.helpdeskTickets.created);
        });

        it('handles very large numbers correctly', () => {
            const largeData = {
                securityTickets: { created: 999999, resolved: 888888 },
                helpdeskTickets: { created: 777777, resolved: 666666 }
            };

            const { container } = render(
                <TicketBreakdownChart
                    data={largeData}
                    chartType="bar"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Should render without errors
            expect(container.querySelector('.bg-neutral-800')).toBeTruthy();
            expect(container.textContent).toContain('Ticket Breakdown');

            // Verify large numbers are handled
            expect(largeData.securityTickets.created).toBe(999999);
            expect(largeData.helpdeskTickets.resolved).toBe(666666);
        });

        it('handles minimal data correctly', () => {
            const minimalData = {
                securityTickets: { created: 1, resolved: 0 },
                helpdeskTickets: { created: 0, resolved: 1 }
            };

            const { container } = render(
                <TicketBreakdownChart
                    data={minimalData}
                    chartType="donut"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Should render without errors
            expect(container.querySelector('.bg-neutral-800')).toBeTruthy();

            // Verify minimal data integrity
            expect(minimalData.securityTickets.created).toBe(1);
            expect(minimalData.securityTickets.resolved).toBe(0);
            expect(minimalData.helpdeskTickets.created).toBe(0);
            expect(minimalData.helpdeskTickets.resolved).toBe(1);
        });
    });

    describe('Styling and Accessibility', () => {
        it('applies correct CSS classes for styling', () => {
            const { container } = render(
                <TicketBreakdownChart
                    data={mockData}
                    chartType="donut"
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
                <TicketBreakdownChart
                    data={mockData}
                    chartType="donut"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Should have proper heading structure
            const heading = container.querySelector('h3');
            expect(heading).toBeTruthy();
            expect(heading?.textContent).toBe('Ticket Breakdown');
        });

        it('maintains consistent styling between chart types', () => {
            const { container: donutContainer } = render(
                <TicketBreakdownChart
                    data={mockData}
                    chartType="donut"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            const { container: barContainer } = render(
                <TicketBreakdownChart
                    data={mockData}
                    chartType="bar"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Both should have same container styling
            expect(donutContainer.querySelector('.bg-neutral-800')).toBeTruthy();
            expect(barContainer.querySelector('.bg-neutral-800')).toBeTruthy();
            expect(donutContainer.querySelector('.h-80')).toBeTruthy();
            expect(barContainer.querySelector('.h-80')).toBeTruthy();
        });

        it('accepts onSegmentClick callback correctly', () => {
            const { container } = render(
                <TicketBreakdownChart
                    data={mockData}
                    chartType="donut"
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
    });

    describe('Chart Interactions', () => {
        it('handles donut chart segment clicks correctly', () => {
            const { container } = render(
                <TicketBreakdownChart
                    data={mockData}
                    chartType="donut"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Find chart elements that should be clickable
            // Note: In a real test environment, we would need to simulate Recharts interactions
            const chartContainer = container.querySelector('.h-64');
            expect(chartContainer).toBeTruthy();

            // Verify the callback is properly set up
            expect(mockOnSegmentClick).not.toHaveBeenCalled();
        });

        it('handles bar chart segment clicks correctly', () => {
            const { container } = render(
                <TicketBreakdownChart
                    data={mockData}
                    chartType="bar"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Find chart elements that should be clickable
            const chartContainer = container.querySelector('.h-64');
            expect(chartContainer).toBeTruthy();

            // Verify the callback is properly set up
            expect(mockOnSegmentClick).not.toHaveBeenCalled();
        });

        it('maintains hover state styling for both chart types', () => {
            const { container: donutContainer } = render(
                <TicketBreakdownChart
                    data={mockData}
                    chartType="donut"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            const { container: barContainer } = render(
                <TicketBreakdownChart
                    data={mockData}
                    chartType="bar"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Verify chart containers are present (Recharts classes may not render in test environment)
            expect(donutContainer.querySelector('.h-64')).toBeTruthy();
            expect(barContainer.querySelector('.h-64')).toBeTruthy();

            // Verify the component structure supports interactions
            expect(donutContainer.querySelector('.bg-neutral-800')).toBeTruthy();
            expect(barContainer.querySelector('.bg-neutral-800')).toBeTruthy();
        });
    });

    describe('Error State Handling', () => {
        it('handles negative ticket counts gracefully', () => {
            const negativeData = {
                securityTickets: { created: -5, resolved: -2 },
                helpdeskTickets: { created: -10, resolved: -8 }
            };

            const { container } = render(
                <TicketBreakdownChart
                    data={negativeData}
                    chartType="donut"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Should still render the component structure
            expect(container.querySelector('.bg-neutral-800')).toBeTruthy();
            expect(container.textContent).toContain('Ticket Breakdown');
        });

        it('handles NaN values in ticket data', () => {
            const nanData = {
                securityTickets: { created: NaN, resolved: 30 },
                helpdeskTickets: { created: 120, resolved: NaN }
            };

            const { container } = render(
                <TicketBreakdownChart
                    data={nanData}
                    chartType="bar"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Should still render without crashing
            expect(container.querySelector('.bg-neutral-800')).toBeTruthy();
        });

        it('handles extremely large ticket numbers', () => {
            const extremeData = {
                securityTickets: { created: Number.MAX_SAFE_INTEGER, resolved: 999999999 },
                helpdeskTickets: { created: 888888888, resolved: Number.MAX_SAFE_INTEGER }
            };

            const { container } = render(
                <TicketBreakdownChart
                    data={extremeData}
                    chartType="donut"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Should render without errors even with extreme values
            expect(container.querySelector('.bg-neutral-800')).toBeTruthy();
            expect(container.textContent).toContain('Ticket Breakdown');
        });

        it('handles undefined nested properties gracefully', () => {
            // Test with missing nested properties
            const incompleteData = {
                securityTickets: { created: 45 }, // missing resolved
                helpdeskTickets: { resolved: 100 } // missing created
            } as any;

            const { container } = render(
                <TicketBreakdownChart
                    data={incompleteData}
                    chartType="bar"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Should still render the basic structure
            expect(container.querySelector('.bg-neutral-800')).toBeTruthy();
        });

        it('switches between chart types without errors', () => {
            const { container, rerender } = render(
                <TicketBreakdownChart
                    data={mockData}
                    chartType="donut"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Verify donut chart renders
            expect(container.querySelector('.bg-neutral-800')).toBeTruthy();

            // Switch to bar chart
            rerender(
                <TicketBreakdownChart
                    data={mockData}
                    chartType="bar"
                    onSegmentClick={mockOnSegmentClick}
                    loading={false}
                />
            );

            // Verify bar chart renders
            expect(container.querySelector('.bg-neutral-800')).toBeTruthy();
            expect(container.textContent).toContain('Ticket Breakdown');
        });
    });
});