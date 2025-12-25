/**
 * Tests for GET /api/firewall/licenses/:deviceId
 * 
 * Requirements: 15.6 - Posture and Health API
 * - Test license retrieval for valid device
 * - Test tenant isolation
 * - Test super admin access
 * - Test 404 for non-existent device
 * - Test 404 for device without license data
 * - Test days remaining calculation
 * - Test license status determination
 * - Test authentication and authorization
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

// Mock dependencies
jest.mock('@/middleware/auth.middleware');
jest.mock('@/middleware/tenant.middleware');
jest.mock('@/lib/database', () => ({
    db: {
        select: jest.fn(),
    },
}));

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import {
    firewallDevices,
    firewallLicenses,
} from '../../../../../../../database/schemas/firewall';
import { eq, and, desc } from 'drizzle-orm';

const mockAuthMiddleware = authMiddleware as jest.MockedFunction<typeof authMiddleware>;
const mockTenantMiddleware = tenantMiddleware as jest.MockedFunction<typeof tenantMiddleware>;

describe('GET /api/firewall/licenses/:deviceId', () => {
    const mockDeviceId = '123e4567-e89b-12d3-a456-426614174000';
    const mockTenantId = '987e6543-e21b-12d3-a456-426614174999';
    const mockUserId = '456e7890-e12b-12d3-a456-426614174111';

    const mockUser = {
        id: mockUserId,
        tenant_id: mockTenantId,
        role: UserRole.ADMIN,
        email: 'admin@test.com',
    };

    const mockTenant = {
        id: mockTenantId,
        name: 'Test Tenant',
    };

    const mockDevice = {
        id: mockDeviceId,
        tenantId: mockTenantId,
        model: 'TZ-400',
        firmwareVersion: '7.0.1',
        serialNumber: 'SN123456',
        managementIp: '192.168.1.1',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockLicense = {
        id: '111e2222-e33b-44d3-a456-426614174222',
        deviceId: mockDeviceId,
        ipsExpiry: '2024-12-31',
        gavExpiry: '2024-11-15',
        atpExpiry: '2025-06-30',
        appControlExpiry: '2024-10-01',
        contentFilterExpiry: '2025-03-15',
        supportExpiry: '2024-12-31',
        licenseWarnings: ['GAV expiring in 15 days'],
        timestamp: new Date(),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Default successful auth
        mockAuthMiddleware.mockResolvedValue({
            success: true,
            user: mockUser,
        });

        // Default successful tenant validation
        mockTenantMiddleware.mockResolvedValue({
            success: true,
            tenant: mockTenant,
        });
    });

    describe('Success Cases', () => {
        it('should return license information for valid device', async () => {
            // Mock device query
            const mockDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };

            // Mock license query
            const mockLicenseQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockLicense]),
            };

            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockLicenseQuery) });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toBeDefined();
            expect(data.data.id).toBe(mockLicense.id);
            expect(data.data.deviceId).toBe(mockDeviceId);
            expect(data.data.ipsExpiry).toBe('2024-12-31');
            expect(data.data.gavExpiry).toBe('2024-11-15');
            expect(data.data.atpExpiry).toBe('2025-06-30');
            expect(data.data.licenseWarnings).toEqual(['GAV expiring in 15 days']);
        });

        it('should calculate days remaining correctly', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 45);
            const futureDateStr = futureDate.toISOString().split('T')[0];

            const licenseWithFutureExpiry = {
                ...mockLicense,
                ipsExpiry: futureDateStr,
            };

            const mockDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };

            const mockLicenseQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([licenseWithFutureExpiry]),
            };

            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockLicenseQuery) });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.ipsDaysRemaining).toBeGreaterThan(40);
            expect(data.data.ipsDaysRemaining).toBeLessThanOrEqual(45);
        });

        it('should determine license status as "active" for licenses with > 30 days', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 60);
            const futureDateStr = futureDate.toISOString().split('T')[0];

            const licenseWithActiveLicense = {
                ...mockLicense,
                ipsExpiry: futureDateStr,
            };

            const mockDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };

            const mockLicenseQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([licenseWithActiveLicense]),
            };

            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockLicenseQuery) });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.ipsStatus).toBe('active');
        });

        it('should determine license status as "expiring" for licenses with <= 30 days', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 15);
            const futureDateStr = futureDate.toISOString().split('T')[0];

            const licenseWithExpiringLicense = {
                ...mockLicense,
                gavExpiry: futureDateStr,
            };

            const mockDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };

            const mockLicenseQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([licenseWithExpiringLicense]),
            };

            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockLicenseQuery) });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.gavStatus).toBe('expiring');
        });

        it('should determine license status as "expired" for past dates', async () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 10);
            const pastDateStr = pastDate.toISOString().split('T')[0];

            const licenseWithExpiredLicense = {
                ...mockLicense,
                atpExpiry: pastDateStr,
            };

            const mockDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };

            const mockLicenseQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([licenseWithExpiredLicense]),
            };

            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockLicenseQuery) });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.atpStatus).toBe('expired');
            expect(data.data.atpDaysRemaining).toBeLessThan(0);
        });

        it('should handle null expiry dates correctly', async () => {
            const licenseWithNullExpiry = {
                ...mockLicense,
                appControlExpiry: null,
            };

            const mockDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };

            const mockLicenseQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([licenseWithNullExpiry]),
            };

            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockLicenseQuery) });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.appControlExpiry).toBeNull();
            expect(data.data.appControlDaysRemaining).toBeNull();
            expect(data.data.appControlStatus).toBeNull();
        });

        it('should allow super admin to access any tenant device', async () => {
            const superAdminUser = {
                ...mockUser,
                role: UserRole.SUPER_ADMIN,
                tenant_id: 'different-tenant-id',
            };

            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: superAdminUser,
            });

            const mockDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };

            const mockLicenseQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockLicense]),
            };

            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockLicenseQuery) });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.deviceId).toBe(mockDeviceId);
        });
    });

    describe('Error Cases', () => {
        it('should return 401 if not authenticated', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: false,
                error: 'Authentication required',
            });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 403 if tenant validation fails', async () => {
            mockTenantMiddleware.mockResolvedValue({
                success: false,
                error: { message: 'Tenant validation failed' },
            });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });

        it('should return 400 for invalid device ID format', async () => {
            const invalidDeviceId = 'invalid-uuid';

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${invalidDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: invalidDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INVALID_ID');
        });

        it('should return 404 if device not found', async () => {
            const mockDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]),
            };

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue(mockDeviceQuery),
            });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBe('Device not found');
        });

        it('should return 403 if device belongs to different tenant', async () => {
            const otherTenantDevice = { ...mockDevice, tenantId: 'other-tenant-id' };
            const mockDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([otherTenantDevice]),
            };

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue(mockDeviceQuery),
            });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');
            expect(data.error.message).toBe('Access denied. Device belongs to another tenant');
        });

        it('should return 404 if no license data exists for device', async () => {
            const mockDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };

            const mockLicenseQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]),
            };

            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockLicenseQuery) });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBe('No license data found for this device');
        });

        it('should return 503 if database connection not available', async () => {
            const originalDb = (db as any);
            (require('@/lib/database') as any).db = null;

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(503);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('DATABASE_ERROR');

            // Restore db
            (require('@/lib/database') as any).db = originalDb;
        });

        it('should return 500 if unexpected error occurs', async () => {
            const mockDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockRejectedValue(new Error('Database error')),
            };

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue(mockDeviceQuery),
            });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
        });
    });

    describe('Tenant Isolation', () => {
        it('should enforce tenant isolation for regular users', async () => {
            const mockDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]),
            };

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue(mockDeviceQuery),
            });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(mockDeviceQuery.where).toHaveBeenCalled();
        });

        it('should not enforce tenant isolation for super admins', async () => {
            const superAdminUser = {
                ...mockUser,
                role: UserRole.SUPER_ADMIN,
            };

            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: superAdminUser,
            });

            const mockDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };

            const mockLicenseQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockLicense]),
            };

            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockLicenseQuery) });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/licenses/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });

            expect(response.status).toBe(200);
        });
    });
});
