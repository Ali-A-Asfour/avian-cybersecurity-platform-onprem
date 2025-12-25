/**
 * Email Alert Listener - Unmatched Device Test
 * 
 * Tests that alerts are created with device_id=null and flagged for review
 * when device matching fails.
 * 
 * Requirements: 11.7
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EmailAlertListener } from '../email-alert-listener';
import type { ParsedMail } from 'mailparser';
import type { EmailConfig } from '../../types/firewall';

// Mock database and AlertManager
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockDelete = jest.fn();
const mockReturning = jest.fn();
const mockWhere = jest.fn();
const mockFrom = jest.fn();
const mockFindFirst = jest.fn();
const mockCreateAlert = jest.fn();

jest.mock('../database', () => ({
    db: {
        insert: mockInsert,
        select: mockSelect,
        delete: mockDelete,
        query: {
            firewallDevices: {
                findFirst: mockFindFirst,
            },
            tenants: {
                findFirst: jest.fn(),
            },
        },
    },
}));

jest.mock('../alert-manager', () => ({
    AlertManager: {
        createAlert: mockCreateAlert,
        deduplicateAlert: jest.fn().mockResolvedValue(false),
    },
}));

describe('EmailAlertListener - Unmatched Device Handling', () => {
    let listener: EmailAlertListener;

    const mockConfig: EmailConfig = {
        host: 'imap.example.com',
        port: 993,
        user: 'test@example.com',
        password: 'password',
        tls: true,
    };

    const mockTenantId = 'tenant-123';
    const mockDeviceId = 'device-456';

    beforeEach(() => {
        jest.clearAllMocks();
        listener = new EmailAlertListener(mockConfig);

        // Setup default mock for tenant query
        const { db } = require('../database');
        db.query.tenants.findFirst.mockResolvedValue({
            id: mockTenantId,
            name: 'Test Tenant',
            slug: 'test-tenant',
        });
    });

    it('should create alert with device_id=null when device identifier does not match any device', async () => {
        // Mock device not found
        mockFindFirst.mockResolvedValue(null);

        // Create email with device identifier that doesn't match any device
        const mockEmail: ParsedMail = {
            from: { text: 'alerts@sonicwall.com', value: [] },
            subject: 'IPS Alert - Unknown Device',
            text: 'IPS Alert detected on device with serial number UNKNOWN123456. Severity: High',
            date: new Date(),
        } as ParsedMail;

        // Parse email
        const parsedAlert = await listener.parseEmail(mockEmail);
        expect(parsedAlert).toBeDefined();
        expect(parsedAlert?.deviceId).toBeUndefined();
        expect(parsedAlert?.deviceIdentifier).toBe('UNKNOWN123456');

        // Process email (this should create alert with device_id=null)
        await (listener as any).processEmail(mockEmail);

        // Verify AlertManager.createAlert was called with undefined deviceId
        expect(mockCreateAlert).toHaveBeenCalledWith(
            expect.objectContaining({
                tenantId: mockTenantId,
                deviceId: undefined,
                alertType: 'ips_alert',
                severity: 'high',
                source: 'email',
                metadata: expect.objectContaining({
                    needsReview: true,
                    unmatchedDevice: true,
                    deviceIdentifier: 'UNKNOWN123456',
                }),
            })
        );
    });

    it('should flag unmatched alerts for review in metadata', async () => {
        // Mock device not found
        mockFindFirst.mockResolvedValue(null);

        // Create email with unmatched device
        const mockEmail: ParsedMail = {
            from: { text: 'alerts@sonicwall.com', value: [] },
            subject: 'VPN Down Alert',
            text: 'VPN tunnel down on device 192.168.99.99. Severity: Critical',
            date: new Date(),
        } as ParsedMail;

        // Process email
        await (listener as any).processEmail(mockEmail);

        // Verify alert metadata contains review flags
        expect(mockCreateAlert).toHaveBeenCalledWith(
            expect.objectContaining({
                metadata: expect.objectContaining({
                    needsReview: true,
                    unmatchedDevice: true,
                    deviceIdentifier: '192.168.99.99',
                }),
            })
        );
    });

    it('should assign unmatched alert to first available tenant', async () => {
        // Mock device not found
        mockFindFirst.mockResolvedValue(null);

        // Create email with unmatched device
        const mockEmail: ParsedMail = {
            from: { text: 'alerts@sonicwall.com', value: [] },
            subject: 'License Expiring',
            text: 'License expiring on device SERIAL999999. Severity: Medium',
            date: new Date(),
        } as ParsedMail;

        // Process email
        await (listener as any).processEmail(mockEmail);

        // Verify alert was assigned to the test tenant
        expect(mockCreateAlert).toHaveBeenCalledWith(
            expect.objectContaining({
                tenantId: mockTenantId,
                deviceId: undefined,
            })
        );
    });

    it('should create alert with device_id when device is matched', async () => {
        // Mock device found
        mockFindFirst.mockResolvedValue({
            id: mockDeviceId,
            tenantId: mockTenantId,
            serialNumber: 'MATCHED123456',
            managementIp: '192.168.1.100',
        });

        // Create email with matching device identifier
        const mockEmail: ParsedMail = {
            from: { text: 'alerts@sonicwall.com', value: [] },
            subject: 'IPS Alert',
            text: 'IPS Alert detected on device with serial number MATCHED123456. Severity: High',
            date: new Date(),
        } as ParsedMail;

        // Process email
        await (listener as any).processEmail(mockEmail);

        // Verify alert was created with correct device_id
        expect(mockCreateAlert).toHaveBeenCalledWith(
            expect.objectContaining({
                tenantId: mockTenantId,
                deviceId: mockDeviceId,
                metadata: expect.objectContaining({
                    needsReview: false,
                    unmatchedDevice: false,
                }),
            })
        );
    });

    it('should not create alert if no tenant exists', async () => {
        // Mock no tenant found
        const { db } = require('../database');
        db.query.tenants.findFirst.mockResolvedValue(null);
        mockFindFirst.mockResolvedValue(null);

        // Create email with unmatched device
        const mockEmail: ParsedMail = {
            from: { text: 'alerts@sonicwall.com', value: [] },
            subject: 'IPS Alert',
            text: 'IPS Alert detected. Severity: High',
            date: new Date(),
        } as ParsedMail;

        // Process email - should not throw but should log error
        await expect((listener as any).processEmail(mockEmail)).resolves.not.toThrow();

        // Verify no alert was created
        expect(mockCreateAlert).not.toHaveBeenCalled();
    });

    it('should include device identifier in alert message for unmatched devices', async () => {
        // Mock device not found
        mockFindFirst.mockResolvedValue(null);

        // Create email with device identifier
        const mockEmail: ParsedMail = {
            from: { text: 'alerts@sonicwall.com', value: [] },
            subject: 'High CPU Alert',
            text: 'High CPU usage detected on device 10.0.0.50. CPU: 95%. Severity: Warning',
            date: new Date(),
        } as ParsedMail;

        // Process email
        await (listener as any).processEmail(mockEmail);

        // Verify alert contains device identifier in metadata
        expect(mockCreateAlert).toHaveBeenCalledWith(
            expect.objectContaining({
                deviceId: undefined,
                message: expect.stringContaining('10.0.0.50'),
                metadata: expect.objectContaining({
                    deviceIdentifier: '10.0.0.50',
                }),
            })
        );
    });
});
