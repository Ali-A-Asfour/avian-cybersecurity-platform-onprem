/**
 * Redis Key Expiration Verification Test
 * 
 * This test verifies that Redis keys used for alert deduplication
 * and storm detection are automatically cleaned up via TTL expiration.
 * 
 * Task 5.2: Use Redis key expiration for automatic cleanup
 */

import { AlertManager, CreateAlertInput } from '../alert-manager';
import { connectRedis } from '../redis';

// Mock database
jest.mock('../database', () => ({
    db: {
        insert: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([{
                    id: 'test-alert-id',
                    tenantId: 'test-tenant-id',
                    deviceId: 'test-device-id',
                    alertType: 'test_alert',
                    severity: 'medium',
                    message: 'Test message',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date(),
                }]),
            }),
        }),
        query: {
            firewallDevices: {
                findFirst: jest.fn().mockResolvedValue({
                    id: 'test-device-id',
                    tenantId: 'test-tenant-id',
                }),
            },
        },
    },
}));

// Mock Redis
jest.mock('../redis', () => ({
    connectRedis: jest.fn(),
}));

// Mock logger
jest.mock('../logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

describe('Redis Key Expiration for Alert Deduplication', () => {
    let mockRedis: any;

    beforeEach(() => {
        mockRedis = {
            exists: jest.fn().mockResolvedValue(0),
            setEx: jest.fn().mockResolvedValue('OK'),
            incr: jest.fn().mockResolvedValue(1),
            expire: jest.fn().mockResolvedValue(1),
            del: jest.fn().mockResolvedValue(1),
        };
        (connectRedis as any).mockResolvedValue(mockRedis);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Deduplication Key Expiration', () => {
        it('should set TTL of 120 seconds (2 minutes) on deduplication keys', async () => {
            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                alertType: 'wan_down',
                severity: 'critical',
                message: 'WAN interface is down',
                source: 'api',
            };

            await AlertManager.createAlert(input);

            // Verify setEx was called with correct TTL
            expect(mockRedis.setEx).toHaveBeenCalledWith(
                expect.stringContaining('alert:dedup:'),
                120, // 2 minutes in seconds
                expect.any(String)
            );
        });

        it('should use setEx which automatically expires keys', async () => {
            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                alertType: 'vpn_down',
                severity: 'high',
                message: 'VPN tunnel is down',
                source: 'api',
            };

            await AlertManager.deduplicateAlert(input);

            // Verify setEx is used (not set + expire separately)
            expect(mockRedis.setEx).toHaveBeenCalledTimes(1);
            expect(mockRedis.setEx).toHaveBeenCalledWith(
                expect.any(String),
                120,
                expect.any(String)
            );
        });

        it('should allow duplicate alert creation after TTL expires', async () => {
            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                alertType: 'cpu_high',
                severity: 'medium',
                message: 'CPU usage high',
                source: 'api',
            };

            // First call - key doesn't exist
            mockRedis.exists.mockResolvedValueOnce(0);
            const isDuplicate1 = await AlertManager.deduplicateAlert(input);
            expect(isDuplicate1).toBe(false);

            // Second call - key exists (within TTL window)
            mockRedis.exists.mockResolvedValueOnce(1);
            const isDuplicate2 = await AlertManager.deduplicateAlert(input);
            expect(isDuplicate2).toBe(true);

            // Third call - key expired (after TTL window)
            mockRedis.exists.mockResolvedValueOnce(0);
            const isDuplicate3 = await AlertManager.deduplicateAlert(input);
            expect(isDuplicate3).toBe(false);

            // Verify setEx was called twice (first and third time)
            expect(mockRedis.setEx).toHaveBeenCalledTimes(2);
        });
    });

    describe('Storm Detection Key Expiration', () => {
        it('should set TTL of 300 seconds (5 minutes) on storm counter keys', async () => {
            // First increment sets the expiry
            mockRedis.incr.mockResolvedValue(1);

            await AlertManager.checkAlertStorm('test-device-id');

            // Verify expire was called with correct TTL
            expect(mockRedis.expire).toHaveBeenCalledWith(
                expect.stringContaining('alert:storm:'),
                300 // 5 minutes in seconds
            );
        });

        it('should set TTL of 900 seconds (15 minutes) on suppression keys', async () => {
            // Simulate alert storm (> 10 alerts)
            mockRedis.incr.mockResolvedValue(11);
            mockRedis.exists.mockResolvedValue(0); // Not already suppressed

            await AlertManager.checkAlertStorm('test-device-id');

            // Verify setEx was called for suppression key with correct TTL
            expect(mockRedis.setEx).toHaveBeenCalledWith(
                expect.stringContaining('alert:suppress:'),
                900, // 15 minutes in seconds
                expect.any(String)
            );
        });

        it('should automatically reset storm counter after 5 minutes', async () => {
            // First window - increment to 5
            mockRedis.incr.mockResolvedValueOnce(1);
            await AlertManager.checkAlertStorm('test-device-id');

            mockRedis.incr.mockResolvedValueOnce(2);
            await AlertManager.checkAlertStorm('test-device-id');

            mockRedis.incr.mockResolvedValueOnce(3);
            await AlertManager.checkAlertStorm('test-device-id');

            mockRedis.incr.mockResolvedValueOnce(4);
            await AlertManager.checkAlertStorm('test-device-id');

            mockRedis.incr.mockResolvedValueOnce(5);
            const isStorm1 = await AlertManager.checkAlertStorm('test-device-id');
            expect(isStorm1).toBe(false); // Below threshold

            // After 5 minutes, key expires and counter resets
            // Next increment starts at 1 again
            mockRedis.incr.mockResolvedValueOnce(1);
            const isStorm2 = await AlertManager.checkAlertStorm('test-device-id');
            expect(isStorm2).toBe(false);

            // Verify expire was called for each first increment
            expect(mockRedis.expire).toHaveBeenCalledTimes(2);
        });

        it('should automatically lift suppression after 15 minutes', async () => {
            // Trigger alert storm
            mockRedis.incr.mockResolvedValue(11);
            mockRedis.exists.mockResolvedValueOnce(0); // Not suppressed
            await AlertManager.checkAlertStorm('test-device-id');

            // Verify suppression key was set with TTL
            expect(mockRedis.setEx).toHaveBeenCalledWith(
                expect.stringContaining('alert:suppress:'),
                900,
                expect.any(String)
            );

            // After 15 minutes, suppression key expires
            // Device is no longer suppressed
            mockRedis.exists.mockResolvedValueOnce(0); // Suppression expired

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                alertType: 'test_alert',
                severity: 'low',
                message: 'Test message',
                source: 'api',
            };

            // Alert should be created (not suppressed)
            const alertId = await AlertManager.createAlert(input);
            expect(alertId).toBeTruthy();
        });
    });

    describe('Automatic Cleanup Benefits', () => {
        it('should not require manual cleanup of deduplication keys', async () => {
            // Create multiple alerts
            for (let i = 0; i < 10; i++) {
                const input: CreateAlertInput = {
                    tenantId: 'test-tenant-id',
                    deviceId: `device-${i}`,
                    alertType: 'test_alert',
                    severity: 'low',
                    message: `Test message ${i}`,
                    source: 'api',
                };

                await AlertManager.createAlert(input);
            }

            // All keys have TTL set automatically
            expect(mockRedis.setEx).toHaveBeenCalledTimes(10);

            // No manual cleanup calls needed
            expect(mockRedis.del).not.toHaveBeenCalled();
        });

        it('should prevent Redis memory bloat through automatic expiration', async () => {
            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                alertType: 'test_alert',
                severity: 'low',
                message: 'Test message',
                source: 'api',
            };

            // Create alert
            await AlertManager.createAlert(input);

            // Verify TTL is set (prevents indefinite storage)
            expect(mockRedis.setEx).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(Number), // TTL is set
                expect.any(String)
            );

            // Keys will be automatically removed by Redis after TTL
            // No manual intervention required
        });
    });
});
