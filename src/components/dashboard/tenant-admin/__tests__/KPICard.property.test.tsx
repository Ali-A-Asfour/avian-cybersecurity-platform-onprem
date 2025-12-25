import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import { KPICard } from '../KPICard';

/**
 * **Feature: tenant-admin-dashboard, Property 1: KPI Card Rendering Completeness**
 * **Validates: Requirements 1.1, 1.2**
 */
describe('KPICard Property-Based Tests', () => {
    // Generator for valid KPI card props with unique identifiers to avoid conflicts
    const kpiCardPropsGenerator = fc.record({
        title: fc.string({ minLength: 5, maxLength: 50 }).map(s => `title-${s.replace(/[^a-zA-Z0-9]/g, 'x')}`),
        value: fc.oneof(
            fc.nat(999999), // number values
            fc.string({ minLength: 5, maxLength: 20 }).map(s => `val-${s.replace(/[^a-zA-Z0-9]/g, 'x')}`) // string values
        ),
        subtitle: fc.string({ minLength: 5, maxLength: 100 }).map(s => `subtitle-${s.replace(/[^a-zA-Z0-9]/g, 'x')}`),
        trend: fc.option(fc.constantFrom('up', 'down', 'stable')),
        trendValue: fc.option(fc.integer({ min: 0, max: 999 })),
        loading: fc.constantFrom(false), // Only test non-loading state for this property
        error: fc.constantFrom(undefined) // Only test non-error state for this property
    });

    it('Property 1: KPI Card Rendering Completeness - For any valid dashboard data, all KPI cards should render with title, primary number, and subtitle elements present', () => {
        fc.assert(
            fc.property(
                kpiCardPropsGenerator,
                (props) => {
                    const mockOnClick = jest.fn();

                    // Create a unique container for each test to avoid DOM conflicts
                    const testContainer = document.createElement('div');
                    document.body.appendChild(testContainer);

                    const { container, getByText } = render(
                        <KPICard
                            {...props}
                            onClick={mockOnClick}
                        />,
                        { container: testContainer }
                    );

                    try {
                        // Verify that title element is present and contains the title text
                        const titleElement = getByText(props.title);
                        expect(titleElement).toBeInTheDocument();
                        expect(titleElement).toHaveClass('text-neutral-300', 'text-sm', 'font-medium', 'mb-2');

                        // Verify that value element is present and contains the value
                        const valueElement = getByText(String(props.value));
                        expect(valueElement).toBeInTheDocument();
                        expect(valueElement).toHaveClass('text-white', 'text-xl', 'sm:text-2xl', 'font-bold');

                        // Verify that subtitle element is present and contains the subtitle text
                        const subtitleElement = getByText(props.subtitle);
                        expect(subtitleElement).toBeInTheDocument();
                        expect(subtitleElement).toHaveClass('text-neutral-400', 'text-xs');

                        // Verify the component is clickable (has role button and tabIndex)
                        const cardElement = container.querySelector('[role="button"]');
                        expect(cardElement).toBeInTheDocument();
                        expect(cardElement).toHaveAttribute('tabIndex', '0');

                        // Verify trend display if trend and trendValue are provided
                        if (props.trend && props.trendValue !== undefined && props.trendValue !== null) {
                            const trendText = getByText(new RegExp(`${props.trendValue}%`));
                            expect(trendText).toBeInTheDocument();

                            // Verify trend arrow is present (in a separate span)
                            const trendSymbol = props.trend === 'up' ? '↗' :
                                props.trend === 'down' ? '↘' : '→';
                            const trendArrow = getByText(trendSymbol);
                            expect(trendArrow).toBeInTheDocument();
                        }
                    } finally {
                        // Clean up the test container
                        document.body.removeChild(testContainer);
                    }

                    return true; // Property holds
                }
            ),
            { numRuns: 100 } // Minimum 100 iterations as per design requirements
        );
    });

    it('Property 1 Edge Cases: KPI Card handles loading and error states correctly', () => {
        fc.assert(
            fc.property(
                fc.record({
                    title: fc.string({ minLength: 5, maxLength: 50 }).map(s => `title-${s.replace(/[^a-zA-Z0-9]/g, 'x')}`),
                    value: fc.oneof(
                        fc.nat(999999),
                        fc.string({ minLength: 5, maxLength: 20 }).map(s => `val-${s.replace(/[^a-zA-Z0-9]/g, 'x')}`)
                    ),
                    subtitle: fc.string({ minLength: 5, maxLength: 100 }).map(s => `subtitle-${s.replace(/[^a-zA-Z0-9]/g, 'x')}`),
                    loading: fc.boolean(),
                    error: fc.option(fc.string({ minLength: 5, maxLength: 100 }).map(s => `error-${s.replace(/[^a-zA-Z0-9]/g, 'x')}`))
                }),
                (props) => {
                    const mockOnClick = jest.fn();

                    // Create a unique container for each test to avoid DOM conflicts
                    const testContainer = document.createElement('div');
                    document.body.appendChild(testContainer);

                    const { container, getByText, queryByText } = render(
                        <KPICard
                            title={props.title}
                            value={props.value}
                            subtitle={props.subtitle}
                            loading={props.loading}
                            error={props.error}
                            onClick={mockOnClick}
                        />,
                        { container: testContainer }
                    );

                    try {
                        if (props.loading) {
                            // In loading state, should show skeleton animation
                            const loadingElement = container.querySelector('.animate-pulse');
                            expect(loadingElement).toBeInTheDocument();

                            // Should not show actual content
                            expect(queryByText(props.title)).not.toBeInTheDocument();
                            expect(queryByText(String(props.value))).not.toBeInTheDocument();
                        } else if (props.error) {
                            // In error state, should show error message
                            expect(getByText(props.title)).toBeInTheDocument();
                            expect(getByText(props.error)).toBeInTheDocument();

                            // Should not show normal value and subtitle
                            expect(queryByText(String(props.value))).not.toBeInTheDocument();
                            expect(queryByText(props.subtitle)).not.toBeInTheDocument();
                        } else {
                            // In normal state, should show all content
                            expect(getByText(props.title)).toBeInTheDocument();
                            expect(getByText(String(props.value))).toBeInTheDocument();
                            expect(getByText(props.subtitle)).toBeInTheDocument();
                        }
                    } finally {
                        // Clean up the test container
                        document.body.removeChild(testContainer);
                    }

                    return true; // Property holds
                }
            ),
            { numRuns: 100 } // Minimum 100 iterations as per design requirements
        );
    });
});