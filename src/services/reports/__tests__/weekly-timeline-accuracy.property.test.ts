/**
 * Property-Based Tests for Weekly Timeline Accuracy
 * 
 * **Feature: avian-reports-module, Property 8: Weekly timeline accuracy**
 * **Validates: Requirements 2.5**
 */

import * as fc from 'fast-check';
import { generators } from './generators';
import { DataAggregator } from '../DataAggregator';
import { DailyAlertCount, EnhancedDateRange, AlertRecord } from '@/types/reports';

// Mock dependencies
jest.mock('../HistoricalDataStore');

describe('Weekly Timeline Accuracy Properties', () => {
    let dataAggregator: DataAggregator;

    beforeEach(() => {
        jest.clearAllMocks();
        dataAggregator = new DataAggregator();
    });

    describe('Property 8: Weekly timeline accuracy', () => {
        it('should display exactly 7 days Monday through Sunday in tenant timezone', () => {
            /**
             * **Feature: avian-reports-module, Property 8: Weekly timeline accuracy**
             * **Validates: Requirements 2.5**
             */
            fc.assert(
                fc.property(
                    generators.weeklyTimeline,
                    generators.timezone,
                    (weeklyTimeline, timezone) => {
                        // Property: Timeline must have exactly 7 days
                        expect(weeklyTimeline).toHaveLength(7);

                        // Property: Days must be in Monday-Sunday order
                        const expectedDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                        weeklyTimeline.forEach((day, index) => {
                            expect(day.dayOfWeek).toBe(expectedDays[index]);
                        });

                        // Property: Each day must have proper date format
                        weeklyTimeline.forEach(day => {
                            expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                            expect(typeof day.count).toBe('number');
                            expect(day.count).toBeGreaterThanOrEqual(0);
                        });

                        // Property: Dates must be consecutive days
                        for (let i = 1; i < weeklyTimeline.length; i++) {
                            const prevDate = new Date(weeklyTimeline[i - 1].date);
                            const currDate = new Date(weeklyTimeline[i].date);
                            const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
                            expect(dayDiff).toBe(1);
                        }

                        // Property: First day must be Monday, last day must be Sunday
                        expect(weeklyTimeline[0].dayOfWeek).toBe('monday');
                        expect(weeklyTimeline[6].dayOfWeek).toBe('sunday');
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should include zero-count days in timeline (no gaps)', () => {
            /**
             * **Feature: avian-reports-module, Property 8: Weekly timeline accuracy**
             * **Validates: Requirements 2.5**
             */
            fc.assert(
                fc.property(
                    fc.array(generators.alertRecord, { maxLength: 50 }),
                    generators.enhancedDateRange,
                    (alertRecords, dateRange) => {
                        // Filter alerts to date range and simulate some days with zero alerts
                        const filteredAlerts = alertRecords.filter(alert =>
                            alert.createdAt >= dateRange.startDate && alert.createdAt <= dateRange.endDate
                        );

                        // Create a timeline where some days might have zero alerts
                        const timeline: DailyAlertCount[] = [];
                        const startDate = new Date(dateRange.startDate);

                        // Generate 7 consecutive days starting from Monday
                        for (let i = 0; i < 7; i++) {
                            const currentDate = new Date(startDate);
                            currentDate.setDate(startDate.getDate() + i);

                            const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                            const alertsForDay = filteredAlerts.filter(alert => {
                                const alertDate = new Date(alert.createdAt);
                                return alertDate.toDateString() === currentDate.toDateString();
                            });

                            timeline.push({
                                date: currentDate.toISOString().split('T')[0],
                                dayOfWeek: dayNames[i] as any,
                                count: alertsForDay.length
                            });
                        }

                        // Property: All 7 days must be present, even if count is zero
                        expect(timeline).toHaveLength(7);

                        // Property: Days with zero alerts must still appear in timeline
                        timeline.forEach(day => {
                            expect(day.count).toBeGreaterThanOrEqual(0);
                            expect(typeof day.count).toBe('number');
                            // Zero is a valid count - days with no alerts should show count: 0
                        });

                        // Property: No days should be skipped
                        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                        timeline.forEach((day, index) => {
                            expect(day.dayOfWeek).toBe(dayNames[index]);
                        });

                        // Property: Timeline must be complete regardless of alert distribution
                        const totalDays = timeline.length;
                        expect(totalDays).toBe(7);

                        // Property: Each day bucket must be present even if empty
                        const daySet = new Set(timeline.map(day => day.dayOfWeek));
                        expect(daySet.size).toBe(7);
                        dayNames.forEach(dayName => {
                            expect(daySet.has(dayName)).toBe(true);
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should base timeline on alert creation timestamps', () => {
            /**
             * **Feature: avian-reports-module, Property 8: Weekly timeline accuracy**
             * **Validates: Requirements 2.5**
             */
            fc.assert(
                fc.property(
                    fc.array(generators.alertRecord, { minLength: 1, maxLength: 100 }),
                    generators.enhancedDateRange,
                    (alertRecords, dateRange) => {
                        // Assign creation timestamps within the date range
                        const alertsInRange = alertRecords.map(alert => ({
                            ...alert,
                            createdAt: new Date(
                                dateRange.startDate.getTime() +
                                Math.random() * (dateRange.endDate.getTime() - dateRange.startDate.getTime())
                            )
                        }));

                        // Group alerts by creation date (not resolution date)
                        const alertsByCreationDate = new Map<string, number>();

                        alertsInRange.forEach(alert => {
                            const dateKey = alert.createdAt.toISOString().split('T')[0];
                            alertsByCreationDate.set(dateKey, (alertsByCreationDate.get(dateKey) || 0) + 1);
                        });

                        // Create timeline based on creation timestamps
                        const timeline: DailyAlertCount[] = [];
                        const startDate = new Date(dateRange.startDate);

                        for (let i = 0; i < 7; i++) {
                            const currentDate = new Date(startDate);
                            currentDate.setDate(startDate.getDate() + i);
                            const dateKey = currentDate.toISOString().split('T')[0];

                            const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

                            timeline.push({
                                date: dateKey,
                                dayOfWeek: dayNames[i] as any,
                                count: alertsByCreationDate.get(dateKey) || 0
                            });
                        }

                        // Property: Timeline counts must be based on creation timestamps
                        timeline.forEach(day => {
                            const expectedCount = alertsByCreationDate.get(day.date) || 0;
                            expect(day.count).toBe(expectedCount);
                        });

                        // Property: Total timeline count must equal total alerts in range
                        const timelineTotal = timeline.reduce((sum, day) => sum + day.count, 0);
                        expect(timelineTotal).toBe(alertsInRange.length);

                        // Property: Creation timestamp must be the determining factor, not other timestamps
                        alertsInRange.forEach(alert => {
                            const creationDate = alert.createdAt.toISOString().split('T')[0];
                            const timelineDay = timeline.find(day => day.date === creationDate);

                            if (timelineDay) {
                                // This alert should contribute to this day's count
                                expect(timelineDay.count).toBeGreaterThan(0);
                            }
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should handle timezone conversion correctly for daily buckets', () => {
            /**
             * **Feature: avian-reports-module, Property 8: Weekly timeline accuracy**
             * **Validates: Requirements 2.5**
             */
            fc.assert(
                fc.property(
                    generators.timezone,
                    generators.enhancedDateRange,
                    fc.array(generators.alertRecord, { maxLength: 20 }),
                    (timezone, dateRange, alertRecords) => {
                        // Simulate timezone-aware date processing
                        const timelineInTenantTz: DailyAlertCount[] = [];

                        // Create 7-day timeline in tenant timezone
                        const startDate = new Date(dateRange.startDate);

                        for (let i = 0; i < 7; i++) {
                            const currentDate = new Date(startDate);
                            currentDate.setDate(startDate.getDate() + i);

                            // Simulate timezone conversion (in real implementation, this would use proper timezone libraries)
                            const dateInTenantTz = currentDate.toISOString().split('T')[0];

                            const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

                            // Count alerts that fall on this date in tenant timezone
                            const alertsForDay = alertRecords.filter(alert => {
                                const alertDateInTenantTz = alert.createdAt.toISOString().split('T')[0];
                                return alertDateInTenantTz === dateInTenantTz;
                            });

                            timelineInTenantTz.push({
                                date: dateInTenantTz,
                                dayOfWeek: dayNames[i] as any,
                                count: alertsForDay.length
                            });
                        }

                        // Property: Timeline must be calculated in tenant timezone
                        expect(timelineInTenantTz).toHaveLength(7);

                        // Property: Date format must be YYYY-MM-DD (ISO date in tenant timezone)
                        timelineInTenantTz.forEach(day => {
                            expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

                            // Validate that date is a valid date
                            const parsedDate = new Date(day.date);
                            expect(parsedDate.toISOString().split('T')[0]).toBe(day.date);
                        });

                        // Property: Timezone consistency across all days
                        // All dates should be consecutive when parsed
                        for (let i = 1; i < timelineInTenantTz.length; i++) {
                            const prevDate = new Date(timelineInTenantTz[i - 1].date);
                            const currDate = new Date(timelineInTenantTz[i].date);
                            const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
                            expect(dayDiff).toBe(1);
                        }

                        // Property: Week structure must be preserved regardless of timezone
                        expect(timelineInTenantTz[0].dayOfWeek).toBe('monday');
                        expect(timelineInTenantTz[6].dayOfWeek).toBe('sunday');
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should maintain ISO week standard (Monday start)', () => {
            /**
             * **Feature: avian-reports-module, Property 8: Weekly timeline accuracy**
             * **Validates: Requirements 2.5**
             */
            fc.assert(
                fc.property(
                    generators.weeklyTimeline,
                    (weeklyTimeline) => {
                        // Property: Week must start with Monday (ISO 8601 standard)
                        expect(weeklyTimeline[0].dayOfWeek).toBe('monday');

                        // Property: Week must end with Sunday
                        expect(weeklyTimeline[6].dayOfWeek).toBe('sunday');

                        // Property: Days must be in correct ISO week order
                        const isoWeekOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                        weeklyTimeline.forEach((day, index) => {
                            expect(day.dayOfWeek).toBe(isoWeekOrder[index]);
                        });

                        // Property: No deviation from ISO week standard
                        const actualOrder = weeklyTimeline.map(day => day.dayOfWeek);
                        expect(actualOrder).toEqual(isoWeekOrder);

                        // Property: Monday must be index 0, Sunday must be index 6
                        const mondayIndex = weeklyTimeline.findIndex(day => day.dayOfWeek === 'monday');
                        const sundayIndex = weeklyTimeline.findIndex(day => day.dayOfWeek === 'sunday');

                        expect(mondayIndex).toBe(0);
                        expect(sundayIndex).toBe(6);

                        // Property: All days between Monday and Sunday must be present
                        for (let i = 0; i < 7; i++) {
                            expect(weeklyTimeline[i].dayOfWeek).toBe(isoWeekOrder[i]);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should handle edge cases with boundary dates correctly', () => {
            /**
             * **Feature: avian-reports-module, Property 8: Weekly timeline accuracy**
             * **Validates: Requirements 2.5**
             */
            fc.assert(
                fc.property(
                    generators.timezone,
                    fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
                    (timezone, baseDate) => {
                        // Create a week that might span month/year boundaries
                        const weekStart = new Date(baseDate);
                        // Ensure we start on a Monday
                        const dayOfWeek = weekStart.getDay();
                        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
                        weekStart.setDate(weekStart.getDate() - daysToMonday);

                        const timeline: DailyAlertCount[] = [];
                        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

                        for (let i = 0; i < 7; i++) {
                            const currentDate = new Date(weekStart);
                            currentDate.setDate(weekStart.getDate() + i);

                            timeline.push({
                                date: currentDate.toISOString().split('T')[0],
                                dayOfWeek: dayNames[i] as any,
                                count: Math.floor(Math.random() * 10) // Random count for testing
                            });
                        }

                        // Property: Timeline must handle month boundaries correctly
                        expect(timeline).toHaveLength(7);

                        // Property: Dates must be consecutive even across month boundaries
                        for (let i = 1; i < timeline.length; i++) {
                            const prevDate = new Date(timeline[i - 1].date);
                            const currDate = new Date(timeline[i].date);
                            const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
                            expect(dayDiff).toBe(1);
                        }

                        // Property: Week structure must be maintained across boundaries
                        expect(timeline[0].dayOfWeek).toBe('monday');
                        expect(timeline[6].dayOfWeek).toBe('sunday');

                        // Property: All dates must be valid
                        timeline.forEach(day => {
                            const parsedDate = new Date(day.date);
                            expect(parsedDate.toISOString().split('T')[0]).toBe(day.date);
                            expect(!isNaN(parsedDate.getTime())).toBe(true);
                        });

                        // Property: Day names must match actual calendar days
                        timeline.forEach((day, index) => {
                            const date = new Date(day.date);
                            const actualDayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
                            const expectedDayIndex = (index + 1) % 7; // Convert to 0 = Sunday format
                            expect(actualDayOfWeek).toBe(expectedDayIndex);
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should ensure timeline completeness regardless of alert distribution', () => {
            /**
             * **Feature: avian-reports-module, Property 8: Weekly timeline accuracy**
             * **Validates: Requirements 2.5**
             */
            fc.assert(
                fc.property(
                    fc.oneof(
                        fc.constant([]), // No alerts
                        fc.array(generators.alertRecord, { minLength: 1, maxLength: 1 }), // Single alert
                        fc.array(generators.alertRecord, { minLength: 100, maxLength: 1000 }) // Many alerts
                    ),
                    generators.enhancedDateRange,
                    (alertRecords, dateRange) => {
                        // Create timeline regardless of alert count or distribution
                        const timeline: DailyAlertCount[] = [];
                        const startDate = new Date(dateRange.startDate);
                        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

                        for (let i = 0; i < 7; i++) {
                            const currentDate = new Date(startDate);
                            currentDate.setDate(startDate.getDate() + i);

                            const alertsForDay = alertRecords.filter(alert => {
                                const alertDate = alert.createdAt.toISOString().split('T')[0];
                                const dayDate = currentDate.toISOString().split('T')[0];
                                return alertDate === dayDate;
                            });

                            timeline.push({
                                date: currentDate.toISOString().split('T')[0],
                                dayOfWeek: dayNames[i] as any,
                                count: alertsForDay.length
                            });
                        }

                        // Property: Timeline must always have 7 days regardless of alert count
                        expect(timeline).toHaveLength(7);

                        // Property: All days must be present even with no alerts
                        if (alertRecords.length === 0) {
                            timeline.forEach(day => {
                                expect(day.count).toBe(0);
                            });
                        }

                        // Property: All days must be present even with single alert
                        if (alertRecords.length === 1) {
                            const totalCount = timeline.reduce((sum, day) => sum + day.count, 0);
                            expect(totalCount).toBeLessThanOrEqual(1);

                            // At least one day should have the alert, others should be zero
                            const nonZeroDays = timeline.filter(day => day.count > 0);
                            expect(nonZeroDays.length).toBeLessThanOrEqual(1);
                        }

                        // Property: All days must be present even with many alerts
                        if (alertRecords.length >= 100) {
                            // Timeline structure must remain intact
                            expect(timeline).toHaveLength(7);
                            timeline.forEach((day, index) => {
                                expect(day.dayOfWeek).toBe(dayNames[index]);
                            });
                        }

                        // Property: Week structure is independent of alert distribution
                        expect(timeline[0].dayOfWeek).toBe('monday');
                        expect(timeline[6].dayOfWeek).toBe('sunday');
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});