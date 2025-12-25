/**
 * Tests for GET /api/firewall/devices/:id - Get Device Details
 * 
 * Requirements: Task 8.1 - Device Management API
 * - Test device retrieval with health snapshot and posture
 * - Test authentication and authorization
 * - Test tenant isolation
 * - Test 404 handling
 * - Test super admin access
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

// Mock dependencies BEFORE imports
jest.mock('@/middleware/auth.middleware');
jest.mock('@/middleware/tenant.middleware');
jest.mock('@/lib/database', () => ({
    db: {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
    },
}));

// Import after mocks
import { GET } from '../route';
import { NextRequest } from 'next/server';
import { db } from '@/lib/database';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

// Get reference to mocked db
const mockDb = jest.mocked(db);

describe('GET /api/firewall/devices/:id', () => {
    const mockTenantId = '123e4567-e89b-12d3-a456-426614174000';
    const mockUserId = '123e4567-e89b-12d3-a456-426614174001';
    const mockDeviceId = '123e4567-e89b-12d3-a456-426614174002';
    const mockHealthSnapshotId = '123e4567-e89b-12d3-a456-426614174003';
    const mockPostureId = '123e4567-e89b-12d3-a456-426614174004';

    const mockDevice = {
        id: mockDeviceId,
        tenantId: mockTenantId,
        model: 'TZ600',
        firmwareVersion: '7.0.1-5050',
        serialNumber: 'TEST-SERIAL-001',
        managementIp: '192.168.1.1',
        apiUsername: 'admin',
        apiPasswordEncrypted: 'encrypted_password',
        status: 'active',
        uptimeSeconds: 86400,
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockHealthSnapshot = {
        id: mockHealthSnapshotId,
        deviceId: mockDeviceId,
        cpuPercent: 45.5,
        ramPercent: 60.2,
        uptimeSeconds: 86400,
        wanStatus: 'up',
        vpnStatus: 'up',
        interfaceStatus: { X0: 'up', X1: 'up', X2: 'down' },
        wifiStatus: 'on',
        haStatus: 'standalone',
        timestamp: new Date(),
    };

    const mockPosture = {
        id: mockPostureId,
        deviceId: mockDeviceId,
        ipsEnabled: true,
        ipsLicenseStatus: 'active',
        ipsDailyBlocks: 150,
        gavEnabled: true,
        gavLicenseStatus: 'active',
        gavDailyBlocks: 25,
        dpiSslEnabled: true,
        dpiSslCertificateStatus: 'valid',
        dpiSslDailyBlocks: 10,
        atpEnabled: true,
        atpLicenseStatus: 'active',
        atpDailyVerdicts: 5,
        botnetFilterEnabled: true,
        botnetDailyBlocks: 8,
        appControlEnabled: true,
        appControlLicenseStatus: 'active',
        appControlDailyBlocks: 12,
        contentFilterEnabled: true,
        contentFilterLicenseStatus: 'active',
        contentFilterDailyBlocks: 20,
        timestamp: new Date(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return device details with latest health snapshot and posture', async () => {
        // Mock successful authentication
        (authMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            user: {
                id: mockUserId,
                email: 'test-device-details@example.com',
                role: UserRole.TENANT_ADMIN,
                tenant_id: mockTenantId,
            },
        });

        // Mock successful tenant validation
        (tenantMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            tenant: {
                id: mockTenantId,
                name: 'Test Tenant Device Details',
                slug: 'test-tenant-device-details',
            },
        });

        // Mock database queries
        // First call: device query
        mockDb.select.mockReturnValueOnce(mockDb as any);
        mockDb.from.mockReturnValueOnce(mockDb as any);
        mockDb.where.mockReturnValueOnce(mockDb as any);
        mockDb.limit.mockResolvedValueOnce([mockDevice]);

        // Second call: health snapshot query
        mockDb.select.mockReturnValueOnce(mockDb as any);
        mockDb.from.mockReturnValueOnce(mockDb as any);
        mockDb.where.mockReturnValueOnce(mockDb as any);
        mockDb.orderBy.mockReturnValueOnce(mockDb as any);
        mockDb.limit.mockResolvedValueOnce([mockHealthSnapshot]);

        // Third call: security posture query
        mockDb.select.mockReturnValueOnce(mockDb as any);
        mockDb.from.mockReturnValueOnce(mockDb as any);
        mockDb.where.mockReturnValueOnce(mockDb as any);
        mockDb.orderBy.mockReturnValueOnce(mockDb as any);
        mockDb.limit.mockResolvedValueOnce([mockPosture]);

        const request = new NextRequest(
            `http://localhost:3000/api/firewall/devices/${mockDeviceId}`
        );

        const response = await GET(request, { params: { id: mockDeviceId } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        expect(data.data.device).toBeDefined();
        expect(data.data.health).toBeDefined();
        expect(data.data.posture).toBeDefined();

        // Verify device data
        expect(data.data.device.id).toBe(mockDeviceId);
        expect(data.data.device.tenantId).toBe(mockTenantId);
        expect(data.data.device.model).toBe('TZ600');
        expect(data.data.device.apiPasswordEncrypted).toBeNull(); // Should never return encrypted password
        expect(data.data.device.status).toBe('active');

        // Verify health snapshot data
        expect(data.data.health.id).toBe(mockHealthSnapshotId);
        expect(data.data.health.cpuPercent).toBe(45.5);
        expect(data.data.health.wanStatus).toBe('up');

        // Verify security posture data
        expect(data.data.posture.id).toBe(mockPostureId);
        expect(data.data.posture.ipsEnabled).toBe(true);
        expect(data.data.posture.ipsDailyBlocks).toBe(150);
    });

    it('should return device without health/posture if none exist', async () => {
        (authMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            user: {
                id: mockUserId,
                email: 'test@example.com',
                role: UserRole.TENANT_ADMIN,
                tenant_id: mockTenantId,
            },
        });

        (tenantMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            tenant: { id: mockTenantId, name: 'Test Tenant', slug: 'test-tenant' },
        });

        // Mock device query
        mockDb.select.mockReturnValueOnce(mockDb as any);
        mockDb.from.mockReturnValueOnce(mockDb as any);
        mockDb.where.mockReturnValueOnce(mockDb as any);
        mockDb.limit.mockResolvedValueOnce([mockDevice]);

        // Mock empty health snapshot query
        mockDb.select.mockReturnValueOnce(mockDb as any);
        mockDb.from.mockReturnValueOnce(mockDb as any);
        mockDb.where.mockReturnValueOnce(mockDb as any);
        mockDb.orderBy.mockReturnValueOnce(mockDb as any);
        mockDb.limit.mockResolvedValueOnce([]);

        // Mock empty posture query
        mockDb.select.mockReturnValueOnce(mockDb as any);
        mockDb.from.mockReturnValueOnce(mockDb as any);
        mockDb.where.mockReturnValueOnce(mockDb as any);
        mockDb.orderBy.mockReturnValueOnce(mockDb as any);
        mockDb.limit.mockResolvedValueOnce([]);

        const request = new NextRequest(
            `http://localhost:3000/api/firewall/devices/${mockDeviceId}`
        );

        const response = await GET(request, { params: { id: mockDeviceId } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.device).toBeDefined();
        expect(data.data.health).toBeNull();
        expect(data.data.posture).toBeNull();
    });

    it('should return 401 if not authenticated', async () => {
        (authMiddleware as jest.Mock).mockResolvedValue({
            success: false,
            error: 'Authentication required',
        });

        const request = new NextRequest(
            `http://localhost:3000/api/firewall/devices/${mockDeviceId}`
        );

        const response = await GET(request, { params: { id: mockDeviceId } });
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 403 if tenant validation fails', async () => {
        (authMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            user: {
                id: mockUserId,
                email: 'test@example.com',
                role: UserRole.TENANT_ADMIN,
                tenant_id: mockTenantId,
            },
        });

        (tenantMiddleware as jest.Mock).mockResolvedValue({
            success: false,
            error: { message: 'Tenant validation failed' },
        });

        const request = new NextRequest(
            `http://localhost:3000/api/firewall/devices/${mockDeviceId}`
        );

        const response = await GET(request, { params: { id: mockDeviceId } });
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('TENANT_ERROR');
    });

    it('should return 400 for invalid device ID format', async () => {
        (authMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            user: {
                id: mockUserId,
                email: 'test@example.com',
                role: UserRole.TENANT_ADMIN,
                tenant_id: mockTenantId,
            },
        });

        (tenantMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            tenant: { id: mockTenantId, name: 'Test Tenant', slug: 'test-tenant' },
        });

        const request = new NextRequest(
            'http://localhost:3000/api/firewall/devices/invalid-id'
        );

        const response = await GET(request, { params: { id: 'invalid-id' } });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('INVALID_ID');
    });

    it('should return 404 if device not found', async () => {
        (authMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            user: {
                id: mockUserId,
                email: 'test@example.com',
                role: UserRole.TENANT_ADMIN,
                tenant_id: mockTenantId,
            },
        });

        (tenantMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            tenant: { id: mockTenantId, name: 'Test Tenant', slug: 'test-tenant' },
        });

        // Mock empty device query
        mockDb.select.mockReturnValueOnce(mockDb as any);
        mockDb.from.mockReturnValueOnce(mockDb as any);
        mockDb.where.mockReturnValueOnce(mockDb as any);
        mockDb.limit.mockResolvedValueOnce([]);

        const nonExistentId = '00000000-0000-0000-0000-000000000000';
        const request = new NextRequest(
            `http://localhost:3000/api/firewall/devices/${nonExistentId}`
        );

        const response = await GET(request, { params: { id: nonExistentId } });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('NOT_FOUND');
    });

    it('should allow super admin to view device from any tenant', async () => {
        (authMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            user: {
                id: 'super-admin-id',
                email: 'superadmin@example.com',
                role: UserRole.SUPER_ADMIN,
                tenant_id: 'different-tenant-id',
            },
        });

        (tenantMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            tenant: { id: 'different-tenant-id', name: 'Different Tenant', slug: 'different' },
        });

        // Mock device query (super admin can see any device)
        mockDb.select.mockReturnValueOnce(mockDb as any);
        mockDb.from.mockReturnValueOnce(mockDb as any);
        mockDb.where.mockReturnValueOnce(mockDb as any);
        mockDb.limit.mockResolvedValueOnce([mockDevice]);

        // Mock health and posture queries
        mockDb.select.mockReturnValueOnce(mockDb as any);
        mockDb.from.mockReturnValueOnce(mockDb as any);
        mockDb.where.mockReturnValueOnce(mockDb as any);
        mockDb.orderBy.mockReturnValueOnce(mockDb as any);
        mockDb.limit.mockResolvedValueOnce([mockHealthSnapshot]);

        mockDb.select.mockReturnValueOnce(mockDb as any);
        mockDb.from.mockReturnValueOnce(mockDb as any);
        mockDb.where.mockReturnValueOnce(mockDb as any);
        mockDb.orderBy.mockReturnValueOnce(mockDb as any);
        mockDb.limit.mockResolvedValueOnce([mockPosture]);

        const request = new NextRequest(
            `http://localhost:3000/api/firewall/devices/${mockDeviceId}`
        );

        const response = await GET(request, { params: { id: mockDeviceId } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.device.id).toBe(mockDeviceId);
    });
});
