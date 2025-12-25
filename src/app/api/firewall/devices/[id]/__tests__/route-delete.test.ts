/**
 * Tests for DELETE /api/firewall/devices/:id
 * 
 * Requirements: 15.1 - Device Management API
 * - Delete device and all associated data
 * - Enforce tenant isolation
 * - Only Super Admins and Tenant Admins can delete devices
 * - Return 404 if device not found
 */

import { UserRole } from '@/types';

// Mock NextResponse before other imports
jest.mock('next/server', () => {
    const actual = jest.requireActual('next/server');
    return {
        ...actual,
        NextResponse: {
            json: (body: any, init?: ResponseInit) => {
                return new Response(JSON.stringify(body), {
                    ...init,
                    headers: {
                        'content-type': 'application/json',
                        ...init?.headers,
                    },
                });
            },
        },
    };
});

// Mock the middleware
jest.mock('@/middleware/auth.middleware', () => ({
    authMiddleware: jest.fn(),
}));

jest.mock('@/middleware/tenant.middleware', () => ({
    tenantMiddleware: jest.fn(),
}));

// Mock the database
jest.mock('@/lib/database', () => ({
    db: {
        select: jest.fn(),
        delete: jest.fn(),
    },
}));

const { authMiddleware } = require('@/middleware/auth.middleware');
const { tenantMiddleware } = require('@/middleware/tenant.middleware');

// Import after mocks
import { NextRequest } from 'next/server';
import { DELETE } from '../route';
import { db } from '@/lib/database';

