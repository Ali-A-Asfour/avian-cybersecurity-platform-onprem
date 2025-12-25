/**
 * Tests for PUT /api/firewall/devices/:id - Update device
 * 
 * Requirements: 15.1 - Device Management API
 * - Update device metadata and credentials
 * - Encrypt API password if provided
 * - Validate input data
 * - Enforce tenant isolation
 * - Only Super Admins and Tenant Admins can update devices
 */

import { NextRequest } from 'next/server';
import { PUT } from '../route';
import { db } from '@/lib/database';
import { firewallDevices } from '../../../../../../../database/schemas/firewall';
import { eq } from 'drizzle-orm';
import { FirewallEncryption } from '@/lib/firewall-encryption';

// Mock middleware
jest.mock('@/middleware/auth.middleware', () => ({
    authMiddleware: jest.fn(),
}));

jest.mock('@/middleware/tenant.middleware', () => ({
    tenantMiddleware: jest.fn(),
}));

// Mock encryption
jest.mock('@/lib/firewall-encryption', () => ({
    FirewallEncryption: {
        encryptPassword: jest.fn(),
        decryptPassword: jest.fn(),
    },
}));

import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

describe('PUT /api/firewall/devices/:id', () => {
    const mockTenantId = '550e8400-e29b-41d4-a716-446655440000';
    const mockDeviceId = '660e8400-e29b-41d4-a716-446655440001';
    const mockUserId = '770e8400-e29b-41d4-a716-446655440002';

    const mockTenantAdmin = {
        id: mockUserId,
        tenant_id: mockTenantId,
        role: 'tenant_admin',
        email: 'admin@test.com',
    };

    const mockSuperAdmin = {
        id: mockUserId,
        tenant_id: mockTenantId,
        role: 'super_admin',
        email: 'superadmin@test.com',
    };

    const mockAnalyst = {
        id: mockUserId,
        tenant_id: mockTenantId,
        role: 'analyst',
        email: 'analyst@test.com',
    };

    const mockTenant = {
        id: mockTenantId,
        name: 'Test Tenant',
    };

    const mockExistingDevice = {
        id: mockDeviceId,
        tenantId: mockTenantId,
        model: 'TZ-400',
        firmwareVersion: '7.0.1',
        serialNumber: 'SN123456',
        managementIp: '192.168.1.1',
        apiUsername: 'admin',
        apiPasswordEncrypted: '{"encrypted":"test","iv":"test"}',
        uptimeSeconds: BigInt(0),
        lastSeenAt: null,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Default successful auth
        (authMiddleware as any).mockResolvedValue({
            success: true,
            user: mockTenantAdmin,
        });

        // Default successful tenant validation
        (tenantMiddleware as any).mockResolvedValue({
            success: true,
            tenant: mockTenant,
        });

        // Default successful encryption
        (FirewallEncryption.encryptPassword as any).mockResolvedValue(
            '{"encrypted":"newencrypted","iv":"newiv"}'
        );
    });

    afterEach(async () => {
        // Clean up test data
        await db.delete(firewallDevices).where(eq(firewallDevices.id, mockDeviceId));
    });

    describe('Authentication and Authorization', () => {
        it('should return 401 if not authenticated', async () => {
            (authMiddleware as any).mockResolvedValue({
                success: false,
                error: 'Authentication required',
            });

            const request = new NextRequest('http://localhost/api/firewall/devices/123', {
                method: 'PUT',
                body: JSON.stringify({ model: 'TZ-500' }),
            });

            const response = await PUT(request, { params: { id: '123' } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 403 if tenant validation fails', async () => {
            (tenantMiddleware as any).mockResolvedValue({
                success: false,
                error: { message: 'Tenant validation failed' },
            });

            const request = new NextRequest('http://localhost/api/firewall/devices/123', {
                method: 'PUT',
                body: JSON.stringify({ model: 'TZ-500' }),
            });

            const response = await PUT(request, { params: { id: '123' } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });

        it('should return 403 if user is not admin', async () => {
            (authMiddleware as any).mockResolvedValue({
                success: true,
                user: mockAnalyst,
            });

            const request = new NextRequest('http://localhost/api/firewall/devices/123', {
                method: 'PUT',
                body: JSON.stringify({ model: 'TZ-500' }),
            });

            const response = await PUT(request, { params: { id: '123' } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INSUFFICIENT_PERMISSIONS');
        });
    });

    describe('Input Validation', () => {
        it('should return 400 for invalid device ID format', async () => {
            const request = new NextRequest('http://localhost/api/firewall/devices/invalid-id', {
                method: 'PUT',
                body: JSON.stringify({ model: 'TZ-500' }),
            });

            const response = await PUT(request, { params: { id: 'invalid-id' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INVALID_ID');
        });

        it('should return 400 if no fields provided for update', async () => {
            // Insert test device
            await db.insert(firewallDevices).values(mockExistingDevice);

            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({}),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('At least one field must be provided');
        });

        it('should return 400 for invalid management IP format', async () => {
            // Insert test device
            await db.insert(firewallDevices).values(mockExistingDevice);

            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ managementIp: 'invalid-ip' }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid management IP address format');
        });

        it('should return 400 for invalid status', async () => {
            // Insert test device
            await db.insert(firewallDevices).values(mockExistingDevice);

            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ status: 'invalid-status' }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid status');
        });
    });

    describe('Device Existence and Tenant Isolation', () => {
        it('should return 404 if device not found', async () => {
            const nonExistentId = '880e8400-e29b-41d4-a716-446655440099';

            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${nonExistentId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ model: 'TZ-500' }),
                }
            );

            const response = await PUT(request, { params: { id: nonExistentId } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should return 404 if device belongs to different tenant', async () => {
            // Insert device for different tenant
            const otherTenantId = '990e8400-e29b-41d4-a716-446655440099';
            await db.insert(firewallDevices).values({
                ...mockExistingDevice,
                tenantId: otherTenantId,
            });

            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ model: 'TZ-500' }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should allow super admin to update device from any tenant', async () => {
            (authMiddleware as any).mockResolvedValue({
                success: true,
                user: mockSuperAdmin,
            });

            // Insert device for different tenant
            const otherTenantId = '990e8400-e29b-41d4-a716-446655440099';
            await db.insert(firewallDevices).values({
                ...mockExistingDevice,
                tenantId: otherTenantId,
            });

            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ model: 'TZ-500' }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.model).toBe('TZ-500');
        });
    });

    describe('Duplicate Detection', () => {
        it('should return 409 if new management IP conflicts with another device', async () => {
            // Insert test device
            await db.insert(firewallDevices).values(mockExistingDevice);

            // Insert another device with different IP
            const anotherDeviceId = '770e8400-e29b-41d4-a716-446655440003';
            await db.insert(firewallDevices).values({
                ...mockExistingDevice,
                id: anotherDeviceId,
                managementIp: '192.168.1.2',
                serialNumber: 'SN789012',
            });

            // Try to update first device to use second device's IP
            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ managementIp: '192.168.1.2' }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(409);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('DUPLICATE_DEVICE');
            expect(data.error.message).toContain('management IP');

            // Clean up
            await db.delete(firewallDevices).where(eq(firewallDevices.id, anotherDeviceId));
        });

        it('should return 409 if new serial number conflicts with another device', async () => {
            // Insert test device
            await db.insert(firewallDevices).values(mockExistingDevice);

            // Insert another device with different serial
            const anotherDeviceId = '770e8400-e29b-41d4-a716-446655440003';
            await db.insert(firewallDevices).values({
                ...mockExistingDevice,
                id: anotherDeviceId,
                managementIp: '192.168.1.2',
                serialNumber: 'SN789012',
            });

            // Try to update first device to use second device's serial
            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ serialNumber: 'SN789012' }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(409);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('DUPLICATE_DEVICE');
            expect(data.error.message).toContain('serial number');

            // Clean up
            await db.delete(firewallDevices).where(eq(firewallDevices.id, anotherDeviceId));
        });

        it('should allow updating to same management IP (no change)', async () => {
            // Insert test device
            await db.insert(firewallDevices).values(mockExistingDevice);

            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ managementIp: '192.168.1.1' }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });
    });

    describe('Successful Updates', () => {
        it('should update device model', async () => {
            // Insert test device
            await db.insert(firewallDevices).values(mockExistingDevice);

            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ model: 'TZ-500' }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.model).toBe('TZ-500');
            expect(data.data.id).toBe(mockDeviceId);
            expect(data.message).toContain('updated successfully');
        });

        it('should update firmware version', async () => {
            // Insert test device
            await db.insert(firewallDevices).values(mockExistingDevice);

            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ firmwareVersion: '7.0.2' }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.firmwareVersion).toBe('7.0.2');
        });

        it('should update management IP', async () => {
            // Insert test device
            await db.insert(firewallDevices).values(mockExistingDevice);

            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ managementIp: '192.168.1.100' }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.managementIp).toBe('192.168.1.100');
        });

        it('should update status', async () => {
            // Insert test device
            await db.insert(firewallDevices).values(mockExistingDevice);

            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ status: 'inactive' }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.status).toBe('inactive');
        });

        it('should update API username', async () => {
            // Insert test device
            await db.insert(firewallDevices).values(mockExistingDevice);

            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ apiUsername: 'newadmin' }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.apiUsername).toBe('newadmin');
        });

        it('should update and encrypt API password', async () => {
            // Insert test device
            await db.insert(firewallDevices).values(mockExistingDevice);

            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ apiPassword: 'newpassword123' }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(FirewallEncryption.encryptPassword).toHaveBeenCalledWith('newpassword123');
            expect(data.data.apiPasswordEncrypted).toBeNull(); // Never returned in response
        });

        it('should update multiple fields at once', async () => {
            // Insert test device
            await db.insert(firewallDevices).values(mockExistingDevice);

            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({
                        model: 'TZ-600',
                        firmwareVersion: '7.1.0',
                        status: 'offline',
                        apiUsername: 'superadmin',
                    }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.model).toBe('TZ-600');
            expect(data.data.firmwareVersion).toBe('7.1.0');
            expect(data.data.status).toBe('offline');
            expect(data.data.apiUsername).toBe('superadmin');
        });

        it('should update updatedAt timestamp', async () => {
            // Insert test device
            const originalUpdatedAt = new Date('2024-01-01');
            await db.insert(firewallDevices).values({
                ...mockExistingDevice,
                updatedAt: originalUpdatedAt,
            });

            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ model: 'TZ-500' }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(new Date(data.data.updatedAt).getTime()).toBeGreaterThan(
                originalUpdatedAt.getTime()
            );
        });

        it('should not return encrypted password in response', async () => {
            // Insert test device
            await db.insert(firewallDevices).values(mockExistingDevice);

            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ model: 'TZ-500' }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.apiPasswordEncrypted).toBeNull();
        });
    });

    describe('Encryption Errors', () => {
        it('should return 500 if password encryption fails', async () => {
            // Insert test device
            await db.insert(firewallDevices).values(mockExistingDevice);

            (FirewallEncryption.encryptPassword as any).mockRejectedValue(
                new Error('Encryption failed')
            );

            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ apiPassword: 'newpassword' }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('ENCRYPTION_ERROR');
        });
    });

    describe('IPv6 Support', () => {
        it('should accept valid IPv6 management IP', async () => {
            // Insert test device
            await db.insert(firewallDevices).values(mockExistingDevice);

            const request = new NextRequest(
                `http://localhost/api/firewall/devices/${mockDeviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ managementIp: '2001:0db8:85a3:0000:0000:8a2e:0370:7334' }),
                }
            );

            const response = await PUT(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.managementIp).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
        });
    });
});
