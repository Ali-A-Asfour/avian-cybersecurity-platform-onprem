/**
 * Alert Storm Integration Test
 * 
 * Demonstrates the complete alert storm detection flow:
 * 1. Multiple alerts trigger storm detection
 * 2. Meta-alert is created
 * 3. Further alerts are suppressed
 * 
 * Requirements: 12.7
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

describe('Alert Storm Integration', () => {
    let mockRedis: any;

    beforeEach(() => {
        // Setup mock Redis
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

    it('should create meta-alert after 11 alerts and suppress further alerts', async () => {
        const { db } = require('../database');
        const { logger } = require('../logger');

        // Simulate 11 alerts being created
        for (let i = 1; i <= 11; i++) {
            // Mock Redis to return increasing count
            mockRedis.incr.mockResolvedValueOnce(i);

            // For the first 10 alerts, device is not suppressed
            // For the 11th alert, device becomes suppressed after storm detection
            if (i <= 10) {
                mockRedis.exists.mockResolvedValueOnce(0); // Not suppressed
                mockRedis.exists.mockResolvedValueOnce(0); // Not duplicate
            } else {
                mockRedis.exists.mockResolvedValueOnce(0); // Not suppressed (checked before storm)
                mockRedis.exists.mockResolvedValueOnce(0); // Not duplicate
                mockRedis.exists.mockResolvedValueOnce(0); // Not already created storm alert
            }

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: 'test-device-id',
                alertType: 'cpu_high',
                severity: 'medium',
                message: `CPU usage high - alert ${i}`,
                source: 'api',
            };

            await AlertManager.createAlert(input);
        }

        // Verify storm was detected on the 11th alert
        expect(logger.warn).toHaveBeenCalledWith(
            'Alert storm detected',
            expect.objectContaining({
                deviceId: 'test-device-id',
                alertCount: 11,
            })
        );

        // Verify meta-alert was created
        const insertCalls = db.insert().values.mock.calls;
        const stormAlert = insertCalls.find((call: any) =>
            call[0].alertType === 'alert_storm_detected'
        );

        expect(stormAlert).toBeDefined();
        expect(stormAlert[0]).toMatchObject({
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
        });

        // Verify suppression key was set
        expect(mockRedis.setEx).toHaveBeenCalledWith(
            expect.stringContaining('alert:suppress:test-device-id'),
            900, // 15 minutes
            expect.any(String)
        );

        // Now simulate a 12th alert - it should be suppressed
        mockRedis.exists.mockResolvedValueOnce(1); // Device IS suppressed

        const suppressedInput: CreateAlertInput = {
            tenantId: 'test-tenant-id',
            deviceId: 'test-device-id',
            alertType: 'cpu_high',
            severity: 'medium',
            message: 'CPU usage high - alert 12 (should be suppressed)',
            source: 'api',
        };

        const result = await AlertManager.createAlert(suppressedInput);

        // Alert should be suppressed (returns null)
        expect(result).toBeNull();

        // Verify suppression was logged
        expect(logger.debug).toHaveBeenCalledWith(
            'Alert suppressed due to alert storm',
            expect.objectContaining({
                deviceId: 'test-device-id',
                alertType: 'cpu_high',
            })
        );
    });

    it('should include descriptive message in meta-alert', async () => {
        const { db } = require('../database');

        // Simulate alert storm
        mockRedis.incr.mockResolvedValue(15);
        mockRedis.exists.mockResolvedValue(0);

        await AlertManager.checkAlertStorm('test-device-id');

        // Get the meta-alert that was created
        const valuesCall = db.insert().values.mock.calls[db.insert().values.mock.calls.length - 1];
        const message = valuesCall[0].message;

        // Verify message contains all required information
        expect(message).toContain('Alert storm detected');
        expect(message).toContain('15 alerts');
        expect(message).toContain('5 minutes');
        expect(message).toContain('Further alerts suppressed');
        expect(message).toContain('15 minutes');
    });
});
