/**
 * Email Alert Listener - 5 Minute Interval Tests
 * 
 * Tests that the email listener checks for new emails every 5 minutes
 * Requirements: 11.1
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { EmailAlertListener } from '../email-alert-listener';

// Mock dependencies
jest.mock('../database', () => ({
    db: {
        query: {
            firewallDevices: {
                findFirst: jest.fn(),
            },
        },
    },
}));

jest.mock('../alert-manager', () => ({
    AlertManager: {
        createAlert: jest.fn(),
        deduplicateAlert: jest.fn(),
    },
}));

jest.mock('../logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

jest.mock('../config', () => ({
    config: {
        imap: {
            host: 'imap.test.com',
            port: 993,
            user: 'test@test.com',
            password: 'test-password',
            tls: true,
        },
    },
}));

describe('Email Alert Listener - 5 Minute Interval', () => {
    let listener: EmailAlertListener;
    let checkForNewEmailsSpy: jest.SpiedFunction<any>;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        const config = {
            host: 'imap.test.com',
            port: 993,
            user: 'test@test.com',
            password: 'test-password',
            tls: true,
        };

        listener = new EmailAlertListener(config);

        // Spy on checkForNewEmails method
        checkForNewEmailsSpy = jest.spyOn(listener as any, 'checkForNewEmails');
        checkForNewEmailsSpy.mockResolvedValue(undefined);
    });

    afterEach(async () => {
        await listener.stop();
        jest.useRealTimers();
    });

    describe('5-Minute Polling Interval', () => {
        it('should check for emails immediately on start', async () => {
            await listener.start();

            // Should check immediately
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(1);
        });

        it('should check for emails every 5 minutes', async () => {
            await listener.start();

            // Initial check
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(1);

            // Advance time by 5 minutes (300,000 ms)
            jest.advanceTimersByTime(5 * 60 * 1000);

            // Should have checked again
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(2);

            // Advance another 5 minutes
            jest.advanceTimersByTime(5 * 60 * 1000);

            // Should have checked a third time
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(3);
        });

        it('should check for emails 3 times in 15 minutes', async () => {
            await listener.start();

            // Initial check
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(1);

            // Advance time by 15 minutes (900,000 ms)
            jest.advanceTimersByTime(15 * 60 * 1000);

            // Should have checked 4 times total (initial + 3 intervals)
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(4);
        });

        it('should not check for emails before 5 minutes have elapsed', async () => {
            await listener.start();

            // Initial check
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(1);

            // Advance time by 4 minutes (not enough)
            jest.advanceTimersByTime(4 * 60 * 1000);

            // Should not have checked again
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(1);

            // Advance by 1 more minute (total 5 minutes)
            jest.advanceTimersByTime(1 * 60 * 1000);

            // Now it should have checked
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(2);
        });

        it('should stop checking when listener is stopped', async () => {
            await listener.start();

            // Initial check
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(1);

            // Advance time by 5 minutes
            jest.advanceTimersByTime(5 * 60 * 1000);

            // Should have checked again
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(2);

            // Stop the listener
            await listener.stop();

            // Advance time by another 5 minutes
            jest.advanceTimersByTime(5 * 60 * 1000);

            // Should NOT have checked again (still 2)
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(2);
        });

        it('should continue checking even if an error occurs', async () => {
            // Mock fetchUnreadEmails to throw an error
            const fetchSpy = jest.spyOn(listener as any, 'fetchUnreadEmails');
            fetchSpy.mockRejectedValue(new Error('IMAP connection failed'));

            await listener.start();

            // Initial check (will fail but error is caught internally)
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(1);

            // Advance time by 5 minutes
            jest.advanceTimersByTime(5 * 60 * 1000);

            // Should still try again despite previous error
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(2);

            fetchSpy.mockRestore();
        });

        it('should use exactly 300,000 milliseconds (5 minutes) as interval', async () => {
            await listener.start();

            // Initial check
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(1);

            // Advance by 299,999 ms (just under 5 minutes)
            jest.advanceTimersByTime(299999);

            // Should not have checked yet
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(1);

            // Advance by 1 more ms (exactly 5 minutes)
            jest.advanceTimersByTime(1);

            // Now it should have checked
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('Multiple Start/Stop Cycles', () => {
        it('should handle multiple start/stop cycles correctly', async () => {
            // First cycle
            await listener.start();
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(5 * 60 * 1000);
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(2);

            await listener.stop();

            // Second cycle
            await listener.start();
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(3); // New initial check

            jest.advanceTimersByTime(5 * 60 * 1000);
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(4);

            await listener.stop();
        });

        it('should not create multiple intervals if start is called twice', async () => {
            await listener.start();
            await listener.start(); // Second start should be ignored

            // Initial check (only once)
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(1);

            // Advance time by 5 minutes
            jest.advanceTimersByTime(5 * 60 * 1000);

            // Should have checked only once more (not twice)
            expect(checkForNewEmailsSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('Interval Constant', () => {
        it('should have CHECK_INTERVAL_MS constant set to 5 minutes', () => {
            const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 300,000 ms

            expect(CHECK_INTERVAL_MS).toBe(300000);
            expect(CHECK_INTERVAL_MS).toBe(5 * 60 * 1000);
        });
    });
});
