/**
 * Alert Storm Detection Tests
 * 
 * Comprehensive tests for alert storm detection functionality.
 * 
 * Requirements: 12.7
 * 
 * Alert storm detection:
 * - If > 10 alerts created for same device in 5 minutes, create meta-alert
 * - Suppress further alerts for device for 15 minutes
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

describe('Alert Storm Detection', () => {
    let mockRedis: any;

    beforeEach(() => {
        mockRedis = {
            exists: jest.fn().mockResolvedValue(0),
            setEx: jest.fn().mockResolvedValue('OK'),
            incr: jest.fn(),
            expire: jest.fn().mockResolvedValue(1),
        };
        (connectRedis as any).mockResolvedValue(mockRedis);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Storm Threshold Detection', () => {
        it('should not trigger storm for 10 alerts (at threshold)', async () => {
            const deviceId = 'device-threshold-test';

            // Create 10 alerts (exactly at threshold, should not trigger)
            for (let i = 1; i <= 10; i++) {
                mockRedis.incr.mockResolvedValueOnce(i);
                mockRedis.exists.mockResolvedValueOnce(0); // Not suppressed
                mockRedis.exists.mockResolvedValueOnce(0); // Not duplicate

                const input: CreateAlertInput = {
                    tenantId: 'test-tenant-id',
                    deviceId: deviceId,
                    alertType: `alert_${i}`,
                    severity: 'medium',
                    message: `Alert ${i}`,
                    source: 'api',
                };

                const alertId = await AlertManager.createAlert(input);
                expect(alertId).toBeTruthy();
            }

            // Verify no storm was detected
            const { logger } = require('../logger');
            expect(logger.warn).not.toHaveBeenCalledWith(
                'Alert storm detected',
                expect.any(Object)
            );
        });

        it('should trigger storm on 11th alert (exceeds threshold)', async () => {
            const { logger } = require('../logger');
            const deviceId = 'device-storm-trigger';

            // Create 11 alerts (exceeds threshold of 10)
            for (let i = 1; i <= 11; i++) {
                mockRedis.incr.mockResolvedValueOnce(i);
                mockRedis.exists.mockResolvedValueOnce(0); // Not suppressed
                mockRedis.exists.mockResolvedValueOnce(0); // Not duplicate

                if (i === 11) {
                    // On 11th alert, storm should be detected
                    mockRedis.exists.mockResolvedValueOnce(0); // Storm not yet created
                }

                const input: CreateAlertInput = {
                    tenantId: 'test-tenant-id',
                    deviceId: deviceId,
                    alertType: `alert_${i}`,
                    severity: 'medium',
                    message: `Alert ${i}`,
                    source: 'api',
                };

                await AlertManager.createAlert(input);
            }

            // Verify storm was detected on 11th alert
            expect(logger.warn).toHaveBeenCalledWith(
                'Alert storm detected',
                expect.objectContaining({
                    deviceId: deviceId,
                    alertCount: 11,
                })
            );
        });

        it('should trigger storm at exactly 11 alerts, not before', async () => {
            const { logger } = require('../logger');
            const deviceId = 'device-exact-threshold';

            // Create 10 alerts - no storm
            for (let i = 1; i <= 10; i++) {
                mockRedis.incr.mockResolvedValueOnce(i);
                mockRedis.exists.mockResolvedValueOnce(0);
                mockRedis.exists.mockResolvedValueOnce(0);

                const input: CreateAlertInput = {
                    tenantId: 'test-tenant-id',
                    deviceId: deviceId,
                    alertType: `alert_${i}`,
                    severity: 'medium',
                    message: `Alert ${i}`,
                    source: 'api',
                };

                await AlertManager.createAlert(input);
            }

            // Verify no storm yet
            expect(logger.warn).not.toHaveBeenCalled();

            // Create 11th alert - storm triggered
            mockRedis.incr.mockResolvedValueOnce(11);
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.exists.mockResolvedValueOnce(0);

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: deviceId,
                alertType: 'alert_11',
                severity: 'medium',
                message: 'Alert 11',
                source: 'api',
            };

            await AlertManager.createAlert(input);

            // Verify storm detected
            expect(logger.warn).toHaveBeenCalledTimes(1);
            expect(logger.warn).toHaveBeenCalledWith(
                'Alert storm detected',
                expect.objectContaining({
                    deviceId: deviceId,
                    alertCount: 11,
                })
            );
        });
    });

    describe('Meta-Alert Creation', () => {
        it('should create meta-alert with correct properties', async () => {
            const { db } = require('../database');
            const deviceId = 'device-meta-alert';

            // Trigger storm
            mockRedis.incr.mockResolvedValueOnce(11);
            mockRedis.exists.mockResolvedValueOnce(0); // Not suppressed
            mockRedis.exists.mockResolvedValueOnce(0); // Not duplicate
            mockRedis.exists.mockResolvedValueOnce(0); // Storm not created

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: deviceId,
                alertType: 'test_alert',
                severity: 'medium',
                message: 'Test',
                source: 'api',
            };

            await AlertManager.createAlert(input);

            // Get the meta-alert creation call
            const insertCalls = db.insert().values.mock.calls;
            const metaAlertCall = insertCalls[insertCalls.length - 1];
            const metaAlert = metaAlertCall[0];

            // Verify meta-alert properties
            expect(metaAlert).toMatchObject({
                tenantId: 'test-tenant-id',
                deviceId: deviceId,
                alertType: 'alert_storm_detected',
                severity: 'high',
                source: 'api',
                acknowledged: false,
            });
        });

        it('should include alert count in meta-alert metadata', async () => {
            const { db } = require('../database');
            const deviceId = 'device-metadata-test';

            // Trigger storm with 15 alerts
            mockRedis.incr.mockResolvedValueOnce(15);
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.exists.mockResolvedValueOnce(0);

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: deviceId,
                alertType: 'test_alert',
                severity: 'medium',
                message: 'Test',
                source: 'api',
            };

            await AlertManager.createAlert(input);

            // Get meta-alert
            const insertCalls = db.insert().values.mock.calls;
            const metaAlert = insertCalls[insertCalls.length - 1][0];

            // Verify metadata
            expect(metaAlert.metadata).toMatchObject({
                alertCount: 15,
                windowSeconds: 300, // 5 minutes
                suppressionSeconds: 900, // 15 minutes
            });
        });

        it('should include window and suppression duration in meta-alert message', async () => {
            const { db } = require('../database');
            const deviceId = 'device-message-test';

            // Trigger storm
            mockRedis.incr.mockResolvedValueOnce(11);
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.exists.mockResolvedValueOnce(0);

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: deviceId,
                alertType: 'test_alert',
                severity: 'medium',
                message: 'Test',
                source: 'api',
            };

            await AlertManager.createAlert(input);

            // Get meta-alert
            const insertCalls = db.insert().values.mock.calls;
            const metaAlert = insertCalls[insertCalls.length - 1][0];

            // Verify message contains key information
            expect(metaAlert.message).toContain('Alert storm detected');
            expect(metaAlert.message).toContain('11 alerts');
            expect(metaAlert.message).toContain('5 minutes');
            expect(metaAlert.message).toContain('15 minutes');
        });

        it('should not create duplicate meta-alert if storm already detected', async () => {
            const { db } = require('../database');
            const deviceId = 'device-no-duplicate';

            // First storm trigger
            mockRedis.incr.mockResolvedValueOnce(11);
            mockRedis.exists.mockResolvedValueOnce(0); // Not suppressed
            mockRedis.exists.mockResolvedValueOnce(0); // Not duplicate
            mockRedis.exists.mockResolvedValueOnce(0); // Storm not created

            const input1: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: deviceId,
                alertType: 'alert_1',
                severity: 'medium',
                message: 'First alert',
                source: 'api',
            };

            await AlertManager.createAlert(input1);

            const callCountAfterFirst = db.insert().values.mock.calls.length;

            // Second storm trigger (should not create duplicate meta-alert)
            mockRedis.incr.mockResolvedValueOnce(12);
            mockRedis.exists.mockResolvedValueOnce(0); // Not suppressed (checking before create)
            mockRedis.exists.mockResolvedValueOnce(0); // Not duplicate
            mockRedis.exists.mockResolvedValueOnce(1); // Storm already created

            const input2: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: deviceId,
                alertType: 'alert_2',
                severity: 'medium',
                message: 'Second alert',
                source: 'api',
            };

            await AlertManager.createAlert(input2);

            const callCountAfterSecond = db.insert().values.mock.calls.length;

            // Verify only one additional insert (the regular alert, no meta-alert)
            expect(callCountAfterSecond).toBe(callCountAfterFirst + 1);
        });
    });

    describe('15-Minute Suppression', () => {
        it('should set suppression with 900 second TTL', async () => {
            const deviceId = 'device-suppression-ttl';

            // Trigger storm
            mockRedis.incr.mockResolvedValueOnce(11);
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.exists.mockResolvedValueOnce(0);

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: deviceId,
                alertType: 'test_alert',
                severity: 'medium',
                message: 'Test',
                source: 'api',
            };

            await AlertManager.createAlert(input);

            // Verify suppression key was set with correct TTL
            expect(mockRedis.setEx).toHaveBeenCalledWith(
                `alert:suppress:${deviceId}`,
                900, // 15 minutes in seconds
                expect.any(String)
            );
        });

        it('should suppress alerts during 15-minute window', async () => {
            const deviceId = 'device-suppression-active';

            // First alert - device is suppressed
            mockRedis.exists.mockResolvedValueOnce(1); // Device IS suppressed

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: deviceId,
                alertType: 'suppressed_alert',
                severity: 'critical',
                message: 'This should be suppressed',
                source: 'api',
            };

            const alertId = await AlertManager.createAlert(input);

            // Verify alert was suppressed (returned null)
            expect(alertId).toBeNull();
        });

        it('should log when alert is suppressed', async () => {
            const { logger } = require('../logger');
            const deviceId = 'device-suppression-log';

            // Device is suppressed
            mockRedis.exists.mockResolvedValueOnce(1);

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: deviceId,
                alertType: 'test_alert',
                severity: 'medium',
                message: 'Test',
                source: 'api',
            };

            await AlertManager.createAlert(input);

            // Verify suppression was logged
            expect(logger.debug).toHaveBeenCalledWith(
                'Alert suppressed due to alert storm',
                expect.objectContaining({
                    deviceId: deviceId,
                    alertType: 'test_alert',
                })
            );
        });

        it('should allow alerts after suppression expires', async () => {
            const deviceId = 'device-suppression-expired';

            // Suppression has expired
            mockRedis.exists.mockResolvedValueOnce(0); // Not suppressed
            mockRedis.exists.mockResolvedValueOnce(0); // Not duplicate
            mockRedis.incr.mockResolvedValueOnce(1); // New storm counter

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: deviceId,
                alertType: 'post_suppression_alert',
                severity: 'medium',
                message: 'Alert after suppression expired',
                source: 'api',
            };

            const alertId = await AlertManager.createAlert(input);

            // Verify alert was created
            expect(alertId).toBeTruthy();
        });
    });

    describe('5-Minute Storm Window', () => {
        it('should use 300 second window for storm detection', async () => {
            const deviceId = 'device-window-test';

            // First alert in window
            mockRedis.incr.mockResolvedValueOnce(1);
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.exists.mockResolvedValueOnce(0);

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: deviceId,
                alertType: 'test_alert',
                severity: 'medium',
                message: 'Test',
                source: 'api',
            };

            await AlertManager.createAlert(input);

            // Verify expire was called with 300 seconds (5 minutes)
            expect(mockRedis.expire).toHaveBeenCalledWith(
                expect.stringContaining('alert:storm:'),
                300
            );
        });

        it('should reset storm counter after 5-minute window expires', async () => {
            const deviceId = 'device-window-reset';

            // First window: 10 alerts (no storm)
            for (let i = 1; i <= 10; i++) {
                mockRedis.incr.mockResolvedValueOnce(i);
                mockRedis.exists.mockResolvedValueOnce(0);
                mockRedis.exists.mockResolvedValueOnce(0);

                const input: CreateAlertInput = {
                    tenantId: 'test-tenant-id',
                    deviceId: deviceId,
                    alertType: `alert_${i}`,
                    severity: 'medium',
                    message: `Alert ${i}`,
                    source: 'api',
                };

                await AlertManager.createAlert(input);
            }

            // Window expires, counter resets to 1
            mockRedis.incr.mockResolvedValueOnce(1); // Counter reset
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.exists.mockResolvedValueOnce(0);

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: deviceId,
                alertType: 'alert_after_reset',
                severity: 'medium',
                message: 'Alert after window reset',
                source: 'api',
            };

            const alertId = await AlertManager.createAlert(input);

            // Verify alert was created (counter reset, no storm)
            expect(alertId).toBeTruthy();
        });
    });

    describe('Device Isolation', () => {
        it('should track storm counters per device independently', async () => {
            const device1 = 'device-1';
            const device2 = 'device-2';

            // Device 1: 11 alerts (triggers storm)
            for (let i = 1; i <= 11; i++) {
                mockRedis.incr.mockResolvedValueOnce(i);
                mockRedis.exists.mockResolvedValueOnce(0);
                mockRedis.exists.mockResolvedValueOnce(0);
                if (i === 11) {
                    mockRedis.exists.mockResolvedValueOnce(0);
                }

                const input: CreateAlertInput = {
                    tenantId: 'test-tenant-id',
                    deviceId: device1,
                    alertType: `alert_${i}`,
                    severity: 'medium',
                    message: `Alert ${i}`,
                    source: 'api',
                };

                await AlertManager.createAlert(input);
            }

            // Device 2: 5 alerts (no storm)
            for (let i = 1; i <= 5; i++) {
                mockRedis.incr.mockResolvedValueOnce(i);
                mockRedis.exists.mockResolvedValueOnce(0);
                mockRedis.exists.mockResolvedValueOnce(0);

                const input: CreateAlertInput = {
                    tenantId: 'test-tenant-id',
                    deviceId: device2,
                    alertType: `alert_${i}`,
                    severity: 'medium',
                    message: `Alert ${i}`,
                    source: 'api',
                };

                const alertId = await AlertManager.createAlert(input);
                expect(alertId).toBeTruthy();
            }

            // Verify device 1 is suppressed but device 2 is not
            mockRedis.exists.mockResolvedValueOnce(1); // Device 1 suppressed
            const device1Alert: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: device1,
                alertType: 'test',
                severity: 'medium',
                message: 'Test',
                source: 'api',
            };
            const device1Result = await AlertManager.createAlert(device1Alert);
            expect(device1Result).toBeNull();

            mockRedis.exists.mockResolvedValueOnce(0); // Device 2 not suppressed
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.incr.mockResolvedValueOnce(6);
            const device2Alert: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: device2,
                alertType: 'test',
                severity: 'medium',
                message: 'Test',
                source: 'api',
            };
            const device2Result = await AlertManager.createAlert(device2Alert);
            expect(device2Result).toBeTruthy();
        });

        it('should use device-specific Redis keys', async () => {
            const deviceId = 'device-redis-keys';

            // Trigger storm
            mockRedis.incr.mockResolvedValueOnce(11);
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.exists.mockResolvedValueOnce(0);

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: deviceId,
                alertType: 'test_alert',
                severity: 'medium',
                message: 'Test',
                source: 'api',
            };

            await AlertManager.createAlert(input);

            // Verify device-specific keys were used
            expect(mockRedis.incr).toHaveBeenCalledWith(`alert:storm:${deviceId}`);
            expect(mockRedis.setEx).toHaveBeenCalledWith(
                `alert:suppress:${deviceId}`,
                900,
                expect.any(String)
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle Redis unavailable gracefully', async () => {
            (connectRedis as any).mockResolvedValue(null);

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                alertType: 'test_alert',
                severity: 'medium',
                message: 'Test',
                source: 'api',
            };

            // Should not throw error
            const alertId = await AlertManager.createAlert(input);

            // Should create alert (fail open)
            expect(alertId).toBeTruthy();
        });

        it('should log error when storm detection fails', async () => {
            const { logger } = require('../logger');

            // Mock Redis error
            mockRedis.incr.mockRejectedValueOnce(new Error('Redis connection failed'));
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.exists.mockResolvedValueOnce(0);

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                alertType: 'test_alert',
                severity: 'medium',
                message: 'Test',
                source: 'api',
            };

            await AlertManager.createAlert(input);

            // Verify error was logged
            expect(logger.error).toHaveBeenCalledWith(
                'Alert storm check failed',
                expect.any(Error),
                expect.objectContaining({
                    deviceId: 'test-device-id',
                })
            );
        });

        it('should not suppress alerts when storm detection fails', async () => {
            // Mock Redis error
            mockRedis.incr.mockRejectedValueOnce(new Error('Redis error'));
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.exists.mockResolvedValueOnce(0);

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                alertType: 'test_alert',
                severity: 'medium',
                message: 'Test',
                source: 'api',
            };

            const alertId = await AlertManager.createAlert(input);

            // Should create alert (fail open)
            expect(alertId).toBeTruthy();
        });
    });

    describe('Integration with Alert Creation', () => {
        it('should check suppression before creating alert', async () => {
            const deviceId = 'device-suppression-check';

            // Device is suppressed
            mockRedis.exists.mockResolvedValueOnce(1);

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: deviceId,
                alertType: 'test_alert',
                severity: 'critical',
                message: 'Test',
                source: 'api',
            };

            const alertId = await AlertManager.createAlert(input);

            // Verify alert was not created
            expect(alertId).toBeNull();

            // Verify deduplication was not checked (suppression happens first)
            const existsCalls = mockRedis.exists.mock.calls;
            expect(existsCalls.length).toBe(1); // Only suppression check
        });

        it('should check storm after creating alert', async () => {
            const deviceId = 'device-storm-after-create';

            // Not suppressed, not duplicate
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.incr.mockResolvedValueOnce(11); // Triggers storm
            mockRedis.exists.mockResolvedValueOnce(0); // Storm not created

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: deviceId,
                alertType: 'test_alert',
                severity: 'medium',
                message: 'Test',
                source: 'api',
            };

            const alertId = await AlertManager.createAlert(input);

            // Verify alert was created
            expect(alertId).toBeTruthy();

            // Verify storm was checked after creation
            expect(mockRedis.incr).toHaveBeenCalled();
        });

        it('should handle alerts without device ID (no storm detection)', async () => {
            mockRedis.exists.mockResolvedValueOnce(0); // Not duplicate

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                // No deviceId
                alertType: 'test_alert',
                severity: 'medium',
                message: 'Test',
                source: 'email',
            };

            const alertId = await AlertManager.createAlert(input);

            // Verify alert was created
            expect(alertId).toBeTruthy();

            // Verify storm detection was not called (no device ID)
            expect(mockRedis.incr).not.toHaveBeenCalled();
        });
    });
});
