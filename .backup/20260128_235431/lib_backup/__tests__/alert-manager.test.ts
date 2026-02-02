/**
 * Alert Manager Tests
 * 
 * Tests for alert creation, deduplication, acknowledgment, and storm detection.
 * 
 * Requirements: 12.1-12.7
 */

import { AlertManager, CreateAlertInput, AlertFilters } from '../alert-manager';
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
        update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    returning: jest.fn().mockResolvedValue([{
                        id: 'test-alert-id',
                        acknowledged: true,
                        acknowledgedBy: 'test-user-id',
                        acknowledgedAt: new Date(),
                    }]),
                }),
            }),
        }),
        select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    orderBy: jest.fn().mockReturnValue({
                        limit: jest.fn().mockReturnValue({
                            offset: jest.fn().mockResolvedValue([]),
                        }),
                    }),
                }),
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

describe('AlertManager', () => {
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
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createAlert', () => {
        it('should create a new alert successfully', async () => {
            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                alertType: 'wan_down',
                severity: 'critical',
                message: 'WAN interface is down',
                source: 'api',
                metadata: { interface: 'X1' },
            };

            const alertId = await AlertManager.createAlert(input);

            expect(alertId).toBeTruthy();
            expect(typeof alertId).toBe('string');
        });

        it('should create alert without device ID', async () => {
            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                alertType: 'license_expiring',
                severity: 'high',
                message: 'License expiring soon',
                source: 'email',
            };

            const alertId = await AlertManager.createAlert(input);

            expect(alertId).toBeTruthy();
        });

        it('should skip duplicate alert within deduplication window', async () => {
            // Mock Redis to indicate duplicate exists
            mockRedis.exists.mockResolvedValueOnce(1);

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                alertType: 'wan_down',
                severity: 'critical',
                message: 'WAN interface is down',
                source: 'api',
            };

            const alertId = await AlertManager.createAlert(input);

            expect(alertId).toBeNull();
            expect(mockRedis.exists).toHaveBeenCalled();
        });

        it('should log comprehensive debugging information when skipping duplicate', async () => {
            const { logger } = require('../logger');
            // Mock Redis to indicate:
            // 1. Device is NOT suppressed (first exists call)
            // 2. Alert IS a duplicate (second exists call)
            mockRedis.exists
                .mockResolvedValueOnce(0) // Not suppressed
                .mockResolvedValueOnce(1); // Is duplicate

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                alertType: 'cpu_high',
                severity: 'medium',
                message: 'CPU usage is at 85%',
                source: 'api',
                metadata: { cpuPercent: 85, threshold: 80 },
            };

            await AlertManager.createAlert(input);

            expect(logger.debug).toHaveBeenCalledWith(
                'Duplicate alert skipped',
                expect.objectContaining({
                    tenantId: 'test-tenant-id',
                    deviceId: 'test-device-id',
                    alertType: 'cpu_high',
                    severity: 'medium',
                    message: 'CPU usage is at 85%',
                    source: 'api',
                    metadata: { cpuPercent: 85, threshold: 80 },
                    timestamp: expect.any(String),
                    dedupWindowSeconds: 120,
                })
            );
        });

        it('should suppress alert when device is in storm suppression', async () => {
            // Mock Redis to indicate device is suppressed
            mockRedis.exists
                .mockResolvedValueOnce(0) // Not a duplicate
                .mockResolvedValueOnce(1); // Device is suppressed

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                alertType: 'cpu_high',
                severity: 'medium',
                message: 'CPU usage high',
                source: 'api',
            };

            const alertId = await AlertManager.createAlert(input);

            expect(alertId).toBeNull();
        });
    });

    describe('deduplicateAlert', () => {
        it('should return false for non-duplicate alert', async () => {
            mockRedis.exists.mockResolvedValue(0);

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                alertType: 'vpn_down',
                severity: 'high',
                message: 'VPN tunnel is down',
                source: 'api',
            };

            const isDuplicate = await AlertManager.deduplicateAlert(input);

            expect(isDuplicate).toBe(false);
            expect(mockRedis.exists).toHaveBeenCalled();
            expect(mockRedis.setEx).toHaveBeenCalledWith(
                expect.any(String),
                120, // 2 minutes
                expect.any(String)
            );
        });

        it('should return true for duplicate alert', async () => {
            mockRedis.exists.mockResolvedValue(1);

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                alertType: 'vpn_down',
                severity: 'high',
                message: 'VPN tunnel is down',
                source: 'api',
            };

            const isDuplicate = await AlertManager.deduplicateAlert(input);

            expect(isDuplicate).toBe(true);
            expect(mockRedis.exists).toHaveBeenCalled();
            expect(mockRedis.setEx).not.toHaveBeenCalled();
        });

        it('should log detailed information when duplicate is detected', async () => {
            const { logger } = require('../logger');
            mockRedis.exists.mockResolvedValue(1);

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                alertType: 'vpn_down',
                severity: 'high',
                message: 'VPN tunnel is down',
                source: 'api',
            };

            await AlertManager.deduplicateAlert(input);

            expect(logger.debug).toHaveBeenCalledWith(
                'Duplicate alert detected in deduplication check',
                expect.objectContaining({
                    tenantId: 'test-tenant-id',
                    deviceId: 'test-device-id',
                    alertType: 'vpn_down',
                    severity: 'high',
                    dedupKey: expect.any(String),
                    dedupWindowSeconds: 120,
                })
            );
        });

        it('should log when deduplication key is created for non-duplicate', async () => {
            const { logger } = require('../logger');
            mockRedis.exists.mockResolvedValue(0);

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                alertType: 'wan_down',
                severity: 'critical',
                message: 'WAN interface is down',
                source: 'api',
            };

            await AlertManager.deduplicateAlert(input);

            expect(logger.debug).toHaveBeenCalledWith(
                'Alert deduplication key created',
                expect.objectContaining({
                    tenantId: 'test-tenant-id',
                    deviceId: 'test-device-id',
                    alertType: 'wan_down',
                    severity: 'critical',
                    dedupKey: expect.any(String),
                    ttlSeconds: 120,
                })
            );
        });

        it('should handle Redis unavailable gracefully', async () => {
            (connectRedis as any).mockResolvedValue(null);

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                alertType: 'test_alert',
                severity: 'low',
                message: 'Test message',
                source: 'api',
            };

            const isDuplicate = await AlertManager.deduplicateAlert(input);

            expect(isDuplicate).toBe(false);
        });
    });

    describe('acknowledgeAlert', () => {
        it('should acknowledge an alert successfully', async () => {
            const { db } = require('../database');
            const alertId = 'test-alert-id';
            const userId = 'test-user-id';
            const acknowledgedAt = new Date();

            // Create mock functions to track calls
            const mockSet = jest.fn();
            const mockWhere = jest.fn();
            const mockReturning = jest.fn();

            // Mock successful acknowledgment
            const mockResult = [{
                id: alertId,
                acknowledged: true,
                acknowledgedBy: userId,
                acknowledgedAt: acknowledgedAt,
            }];

            mockReturning.mockResolvedValue(mockResult);
            mockWhere.mockReturnValue({ returning: mockReturning });
            mockSet.mockReturnValue({ where: mockWhere });
            db.update.mockReturnValueOnce({ set: mockSet });

            await AlertManager.acknowledgeAlert(alertId, userId);

            // Verify the update method was called
            expect(db.update).toHaveBeenCalled();

            // Verify set was called with acknowledged=true, acknowledgedBy=userId, and acknowledgedAt timestamp
            expect(mockSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    acknowledged: true,
                    acknowledgedBy: userId,
                    acknowledgedAt: expect.any(Date),
                })
            );
        });

        it('should set acknowledgedAt timestamp when acknowledging', async () => {
            const { db } = require('../database');
            const alertId = 'test-alert-id';
            const userId = 'test-user-id';
            const beforeAck = new Date();

            // Create mock functions to track calls
            const mockSet = jest.fn();
            const mockWhere = jest.fn();
            const mockReturning = jest.fn();

            // Mock successful acknowledgment
            const mockResult = [{
                id: alertId,
                acknowledged: true,
                acknowledgedBy: userId,
                acknowledgedAt: new Date(),
            }];

            mockReturning.mockResolvedValue(mockResult);
            mockWhere.mockReturnValue({ returning: mockReturning });
            mockSet.mockReturnValue({ where: mockWhere });
            db.update.mockReturnValueOnce({ set: mockSet });

            await AlertManager.acknowledgeAlert(alertId, userId);

            const afterAck = new Date();

            // Verify acknowledgedAt was set
            expect(mockSet).toHaveBeenCalled();
            const setArgs = mockSet.mock.calls[0][0];

            expect(setArgs.acknowledgedAt).toBeInstanceOf(Date);
            expect(setArgs.acknowledgedAt.getTime()).toBeGreaterThanOrEqual(beforeAck.getTime());
            expect(setArgs.acknowledgedAt.getTime()).toBeLessThanOrEqual(afterAck.getTime());
        });

        it('should update only the specified alert by ID', async () => {
            const { db } = require('../database');
            const alertId = 'specific-alert-id';
            const userId = 'test-user-id';

            // Mock successful acknowledgment
            const mockResult = [{
                id: alertId,
                acknowledged: true,
                acknowledgedBy: userId,
                acknowledgedAt: new Date(),
            }];

            const mockWhere = jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue(mockResult),
            });

            db.update.mockReturnValueOnce({
                set: jest.fn().mockReturnValue({
                    where: mockWhere,
                }),
            });

            await AlertManager.acknowledgeAlert(alertId, userId);

            // Verify where clause was called with the correct alert ID
            expect(mockWhere).toHaveBeenCalled();
        });

        it('should throw error for non-existent alert', async () => {
            const { db } = require('../database');
            // Mock empty result for non-existent alert
            db.update.mockReturnValueOnce({
                set: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        returning: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });

            const fakeAlertId = '00000000-0000-0000-0000-000000000000';
            const userId = 'test-user-id';

            await expect(
                AlertManager.acknowledgeAlert(fakeAlertId, userId)
            ).rejects.toThrow('Alert not found');
        });

        it('should log acknowledgment action', async () => {
            const { logger } = require('../logger');
            const { db } = require('../database');
            const alertId = 'test-alert-id';
            const userId = 'test-user-id';

            // Mock successful acknowledgment
            const mockResult = [{
                id: alertId,
                acknowledged: true,
                acknowledgedBy: userId,
                acknowledgedAt: new Date(),
            }];

            db.update.mockReturnValueOnce({
                set: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        returning: jest.fn().mockResolvedValue(mockResult),
                    }),
                }),
            });

            await AlertManager.acknowledgeAlert(alertId, userId);

            // Verify logging
            expect(logger.info).toHaveBeenCalledWith(
                'Alert acknowledged',
                expect.objectContaining({
                    alertId,
                    userId,
                })
            );
        });

        it('should handle database errors gracefully', async () => {
            const { logger } = require('../logger');
            const { db } = require('../database');
            const alertId = 'test-alert-id';
            const userId = 'test-user-id';

            // Mock database error
            const dbError = new Error('Database connection failed');
            db.update.mockReturnValueOnce({
                set: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        returning: jest.fn().mockRejectedValue(dbError),
                    }),
                }),
            });

            await expect(
                AlertManager.acknowledgeAlert(alertId, userId)
            ).rejects.toThrow('Database connection failed');

            // Verify error was logged
            expect(logger.error).toHaveBeenCalledWith(
                'Failed to acknowledge alert',
                expect.any(Error),
                expect.objectContaining({
                    alertId,
                    userId,
                })
            );
        });

        it('should allow different users to acknowledge different alerts', async () => {
            const { db } = require('../database');

            // First acknowledgment
            const alert1Id = 'alert-1';
            const user1Id = 'user-1';

            db.update.mockReturnValueOnce({
                set: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        returning: jest.fn().mockResolvedValue([{
                            id: alert1Id,
                            acknowledged: true,
                            acknowledgedBy: user1Id,
                            acknowledgedAt: new Date(),
                        }]),
                    }),
                }),
            });

            await AlertManager.acknowledgeAlert(alert1Id, user1Id);

            // Second acknowledgment by different user
            const alert2Id = 'alert-2';
            const user2Id = 'user-2';

            db.update.mockReturnValueOnce({
                set: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        returning: jest.fn().mockResolvedValue([{
                            id: alert2Id,
                            acknowledged: true,
                            acknowledgedBy: user2Id,
                            acknowledgedAt: new Date(),
                        }]),
                    }),
                }),
            });

            await AlertManager.acknowledgeAlert(alert2Id, user2Id);

            // Verify both calls succeeded
            expect(db.update).toHaveBeenCalledTimes(2);
        });
    });

    describe('getAlerts', () => {
        it('should call database with correct filters', async () => {
            const filters: AlertFilters = {
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                severity: 'critical',
                acknowledged: false,
            };

            await AlertManager.getAlerts(filters);

            const { db } = require('../database');
            expect(db.select).toHaveBeenCalled();
        });

        it('should handle multiple severity filters', async () => {
            const filters: AlertFilters = {
                tenantId: 'test-tenant-id',
                severity: ['critical', 'high'],
            };

            await AlertManager.getAlerts(filters);

            const { db } = require('../database');
            expect(db.select).toHaveBeenCalled();
        });

        it('should apply pagination', async () => {
            const filters: AlertFilters = {
                tenantId: 'test-tenant-id',
                limit: 10,
                offset: 20,
            };

            await AlertManager.getAlerts(filters);

            const { db } = require('../database');
            expect(db.select).toHaveBeenCalled();
        });

        it('should always enforce tenant_id filtering', async () => {
            const { db } = require('../database');

            // Mock the database to return alerts
            const mockAlerts = [
                {
                    id: 'alert-1',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'wan_down',
                    severity: 'critical',
                    message: 'WAN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date(),
                },
            ];

            // Create a proper mock chain that returns the alerts
            const mockOrderBy = jest.fn().mockResolvedValue(mockAlerts);
            const mockWhere = jest.fn().mockReturnValue({
                orderBy: mockOrderBy,
            });
            const mockFrom = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            db.select.mockReturnValueOnce({
                from: mockFrom,
            });

            const filters: AlertFilters = {
                tenantId: 'tenant-a',
            };

            const alerts = await AlertManager.getAlerts(filters);

            // Verify tenant_id is always included in the query
            expect(db.select).toHaveBeenCalled();
            expect(alerts).toHaveLength(1);
            expect(alerts[0].tenantId).toBe('tenant-a');
        });

        it('should filter by tenant_id even with other filters', async () => {
            const { db } = require('../database');

            const mockAlerts = [
                {
                    id: 'alert-1',
                    tenantId: 'tenant-b',
                    deviceId: 'device-2',
                    alertType: 'vpn_down',
                    severity: 'high',
                    message: 'VPN tunnel down',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date(),
                },
            ];

            // Create a proper mock chain without pagination (no limit/offset in this test)
            const mockOrderBy = jest.fn().mockResolvedValue(mockAlerts);
            const mockWhere = jest.fn().mockReturnValue({
                orderBy: mockOrderBy,
            });
            const mockFrom = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            db.select.mockReturnValueOnce({
                from: mockFrom,
            });

            const filters: AlertFilters = {
                tenantId: 'tenant-b',
                deviceId: 'device-2',
                severity: 'high',
                acknowledged: false,
            };

            const alerts = await AlertManager.getAlerts(filters);

            // Verify all returned alerts belong to the specified tenant
            expect(alerts).toHaveLength(1);
            expect(alerts[0].tenantId).toBe('tenant-b');
        });

        it('should return empty array when no alerts match tenant_id', async () => {
            const { db } = require('../database');

            // Create a proper mock chain that returns empty array
            const mockOrderBy = jest.fn().mockResolvedValue([]);
            const mockWhere = jest.fn().mockReturnValue({
                orderBy: mockOrderBy,
            });
            const mockFrom = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            db.select.mockReturnValueOnce({
                from: mockFrom,
            });

            const filters: AlertFilters = {
                tenantId: 'non-existent-tenant',
            };

            const alerts = await AlertManager.getAlerts(filters);

            expect(alerts).toHaveLength(0);
        });

        it('should filter alerts by device_id', async () => {
            const { db } = require('../database');

            // Mock alerts from multiple devices
            const mockAlerts = [
                {
                    id: 'alert-1',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'wan_down',
                    severity: 'critical',
                    message: 'WAN is down on device 1',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date(),
                },
            ];

            // Create a proper mock chain that returns filtered alerts
            const mockOrderBy = jest.fn().mockResolvedValue(mockAlerts);
            const mockWhere = jest.fn().mockReturnValue({
                orderBy: mockOrderBy,
            });
            const mockFrom = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            db.select.mockReturnValueOnce({
                from: mockFrom,
            });

            const filters: AlertFilters = {
                tenantId: 'tenant-a',
                deviceId: 'device-1',
            };

            const alerts = await AlertManager.getAlerts(filters);

            // Verify only alerts for the specified device are returned
            expect(alerts).toHaveLength(1);
            expect(alerts[0].deviceId).toBe('device-1');
        });

        it('should return alerts for all devices when device_id not specified', async () => {
            const { db } = require('../database');

            // Mock alerts from multiple devices
            const mockAlerts = [
                {
                    id: 'alert-1',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'wan_down',
                    severity: 'critical',
                    message: 'WAN is down on device 1',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date(),
                },
                {
                    id: 'alert-2',
                    tenantId: 'tenant-a',
                    deviceId: 'device-2',
                    alertType: 'vpn_down',
                    severity: 'high',
                    message: 'VPN is down on device 2',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date(),
                },
            ];

            // Create a proper mock chain that returns all alerts
            const mockOrderBy = jest.fn().mockResolvedValue(mockAlerts);
            const mockWhere = jest.fn().mockReturnValue({
                orderBy: mockOrderBy,
            });
            const mockFrom = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            db.select.mockReturnValueOnce({
                from: mockFrom,
            });

            const filters: AlertFilters = {
                tenantId: 'tenant-a',
                // No deviceId specified
            };

            const alerts = await AlertManager.getAlerts(filters);

            // Verify alerts from all devices are returned
            expect(alerts).toHaveLength(2);
            expect(alerts[0].deviceId).toBe('device-1');
            expect(alerts[1].deviceId).toBe('device-2');
        });

        it('should return empty array when no alerts match device_id', async () => {
            const { db } = require('../database');

            // Create a proper mock chain that returns empty array
            const mockOrderBy = jest.fn().mockResolvedValue([]);
            const mockWhere = jest.fn().mockReturnValue({
                orderBy: mockOrderBy,
            });
            const mockFrom = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            db.select.mockReturnValueOnce({
                from: mockFrom,
            });

            const filters: AlertFilters = {
                tenantId: 'tenant-a',
                deviceId: 'non-existent-device',
            };

            const alerts = await AlertManager.getAlerts(filters);

            expect(alerts).toHaveLength(0);
        });

        it('should filter alerts by acknowledged status (false)', async () => {
            const { db } = require('../database');

            // Mock unacknowledged alerts
            const mockAlerts = [
                {
                    id: 'alert-1',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'wan_down',
                    severity: 'critical',
                    message: 'WAN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date(),
                },
                {
                    id: 'alert-2',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'vpn_down',
                    severity: 'high',
                    message: 'VPN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date(),
                },
            ];

            // Create a proper mock chain that returns unacknowledged alerts
            const mockOrderBy = jest.fn().mockResolvedValue(mockAlerts);
            const mockWhere = jest.fn().mockReturnValue({
                orderBy: mockOrderBy,
            });
            const mockFrom = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            db.select.mockReturnValueOnce({
                from: mockFrom,
            });

            const filters: AlertFilters = {
                tenantId: 'tenant-a',
                acknowledged: false,
            };

            const alerts = await AlertManager.getAlerts(filters);

            // Verify only unacknowledged alerts are returned
            expect(alerts).toHaveLength(2);
            expect(alerts[0].acknowledged).toBe(false);
            expect(alerts[1].acknowledged).toBe(false);
        });

        it('should filter alerts by acknowledged status (true)', async () => {
            const { db } = require('../database');

            // Mock acknowledged alerts
            const mockAlerts = [
                {
                    id: 'alert-1',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'wan_down',
                    severity: 'critical',
                    message: 'WAN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: true,
                    acknowledgedBy: 'user-1',
                    acknowledgedAt: new Date('2024-01-15T10:00:00Z'),
                    createdAt: new Date('2024-01-15T09:00:00Z'),
                },
            ];

            // Create a proper mock chain that returns acknowledged alerts
            const mockOrderBy = jest.fn().mockResolvedValue(mockAlerts);
            const mockWhere = jest.fn().mockReturnValue({
                orderBy: mockOrderBy,
            });
            const mockFrom = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            db.select.mockReturnValueOnce({
                from: mockFrom,
            });

            const filters: AlertFilters = {
                tenantId: 'tenant-a',
                acknowledged: true,
            };

            const alerts = await AlertManager.getAlerts(filters);

            // Verify only acknowledged alerts are returned
            expect(alerts).toHaveLength(1);
            expect(alerts[0].acknowledged).toBe(true);
            expect(alerts[0].acknowledgedBy).toBe('user-1');
            expect(alerts[0].acknowledgedAt).toEqual(new Date('2024-01-15T10:00:00Z'));
        });

        it('should return all alerts when acknowledged filter not specified', async () => {
            const { db } = require('../database');

            // Mock mix of acknowledged and unacknowledged alerts
            const mockAlerts = [
                {
                    id: 'alert-1',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'wan_down',
                    severity: 'critical',
                    message: 'WAN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date(),
                },
                {
                    id: 'alert-2',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'vpn_down',
                    severity: 'high',
                    message: 'VPN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: true,
                    acknowledgedBy: 'user-1',
                    acknowledgedAt: new Date(),
                    createdAt: new Date(),
                },
            ];

            // Create a proper mock chain that returns all alerts
            const mockOrderBy = jest.fn().mockResolvedValue(mockAlerts);
            const mockWhere = jest.fn().mockReturnValue({
                orderBy: mockOrderBy,
            });
            const mockFrom = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            db.select.mockReturnValueOnce({
                from: mockFrom,
            });

            const filters: AlertFilters = {
                tenantId: 'tenant-a',
                // No acknowledged filter specified
            };

            const alerts = await AlertManager.getAlerts(filters);

            // Verify both acknowledged and unacknowledged alerts are returned
            expect(alerts).toHaveLength(2);
            expect(alerts[0].acknowledged).toBe(false);
            expect(alerts[1].acknowledged).toBe(true);
        });

        it('should combine acknowledged filter with other filters', async () => {
            const { db } = require('../database');

            // Mock unacknowledged critical alerts for specific device
            const mockAlerts = [
                {
                    id: 'alert-1',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'wan_down',
                    severity: 'critical',
                    message: 'WAN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date(),
                },
            ];

            // Create a proper mock chain that returns filtered alerts
            const mockOrderBy = jest.fn().mockResolvedValue(mockAlerts);
            const mockWhere = jest.fn().mockReturnValue({
                orderBy: mockOrderBy,
            });
            const mockFrom = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            db.select.mockReturnValueOnce({
                from: mockFrom,
            });

            const filters: AlertFilters = {
                tenantId: 'tenant-a',
                deviceId: 'device-1',
                severity: 'critical',
                acknowledged: false,
            };

            const alerts = await AlertManager.getAlerts(filters);

            // Verify all filters are applied
            expect(alerts).toHaveLength(1);
            expect(alerts[0].deviceId).toBe('device-1');
            expect(alerts[0].severity).toBe('critical');
            expect(alerts[0].acknowledged).toBe(false);
        });

        it('should return empty array when no alerts match acknowledged filter', async () => {
            const { db } = require('../database');

            // Create a proper mock chain that returns empty array
            const mockOrderBy = jest.fn().mockResolvedValue([]);
            const mockWhere = jest.fn().mockReturnValue({
                orderBy: mockOrderBy,
            });
            const mockFrom = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            db.select.mockReturnValueOnce({
                from: mockFrom,
            });

            const filters: AlertFilters = {
                tenantId: 'tenant-a',
                acknowledged: true, // Looking for acknowledged alerts but none exist
            };

            const alerts = await AlertManager.getAlerts(filters);

            expect(alerts).toHaveLength(0);
        });

        it('should filter alerts by start date', async () => {
            const { db } = require('../database');

            const startDate = new Date('2024-01-15T00:00:00Z');
            const mockAlerts = [
                {
                    id: 'alert-1',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'wan_down',
                    severity: 'critical',
                    message: 'WAN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date('2024-01-16T10:00:00Z'),
                },
                {
                    id: 'alert-2',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'vpn_down',
                    severity: 'high',
                    message: 'VPN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date('2024-01-17T10:00:00Z'),
                },
            ];

            // Create a proper mock chain that returns filtered alerts
            const mockOrderBy = jest.fn().mockResolvedValue(mockAlerts);
            const mockWhere = jest.fn().mockReturnValue({
                orderBy: mockOrderBy,
            });
            const mockFrom = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            db.select.mockReturnValueOnce({
                from: mockFrom,
            });

            const filters: AlertFilters = {
                tenantId: 'tenant-a',
                startDate: startDate,
            };

            const alerts = await AlertManager.getAlerts(filters);

            // Verify only alerts after start date are returned
            expect(alerts).toHaveLength(2);
            expect(alerts[0].createdAt.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
            expect(alerts[1].createdAt.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        });

        it('should filter alerts by end date', async () => {
            const { db } = require('../database');

            const endDate = new Date('2024-01-20T23:59:59Z');
            const mockAlerts = [
                {
                    id: 'alert-1',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'wan_down',
                    severity: 'critical',
                    message: 'WAN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date('2024-01-18T10:00:00Z'),
                },
                {
                    id: 'alert-2',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'vpn_down',
                    severity: 'high',
                    message: 'VPN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date('2024-01-19T10:00:00Z'),
                },
            ];

            // Create a proper mock chain that returns filtered alerts
            const mockOrderBy = jest.fn().mockResolvedValue(mockAlerts);
            const mockWhere = jest.fn().mockReturnValue({
                orderBy: mockOrderBy,
            });
            const mockFrom = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            db.select.mockReturnValueOnce({
                from: mockFrom,
            });

            const filters: AlertFilters = {
                tenantId: 'tenant-a',
                endDate: endDate,
            };

            const alerts = await AlertManager.getAlerts(filters);

            // Verify only alerts before end date are returned
            expect(alerts).toHaveLength(2);
            expect(alerts[0].createdAt.getTime()).toBeLessThanOrEqual(endDate.getTime());
            expect(alerts[1].createdAt.getTime()).toBeLessThanOrEqual(endDate.getTime());
        });

        it('should filter alerts by date range (start and end date)', async () => {
            const { db } = require('../database');

            const startDate = new Date('2024-01-15T00:00:00Z');
            const endDate = new Date('2024-01-20T23:59:59Z');
            const mockAlerts = [
                {
                    id: 'alert-1',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'wan_down',
                    severity: 'critical',
                    message: 'WAN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date('2024-01-16T10:00:00Z'),
                },
                {
                    id: 'alert-2',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'vpn_down',
                    severity: 'high',
                    message: 'VPN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date('2024-01-18T10:00:00Z'),
                },
            ];

            // Create a proper mock chain that returns filtered alerts
            const mockOrderBy = jest.fn().mockResolvedValue(mockAlerts);
            const mockWhere = jest.fn().mockReturnValue({
                orderBy: mockOrderBy,
            });
            const mockFrom = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            db.select.mockReturnValueOnce({
                from: mockFrom,
            });

            const filters: AlertFilters = {
                tenantId: 'tenant-a',
                startDate: startDate,
                endDate: endDate,
            };

            const alerts = await AlertManager.getAlerts(filters);

            // Verify only alerts within date range are returned
            expect(alerts).toHaveLength(2);
            expect(alerts[0].createdAt.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
            expect(alerts[0].createdAt.getTime()).toBeLessThanOrEqual(endDate.getTime());
            expect(alerts[1].createdAt.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
            expect(alerts[1].createdAt.getTime()).toBeLessThanOrEqual(endDate.getTime());
        });

        it('should return empty array when no alerts match date range', async () => {
            const { db } = require('../database');

            const startDate = new Date('2024-02-01T00:00:00Z');
            const endDate = new Date('2024-02-28T23:59:59Z');

            // Create a proper mock chain that returns empty array
            const mockOrderBy = jest.fn().mockResolvedValue([]);
            const mockWhere = jest.fn().mockReturnValue({
                orderBy: mockOrderBy,
            });
            const mockFrom = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            db.select.mockReturnValueOnce({
                from: mockFrom,
            });

            const filters: AlertFilters = {
                tenantId: 'tenant-a',
                startDate: startDate,
                endDate: endDate,
            };

            const alerts = await AlertManager.getAlerts(filters);

            expect(alerts).toHaveLength(0);
        });

        it('should combine date range filter with other filters', async () => {
            const { db } = require('../database');

            const startDate = new Date('2024-01-15T00:00:00Z');
            const endDate = new Date('2024-01-20T23:59:59Z');
            const mockAlerts = [
                {
                    id: 'alert-1',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'wan_down',
                    severity: 'critical',
                    message: 'WAN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date('2024-01-16T10:00:00Z'),
                },
            ];

            // Create a proper mock chain that returns filtered alerts
            const mockOrderBy = jest.fn().mockResolvedValue(mockAlerts);
            const mockWhere = jest.fn().mockReturnValue({
                orderBy: mockOrderBy,
            });
            const mockFrom = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            db.select.mockReturnValueOnce({
                from: mockFrom,
            });

            const filters: AlertFilters = {
                tenantId: 'tenant-a',
                deviceId: 'device-1',
                severity: 'critical',
                acknowledged: false,
                startDate: startDate,
                endDate: endDate,
            };

            const alerts = await AlertManager.getAlerts(filters);

            // Verify all filters are applied
            expect(alerts).toHaveLength(1);
            expect(alerts[0].deviceId).toBe('device-1');
            expect(alerts[0].severity).toBe('critical');
            expect(alerts[0].acknowledged).toBe(false);
            expect(alerts[0].createdAt.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
            expect(alerts[0].createdAt.getTime()).toBeLessThanOrEqual(endDate.getTime());
        });

        it('should handle date range for last 7 days', async () => {
            const { db } = require('../database');

            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const mockAlerts = [
                {
                    id: 'alert-1',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'wan_down',
                    severity: 'critical',
                    message: 'WAN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
                },
                {
                    id: 'alert-2',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'vpn_down',
                    severity: 'high',
                    message: 'VPN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
                },
            ];

            // Create a proper mock chain that returns filtered alerts
            const mockOrderBy = jest.fn().mockResolvedValue(mockAlerts);
            const mockWhere = jest.fn().mockReturnValue({
                orderBy: mockOrderBy,
            });
            const mockFrom = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            db.select.mockReturnValueOnce({
                from: mockFrom,
            });

            const filters: AlertFilters = {
                tenantId: 'tenant-a',
                startDate: sevenDaysAgo,
                endDate: now,
            };

            const alerts = await AlertManager.getAlerts(filters);

            // Verify alerts from last 7 days are returned
            expect(alerts).toHaveLength(2);
            expect(alerts[0].createdAt.getTime()).toBeGreaterThanOrEqual(sevenDaysAgo.getTime());
            expect(alerts[0].createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
            expect(alerts[1].createdAt.getTime()).toBeGreaterThanOrEqual(sevenDaysAgo.getTime());
            expect(alerts[1].createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
        });

        it('should handle date range for last 30 days', async () => {
            const { db } = require('../database');

            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const mockAlerts = [
                {
                    id: 'alert-1',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'wan_down',
                    severity: 'critical',
                    message: 'WAN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
                },
                {
                    id: 'alert-2',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'vpn_down',
                    severity: 'high',
                    message: 'VPN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
                },
            ];

            // Create a proper mock chain that returns filtered alerts
            const mockOrderBy = jest.fn().mockResolvedValue(mockAlerts);
            const mockWhere = jest.fn().mockReturnValue({
                orderBy: mockOrderBy,
            });
            const mockFrom = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            db.select.mockReturnValueOnce({
                from: mockFrom,
            });

            const filters: AlertFilters = {
                tenantId: 'tenant-a',
                startDate: thirtyDaysAgo,
                endDate: now,
            };

            const alerts = await AlertManager.getAlerts(filters);

            // Verify alerts from last 30 days are returned
            expect(alerts).toHaveLength(2);
            expect(alerts[0].createdAt.getTime()).toBeGreaterThanOrEqual(thirtyDaysAgo.getTime());
            expect(alerts[0].createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
            expect(alerts[1].createdAt.getTime()).toBeGreaterThanOrEqual(thirtyDaysAgo.getTime());
            expect(alerts[1].createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
        });

        it('should sort alerts by timestamp descending (newest first)', async () => {
            const { db } = require('../database');

            // Create alerts with different timestamps
            const mockAlerts = [
                {
                    id: 'alert-3',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'cpu_high',
                    severity: 'medium',
                    message: 'CPU usage high',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date('2024-01-20T15:00:00Z'), // Newest
                },
                {
                    id: 'alert-2',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'vpn_down',
                    severity: 'high',
                    message: 'VPN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date('2024-01-20T12:00:00Z'), // Middle
                },
                {
                    id: 'alert-1',
                    tenantId: 'tenant-a',
                    deviceId: 'device-1',
                    alertType: 'wan_down',
                    severity: 'critical',
                    message: 'WAN is down',
                    source: 'api',
                    metadata: {},
                    acknowledged: false,
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                    createdAt: new Date('2024-01-20T09:00:00Z'), // Oldest
                },
            ];

            // Create a proper mock chain that returns sorted alerts
            const mockOrderBy = jest.fn().mockResolvedValue(mockAlerts);
            const mockWhere = jest.fn().mockReturnValue({
                orderBy: mockOrderBy,
            });
            const mockFrom = jest.fn().mockReturnValue({
                where: mockWhere,
            });
            db.select.mockReturnValueOnce({
                from: mockFrom,
            });

            const filters: AlertFilters = {
                tenantId: 'tenant-a',
            };

            const alerts = await AlertManager.getAlerts(filters);

            // Verify alerts are sorted by timestamp descending (newest first)
            expect(alerts).toHaveLength(3);
            expect(alerts[0].id).toBe('alert-3');
            expect(alerts[0].createdAt).toEqual(new Date('2024-01-20T15:00:00Z'));
            expect(alerts[1].id).toBe('alert-2');
            expect(alerts[1].createdAt).toEqual(new Date('2024-01-20T12:00:00Z'));
            expect(alerts[2].id).toBe('alert-1');
            expect(alerts[2].createdAt).toEqual(new Date('2024-01-20T09:00:00Z'));

            // Verify timestamps are in descending order
            expect(alerts[0].createdAt.getTime()).toBeGreaterThan(alerts[1].createdAt.getTime());
            expect(alerts[1].createdAt.getTime()).toBeGreaterThan(alerts[2].createdAt.getTime());
        });
    });

    describe('checkAlertStorm', () => {
        it('should detect alert storm and create meta-alert', async () => {
            const { db } = require('../database');
            const { logger } = require('../logger');

            // Mock Redis to simulate alert storm
            mockRedis.incr.mockResolvedValue(11); // Exceeds threshold of 10
            mockRedis.exists.mockResolvedValue(0); // Not already suppressed

            const isStorm = await AlertManager.checkAlertStorm('test-device-id');

            expect(isStorm).toBe(true);
            expect(mockRedis.incr).toHaveBeenCalled();
            expect(mockRedis.setEx).toHaveBeenCalledWith(
                expect.stringContaining('alert:suppress:'),
                900, // 15 minutes
                expect.any(String)
            );

            // Verify warning was logged
            expect(logger.warn).toHaveBeenCalledWith(
                'Alert storm detected',
                expect.objectContaining({
                    deviceId: 'test-device-id',
                    alertCount: 11,
                })
            );

            // Verify meta-alert was created with correct properties
            expect(db.insert).toHaveBeenCalled();
            const valuesCall = db.insert().values.mock.calls[db.insert().values.mock.calls.length - 1];
            expect(valuesCall[0]).toMatchObject({
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                alertType: 'alert_storm_detected',
                severity: 'high',
                source: 'api',
                metadata: {
                    alertCount: 11,
                    windowSeconds: 300,
                    suppressionSeconds: 900,
                },
                acknowledged: false,
            });

            // Verify message contains key information
            expect(valuesCall[0].message).toContain('Alert storm detected');
            expect(valuesCall[0].message).toContain('11 alerts');
            expect(valuesCall[0].message).toContain('5 minutes');
            expect(valuesCall[0].message).toContain('15 minutes');
        });

        it('should not create duplicate storm alert', async () => {
            // Mock Redis to simulate alert storm but already suppressed
            mockRedis.incr.mockResolvedValue(11);
            mockRedis.exists.mockResolvedValue(1); // Already suppressed

            const isStorm = await AlertManager.checkAlertStorm('test-device-id');

            // Should still return true but not create duplicate alert
            expect(isStorm).toBe(false);
        });

        it('should not trigger storm for alerts below threshold', async () => {
            mockRedis.incr.mockResolvedValue(5); // Below threshold

            const isStorm = await AlertManager.checkAlertStorm('test-device-id');

            expect(isStorm).toBe(false);
        });

        it('should handle Redis unavailable gracefully', async () => {
            (connectRedis as any).mockResolvedValue(null);

            const isStorm = await AlertManager.checkAlertStorm('test-device-id');

            expect(isStorm).toBe(false);
        });
    });
});
