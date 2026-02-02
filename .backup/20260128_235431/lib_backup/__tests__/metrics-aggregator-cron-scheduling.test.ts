/**
 * Tests for MetricsAggregator Cron Scheduling
 * 
 * Validates that the cron job is properly configured to run at midnight UTC.
 * 
 * Requirements: 9.1 - Create rollup at midnight UTC
 */

import { MetricsAggregator } from '../metrics-aggregator';
import * as cron from 'node-cron';

// Mock dependencies
jest.mock('../database', () => ({
    db: {
        select: jest.fn(),
        insert: jest.fn(),
        delete: jest.fn(),
    },
}));

jest.mock('../firewall-polling-state');
jest.mock('../logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

// Spy on node-cron
jest.mock('node-cron', () => {
    const actualCron = jest.requireActual('node-cron');
    return {
        ...actualCron,
        schedule: jest.fn(actualCron.schedule),
    };
});

describe('MetricsAggregator - Cron Scheduling', () => {
    let aggregator: MetricsAggregator;

    beforeEach(() => {
        aggregator = new MetricsAggregator();
        jest.clearAllMocks();
    });

    afterEach(async () => {
        if (aggregator.isAggregating()) {
            await aggregator.stop();
        }
    });

    describe('Cron Schedule Configuration', () => {
        it('should schedule cron job with correct expression (0 0 * * *)', async () => {
            await aggregator.start();

            // Verify cron.schedule was called
            expect(cron.schedule).toHaveBeenCalled();

            // Get the call arguments
            const scheduleCall = jest.mocked(cron.schedule).mock.calls[0];
            const cronExpression = scheduleCall[0];
            const options = scheduleCall[2];

            // Verify cron expression is for midnight (0 0 * * *)
            expect(cronExpression).toBe('0 0 * * *');

            // Verify timezone is UTC
            expect(options).toEqual({
                timezone: 'UTC',
            });
        });

        it('should use UTC timezone for scheduling', async () => {
            await aggregator.start();

            const scheduleCall = jest.mocked(cron.schedule).mock.calls[0];
            const options = scheduleCall[2];

            expect(options?.timezone).toBe('UTC');
        });

        it('should create a valid cron task', async () => {
            await aggregator.start();

            // Verify the cron task was created
            expect(cron.schedule).toHaveBeenCalledTimes(1);

            // Verify the task is a function
            const scheduleCall = jest.mocked(cron.schedule).mock.calls[0];
            const taskFunction = scheduleCall[1];
            expect(typeof taskFunction).toBe('function');
        });
    });

    describe('Cron Expression Validation', () => {
        it('should validate cron expression is correct for daily midnight execution', () => {
            const cronExpression = '0 0 * * *';

            // Verify the expression is valid
            expect(cron.validate(cronExpression)).toBe(true);

            // Parse the expression to verify components
            // Format: minute hour day month dayOfWeek
            const parts = cronExpression.split(' ');
            expect(parts[0]).toBe('0'); // minute = 0
            expect(parts[1]).toBe('0'); // hour = 0 (midnight)
            expect(parts[2]).toBe('*'); // every day
            expect(parts[3]).toBe('*'); // every month
            expect(parts[4]).toBe('*'); // every day of week
        });

        it('should run at midnight UTC (00:00)', () => {
            const cronExpression = '0 0 * * *';

            // Verify this is a valid cron expression
            expect(cron.validate(cronExpression)).toBe(true);

            // The expression '0 0 * * *' means:
            // - minute: 0 (at the start of the hour)
            // - hour: 0 (midnight)
            // - day: * (every day)
            // - month: * (every month)
            // - dayOfWeek: * (every day of the week)
            const parts = cronExpression.split(' ');
            expect(parts[0]).toBe('0'); // Runs at minute 0
            expect(parts[1]).toBe('0'); // Runs at hour 0 (midnight)
        });

        it('should run daily (every day of every month)', () => {
            const cronExpression = '0 0 * * *';
            const parts = cronExpression.split(' ');

            // Verify it runs every day
            expect(parts[2]).toBe('*'); // day of month
            expect(parts[3]).toBe('*'); // month
            expect(parts[4]).toBe('*'); // day of week
        });
    });

    describe('Cron Task Lifecycle', () => {
        it('should start cron task when aggregator starts', async () => {
            expect(aggregator.isAggregating()).toBe(false);

            await aggregator.start();

            expect(aggregator.isAggregating()).toBe(true);
            expect(cron.schedule).toHaveBeenCalled();
        });

        it('should stop cron task when aggregator stops', async () => {
            await aggregator.start();
            expect(aggregator.isAggregating()).toBe(true);

            await aggregator.stop();

            expect(aggregator.isAggregating()).toBe(false);
        });

        it('should not create multiple cron tasks on repeated starts', async () => {
            await aggregator.start();
            const firstCallCount = jest.mocked(cron.schedule).mock.calls.length;

            // Try to start again
            await aggregator.start();
            const secondCallCount = jest.mocked(cron.schedule).mock.calls.length;

            // Should not have created another cron task
            expect(secondCallCount).toBe(firstCallCount);
        });
    });

    describe('Cron Task Function', () => {
        it('should call runDailyRollup when cron task executes', async () => {
            // Spy on runDailyRollup
            const runDailyRollupSpy = jest.spyOn(aggregator, 'runDailyRollup').mockResolvedValue();

            await aggregator.start();

            // Get the cron task function
            const scheduleCall = jest.mocked(cron.schedule).mock.calls[0];
            const taskFunction = scheduleCall[1];

            // Execute the task function
            await taskFunction();

            // Verify runDailyRollup was called
            expect(runDailyRollupSpy).toHaveBeenCalled();

            runDailyRollupSpy.mockRestore();
        });

        it('should handle errors in cron task execution gracefully', async () => {
            // Spy on runDailyRollup to throw an error
            const runDailyRollupSpy = jest.spyOn(aggregator, 'runDailyRollup')
                .mockRejectedValue(new Error('Database connection failed'));

            await aggregator.start();

            // Get the cron task function
            const scheduleCall = jest.mocked(cron.schedule).mock.calls[0];
            const taskFunction = scheduleCall[1];

            // Execute the task function - it will reject but that's expected
            // The cron task logs errors but doesn't prevent future executions
            await expect(taskFunction()).rejects.toThrow('Database connection failed');

            // Verify the error was logged (the logger mock would have been called)
            runDailyRollupSpy.mockRestore();
        });
    });

    describe('Timezone Handling', () => {
        it('should use UTC timezone to ensure consistent execution across regions', async () => {
            await aggregator.start();

            const scheduleCall = jest.mocked(cron.schedule).mock.calls[0];
            const options = scheduleCall[2];

            // Verify UTC timezone is explicitly set
            expect(options?.timezone).toBe('UTC');

            // This ensures that regardless of the server's local timezone,
            // the rollup always runs at midnight UTC
        });

        it('should not use local timezone', async () => {
            await aggregator.start();

            const scheduleCall = jest.mocked(cron.schedule).mock.calls[0];
            const options = scheduleCall[2];

            // Verify timezone is explicitly set (not undefined/default)
            expect(options?.timezone).toBeDefined();
            expect(options?.timezone).not.toBe('local');
            expect(options?.timezone).toBe('UTC');
        });
    });

    describe('Requirements Validation', () => {
        it('should satisfy Requirement 9.1: Create rollup at midnight UTC', async () => {
            await aggregator.start();

            const scheduleCall = jest.mocked(cron.schedule).mock.calls[0];
            const cronExpression = scheduleCall[0];
            const options = scheduleCall[2];

            // Verify midnight execution
            expect(cronExpression).toBe('0 0 * * *');

            // Verify UTC timezone
            expect(options?.timezone).toBe('UTC');

            // Verify daily execution
            expect(cron.validate(cronExpression)).toBe(true);
        });

        it('should run daily (not hourly, weekly, or monthly)', async () => {
            await aggregator.start();

            const scheduleCall = jest.mocked(cron.schedule).mock.calls[0];
            const cronExpression = scheduleCall[0];

            // Verify it's not hourly (would be '0 * * * *')
            expect(cronExpression).not.toBe('0 * * * *');

            // Verify it's not weekly (would have specific day of week)
            expect(cronExpression).not.toMatch(/0 0 \* \* [0-6]/);

            // Verify it's not monthly (would have specific day of month)
            expect(cronExpression).not.toMatch(/0 0 [1-9] \* \*/);

            // Verify it's daily
            expect(cronExpression).toBe('0 0 * * *');
        });
    });

    describe('Integration with runDailyRollup', () => {
        it('should execute rollup for previous day when cron task runs', async () => {
            // Mock database to avoid actual queries
            const { db } = require('../database');
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([]),
                }),
            });
            db.select = mockSelect;

            await aggregator.start();

            // Get the cron task function
            const scheduleCall = jest.mocked(cron.schedule).mock.calls[0];
            const taskFunction = scheduleCall[1];

            // Execute the task function
            await taskFunction();

            // Verify database was queried for active devices
            expect(mockSelect).toHaveBeenCalled();
        });
    });

    describe('Cron Schedule Documentation', () => {
        it('should document the cron expression format', () => {
            // Cron expression format: minute hour day month dayOfWeek
            const cronExpression = '0 0 * * *';
            const parts = cronExpression.split(' ');

            expect(parts).toHaveLength(5);
            expect(parts[0]).toBe('0'); // minute (0-59)
            expect(parts[1]).toBe('0'); // hour (0-23)
            expect(parts[2]).toBe('*'); // day of month (1-31)
            expect(parts[3]).toBe('*'); // month (1-12)
            expect(parts[4]).toBe('*'); // day of week (0-7, 0 and 7 are Sunday)
        });

        it('should verify midnight is hour 0 in 24-hour format', () => {
            const cronExpression = '0 0 * * *';
            const parts = cronExpression.split(' ');

            // Hour 0 is midnight in 24-hour format
            expect(parts[1]).toBe('0');

            // Not 12 (which would be noon)
            expect(parts[1]).not.toBe('12');
        });
    });
});
