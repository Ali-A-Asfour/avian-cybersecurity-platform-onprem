/**
 * Alert Deduplication Tests
 * 
 * Comprehensive tests for alert deduplication logic.
 * 
 * Requirements: 12.1, 12.2
 * 
 * Deduplication Rules:
 * - Same alert_type + device_id + severity within 2 minutes = duplicate
 * - Uses Redis for fast deduplication checks with 2-minute TTL
 * - Deduplication key based on: tenant_id, device_id, alert_type, severity
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

describe('Alert Deduplication', () => {
    let mockRedis: any;

    beforeEach(() => {
        // Setup mock Redis
        mockRedis = {
            exists: jest.fn().mockResolvedValue(0),
            setEx: jest.fn().mockResolvedValue('OK'),
            incr: jest.fn().mockResolvedValue(1),
            expire: jest.fn().mockResolvedValue(1),
        };
        (connectRedis as any).mockResolvedValue(mockRedis);
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Basic Deduplication', () => {
        it('should allow first alert to be created', async () => {
            mockRedis.exists.mockResolvedValue(0); // Key doesn't exist

            const input: CreateAlertInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'wan_down',
                severity: 'critical',
                message: 'WAN interface is down',
                source: 'api',
            };

            const alertId = await AlertManager.createAlert(input);

            expect(alertId).toBeTruthy();
            expect(mockRedis.exists).toHaveBeenCalled();
            expect(mockRedis.setEx).toHaveBeenCalledWith(
                expect.any(String),
                120, // 2 minutes
                expect.any(String)
            );
        });

        it('should block duplicate alert within 2-minute window', async () => {
            // First call - key doesn't exist
            mockRedis.exists.mockResolvedValueOnce(0);

            const input: CreateAlertInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'wan_down',
                severity: 'critical',
                message: 'WAN interface is down',
                source: 'api',
            };

            const alertId1 = await AlertManager.createAlert(input);
            expect(alertId1).toBeTruthy();

            // Second call - key exists (duplicate)
            mockRedis.exists.mockResolvedValueOnce(1);

            const alertId2 = await AlertManager.createAlert(input);
            expect(alertId2).toBeNull();
        });

        it('should allow alert after 2-minute window expires', async () => {
            const input: CreateAlertInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'wan_down',
                severity: 'critical',
                message: 'WAN interface is down',
                source: 'api',
            };

            // First alert - key doesn't exist
            mockRedis.exists.mockResolvedValueOnce(0);
            const alertId1 = await AlertManager.createAlert(input);
            expect(alertId1).toBeTruthy();

            // Second alert within window - key exists
            mockRedis.exists.mockResolvedValueOnce(1);
            const alertId2 = await AlertManager.createAlert(input);
            expect(alertId2).toBeNull();

            // Third alert after window - key expired
            mockRedis.exists.mockResolvedValueOnce(0);
            const alertId3 = await AlertManager.createAlert(input);
            expect(alertId3).toBeTruthy();
        });
    });

    describe('Deduplication Key Components', () => {
        it('should treat different alert_types as separate alerts', async () => {
            mockRedis.exists.mockResolvedValue(0);

            const baseInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                severity: 'critical' as const,
                message: 'Alert message',
                source: 'api' as const,
            };

            // Create alert with type 'wan_down'
            const alert1 = await AlertManager.createAlert({
                ...baseInput,
                alertType: 'wan_down',
            });
            expect(alert1).toBeTruthy();

            // Create alert with type 'vpn_down' - should NOT be duplicate
            const alert2 = await AlertManager.createAlert({
                ...baseInput,
                alertType: 'vpn_down',
            });
            expect(alert2).toBeTruthy();

            // Both alerts should have been created
            expect(mockRedis.setEx).toHaveBeenCalledTimes(2);
        });

        it('should treat different severities as separate alerts', async () => {
            mockRedis.exists.mockResolvedValue(0);

            const baseInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'cpu_high',
                message: 'CPU usage high',
                source: 'api' as const,
            };

            // Create alert with severity 'critical'
            const alert1 = await AlertManager.createAlert({
                ...baseInput,
                severity: 'critical',
            });
            expect(alert1).toBeTruthy();

            // Create alert with severity 'high' - should NOT be duplicate
            const alert2 = await AlertManager.createAlert({
                ...baseInput,
                severity: 'high',
            });
            expect(alert2).toBeTruthy();

            // Both alerts should have been created
            expect(mockRedis.setEx).toHaveBeenCalledTimes(2);
        });

        it('should treat different devices as separate alerts', async () => {
            mockRedis.exists.mockResolvedValue(0);

            const baseInput = {
                tenantId: 'tenant-1',
                alertType: 'wan_down',
                severity: 'critical' as const,
                message: 'WAN interface is down',
                source: 'api' as const,
            };

            // Create alert for device-1
            const alert1 = await AlertManager.createAlert({
                ...baseInput,
                deviceId: 'device-1',
            });
            expect(alert1).toBeTruthy();

            // Create alert for device-2 - should NOT be duplicate
            const alert2 = await AlertManager.createAlert({
                ...baseInput,
                deviceId: 'device-2',
            });
            expect(alert2).toBeTruthy();

            // Both alerts should have been created
            expect(mockRedis.setEx).toHaveBeenCalledTimes(2);
        });

        it('should treat different tenants as separate alerts', async () => {
            mockRedis.exists.mockResolvedValue(0);

            const baseInput = {
                deviceId: 'device-1',
                alertType: 'wan_down',
                severity: 'critical' as const,
                message: 'WAN interface is down',
                source: 'api' as const,
            };

            // Create alert for tenant-1
            const alert1 = await AlertManager.createAlert({
                ...baseInput,
                tenantId: 'tenant-1',
            });
            expect(alert1).toBeTruthy();

            // Create alert for tenant-2 - should NOT be duplicate
            const alert2 = await AlertManager.createAlert({
                ...baseInput,
                tenantId: 'tenant-2',
            });
            expect(alert2).toBeTruthy();

            // Both alerts should have been created
            expect(mockRedis.setEx).toHaveBeenCalledTimes(2);
        });

        it('should deduplicate when all key components match', async () => {
            const input: CreateAlertInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'wan_down',
                severity: 'critical',
                message: 'WAN interface is down',
                source: 'api',
            };

            // First alert - key doesn't exist
            mockRedis.exists.mockResolvedValueOnce(0);
            const alert1 = await AlertManager.createAlert(input);
            expect(alert1).toBeTruthy();

            // Second alert with same key components - should be duplicate
            mockRedis.exists.mockResolvedValueOnce(1);
            const alert2 = await AlertManager.createAlert(input);
            expect(alert2).toBeNull();
        });
    });

    describe('Message and Metadata Variations', () => {
        it('should deduplicate alerts with different messages but same key components', async () => {
            const baseInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'cpu_high',
                severity: 'medium' as const,
                source: 'api' as const,
            };

            // First alert
            mockRedis.exists.mockResolvedValueOnce(0);
            const alert1 = await AlertManager.createAlert({
                ...baseInput,
                message: 'CPU usage is at 85%',
            });
            expect(alert1).toBeTruthy();

            // Second alert with different message - should still be duplicate
            mockRedis.exists.mockResolvedValueOnce(1);
            const alert2 = await AlertManager.createAlert({
                ...baseInput,
                message: 'CPU usage is at 87%',
            });
            expect(alert2).toBeNull();
        });

        it('should deduplicate alerts with different metadata but same key components', async () => {
            const baseInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'ips_counter_increase',
                severity: 'info' as const,
                message: 'IPS blocks increased',
                source: 'api' as const,
            };

            // First alert
            mockRedis.exists.mockResolvedValueOnce(0);
            const alert1 = await AlertManager.createAlert({
                ...baseInput,
                metadata: { previous_value: 100, new_value: 105 },
            });
            expect(alert1).toBeTruthy();

            // Second alert with different metadata - should still be duplicate
            mockRedis.exists.mockResolvedValueOnce(1);
            const alert2 = await AlertManager.createAlert({
                ...baseInput,
                metadata: { previous_value: 105, new_value: 110 },
            });
            expect(alert2).toBeNull();
        });

        it('should deduplicate alerts with different sources but same key components', async () => {
            const baseInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'license_expiring',
                severity: 'high' as const,
                message: 'License expiring soon',
            };

            // First alert from API
            mockRedis.exists.mockResolvedValueOnce(0);
            const alert1 = await AlertManager.createAlert({
                ...baseInput,
                source: 'api',
            });
            expect(alert1).toBeTruthy();

            // Second alert from email - should still be duplicate
            mockRedis.exists.mockResolvedValueOnce(1);
            const alert2 = await AlertManager.createAlert({
                ...baseInput,
                source: 'email',
            });
            expect(alert2).toBeNull();
        });
    });

    describe('Alerts Without Device ID', () => {
        it('should allow alerts without device_id', async () => {
            mockRedis.exists.mockResolvedValue(0);

            const input: CreateAlertInput = {
                tenantId: 'tenant-1',
                alertType: 'license_expiring',
                severity: 'high',
                message: 'License expiring soon',
                source: 'email',
            };

            const alertId = await AlertManager.createAlert(input);

            expect(alertId).toBeTruthy();
            expect(mockRedis.setEx).toHaveBeenCalled();
        });

        it('should deduplicate alerts without device_id', async () => {
            const input: CreateAlertInput = {
                tenantId: 'tenant-1',
                alertType: 'license_expiring',
                severity: 'high',
                message: 'License expiring soon',
                source: 'email',
            };

            // First alert
            mockRedis.exists.mockResolvedValueOnce(0);
            const alert1 = await AlertManager.createAlert(input);
            expect(alert1).toBeTruthy();

            // Second alert - should be duplicate
            mockRedis.exists.mockResolvedValueOnce(1);
            const alert2 = await AlertManager.createAlert(input);
            expect(alert2).toBeNull();
        });

        it('should treat alerts with and without device_id as separate', async () => {
            mockRedis.exists.mockResolvedValue(0);

            const baseInput = {
                tenantId: 'tenant-1',
                alertType: 'license_expiring',
                severity: 'high' as const,
                message: 'License expiring soon',
                source: 'email' as const,
            };

            // Alert without device_id
            const alert1 = await AlertManager.createAlert(baseInput);
            expect(alert1).toBeTruthy();

            // Alert with device_id - should NOT be duplicate
            const alert2 = await AlertManager.createAlert({
                ...baseInput,
                deviceId: 'device-1',
            });
            expect(alert2).toBeTruthy();

            // Both alerts should have been created
            expect(mockRedis.setEx).toHaveBeenCalledTimes(2);
        });
    });

    describe('Redis TTL Behavior', () => {
        it('should set 120-second TTL on deduplication keys', async () => {
            mockRedis.exists.mockResolvedValue(0);

            const input: CreateAlertInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'wan_down',
                severity: 'critical',
                message: 'WAN interface is down',
                source: 'api',
            };

            await AlertManager.createAlert(input);

            expect(mockRedis.setEx).toHaveBeenCalledWith(
                expect.any(String),
                120, // Exactly 2 minutes (120 seconds)
                expect.any(String)
            );
        });

        it('should use setEx for atomic key creation with TTL', async () => {
            mockRedis.exists.mockResolvedValue(0);

            const input: CreateAlertInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'wan_down',
                severity: 'critical',
                message: 'WAN interface is down',
                source: 'api',
            };

            await AlertManager.createAlert(input);

            // Verify setEx is used for deduplication key
            // Note: expire may be called by alert storm detection logic
            expect(mockRedis.setEx).toHaveBeenCalledWith(
                expect.stringContaining('alert:dedup:'),
                120,
                expect.any(String)
            );
        });
    });

    describe('Error Handling', () => {
        it('should allow alert creation when Redis is unavailable', async () => {
            (connectRedis as any).mockResolvedValue(null);

            const input: CreateAlertInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'wan_down',
                severity: 'critical',
                message: 'WAN interface is down',
                source: 'api',
            };

            const alertId = await AlertManager.createAlert(input);

            // Alert should be created (fail open)
            expect(alertId).toBeTruthy();
        });

        it('should allow alert creation when Redis exists check fails', async () => {
            mockRedis.exists.mockRejectedValue(new Error('Redis error'));

            const input: CreateAlertInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'wan_down',
                severity: 'critical',
                message: 'WAN interface is down',
                source: 'api',
            };

            const alertId = await AlertManager.createAlert(input);

            // Alert should be created (fail open)
            expect(alertId).toBeTruthy();
        });

        it('should log error when deduplication check fails', async () => {
            const { logger } = require('../logger');
            mockRedis.exists.mockRejectedValue(new Error('Redis connection failed'));

            const input: CreateAlertInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'wan_down',
                severity: 'critical',
                message: 'WAN interface is down',
                source: 'api',
            };

            await AlertManager.createAlert(input);

            expect(logger.error).toHaveBeenCalledWith(
                'Alert deduplication check failed',
                expect.any(Error),
                expect.objectContaining({
                    tenantId: 'tenant-1',
                    deviceId: 'device-1',
                    alertType: 'wan_down',
                })
            );
        });
    });

    describe('Logging', () => {
        it('should log when duplicate alert is skipped', async () => {
            const { logger } = require('../logger');
            // First exists call: device is NOT suppressed
            // Second exists call: alert IS a duplicate
            mockRedis.exists
                .mockResolvedValueOnce(0) // Not suppressed
                .mockResolvedValueOnce(1); // Is duplicate

            const input: CreateAlertInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'cpu_high',
                severity: 'medium',
                message: 'CPU usage is at 85%',
                source: 'api',
                metadata: { cpuPercent: 85 },
            };

            await AlertManager.createAlert(input);

            expect(logger.debug).toHaveBeenCalledWith(
                'Duplicate alert skipped',
                expect.objectContaining({
                    tenantId: 'tenant-1',
                    deviceId: 'device-1',
                    alertType: 'cpu_high',
                    severity: 'medium',
                    message: 'CPU usage is at 85%',
                    source: 'api',
                    metadata: { cpuPercent: 85 },
                    timestamp: expect.any(String),
                    dedupWindowSeconds: 120,
                })
            );
        });

        it('should log when deduplication key is created', async () => {
            const { logger } = require('../logger');
            mockRedis.exists.mockResolvedValue(0);

            const input: CreateAlertInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'wan_down',
                severity: 'critical',
                message: 'WAN interface is down',
                source: 'api',
            };

            await AlertManager.createAlert(input);

            expect(logger.debug).toHaveBeenCalledWith(
                'Alert deduplication key created',
                expect.objectContaining({
                    tenantId: 'tenant-1',
                    deviceId: 'device-1',
                    alertType: 'wan_down',
                    severity: 'critical',
                    dedupKey: expect.any(String),
                    ttlSeconds: 120,
                })
            );
        });
    });

    describe('Real-World Scenarios', () => {
        it('should handle rapid-fire identical alerts', async () => {
            const input: CreateAlertInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'wan_down',
                severity: 'critical',
                message: 'WAN interface is down',
                source: 'api',
            };

            // First alert succeeds
            mockRedis.exists.mockResolvedValueOnce(0);
            const alert1 = await AlertManager.createAlert(input);
            expect(alert1).toBeTruthy();

            // Next 5 alerts are duplicates
            for (let i = 0; i < 5; i++) {
                mockRedis.exists.mockResolvedValueOnce(1);
                const alertId = await AlertManager.createAlert(input);
                expect(alertId).toBeNull();
            }

            // Only 1 alert should have been created
            const { db } = require('../database');
            expect(db.insert).toHaveBeenCalledTimes(1);
        });

        it('should handle counter increase alerts with changing values', async () => {
            const baseInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'ips_counter_increase',
                severity: 'info' as const,
                message: 'IPS blocks increased',
                source: 'api' as const,
            };

            // First counter increase
            mockRedis.exists.mockResolvedValueOnce(0);
            const alert1 = await AlertManager.createAlert({
                ...baseInput,
                metadata: { previous_value: 100, new_value: 105 },
            });
            expect(alert1).toBeTruthy();

            // Second counter increase within 2 minutes - should be deduplicated
            mockRedis.exists.mockResolvedValueOnce(1);
            const alert2 = await AlertManager.createAlert({
                ...baseInput,
                metadata: { previous_value: 105, new_value: 110 },
            });
            expect(alert2).toBeNull();

            // Third counter increase after 2 minutes - should be allowed
            mockRedis.exists.mockResolvedValueOnce(0);
            const alert3 = await AlertManager.createAlert({
                ...baseInput,
                metadata: { previous_value: 110, new_value: 115 },
            });
            expect(alert3).toBeTruthy();
        });

        it('should handle multiple devices with same alert type', async () => {
            mockRedis.exists.mockResolvedValue(0);

            const baseInput = {
                tenantId: 'tenant-1',
                alertType: 'wan_down',
                severity: 'critical' as const,
                message: 'WAN interface is down',
                source: 'api' as const,
            };

            // Create alerts for 3 different devices
            const alert1 = await AlertManager.createAlert({
                ...baseInput,
                deviceId: 'device-1',
            });
            const alert2 = await AlertManager.createAlert({
                ...baseInput,
                deviceId: 'device-2',
            });
            const alert3 = await AlertManager.createAlert({
                ...baseInput,
                deviceId: 'device-3',
            });

            // All alerts should be created (different devices)
            expect(alert1).toBeTruthy();
            expect(alert2).toBeTruthy();
            expect(alert3).toBeTruthy();
            expect(mockRedis.setEx).toHaveBeenCalledTimes(3);
        });

        it('should handle license expiry alerts from email', async () => {
            const input: CreateAlertInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'license_expiring',
                severity: 'high',
                message: 'IPS license expiring in 15 days',
                source: 'email',
                metadata: { license_type: 'IPS', days_remaining: 15 },
            };

            // First email alert
            mockRedis.exists.mockResolvedValueOnce(0);
            const alert1 = await AlertManager.createAlert(input);
            expect(alert1).toBeTruthy();

            // Duplicate email within 2 minutes - should be blocked
            mockRedis.exists.mockResolvedValueOnce(1);
            const alert2 = await AlertManager.createAlert(input);
            expect(alert2).toBeNull();
        });
    });

    describe('Integration with Alert Storm Detection', () => {
        it('should not create alert when device is suppressed', async () => {
            // Mock device suppression (storm detected)
            mockRedis.exists
                .mockResolvedValueOnce(0) // Not a duplicate
                .mockResolvedValueOnce(1); // Device is suppressed

            const input: CreateAlertInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'cpu_high',
                severity: 'medium',
                message: 'CPU usage high',
                source: 'api',
            };

            const alertId = await AlertManager.createAlert(input);

            expect(alertId).toBeNull();
        });

        it('should check suppression before deduplication', async () => {
            // Mock device suppression
            mockRedis.exists.mockResolvedValueOnce(1); // Device is suppressed

            const input: CreateAlertInput = {
                tenantId: 'tenant-1',
                deviceId: 'device-1',
                alertType: 'cpu_high',
                severity: 'medium',
                message: 'CPU usage high',
                source: 'api',
            };

            await AlertManager.createAlert(input);

            // Deduplication check should not be reached
            // Only one exists call for suppression check
            expect(mockRedis.exists).toHaveBeenCalledTimes(1);
        });
    });
});
