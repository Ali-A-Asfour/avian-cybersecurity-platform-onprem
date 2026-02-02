/**
 * Email Alert Listener - Device Matching Tests
 * 
 * Tests device identifier matching to firewall_devices table
 * 
 * Requirements: 11.6-11.7
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EmailAlertListener } from '../email-alert-listener';
import { db } from '../database';
import type { EmailConfig } from '../../types/firewall';

// Mock the database module
jest.mock('../database');

// Mock config
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

// Mock redis
jest.mock('../redis', () => ({
    connectRedis: jest.fn().mockResolvedValue({
        exists: jest.fn().mockResolvedValue(0),
        setEx: jest.fn().mockResolvedValue('OK'),
    }),
}));

// Mock logger
jest.mock('../logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
}));

// Mock alert manager
jest.mock('../alert-manager', () => ({
    AlertManager: {
        createAlert: jest.fn(),
        deduplicateAlert: jest.fn().mockResolvedValue(false),
    },
}));

describe('EmailAlertListener - Device Matching', () => {
    let listener: EmailAlertListener;

    const mockConfig: EmailConfig = {
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

    describe('Match by Serial Number', () => {
        it('should match device by serial number', async () => {
            // Requirement 11.6: Try matching by serial_number
            const serialNumber = 'C0EAE4123456';
            const mockDevice = {
                id: 'device-123',
                tenantId: 'tenant-123',
                serialNumber,
                managementIp: '192.168.1.1',
            };

            // Mock database query
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn().mockResolvedValueOnce(mockDevice),
                },
            };

            const matchedId = await listener.matchDevice(serialNumber);

            expect(matchedId).toBe('device-123');
            expect(mockDb.query.firewallDevices.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.any(Object),
                })
            );
        });

        it('should return undefined for non-existent serial number', async () => {
            // Mock database query
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn()
                        .mockResolvedValueOnce(undefined) // First call (serial)
                        .mockResolvedValueOnce(undefined) // Second call (IP)
                        .mockResolvedValueOnce(undefined), // Third call (hostname)
                },
            };

            const matchedId = await listener.matchDevice('NONEXISTENT123');

            expect(matchedId).toBeUndefined();
        });
    });

    describe('Match by Management IP', () => {
        it('should match device by management IP', async () => {
            // Requirement 11.6: Try matching by management_ip
            const managementIp = '10.0.0.100';
            const mockDevice = {
                id: 'device-456',
                tenantId: 'tenant-123',
                serialNumber: 'SERIAL123',
                managementIp,
            };

            // Mock database query
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn()
                        .mockResolvedValueOnce(undefined) // First call (serial) - no match
                        .mockResolvedValueOnce(mockDevice), // Second call (IP) - match
                },
            };

            const matchedId = await listener.matchDevice(managementIp);

            expect(matchedId).toBe('device-456');
        });

        it('should return undefined for non-existent IP', async () => {
            // Mock database query
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn()
                        .mockResolvedValueOnce(undefined)
                        .mockResolvedValueOnce(undefined)
                        .mockResolvedValueOnce(undefined),
                },
            };

            const matchedId = await listener.matchDevice('10.99.99.99');

            expect(matchedId).toBeUndefined();
        });
    });

    describe('Match by Hostname', () => {
        it('should match device by hostname stored in model field', async () => {
            // Requirement 11.6: Try matching by hostname (if available)
            const hostname = 'firewall-hq';
            const mockDevice = {
                id: 'device-789',
                tenantId: 'tenant-123',
                serialNumber: 'SERIAL456',
                managementIp: '192.168.1.1',
                model: hostname,
            };

            // Mock database query
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn()
                        .mockResolvedValueOnce(undefined) // First call (serial) - no match
                        .mockResolvedValueOnce(undefined) // Second call (IP) - no match
                        .mockResolvedValueOnce(mockDevice), // Third call (hostname) - match
                },
            };

            const matchedId = await listener.matchDevice(hostname);

            expect(matchedId).toBe('device-789');
        });

        it('should return undefined for non-existent hostname', async () => {
            // Mock database query
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn()
                        .mockResolvedValueOnce(undefined)
                        .mockResolvedValueOnce(undefined)
                        .mockResolvedValueOnce(undefined),
                },
            };

            const matchedId = await listener.matchDevice('unknown-firewall');

            expect(matchedId).toBeUndefined();
        });
    });

    describe('Match Priority', () => {
        it('should prioritize serial number match over IP match', async () => {
            const serialNumber = 'SERIAL999';
            const mockDevice = {
                id: 'device-priority-1',
                tenantId: 'tenant-123',
                serialNumber,
                managementIp: '10.0.0.100',
            };

            // Mock database query
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn().mockResolvedValueOnce(mockDevice),
                },
            };

            const matchedId = await listener.matchDevice(serialNumber);
            expect(matchedId).toBe('device-priority-1');
        });

        it('should fall back to IP match when serial number does not match', async () => {
            const managementIp = '10.0.0.150';
            const mockDevice = {
                id: 'device-priority-2',
                tenantId: 'tenant-123',
                serialNumber: 'SERIAL_ABC',
                managementIp,
            };

            // Mock database query
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn()
                        .mockResolvedValueOnce(undefined) // Serial match fails
                        .mockResolvedValueOnce(mockDevice), // IP match succeeds
                },
            };

            const matchedId = await listener.matchDevice(managementIp);
            expect(matchedId).toBe('device-priority-2');
        });

        it('should fall back to hostname match when serial and IP do not match', async () => {
            const hostname = 'fw-branch-office';
            const mockDevice = {
                id: 'device-priority-3',
                tenantId: 'tenant-123',
                serialNumber: 'SERIAL_XYZ',
                managementIp: '10.0.0.99',
                model: hostname,
            };

            // Mock database query
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn()
                        .mockResolvedValueOnce(undefined) // Serial match fails
                        .mockResolvedValueOnce(undefined) // IP match fails
                        .mockResolvedValueOnce(mockDevice), // Hostname match succeeds
                },
            };

            const matchedId = await listener.matchDevice(hostname);
            expect(matchedId).toBe('device-priority-3');
        });
    });

    describe('No Match Scenarios', () => {
        it('should return undefined when no device matches', async () => {
            // Requirement 11.7: If no match, create alert with device_id=null
            // Mock database query
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn()
                        .mockResolvedValueOnce(undefined)
                        .mockResolvedValueOnce(undefined)
                        .mockResolvedValueOnce(undefined),
                },
            };

            const matchedId = await listener.matchDevice('UNKNOWN_IDENTIFIER');

            expect(matchedId).toBeUndefined();
        });

        it('should handle empty identifier gracefully', async () => {
            // Mock database query
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn()
                        .mockResolvedValueOnce(undefined)
                        .mockResolvedValueOnce(undefined)
                        .mockResolvedValueOnce(undefined),
                },
            };

            const matchedId = await listener.matchDevice('');

            expect(matchedId).toBeUndefined();
        });

        it('should handle whitespace identifier gracefully', async () => {
            // Mock database query
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn()
                        .mockResolvedValueOnce(undefined)
                        .mockResolvedValueOnce(undefined)
                        .mockResolvedValueOnce(undefined),
                },
            };

            const matchedId = await listener.matchDevice('   ');

            expect(matchedId).toBeUndefined();
        });
    });

    describe('Multiple Devices', () => {
        it('should match correct device when multiple devices exist', async () => {
            const mockDevice2 = {
                id: 'device-002',
                tenantId: 'tenant-123',
                serialNumber: 'SERIAL_002',
                managementIp: '10.0.0.2',
            };

            // Mock database query
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn().mockResolvedValueOnce(mockDevice2),
                },
            };

            // Match device 2
            const matchedId = await listener.matchDevice('SERIAL_002');
            expect(matchedId).toBe('device-002');
        });

        it('should match device by IP when multiple devices exist', async () => {
            const mockDevice3 = {
                id: 'device-003',
                tenantId: 'tenant-123',
                serialNumber: 'SERIAL_003',
                managementIp: '10.0.0.3',
            };

            // Mock database query
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn()
                        .mockResolvedValueOnce(undefined) // Serial match fails
                        .mockResolvedValueOnce(mockDevice3), // IP match succeeds
                },
            };

            // Match device 3 by IP
            const matchedId = await listener.matchDevice('10.0.0.3');
            expect(matchedId).toBe('device-003');
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', async () => {
            // Mock database error
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn().mockRejectedValueOnce(
                        new Error('Database connection failed')
                    ),
                },
            };

            const matchedId = await listener.matchDevice('SERIAL123');

            // Should return undefined on error
            expect(matchedId).toBeUndefined();
        });

        it('should handle null database response gracefully', async () => {
            // Mock database query
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn()
                        .mockResolvedValueOnce(null)
                        .mockResolvedValueOnce(null)
                        .mockResolvedValueOnce(null),
                },
            };

            const matchedId = await listener.matchDevice('SERIAL123');

            expect(matchedId).toBeUndefined();
        });
    });

    describe('Real-World Identifiers', () => {
        it('should match typical SonicWall serial number format', async () => {
            const serialNumber = 'C0EAE4B2C3D4';
            const mockDevice = {
                id: 'device-real-1',
                tenantId: 'tenant-123',
                serialNumber,
                managementIp: '192.168.1.1',
            };

            // Mock database query
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn().mockResolvedValueOnce(mockDevice),
                },
            };

            const matchedId = await listener.matchDevice(serialNumber);

            expect(matchedId).toBe('device-real-1');
        });

        it('should match typical private IP address', async () => {
            const managementIp = '192.168.1.254';
            const mockDevice = {
                id: 'device-real-2',
                tenantId: 'tenant-123',
                serialNumber: 'SERIAL789',
                managementIp,
            };

            // Mock database query
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn()
                        .mockResolvedValueOnce(undefined)
                        .mockResolvedValueOnce(mockDevice),
                },
            };

            const matchedId = await listener.matchDevice(managementIp);

            expect(matchedId).toBe('device-real-2');
        });

        it('should match typical hostname format', async () => {
            const hostname = 'sonicwall-hq-01';
            const mockDevice = {
                id: 'device-real-3',
                tenantId: 'tenant-123',
                serialNumber: 'SERIAL999',
                managementIp: '10.0.0.1',
                model: hostname,
            };

            // Mock database query
            const mockDb = db as any;
            mockDb.query = {
                firewallDevices: {
                    findFirst: jest.fn()
                        .mockResolvedValueOnce(undefined)
                        .mockResolvedValueOnce(undefined)
                        .mockResolvedValueOnce(mockDevice),
                },
            };

            const matchedId = await listener.matchDevice(hostname);

            expect(matchedId).toBe('device-real-3');
        });
    });
});