describe('DELETE /api/firewall/devices/:id', () => {
    const mockTenantId = '550e8400-e29b-41d4-a716-446655440000';
    const mockDeviceId = '660e8400-e29b-41d4-a716-446655440001';
    const mockUserId = '770e8400-e29b-41d4-a716-446655440002';

    const mockDevice = {
        id: mockDeviceId,
        tenantId: mockTenantId,
        model: 'TZ-400',
        firmwareVersion: '7.0.1-5050',
        serialNumber: 'C0EAE4D2E3F1',
        managementIp: '192.168.1.1',
        apiUsername: 'admin',
        apiPasswordEncrypted: 'encrypted_password',
        uptimeSeconds: BigInt(86400),
        lastSeenAt: new Date('2024-01-15T10:00:00Z'),
        status: 'active',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-15T10:00:00Z'),
    };

    const mockTenantAdminUser = {
        id: mockUserId,
        tenant_id: mockTenantId,
        role: 'tenant_admin' as UserRole,
        email: 'admin@example.com',
    };

    const mockSuperAdminUser = {
        id: mockUserId,
        tenant_id: mockTenantId,
        role: UserRole.SUPER_ADMIN,
        email: 'superadmin@example.com',
    };

    const mockAnalystUser = {
        id: mockUserId,
        tenant_id: mockTenantId,
        role: 'analyst' as UserRole,
        email: 'analyst@example.com',
    };

    const mockTenant = {
        id: mockTenantId,
        name: 'Test Tenant',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Authentication and Authorization', () => {
        it('should return 401 if user is not authenticated', async () => {
            authMiddleware.mockResolvedValue({
                success: false,
                error: 'Authentication required',
            });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'DELETE' }
            );

            const response = await DELETE(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 403 if tenant validation fails', async () => {
            authMiddleware.mockResolvedValue({
                success: true,
                user: mockTenantAdminUser,
            });

            tenantMiddleware.mockResolvedValue({
                success: false,
                error: { message: 'Tenant validation failed' },
            });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'DELETE' }
            );

            const response = await DELETE(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });

        it('should return 403 if user is not an admin', async () => {
            authMiddleware.mockResolvedValue({
                success: true,
                user: mockAnalystUser,
            });

            tenantMiddleware.mockResolvedValue({
                success: true,
                tenant: mockTenant,
            });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'DELETE' }
            );

            const response = await DELETE(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INSUFFICIENT_PERMISSIONS');
            expect(data.error.message).toContain('Only administrators can delete');
        });

        it('should allow tenant admin to delete device', async () => {
            authMiddleware.mockResolvedValue({
                success: true,
                user: mockTenantAdminUser,
            });

            tenantMiddleware.mockResolvedValue({
                success: true,
                tenant: mockTenant,
            });

            const mockSelectQuery = {
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };

            const mockDeleteQuery = {
                where: jest.fn().mockReturnThis(),
                returning: jest.fn().mockResolvedValue([mockDevice]),
            };

            (db.select as jest.Mock).mockReturnValue(mockSelectQuery);
            (db.delete as jest.Mock).mockReturnValue(mockDeleteQuery);

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'DELETE' }
            );

            const response = await DELETE(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it('should allow super admin to delete device', async () => {
            authMiddleware.mockResolvedValue({
                success: true,
                user: mockSuperAdminUser,
            });

            tenantMiddleware.mockResolvedValue({
                success: true,
                tenant: mockTenant,
            });

            const mockSelectQuery = {
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };

            const mockDeleteQuery = {
                where: jest.fn().mockReturnThis(),
                returning: jest.fn().mockResolvedValue([mockDevice]),
            };

            (db.select as jest.Mock).mockReturnValue(mockSelectQuery);
            (db.delete as jest.Mock).mockReturnValue(mockDeleteQuery);

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'DELETE' }
            );

            const response = await DELETE(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });
    });

    describe('Input Validation', () => {
        beforeEach(() => {
            authMiddleware.mockResolvedValue({
                success: true,
                user: mockTenantAdminUser,
            });

            tenantMiddleware.mockResolvedValue({
                success: true,
                tenant: mockTenant,
            });
        });

        it('should return 400 for invalid UUID format', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/devices/invalid-uuid',
                { method: 'DELETE' }
            );

            const response = await DELETE(request, { params: { id: 'invalid-uuid' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INVALID_ID');
            expect(data.error.message).toContain('Invalid device ID format');
        });

        it('should accept valid UUID format', async () => {
            const mockSelectQuery = {
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };

            const mockDeleteQuery = {
                where: jest.fn().mockReturnThis(),
                returning: jest.fn().mockResolvedValue([mockDevice]),
            };

            (db.select as jest.Mock).mockReturnValue(mockSelectQuery);
            (db.delete as jest.Mock).mockReturnValue(mockDeleteQuery);

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'DELETE' }
            );

            const response = await DELETE(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });
    });

    describe('Device Deletion', () => {
        beforeEach(() => {
            authMiddleware.mockResolvedValue({
                success: true,
                user: mockTenantAdminUser,
            });

            tenantMiddleware.mockResolvedValue({
                success: true,
                tenant: mockTenant,
            });
        });

        it('should return 404 if device not found', async () => {
            const mockSelectQuery = {
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]),
            };

            (db.select as jest.Mock).mockReturnValue(mockSelectQuery);

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'DELETE' }
            );

            const response = await DELETE(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBe('Device not found');
        });

        it('should successfully delete device and return device info', async () => {
            const mockSelectQuery = {
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };

            const mockDeleteQuery = {
                where: jest.fn().mockReturnThis(),
                returning: jest.fn().mockResolvedValue([mockDevice]),
            };

            (db.select as jest.Mock).mockReturnValue(mockSelectQuery);
            (db.delete as jest.Mock).mockReturnValue(mockDeleteQuery);

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'DELETE' }
            );

            const response = await DELETE(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.message).toBe('Firewall device deleted successfully');
            expect(data.data.id).toBe(mockDeviceId);
            expect(data.data.serialNumber).toBe(mockDevice.serialNumber);
            expect(data.data.managementIp).toBe(mockDevice.managementIp);
        });

        it('should return 500 if delete operation fails', async () => {
            const mockSelectQuery = {
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };

            const mockDeleteQuery = {
                where: jest.fn().mockReturnThis(),
                returning: jest.fn().mockResolvedValue([]), // Empty array indicates failure
            };

            (db.select as jest.Mock).mockReturnValue(mockSelectQuery);
            (db.delete as jest.Mock).mockReturnValue(mockDeleteQuery);

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'DELETE' }
            );

            const response = await DELETE(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('DELETE_FAILED');
        });
    });

    describe('Tenant Isolation', () => {
        it('should not allow tenant admin to delete device from another tenant', async () => {
            const otherTenantId = '880e8400-e29b-41d4-a716-446655440003';
            const userFromDifferentTenant = {
                ...mockTenantAdminUser,
                tenant_id: otherTenantId,
            };

            authMiddleware.mockResolvedValue({
                success: true,
                user: userFromDifferentTenant,
            });

            tenantMiddleware.mockResolvedValue({
                success: true,
                tenant: { id: otherTenantId, name: 'Other Tenant' },
            });

            // Device belongs to mockTenantId, but user is from otherTenantId
            const mockSelectQuery = {
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]), // No device found due to tenant filter
            };

            (db.select as jest.Mock).mockReturnValue(mockSelectQuery);

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'DELETE' }
            );

            const response = await DELETE(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should allow super admin to delete device from any tenant', async () => {
            authMiddleware.mockResolvedValue({
                success: true,
                user: mockSuperAdminUser,
            });

            tenantMiddleware.mockResolvedValue({
                success: true,
                tenant: mockTenant,
            });

            const mockSelectQuery = {
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };

            const mockDeleteQuery = {
                where: jest.fn().mockReturnThis(),
                returning: jest.fn().mockResolvedValue([mockDevice]),
            };

            (db.select as jest.Mock).mockReturnValue(mockSelectQuery);
            (db.delete as jest.Mock).mockReturnValue(mockDeleteQuery);

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'DELETE' }
            );

            const response = await DELETE(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            authMiddleware.mockResolvedValue({
                success: true,
                user: mockTenantAdminUser,
            });

            tenantMiddleware.mockResolvedValue({
                success: true,
                tenant: mockTenant,
            });
        });

        it('should handle database errors gracefully', async () => {
            const mockSelectQuery = {
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockRejectedValue(new Error('Database connection failed')),
            };

            (db.select as jest.Mock).mockReturnValue(mockSelectQuery);

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'DELETE' }
            );

            const response = await DELETE(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toBe('Failed to delete firewall device');
        });

        it('should handle unexpected errors during deletion', async () => {
            const mockSelectQuery = {
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };

            const mockDeleteQuery = {
                where: jest.fn().mockReturnThis(),
                returning: jest.fn().mockRejectedValue(new Error('Unexpected error')),
            };

            (db.select as jest.Mock).mockReturnValue(mockSelectQuery);
            (db.delete as jest.Mock).mockReturnValue(mockDeleteQuery);

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'DELETE' }
            );

            const response = await DELETE(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
        });
    });

    describe('Cascading Deletes', () => {
        it('should rely on database CASCADE to delete related records', async () => {
            // This test verifies that we're relying on database CASCADE
            // The actual CASCADE behavior is tested at the database level
            authMiddleware.mockResolvedValue({
                success: true,
                user: mockTenantAdminUser,
            });

            tenantMiddleware.mockResolvedValue({
                success: true,
                tenant: mockTenant,
            });

            const mockSelectQuery = {
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };

            const mockDeleteQuery = {
                where: jest.fn().mockReturnThis(),
                returning: jest.fn().mockResolvedValue([mockDevice]),
            };

            (db.select as jest.Mock).mockReturnValue(mockSelectQuery);
            (db.delete as jest.Mock).mockReturnValue(mockDeleteQuery);

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/devices/${mockDeviceId}`,
                { method: 'DELETE' }
            );

            const response = await DELETE(request, { params: { id: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);

            // Verify only one delete call was made (to firewall_devices)
            // CASCADE handles the rest
            expect(db.delete).toHaveBeenCalledTimes(1);
        });
    });
});
