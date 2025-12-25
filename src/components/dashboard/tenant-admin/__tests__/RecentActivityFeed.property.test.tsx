import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, cleanup } from '@testing-library/react';
import fc from 'fast-check';
import { RecentActivityFeed } from '../RecentActivityFeed';

/**
 * **Feature: tenant-admin-dashboard, Property 8: Activity Feed Limitation**
 * **Validates: Requirements 6.1, 6.2**
 */

describe('RecentActivityFeed Property Tests', () => {
    beforeEach(() => {
        cleanup();
    });

    // Generator for activity items with more realistic data
    const activityItemGenerator = fc.record({
        id: fc.integer({ min: 1, max: 1000000 }).map(n => `activity-${n}-${Math.random().toString(36).substr(2, 9)}`),
        timestamp: fc.integer({ min: 0, max: Date.now() }).map(timestamp => new Date(timestamp).toISOString()),
        description: fc.string({ minLength: 10, maxLength: 100 })
            .filter(s => s.trim().length >= 10)
            .map(s => s.replace(/\s+/g, ' ').trim()), // Normalize whitespace
        type: fc.constantFrom('alert', 'compliance', 'device', 'ticket', 'integration'),
        icon: fc.constantFrom('🚨', '⚠️', '💻', '🎫', '🔗', '✅', '❌', '🔧')
    });

    it('Property 8: Activity Feed Limitation - should display exactly 3 most recent activities regardless of input size', () => {
        fc.assert(
            fc.property(
                fc.array(activityItemGenerator, { minLength: 1, maxLength: 20 }),
                (activities) => {
                    cleanup();

                    const mockOnClick = jest.fn();

                    render(
                        <RecentActivityFeed
                            activities={activities}
                            onActivityClick={mockOnClick}
                        />
                    );

                    // Should always display exactly 3 activities or fewer if input has less than 3
                    const expectedCount = Math.min(3, activities.length);
                    const activityButtons = screen.getAllByRole('button');

                    expect(activityButtons).toHaveLength(expectedCount);

                    // Verify that the displayed activities contain the expected content
                    // (checking that description and icon are present, not exact text match)
                    const displayedActivities = activities.slice(0, 3);

                    displayedActivities.forEach((activity, index) => {
                        const button = activityButtons[index];
                        // Check that the button contains the description text (partial match)
                        expect(button.textContent).toContain(activity.description);
                        expect(button.textContent).toContain(activity.icon);
                    });
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 8: Activity Feed Limitation - should never display more than 3 activities', () => {
        fc.assert(
            fc.property(
                fc.array(activityItemGenerator, { minLength: 4, maxLength: 50 }),
                (activities) => {
                    cleanup();

                    const mockOnClick = jest.fn();

                    render(
                        <RecentActivityFeed
                            activities={activities}
                            onActivityClick={mockOnClick}
                        />
                    );

                    // Should never display more than 3 activities, even with large input arrays
                    const activityButtons = screen.getAllByRole('button');
                    expect(activityButtons.length).toBeLessThanOrEqual(3);
                    expect(activityButtons).toHaveLength(3);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 8: Activity Feed Limitation - should handle empty activity arrays gracefully', () => {
        cleanup();

        const mockOnClick = jest.fn();

        render(
            <RecentActivityFeed
                activities={[]}
                onActivityClick={mockOnClick}
            />
        );

        // Should display no activity buttons when array is empty
        const activityButtons = screen.queryAllByRole('button');
        expect(activityButtons).toHaveLength(0);

        // Should display empty state message
        expect(screen.getByText('No recent activity to display')).toBeInTheDocument();
    });

    it('Property 8: Activity Feed Limitation - should preserve order of first 3 activities', () => {
        fc.assert(
            fc.property(
                fc.array(activityItemGenerator, { minLength: 5, maxLength: 20 }),
                (activities) => {
                    cleanup();

                    const mockOnClick = jest.fn();

                    render(
                        <RecentActivityFeed
                            activities={activities}
                            onActivityClick={mockOnClick}
                        />
                    );

                    const activityButtons = screen.getAllByRole('button');
                    expect(activityButtons).toHaveLength(3);

                    // Verify that the order is preserved - first 3 activities should appear in the same order
                    const firstThreeActivities = activities.slice(0, 3);

                    firstThreeActivities.forEach((activity, index) => {
                        const button = activityButtons[index];
                        expect(button.textContent).toContain(activity.description);
                    });
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 8: Activity Feed Limitation - should handle arrays with exactly 3 activities', () => {
        fc.assert(
            fc.property(
                fc.array(activityItemGenerator, { minLength: 3, maxLength: 3 }),
                (activities) => {
                    cleanup();

                    const mockOnClick = jest.fn();

                    render(
                        <RecentActivityFeed
                            activities={activities}
                            onActivityClick={mockOnClick}
                        />
                    );

                    const activityButtons = screen.getAllByRole('button');
                    expect(activityButtons).toHaveLength(3);

                    // All 3 activities should be displayed
                    activities.forEach((activity, index) => {
                        const button = activityButtons[index];
                        expect(button.textContent).toContain(activity.description);
                    });
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 8: Activity Feed Limitation - should limit to exactly 3 items for any array size', () => {
        fc.assert(
            fc.property(
                fc.array(activityItemGenerator, { minLength: 1, maxLength: 100 }),
                (activities) => {
                    cleanup();

                    const mockOnClick = jest.fn();

                    render(
                        <RecentActivityFeed
                            activities={activities}
                            onActivityClick={mockOnClick}
                        />
                    );

                    const activityButtons = screen.getAllByRole('button');
                    const expectedCount = Math.min(3, activities.length);

                    // Core property: never more than 3, and exactly the minimum of input length and 3
                    expect(activityButtons).toHaveLength(expectedCount);
                    expect(activityButtons.length).toBeLessThanOrEqual(3);
                }
            ),
            { numRuns: 100 }
        );
    });
});