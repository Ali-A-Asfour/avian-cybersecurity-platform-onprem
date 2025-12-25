/**
 * Alert Storm Suppression Demonstration Test
 * 
 * This test demonstrates the complete 15-minute suppression workflow
 * for devices experiencing alert storms.
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

describe('Alert Storm Suppression - 15 Minute Workflow', () => {
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

    it('should demonstrate complete 15-minute suppression workflow', async () => {
        const { logger } = require('../logger');
        const deviceId = 'demo-device-123';

        // Phase 1: Normal alert creation (alerts 1-10)
        console.log('\n=== Phase 1: Normal Alert Creation ===');
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
            console.log(`Alert ${i}: Created (ID: ${alertId})`);
            expect(alertId).toBeTruthy();
        }

        // Phase 2: Storm detection (alert 11)
        console.log('\n=== Phase 2: Storm Detection (Alert 11) ===');
        mockRedis.incr.mockResolvedValueOnce(11); // Exceeds threshold
        mockRedis.exists.mockResolvedValueOnce(0); // Not suppressed yet
        mockRedis.exists.mockResolvedValueOnce(0); // Not duplicate
        mockRedis.exists.mockResolvedValueOnce(0); // Storm not yet created

        const stormTriggerInput: CreateAlertInput = {
            tenantId: 'test-tenant-id',
            deviceId: deviceId,
            alertType: 'alert_11',
            severity: 'medium',
            message: 'Alert 11 - triggers storm',
            source: 'api',
        };

        const alert11Id = await AlertManager.createAlert(stormTriggerInput);
        console.log(`Alert 11: Created (ID: ${alert11Id})`);
        console.log('🚨 STORM DETECTED! Meta-alert created.');
        console.log('⏱️  15-minute suppression activated (900 seconds)');

        // Verify storm detection was logged
        expect(logger.warn).toHaveBeenCalledWith(
            'Alert storm detected',
            expect.objectContaining({
                deviceId: deviceId,
                alertCount: 11,
            })
        );

        // Verify suppression key was set with 15-minute TTL
        expect(mockRedis.setEx).toHaveBeenCalledWith(
            expect.stringContaining('alert:suppress:'),
            900, // ← 15 minutes in seconds
            expect.any(String)
        );

        // Phase 3: Suppressed alerts (alerts 12-20)
        console.log('\n=== Phase 3: Suppression Active (15 minutes) ===');
        for (let i = 12; i <= 20; i++) {
            mockRedis.exists.mockResolvedValueOnce(1); // Device IS suppressed

            const input: CreateAlertInput = {
                tenantId: 'test-tenant-id',
                deviceId: deviceId,
                alertType: `alert_${i}`,
                severity: 'medium',
                message: `Alert ${i}`,
                source: 'api',
            };

            const alertId = await AlertManager.createAlert(input);
            console.log(`Alert ${i}: ✗ SUPPRESSED (returned null)`);
            expect(alertId).toBeNull();
        }

        // Verify suppression was logged
        expect(logger.debug).toHaveBeenCalledWith(
            'Alert suppressed due to alert storm',
            expect.objectContaining({
                deviceId: deviceId,
            })
        );

        // Phase 4: Suppression expires, normal operation resumes
        console.log('\n=== Phase 4: After 15 Minutes - Suppression Expired ===');
        mockRedis.exists.mockResolvedValueOnce(0); // Suppression expired
        mockRedis.exists.mockResolvedValueOnce(0); // Not duplicate
        mockRedis.incr.mockResolvedValueOnce(1); // New storm counter

        const resumedInput: CreateAlertInput = {
            tenantId: 'test-tenant-id',
            deviceId: deviceId,
            alertType: 'alert_resumed',
            severity: 'medium',
            message: 'Alert after suppression expired',
            source: 'api',
        };

        const resumedAlertId = await AlertManager.createAlert(resumedInput);
        console.log(`Alert (post-suppression): ✓ Created (ID: ${resumedAlertId})`);
        console.log('✅ Normal alert processing resumed');
        expect(resumedAlertId).toBeTruthy();

        // Summary
        console.log('\n=== Workflow Summary ===');
        console.log('✓ Alerts 1-10: Created normally');
        console.log('✓ Alert 11: Triggered storm detection');
        console.log('✓ Meta-alert: Created with storm details');
        console.log('✓ Suppression: Activated for 15 minutes (900s)');
        console.log('✓ Alerts 12-20: Suppressed (returned null)');
        console.log('✓ After 15 min: Suppression expired automatically');
        console.log('✓ New alerts: Processing resumed normally');
    });

    it('should verify 15-minute suppression duration constant', () => {
        // Access the private constant through the class
        const AlertManagerClass = AlertManager as any;

        // The constant should be 900 seconds (15 minutes)
        const expectedDuration = 900;

        console.log('\n=== Suppression Duration Verification ===');
        console.log(`Expected: ${expectedDuration} seconds (15 minutes)`);
        console.log(`Actual: ${AlertManagerClass.STORM_SUPPRESSION_SECONDS} seconds`);
        console.log(`Match: ${AlertManagerClass.STORM_SUPPRESSION_SECONDS === expectedDuration ? '✅' : '❌'}`);

        expect(AlertManagerClass.STORM_SUPPRESSION_SECONDS).toBe(expectedDuration);
    });

    it('should verify suppression key format and TTL', async () => {
        const deviceId = 'test-device-456';

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

        // Verify setEx was called with correct parameters
        expect(mockRedis.setEx).toHaveBeenCalledWith(
            `alert:suppress:${deviceId}`, // Key format
            900,                           // TTL: 15 minutes
            expect.any(String)             // Timestamp value
        );

        console.log('\n=== Suppression Key Details ===');
        console.log(`Key Pattern: alert:suppress:{deviceId}`);
        console.log(`Example Key: alert:suppress:${deviceId}`);
        console.log(`TTL: 900 seconds (15 minutes)`);
        console.log(`Value: ISO timestamp of suppression start`);
        console.log(`Auto-cleanup: Yes (Redis TTL handles expiration)`);
    });

    it('should verify meta-alert contains suppression duration', async () => {
        const { db } = require('../database');

        // Trigger storm
        mockRedis.incr.mockResolvedValueOnce(11);
        mockRedis.exists.mockResolvedValueOnce(0);
        mockRedis.exists.mockResolvedValueOnce(0);
        mockRedis.exists.mockResolvedValueOnce(0);

        const input: CreateAlertInput = {
            tenantId: 'test-tenant-id',
            deviceId: 'test-device-789',
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

        console.log('\n=== Meta-Alert Details ===');
        console.log(`Type: ${metaAlert.alertType}`);
        console.log(`Severity: ${metaAlert.severity}`);
        console.log(`Message: ${metaAlert.message}`);
        console.log(`Metadata:`, JSON.stringify(metaAlert.metadata, null, 2));

        // Verify meta-alert properties
        expect(metaAlert.alertType).toBe('alert_storm_detected');
        expect(metaAlert.severity).toBe('high');
        expect(metaAlert.message).toContain('15 minutes');
        expect(metaAlert.metadata.suppressionSeconds).toBe(900);
        expect(metaAlert.metadata.windowSeconds).toBe(300);
        expect(metaAlert.metadata.alertCount).toBe(11);
    });
});
