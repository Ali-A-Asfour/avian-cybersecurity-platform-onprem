/**
 * Email Alert Listener - Create Alert Tests
 * 
 * Tests for creating alert records from parsed emails.
 * 
 * Requirements: 11.8-11.10
 */

import { EmailAlertListener } from '../email-alert-listener';
import { AlertManager } from '../alert-manager';
import { db } from '../database';
import type { ParsedMail } from 'mailparser';
import type { ParsedAlert } from '../../types/firewall';

// Mock dependencies
jest.mock('../database');
jest.mock('../alert-manager');
jest.mock('../logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

describe('EmailAlertListener - Create Alert', () => {
    let listener: EmailAlertListener;
    const mockConfig = {
        host: 'imap.example.com',
        port: 993,
        user: 'test@example.com',
        password: 'password',
        tls: true,
    };

    beforeEach(() => {
        listener = new EmailAlertListener(mockConfig);
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('createAlertFromEmail', () => {
        it('should create alert with source="email" for matched device', async () => {
            // Requirement 11.8: Set source="email" in alert
            const mockDevice = {
                id: 'device-123',
                tenantId: 'tenant-456',
                serialNumber: 'C0EAE4123456',
                managementIp: '192.168.1.1',
                model: 'TZ400',
            };

            const mockParsedAlert: ParsedAlert = {
                alertType: 'ips_alert',
                severity: 'high' as const,
                message: 'IPS detected intrusion attempt',
                timestamp: new Date('2024-12-08T10:30:00Z'),
                deviceIdentifier: 'C0EAE4123456',
                deviceId: 'device-123',
            };

            // Mock database query
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn().mockResolvedValue(mockDevice),
                },
            };

            // Mock AlertManager.createAlert
            const createAlertSpy = jest.spyOn(AlertManager, 'createAlert').mockResolvedValue('alert-789');

            // Call the private method via parseEmail and createAlertFromEmail flow
            // We'll test this through the public interface
            const email: ParsedMail = {
                from: { text: 'alerts@sonicwall.com', value: [] },
                subject: 'IPS Alert',
                text: 'IPS detected intrusion attempt\nSerial: C0EAE4123456\nSeverity: High',
                date: new Date('2024-12-08T10:30:00Z'),
            } as ParsedMail;

            // Parse email
            const parsedAlert = await listener.parseEmail(email);
            expect(parsedAlert).toBeTruthy();

            // Manually call createAlertFromEmail (accessing private method for testing)
            await (listener as any).createAlertFromEmail(parsedAlert);

            // Verify AlertManager.createAlert was called with source="email"
            expect(createAlertSpy).toHaveBeenCalledWith({
                tenantId: 'tenant-456',
                deviceId: 'device-123',
                alertType: 'ips_alert',
                severity: 'high',
                message: expect.any(String),
                source: 'email', // Requirement 11.8
                metadata: expect.objectContaining({
                    deviceIdentifier: 'C0EAE4123456',
                    emailTimestamp: expect.any(String),
                    needsReview: false,
                    unmatchedDevice: false,
                }),
            });
        });

        it('should create alert with device_id=null for unmatched device', async () => {
            // Requirement 11.7: If no match, create alert with device_id=null and flag for review
            const mockTenant = {
                id: 'tenant-999',
                name: 'System Tenant',
            };

            const mockParsedAlert: ParsedAlert = {
                alertType: 'vpn_down',
                severity: 'critical' as const,
                message: 'VPN tunnel is down',
                timestamp: new Date('2024-12-08T11:00:00Z'),
                deviceIdentifier: 'UNKNOWN-SERIAL',
                deviceId: undefined, // No device match
            };

            // Mock database queries
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn().mockResolvedValue(null),
                },
                tenants: {
                    findFirst: jest.fn().mockResolvedValue(mockTenant),
                },
            };

            // Mock AlertManager.createAlert
            const createAlertSpy = jest.spyOn(AlertManager, 'createAlert').mockResolvedValue('alert-999');

            // Call createAlertFromEmail
            await (listener as any).createAlertFromEmail(mockParsedAlert);

            // Verify alert was created with device_id=undefined and needsReview=true
            expect(createAlertSpy).toHaveBeenCalledWith({
                tenantId: 'tenant-999',
                deviceId: undefined, // Requirement 11.7
                alertType: 'vpn_down',
                severity: 'critical',
                message: 'VPN tunnel is down',
                source: 'email',
                metadata: expect.objectContaining({
                    deviceIdentifier: 'UNKNOWN-SERIAL',
                    emailTimestamp: expect.any(String),
                    needsReview: true, // Requirement 11.7: Flag for review
                    unmatchedDevice: true,
                }),
            });
        });

        it('should include device identifier in metadata', async () => {
            // Requirement 11.8: Store device identifier in metadata
            const mockDevice = {
                id: 'device-abc',
                tenantId: 'tenant-def',
                serialNumber: 'C0EAE4ABCDEF',
                managementIp: '10.0.0.1',
            };

            const mockParsedAlert: ParsedAlert = {
                alertType: 'license_expiring',
                severity: 'medium' as const,
                message: 'IPS license expiring in 15 days',
                timestamp: new Date('2024-12-08T12:00:00Z'),
                deviceIdentifier: 'C0EAE4ABCDEF',
                deviceId: 'device-abc',
            };

            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn().mockResolvedValue(mockDevice),
                },
            };
            const createAlertSpy = jest.spyOn(AlertManager, 'createAlert').mockResolvedValue('alert-xyz');

            await (listener as any).createAlertFromEmail(mockParsedAlert);

            expect(createAlertSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        deviceIdentifier: 'C0EAE4ABCDEF',
                    }),
                })
            );
        });

        it('should include email timestamp in metadata', async () => {
            // Requirement 11.8: Store email timestamp in metadata
            const mockDevice = {
                id: 'device-111',
                tenantId: 'tenant-222',
            };

            const emailTimestamp = new Date('2024-12-08T13:45:30Z');
            const mockParsedAlert: ParsedAlert = {
                alertType: 'wan_down',
                severity: 'critical' as const,
                message: 'WAN interface is down',
                timestamp: emailTimestamp,
                deviceIdentifier: '192.168.1.100',
                deviceId: 'device-111',
            };

            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn().mockResolvedValue(mockDevice),
                },
            };
            const createAlertSpy = jest.spyOn(AlertManager, 'createAlert').mockResolvedValue('alert-111');

            await (listener as any).createAlertFromEmail(mockParsedAlert);

            expect(createAlertSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({
                        emailTimestamp: emailTimestamp.toISOString(),
                    }),
                })
            );
        });

        it('should handle error when device not found but deviceId provided', async () => {
            // Edge case: deviceId is provided but device doesn't exist in database
            const mockParsedAlert: ParsedAlert = {
                alertType: 'security_alert',
                severity: 'high' as const,
                message: 'Security event detected',
                timestamp: new Date(),
                deviceIdentifier: 'SERIAL123',
                deviceId: 'non-existent-device',
            };

            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn().mockResolvedValue(null),
                },
            };

            // Should not throw, but should log error and return early
            await expect((listener as any).createAlertFromEmail(mockParsedAlert)).resolves.toBeUndefined();
        });

        it('should handle error when no tenant found for unmatched device', async () => {
            // Edge case: No tenant exists to assign unmatched alert
            const mockParsedAlert: ParsedAlert = {
                alertType: 'email_alert',
                severity: 'info' as const,
                message: 'Generic alert',
                timestamp: new Date(),
                deviceIdentifier: 'UNKNOWN',
                deviceId: undefined,
            };

            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn().mockResolvedValue(null),
                },
                tenants: {
                    findFirst: jest.fn().mockResolvedValue(null),
                },
            };

            // Should not throw, but should log error and return early
            await expect((listener as any).createAlertFromEmail(mockParsedAlert)).resolves.toBeUndefined();
        });
    });

    describe('Alert Creation Integration', () => {
        it('should create alert with all required fields', async () => {
            // Full integration test for alert creation
            const mockDevice = {
                id: 'device-full',
                tenantId: 'tenant-full',
                serialNumber: 'FULLSERIAL123',
                managementIp: '172.16.0.1',
                model: 'NSA 2700',
            };

            const mockParsedAlert: ParsedAlert = {
                alertType: 'botnet_alert',
                severity: 'high' as const,
                message: 'Botnet communication detected from internal host',
                timestamp: new Date('2024-12-08T14:20:00Z'),
                deviceIdentifier: 'FULLSERIAL123',
                deviceId: 'device-full',
            };

            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn().mockResolvedValue(mockDevice),
                },
            };
            const createAlertSpy = jest.spyOn(AlertManager, 'createAlert').mockResolvedValue('alert-full');

            await (listener as any).createAlertFromEmail(mockParsedAlert);

            expect(createAlertSpy).toHaveBeenCalledTimes(1);
            expect(createAlertSpy).toHaveBeenCalledWith({
                tenantId: 'tenant-full',
                deviceId: 'device-full',
                alertType: 'botnet_alert',
                severity: 'high',
                message: 'Botnet communication detected from internal host',
                source: 'email',
                metadata: {
                    deviceIdentifier: 'FULLSERIAL123',
                    emailTimestamp: '2024-12-08T14:20:00.000Z',
                    needsReview: false,
                    unmatchedDevice: false,
                },
            });
        });
    });
});
