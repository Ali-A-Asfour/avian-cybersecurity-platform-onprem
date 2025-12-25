/**
 * Email Alert Listener - Duplicate Detection Tests
 * 
 * Tests for detecting and skipping duplicate emails within 5-minute window.
 * 
 * Requirements: 11.10
 */

import { EmailAlertListener } from '../email-alert-listener';
import { connectRedis } from '../redis';
import { db } from '../database';
import { firewallDevices } from '../../../database/schemas/firewall';
import { ParsedMail } from 'mailparser';

// Mock dependencies
jest.mock('../redis');
jest.mock('../database');
jest.mock('../logger');
jest.mock('../alert-manager');
jest.mock('../config', () => ({
    config: {
        imap: {
            host: 'imap.example.com',
            port: 993,
            user: 'test@example.com',
            password: 'password',
            tls: true,
        },
        redis: {
            url: 'redis://localhost:6379',
        },
    },
}));

describe('EmailAlertListener - Duplicate Detection', () => {
    let listener: EmailAlertListener;
    let mockRedis: any;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Mock Redis
        mockRedis = {
            exists: jest.fn(),
            setEx: jest.fn(),
            get: jest.fn(),
            del: jest.fn(),
        };
        (connectRedis as jest.Mock).mockResolvedValue(mockRedis);

        // Mock database
        (db as any).query = {
            firewallDevices: {
                findFirst: jest.fn(),
            },
        };

        // Create listener
        listener = new EmailAlertListener({
            host: 'imap.example.com',
            port: 993,
            user: 'test@example.com',
            password: 'password',
            tls: true,
        });
    });

    describe('isDuplicateEmail', () => {
        it('should detect duplicate email within 5 minutes', async () => {
            // Requirement 11.10: Same alert_type, device_id, timestamp within 5 minutes = duplicate

            const parsedAlert = {
                alertType: 'ips_alert',
                severity: 'high' as const,
                message: 'IPS alert detected',
                timestamp: new Date(),
                deviceIdentifier: 'C0EAE4123456',
                deviceId: 'device-123',
            };

            // Mock device lookup
            (db.query.firewallDevices.findFirst as jest.Mock).mockResolvedValue({
                id: 'device-123',
                tenantId: 'tenant-123',
            });

            // First email - not a duplicate
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.setEx.mockResolvedValueOnce('OK');

            const isDuplicate1 = await (listener as any).isDuplicateEmail(parsedAlert);

            expect(isDuplicate1).toBe(false);
            expect(mockRedis.exists).toHaveBeenCalledWith(
                expect.stringContaining('email:dedup:')
            );
            expect(mockRedis.setEx).toHaveBeenCalledWith(
                expect.stringContaining('email:dedup:'),
                300, // 5 minutes = 300 seconds
                expect.any(String)
            );
        });

        it('should skip duplicate email within 5 minutes', async () => {
            // Requirement 11.10: Duplicate detection

            const parsedAlert = {
                alertType: 'vpn_down',
                severity: 'critical' as const,
                message: 'VPN tunnel down',
                timestamp: new Date(),
                deviceIdentifier: '192.168.1.1',
                deviceId: 'device-456',
            };

            // Mock device lookup
            (db.query.firewallDevices.findFirst as jest.Mock).mockResolvedValue({
                id: 'device-456',
                tenantId: 'tenant-456',
            });

            // Email already exists in Redis (duplicate)
            mockRedis.exists.mockResolvedValueOnce(1);

            const isDuplicate = await (listener as any).isDuplicateEmail(parsedAlert);

            expect(isDuplicate).toBe(true);
            expect(mockRedis.exists).toHaveBeenCalledWith(
                expect.stringContaining('email:dedup:')
            );
            // Should not set key if duplicate
            expect(mockRedis.setEx).not.toHaveBeenCalled();
        });

        it('should allow same alert after 5 minutes', async () => {
            // After 5 minutes, Redis key should expire and alert should be allowed

            const parsedAlert = {
                alertType: 'license_expiring',
                severity: 'medium' as const,
                message: 'License expiring soon',
                timestamp: new Date(),
                deviceIdentifier: 'C0EAE4789012',
                deviceId: 'device-789',
            };

            // Mock device lookup
            (db.query.firewallDevices.findFirst as jest.Mock).mockResolvedValue({
                id: 'device-789',
                tenantId: 'tenant-789',
            });

            // Key expired (not found in Redis)
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.setEx.mockResolvedValueOnce('OK');

            const isDuplicate = await (listener as any).isDuplicateEmail(parsedAlert);

            expect(isDuplicate).toBe(false);
            expect(mockRedis.setEx).toHaveBeenCalledWith(
                expect.any(String),
                300, // 5 minutes
                expect.any(String)
            );
        });

        it('should use different keys for different alert types', async () => {
            // Different alert types should not be considered duplicates

            const alert1 = {
                alertType: 'ips_alert',
                severity: 'high' as const,
                message: 'IPS alert',
                timestamp: new Date(),
                deviceIdentifier: 'C0EAE4123456',
                deviceId: 'device-123',
            };

            const alert2 = {
                alertType: 'vpn_down',
                severity: 'high' as const,
                message: 'VPN down',
                timestamp: new Date(),
                deviceIdentifier: 'C0EAE4123456',
                deviceId: 'device-123',
            };

            // Mock device lookup
            (db.query.firewallDevices.findFirst as jest.Mock).mockResolvedValue({
                id: 'device-123',
                tenantId: 'tenant-123',
            });

            // First alert
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.setEx.mockResolvedValueOnce('OK');

            const isDuplicate1 = await (listener as any).isDuplicateEmail(alert1);
            expect(isDuplicate1).toBe(false);

            const key1 = (mockRedis.setEx as jest.Mock).mock.calls[0][0];

            // Second alert (different type)
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.setEx.mockResolvedValueOnce('OK');

            const isDuplicate2 = await (listener as any).isDuplicateEmail(alert2);
            expect(isDuplicate2).toBe(false);

            const key2 = (mockRedis.setEx as jest.Mock).mock.calls[1][0];

            // Keys should be different
            expect(key1).not.toBe(key2);
        });

        it('should use different keys for different devices', async () => {
            // Same alert type but different devices should not be duplicates

            const alert1 = {
                alertType: 'high_cpu',
                severity: 'medium' as const,
                message: 'High CPU usage',
                timestamp: new Date(),
                deviceIdentifier: 'C0EAE4111111',
                deviceId: 'device-111',
            };

            const alert2 = {
                alertType: 'high_cpu',
                severity: 'medium' as const,
                message: 'High CPU usage',
                timestamp: new Date(),
                deviceIdentifier: 'C0EAE4222222',
                deviceId: 'device-222',
            };

            // Mock device lookups
            (db.query.firewallDevices.findFirst as jest.Mock)
                .mockResolvedValueOnce({
                    id: 'device-111',
                    tenantId: 'tenant-123',
                })
                .mockResolvedValueOnce({
                    id: 'device-222',
                    tenantId: 'tenant-123',
                });

            // First alert
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.setEx.mockResolvedValueOnce('OK');

            const isDuplicate1 = await (listener as any).isDuplicateEmail(alert1);
            expect(isDuplicate1).toBe(false);

            const key1 = (mockRedis.setEx as jest.Mock).mock.calls[0][0];

            // Second alert (different device)
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.setEx.mockResolvedValueOnce('OK');

            const isDuplicate2 = await (listener as any).isDuplicateEmail(alert2);
            expect(isDuplicate2).toBe(false);

            const key2 = (mockRedis.setEx as jest.Mock).mock.calls[1][0];

            // Keys should be different
            expect(key1).not.toBe(key2);
        });

        it('should handle alerts without device ID', async () => {
            // Alerts without device match should still be deduplicated

            const parsedAlert = {
                alertType: 'security_alert',
                severity: 'info' as const,
                message: 'Security alert',
                timestamp: new Date(),
                deviceIdentifier: 'unknown-device',
                deviceId: undefined,
            };

            // No device found
            (db.query.firewallDevices.findFirst as jest.Mock).mockResolvedValue(null);

            // Should not be considered duplicate (no device to deduplicate against)
            const isDuplicate = await (listener as any).isDuplicateEmail(parsedAlert);

            expect(isDuplicate).toBe(false);
            expect(mockRedis.exists).not.toHaveBeenCalled();
        });

        it('should handle Redis errors gracefully', async () => {
            // If Redis fails, should not block email processing

            const parsedAlert = {
                alertType: 'wan_down',
                severity: 'critical' as const,
                message: 'WAN interface down',
                timestamp: new Date(),
                deviceIdentifier: 'C0EAE4123456',
                deviceId: 'device-123',
            };

            // Mock device lookup
            (db.query.firewallDevices.findFirst as jest.Mock).mockResolvedValue({
                id: 'device-123',
                tenantId: 'tenant-123',
            });

            // Redis error
            mockRedis.exists.mockRejectedValueOnce(new Error('Redis connection failed'));

            const isDuplicate = await (listener as any).isDuplicateEmail(parsedAlert);

            // Should fail open (allow email processing)
            expect(isDuplicate).toBe(false);
        });

        it('should handle Redis unavailable', async () => {
            // If Redis is not available, should not block email processing

            (connectRedis as jest.Mock).mockResolvedValue(null);

            const parsedAlert = {
                alertType: 'botnet_alert',
                severity: 'high' as const,
                message: 'Botnet activity detected',
                timestamp: new Date(),
                deviceIdentifier: 'C0EAE4123456',
                deviceId: 'device-123',
            };

            // Mock device lookup
            (db.query.firewallDevices.findFirst as jest.Mock).mockResolvedValue({
                id: 'device-123',
                tenantId: 'tenant-123',
            });

            const isDuplicate = await (listener as any).isDuplicateEmail(parsedAlert);

            // Should fail open (allow email processing)
            expect(isDuplicate).toBe(false);
        });
    });

    describe('processEmail with duplicate detection', () => {
        it('should skip processing duplicate emails', async () => {
            // Requirement 11.10: Skip processing duplicate emails

            const mockEmail: Partial<ParsedMail> = {
                from: { text: 'alerts@sonicwall.com', value: [] },
                subject: 'IPS Alert',
                text: 'Critical: IPS alert detected\nDevice: C0EAE4123456',
                date: new Date(),
            };

            // Mock device lookup
            (db.query.firewallDevices.findFirst as jest.Mock).mockResolvedValue({
                id: 'device-123',
                tenantId: 'tenant-123',
                serialNumber: 'C0EAE4123456',
            });

            // Mock duplicate detection
            mockRedis.exists.mockResolvedValueOnce(1); // Duplicate found

            // Spy on createAlertFromEmail
            const createAlertSpy = jest.spyOn(listener as any, 'createAlertFromEmail');

            await (listener as any).processEmail(mockEmail, 12345);

            // Should not create alert for duplicate
            expect(createAlertSpy).not.toHaveBeenCalled();
        });

        it('should process non-duplicate emails', async () => {
            // Non-duplicate emails should be processed normally

            const mockEmail: Partial<ParsedMail> = {
                from: { text: 'alerts@sonicwall.com', value: [] },
                subject: 'VPN Down',
                text: 'Critical: VPN tunnel down\nDevice: 192.168.1.1',
                date: new Date(),
            };

            // Mock device lookup
            (db.query.firewallDevices.findFirst as jest.Mock).mockResolvedValue({
                id: 'device-456',
                tenantId: 'tenant-456',
                managementIp: '192.168.1.1',
            });

            // Mock duplicate detection - not a duplicate
            mockRedis.exists.mockResolvedValueOnce(0);
            mockRedis.setEx.mockResolvedValueOnce('OK');

            // Mock alert creation
            jest.spyOn(listener as any, 'createAlertFromEmail').mockResolvedValue(undefined);
            jest.spyOn(listener as any, 'markEmailAsProcessed').mockResolvedValue(undefined);

            await (listener as any).processEmail(mockEmail, 12345);

            // Should create alert for non-duplicate
            expect((listener as any).createAlertFromEmail).toHaveBeenCalled();
        });
    });
});
