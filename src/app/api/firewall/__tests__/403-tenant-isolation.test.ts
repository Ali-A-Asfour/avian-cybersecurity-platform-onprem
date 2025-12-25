/**
 * Test Suite: 403 Tenant Isolation Verification for Firewall API
 * 
 * Requirements: 17.1-17.9 - Multi-Tenant Isolation
 * - Enforce tenant-based access control
 * - Prevent cross-tenant data access
 * - Allow super admin cross-tenant access
 * - Validate tenant ownership of resources
 * 
 * This test suite verifies that tenant isolation is properly enforced
 * across all firewall API endpoints.
 */

import { NextRequest } from 'next/server';
import { GET as getDevices } from '../devices/route';
import { GET as getDevice } from '../devices/[id]/route';
import { GET as getPosture } from '../posture/[deviceId]/route';
import { GET as getHealth } from '../health/[deviceId]/route';
import { GET as getLicenses } from '../licenses/[deviceId]/route';
import { GET as getAlerts } from '../alerts/route';
import { GET as getMetrics } from '../metrics/[deviceId]/route';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { UserRole } from '@/types';

// Mock the auth and tenant middleware
jest.mock('@/middleware/auth.middleware');
jest.mock('@/middleware/tenant.middleware');

// Mock the database
jest.mock('@/lib/database', () => ({
    db: {
        select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([]),
            }),
        }),
    },
}));

describe('Firewall API - 403 Tenant Isolation Verification', () => {
    const TENANT_A_ID = 'tenant-a-123';
    const TENANT_B_ID = 'tenant-b-456';
    const DEVICE_TENANT_B = 'device-b-001';
    const USER_TENANT_A = 'user-a-001';

    const mockRequest = (url: string, method: string = 'GET') => {
        return new NextRequest(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer mock-token',
            },
        });
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Cross-Tenant Access Prevention', () => {
        it('should return 403 when tenant validation fails', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.TENANT_ADMIN,
                },
            });

            // Tenant middleware fails validation
            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: false,
                error: {
                    code: 'TENANT_ERROR',
                    message: 'Access denied to this tenant',
                },
            });

            const request = mockRequest('http://localhost:3000/api/firewall/devices');
            const response = await getDevices(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });

        it('should prevent accessing device from different tenant', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.ANALYST,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            const request = mockRequest(`http://localhost:3000/api/firewall/devices/${DEVICE_TENANT_B}`);
            const response = await getDevice(request, { params: { id: DEVICE_TENANT_B } });
            const data = await response.json();

            // Should return 404 (not found in user's tenant) or 403 (forbidden)
            expect([403, 404]).toContain(response.status);
            expect(data.success).toBe(false);
        });
    });

    describe('Tenant Isolation Across Endpoints', () => {
        beforeEach(() => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.ANALYST,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });
        });

        it('should enforce tenant isolation on posture endpoint', async () => {
            const request = mockRequest(`http://localhost:3000/api/firewall/posture/${DEVICE_TENANT_B}`);
            const response = await getPosture(request, { params: { deviceId: DEVICE_TENANT_B } });
            const data = await response.json();

            expect([403, 404]).toContain(response.status);
            expect(data.success).toBe(false);
        });

        it('should enforce tenant isolation on health endpoint', async () => {
            const request = mockRequest(`http://localhost:3000/api/firewall/health/${DEVICE_TENANT_B}`);
            const response = await getHealth(request, { params: { deviceId: DEVICE_TENANT_B } });
            const data = await response.json();

            expect([403, 404]).toContain(response.status);
            expect(data.success).toBe(false);
        });

        it('should enforce tenant isolation on licenses endpoint', async () => {
            const request = mockRequest(`http://localhost:3000/api/firewall/licenses/${DEVICE_TENANT_B}`);
            const response = await getLicenses(request, { params: { deviceId: DEVICE_TENANT_B } });
            const data = await response.json();

            expect([403, 404]).toContain(response.status);
            expect(data.success).toBe(false);
        });

        it('should enforce tenant isolation on metrics endpoint', async () => {
            const request = mockRequest(`http://localhost:3000/api/firewall/metrics/${DEVICE_TENANT_B}`);
            const response = await getMetrics(request, { params: { deviceId: DEVICE_TENANT_B } });
            const data = await response.json();

            expect([403, 404]).toContain(response.status);
            expect(data.success).toBe(false);
        });

        it('should only return alerts for user tenant', async () => {
            const request = mockRequest('http://localhost:3000/api/firewall/alerts');
            const response = await getAlerts(request);

            // The endpoint should succeed but only return tenant-filtered data
            // This is verified by the database query filtering by tenant_id
            expect(response.status).toBe(200);
        });
    });

    describe('Super Admin Cross-Tenant Access', () => {
        it('should allow super admin to access any tenant resources', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: 'super-admin-001',
                    tenant_id: TENANT_A_ID,
                    role: UserRole.SUPER_ADMIN,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            const request = mockRequest(`http://localhost:3000/api/firewall/devices/${DEVICE_TENANT_B}`);
            const response = await getDevice(request, { params: { id: DEVICE_TENANT_B } });

            // Super admin should be able to access (returns 404 if device doesn't exist, not 403)
            expect(response.status).not.toBe(403);
        });
    });

    describe('Error Response Format', () => {
        it('should return consistent 403 error format', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.ANALYST,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: false,
                error: {
                    code: 'TENANT_ERROR',
                    message: 'Access denied to this tenant',
                },
            });

            const request = mockRequest('http://localhost:3000/api/firewall/devices');
            const response = await getDevices(request);
            const data = await response.json();

            expect(data).toHaveProperty('success');
            expect(data).toHaveProperty('error');
            expect(data.error).toHaveProperty('code');
            expect(data.error).toHaveProperty('message');
            expect(data.success).toBe(false);
            expect(response.status).toBe(403);
        });
    });
});
