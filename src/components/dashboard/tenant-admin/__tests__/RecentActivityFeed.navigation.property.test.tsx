import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import fc from 'fast-check';
import { RecentActivityFeed } from '../RecentActivityFeed';

/**
 * **Feature: tenant-admin-dashboard, Property 10: Navigation Type-based Routing**
 * **Validates: Requirements 9.6**
 */

describe('RecentActivityFeed Navigation Property Tests', () => {
    beforeEach(() => {
        cleanup();
    });

    // Generator for activity items with specific types
    const activityItemGenerator = fc.record({
        id: fc.integer({ min: 1, max: 1000000 }).map(n => `activity-${n}-${Math.random()}`),
        timestamp: fc.integer({ min: 0, max: Date.now() }).map(timestamp => new Date(timestamp).toISOString()),
        description: fc.string({ minLength: 10, maxLength: 100 })
            .filter(s => s.trim().length >= 10)
            .map(s => s.replace(/\s+/g, ' ').trim()),
        type: fc.constantFrom('alert', 'compliance', 'device', 'ticket', 'integration'),
        icon: fc.constantFrom('🚨', '⚠️', '💻', '🎫', '🔗', '✅', '❌', '🔧')
    });

    it('Property 10: Navigation Type-based Routing - should call onActivityClick with correct activity for any activity type', () => {
        fc.assert(
            fc.property(
                fc.array(activityItemGenerator, { minLength: 1, maxLength: 10 }),
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
                    const displayedActivities = activities.slice(0, 3); // Component shows max 3

                    // Test clicking each displayed activity
                    displayedActivities.forEach((expectedActivity, index) => {
                        if (index < activityButtons.length) {
                            const button = activityButtons[index];

                            // Clear previous calls
                            mockOnClick.mockClear();

                            // Click the button
                            fireEvent.click(button);

                            // Verify the callback was called with the correct activity
                            expect(mockOnClick).toHaveBeenCalledTimes(1);
                            expect(mockOnClick).toHaveBeenCalledWith(expectedActivity);

                            // Verify the activity has the expected type
                            const calledActivity = mockOnClick.mock.calls[0][0];
                            expect(['alert', 'compliance', 'device', 'ticket', 'integration']).toContain(calledActivity.type);
                            expect(calledActivity.type).toBe(expectedActivity.type);
                        }
                    });
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 10: Navigation Type-based Routing - should preserve activity type information for navigation routing', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('alert', 'compliance', 'device', 'ticket', 'integration'),
                fc.string({ minLength: 10, maxLength: 50 }).map(s => s.replace(/\s+/g, ' ').trim()),
                fc.constantFrom('🚨', '⚠️', '💻', '🎫', '🔗'),
                (activityType, description, icon) => {
                    cleanup();

                    const activity = {
                        id: `test-${Math.random()}`,
                        timestamp: new Date().toISOString(),
                        description,
                        type: activityType,
                        icon
                    };

                    const mockOnClick = jest.fn();

                    render(
                        <RecentActivityFeed
                            activities={[activity]}
                            onActivityClick={mockOnClick}
                        />
                    );

                    const button = screen.getByRole('button');
                    fireEvent.click(button);

                    // Verify the callback receives the activity with correct type for routing
                    expect(mockOnClick).toHaveBeenCalledTimes(1);
                    const calledActivity = mockOnClick.mock.calls[0][0];

                    // The type should match exactly for proper navigation routing
                    expect(calledActivity.type).toBe(activityType);
                    expect(calledActivity.id).toBe(activity.id);
                    expect(calledActivity.description).toBe(activity.description);

                    // Verify all required fields for navigation are present
                    expect(calledActivity).toHaveProperty('id');
                    expect(calledActivity).toHaveProperty('type');
                    expect(calledActivity).toHaveProperty('timestamp');
                    expect(calledActivity).toHaveProperty('description');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 10: Navigation Type-based Routing - should handle keyboard navigation with correct activity data', () => {
        fc.assert(
            fc.property(
                activityItemGenerator,
                (activity) => {
                    cleanup();

                    const mockOnClick = jest.fn();

                    render(
                        <RecentActivityFeed
                            activities={[activity]}
                            onActivityClick={mockOnClick}
                        />
                    );

                    const button = screen.getByRole('button');

                    // Test Enter key navigation
                    mockOnClick.mockClear();
                    fireEvent.keyDown(button, { key: 'Enter' });

                    expect(mockOnClick).toHaveBeenCalledTimes(1);
                    expect(mockOnClick).toHaveBeenCalledWith(activity);

                    // Test Space key navigation
                    mockOnClick.mockClear();
                    fireEvent.keyDown(button, { key: ' ' });

                    expect(mockOnClick).toHaveBeenCalledTimes(1);
                    expect(mockOnClick).toHaveBeenCalledWith(activity);

                    // Verify activity type is preserved for navigation
                    const calledActivity = mockOnClick.mock.calls[0][0];
                    expect(calledActivity.type).toBe(activity.type);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 10: Navigation Type-based Routing - should maintain activity order for consistent navigation', () => {
        fc.assert(
            fc.property(
                fc.array(activityItemGenerator, { minLength: 3, maxLength: 10 }),
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
                    const expectedActivities = activities.slice(0, 3);

                    // Click each button and verify the order matches the input order
                    expectedActivities.forEach((expectedActivity, index) => {
                        mockOnClick.mockClear();
                        fireEvent.click(activityButtons[index]);

                        expect(mockOnClick).toHaveBeenCalledWith(expectedActivity);

                        // Verify the activity maintains its position-based identity for navigation
                        const calledActivity = mockOnClick.mock.calls[0][0];
                        expect(calledActivity.id).toBe(expectedActivity.id);
                        expect(calledActivity.type).toBe(expectedActivity.type);
                    });
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 10: Navigation Type-based Routing - should handle all activity types correctly', () => {
        const activityTypes = ['alert', 'compliance', 'device', 'ticket', 'integration'] as const;

        activityTypes.forEach(type => {
            cleanup();

            const activity = {
                id: `test-${type}-${Math.random()}`,
                timestamp: new Date().toISOString(),
                description: `Test ${type} activity description`,
                type,
                icon: '🔧'
            };

            const mockOnClick = jest.fn();

            render(
                <RecentActivityFeed
                    activities={[activity]}
                    onActivityClick={mockOnClick}
                />
            );

            const button = screen.getByRole('button');
            fireEvent.click(button);

            expect(mockOnClick).toHaveBeenCalledTimes(1);
            const calledActivity = mockOnClick.mock.calls[0][0];

            // Verify each type is handled correctly for navigation
            expect(calledActivity.type).toBe(type);
            expect(calledActivity.id).toBe(activity.id);
        });
    });
});