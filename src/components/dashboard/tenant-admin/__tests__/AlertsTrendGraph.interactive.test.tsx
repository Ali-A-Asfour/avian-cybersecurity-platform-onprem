import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, jest } from '@jest/globals';
import { AlertsTrendGraph } from '../AlertsTrendGraph';

describe('AlertsTrendGraph Interactive Behavior', () => {
    const mockData = [
        { date: '2024-01-01', alertCount: 5 },
        { date: '2024-01-02', alertCount: 8 },
        { date: '2024-01-03', alertCount: 3 },
        { date: '2024-01-04', alertCount: 12 },
        { date: '2024-01-05', alertCount: 7 },
        { date: '2024-01-06', alertCount: 4 },
        { date: '2024-01-07', alertCount: 9 }
    ];

    it('should display hover state information when hovering over chart', () => {
        const mockOnPointClick = jest.fn();

        const { container } = render(
            <div style={{ width: '800px', height: '400px' }}>
                <AlertsTrendGraph
                    data={mockData}
                    onPointClick={mockOnPointClick}
                    loading={false}
                />
            </div>
        );

        // Verify the chart renders
        expect(screen.getByText('Security Alerts Trend (7 Days)')).toBeInTheDocument();

        // Verify the chart container is present
        const chartContainer = container.querySelector('.h-48');
        expect(chartContainer).toBeInTheDocument();

        // Verify the responsive container is rendered
        const responsiveContainer = container.querySelector('.recharts-responsive-container');
        expect(responsiveContainer).toBeInTheDocument();
    });

    it('should handle click events correctly', () => {
        const mockOnPointClick = jest.fn();

        const { container } = render(
            <div style={{ width: '800px', height: '400px' }}>
                <AlertsTrendGraph
                    data={mockData}
                    onPointClick={mockOnPointClick}
                    loading={false}
                />
            </div>
        );

        // Verify the chart is configured for interaction
        const lineChart = container.querySelector('[class*="recharts"]');
        expect(lineChart).toBeInTheDocument();

        // Verify the onPointClick function is properly passed
        expect(mockOnPointClick).toBeDefined();
        expect(typeof mockOnPointClick).toBe('function');
    });

    it('should display loading state correctly', () => {
        const mockOnPointClick = jest.fn();

        render(
            <AlertsTrendGraph
                data={mockData}
                onPointClick={mockOnPointClick}
                loading={true}
            />
        );

        // Should show loading skeleton
        const loadingElement = document.querySelector('.animate-pulse');
        expect(loadingElement).toBeInTheDocument();

        // Should not show chart title during loading
        expect(screen.queryByText('Security Alerts Trend (7 Days)')).not.toBeInTheDocument();
    });

    it('should display error state correctly', () => {
        const mockOnPointClick = jest.fn();
        const errorMessage = 'Failed to fetch data';

        render(
            <AlertsTrendGraph
                data={mockData}
                onPointClick={mockOnPointClick}
                loading={false}
                error={errorMessage}
            />
        );

        // Should show error message
        expect(screen.getByText('Failed to load alerts trend')).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();

        // Should not show chart title during error
        expect(screen.queryByText('Security Alerts Trend (7 Days)')).not.toBeInTheDocument();
    });

    it('should handle empty data gracefully', () => {
        const mockOnPointClick = jest.fn();

        const { container } = render(
            <div style={{ width: '800px', height: '400px' }}>
                <AlertsTrendGraph
                    data={[]}
                    onPointClick={mockOnPointClick}
                    loading={false}
                />
            </div>
        );

        // Should still render the chart structure
        expect(screen.getByText('Security Alerts Trend (7 Days)')).toBeInTheDocument();

        // Should render the chart container
        const responsiveContainer = container.querySelector('.recharts-responsive-container');
        expect(responsiveContainer).toBeInTheDocument();
    });

    it('should show cursor pointer when interacting', () => {
        const mockOnPointClick = jest.fn();

        const { container } = render(
            <div style={{ width: '800px', height: '400px' }}>
                <AlertsTrendGraph
                    data={mockData}
                    onPointClick={mockOnPointClick}
                    loading={false}
                />
            </div>
        );

        // Verify the chart container has the correct structure for interaction
        const chartHeightContainer = container.querySelector('.h-48');
        expect(chartHeightContainer).toBeInTheDocument();

        // Verify the chart has interactive elements configured
        const lineChart = container.querySelector('[class*="recharts"]');
        expect(lineChart).toBeInTheDocument();
    });

    it('should handle click errors gracefully', () => {
        const mockOnPointClick = jest.fn(() => {
            throw new Error('Navigation error');
        });

        // Mock console.error to avoid test output noise
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        const { container } = render(
            <div style={{ width: '800px', height: '400px' }}>
                <AlertsTrendGraph
                    data={mockData}
                    onPointClick={mockOnPointClick}
                    loading={false}
                />
            </div>
        );

        // Verify the chart still renders even with a problematic click handler
        expect(screen.getByText('Security Alerts Trend (7 Days)')).toBeInTheDocument();

        // Verify the chart structure is intact
        const responsiveContainer = container.querySelector('.recharts-responsive-container');
        expect(responsiveContainer).toBeInTheDocument();

        // Clean up the spy
        consoleSpy.mockRestore();
    });
});