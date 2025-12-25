/**
 * Test Suite: Authentication and Authorization Integration Tests
 * 
 * Requirements: 15.10, 17.1-17.9 - API Error Handling and Multi-Tenant Isolation
 * 
 * This comprehensive test suite verifies:
 * - Authentication enforcement across all firewall endpoints
 * - Tenant isolation (users can only access their tenant's data)
 * - Role-based authorization (admin vs analyst vs user)
 * - Cross-tenant access prevention
 * - Super admin cross-tenant access
 */

import { NextRequest } from 'next/server';
import { GET as getDevices, POST as postDevices } from '../devices/route';
import { GET as getDevice, PUT as putDevice, DELETE as deleteDevice } from '../devices/[id]/route';
import { POST as uploadConfig } from '../config/upload/route';
import { GET as getConfigRisks } from '../config/risks/[deviceId]/route';
import { GET as getPosture } from '../posture/[deviceId]/route';
import { GET as getHealth } from '../health/[deviceId]/route';
import { GET as getLicenses } from '../licenses/[deviceId]/route';
import { GET as getAlerts } from '../alerts/route';
import { PUT as acknowledgeAlert } from '../alerts/[id]/acknowledge/route';
import { GET as getMetrics } from '../metrics/[deviceId]/route';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import { firewallDevices } from '@/database/schemas/firewall';
import { eq, and } from 'drizzle-orm';
import { UserRole } from '@/types';

// Mock dependencies
jest.mock('@/middleware/auth.middleware');
jest.mock('@/middleware/tenant.middleware');

// Create a more complete database mock
const mockDb = {
    select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                    offset: jest.fn().mockResolvedValue([]),
                }),
                orderBy: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        offset: jest.fn().mockResolvedValue([]),
                    }),
                }),
            }),
        }),
    }),
    insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([]),
        }),
    }),
    update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([]),
            }),
        }),
    }),
    delete: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
    }),
};

jest.mock('@/lib/database', () => ({
    db: mockDb,
}));

describe('Firewall API - Authentication and Authorization Integration', () => {
    const TENANT_A_ID = 'tenant-a-123';
    const TENANT_B_ID = 'tenant-b-456';
    const DEVICE_TENANT_A = 'device-a-001';
    const DEVICE_TENANT_B = 'device-b-001';
    const USER_ADMIN_TENANT_A = 'user-admin-a';
    const USER_ANALYST_TENANT_A = 'user-analyst-a';
    const USER_ADMIN_TENANT_B = 'user-admin-b';
    const SUPER_ADMIN_USER = 'user-super-admin';

    const mockRequest = (url: string, method: string = 'GET', body?: any) => {
        return new NextRequest(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer mock-token',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset database mock to default behavior
        mockDb.select.mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([]),
            }),
        });
    });

    describe('Authentication Enforcement', () => {
        it('should reject requests without authentication', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: false,
                error: 'Authentication required',
            });

            const request = mockRequest('http://localhost:3000/api/firewall/devices');
            const response = await getDevices(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should reject requests with invalid tokens', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: false,
                error: 'Invalid or expired token',
            });

            const request = mockRequest('http://localhost:3000/api/firewall/devices');
            const response = await getDevices(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
        });
    });

    describe('Tenant Isolation - Basic Access Control', () => {
        it('should allow tenant admin to access their own tenant devices', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_ADMIN_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.TENANT_ADMIN,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            const mockDevices = [
                {
                    device_id: DEVICE_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    model: 'TZ400',
                    management_ip: '192.168.1.1',
                },
            ];

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue(mockDevices),
                }),
            });

            const request = mockRequest('http://localhost:3000/api/firewall/devices');
            const response = await getDevices(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(1);
            expect(data.data[0].tenant_id).toBe(TENANT_A_ID);
        });

        it('should prevent tenant admin from accessing another tenant devices', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_ADMIN_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.TENANT_ADMIN,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            // Mock database to return device from different tenant
            const mockDevice = {
                device_id: DEVICE_TENANT_B,
                tenant_id: TENANT_B_ID,
                model: 'TZ500',
                management_ip: '192.168.2.1',
            };

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([mockDevice]),
                }),
            });

            const request = mockRequest(`http://localhost:3000/api/firewall/devices/${DEVICE_TENANT_B}`);
            const response = await getDevice(request, { params: { id: DEVICE_TENANT_B } });
            const data = await response.json();

            // Should return 404 (device not found in user's tenant) or 403 (forbidden)
            expect([403, 404]).toContain(response.status);
            expect(data.success).toBe(false);
        });
    });

    describe('Tenant Isolation - Cross-Tenant Prevention', () => {
        it('should prevent user from Tenant A accessing device from Tenant B', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_ANALYST_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.ANALYST,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            // Device belongs to Tenant B
            const mockDevice = {
                device_id: DEVICE_TENANT_B,
                tenant_id: TENANT_B_ID,
                model: 'TZ500',
            };

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([mockDevice]),
                }),
            });

            const request = mockRequest(`http://localhost:3000/api/firewall/posture/${DEVICE_TENANT_B}`);
            const response = await getPosture(request, { params: { deviceId: DEVICE_TENANT_B } });
            const data = await response.json();

            expect([403, 404]).toContain(response.status);
            expect(data.success).toBe(false);
        });

        it('should prevent cross-tenant config upload', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_ADMIN_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.TENANT_ADMIN,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            // Device belongs to Tenant B
            const mockDevice = {
                device_id: DEVICE_TENANT_B,
                tenant_id: TENANT_B_ID,
            };

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([mockDevice]),
                }),
            });

            const request = mockRequest('http://localhost:3000/api/firewall/config/upload', 'POST', {
                deviceId: DEVICE_TENANT_B,
                configText: 'config content',
            });

            const response = await uploadConfig(request);
            const data = await response.json();

            expect([403, 404]).toContain(response.status);
            expect(data.success).toBe(false);
        });
    });

    describe('Super Admin Cross-Tenant Access', () => {
        it('should allow super admin to access devices from any tenant', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: SUPER_ADMIN_USER,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.SUPER_ADMIN,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            // Device belongs to Tenant B, but super admin should access it
            const mockDevice = {
                device_id: DEVICE_TENANT_B,
                tenant_id: TENANT_B_ID,
                model: 'TZ500',
                management_ip: '192.168.2.1',
            };

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([mockDevice]),
                }),
            });

            const request = mockRequest(`http://localhost:3000/api/firewall/devices/${DEVICE_TENANT_B}`);
            const response = await getDevice(request, { params: { id: DEVICE_TENANT_B } });
            const data = await response.json();

            // Super admin should be able to access
            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.device_id).toBe(DEVICE_TENANT_B);
        });

        it('should allow super admin to view all tenant devices', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: SUPER_ADMIN_USER,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.SUPER_ADMIN,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            const mockDevices = [
                { device_id: DEVICE_TENANT_A, tenant_id: TENANT_A_ID, model: 'TZ400' },
                { device_id: DEVICE_TENANT_B, tenant_id: TENANT_B_ID, model: 'TZ500' },
            ];

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue(mockDevices),
                }),
            });

            const request = mockRequest('http://localhost:3000/api/firewall/devices');
            const response = await getDevices(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            // Super admin can see devices from multiple tenants
            expect(data.data.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Role-Based Authorization', () => {
        it('should allow tenant admin to create devices', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_ADMIN_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.TENANT_ADMIN,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            (db.insert as jest.Mock).mockReturnValue({
                values: jest.fn().mockReturnValue({
                    returning: jest.fn().mockResolvedValue([{
                        device_id: DEVICE_TENANT_A,
                        tenant_id: TENANT_A_ID,
                        management_ip: '192.168.1.1',
                    }]),
                }),
            });

            const request = mockRequest('http://localhost:3000/api/firewall/devices', 'POST', {
                managementIp: '192.168.1.1',
                apiUsername: 'admin',
                apiPassword: 'password',
            });

            const response = await postDevices(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
        });

        it('should prevent analyst from deleting devices', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_ANALYST_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.ANALYST,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            const request = mockRequest(
                `http://localhost:3000/api/firewall/devices/${DEVICE_TENANT_A}`,
                'DELETE'
            );

            const response = await deleteDevice(request, { params: { id: DEVICE_TENANT_A } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INSUFFICIENT_PERMISSIONS');
        });

        it('should prevent analyst from updating devices', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_ANALYST_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.ANALYST,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            const request = mockRequest(
                `http://localhost:3000/api/firewall/devices/${DEVICE_TENANT_A}`,
                'PUT',
                { model: 'TZ500' }
            );

            const response = await putDevice(request, { params: { id: DEVICE_TENANT_A } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INSUFFICIENT_PERMISSIONS');
        });

        it('should allow analyst to view devices (read-only)', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_ANALYST_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.ANALYST,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            const mockDevices = [
                { device_id: DEVICE_TENANT_A, tenant_id: TENANT_A_ID, model: 'TZ400' },
            ];

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue(mockDevices),
                }),
            });

            const request = mockRequest('http://localhost:3000/api/firewall/devices');
            const response = await getDevices(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(1);
        });
    });

    describe('Tenant Isolation - Alert Access', () => {
        it('should only return alerts for user tenant', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_ADMIN_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.TENANT_ADMIN,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            const mockAlerts = [
                {
                    alert_id: 'alert-1',
                    tenant_id: TENANT_A_ID,
                    device_id: DEVICE_TENANT_A,
                    severity: 'high',
                },
            ];

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue({
                                offset: jest.fn().mockResolvedValue(mockAlerts),
                            }),
                        }),
                    }),
                }),
            });

            const request = mockRequest('http://localhost:3000/api/firewall/alerts');
            const response = await getAlerts(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.every((alert: any) => alert.tenant_id === TENANT_A_ID)).toBe(true);
        });

        it('should prevent acknowledging alerts from another tenant', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_ADMIN_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.TENANT_ADMIN,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            // Alert belongs to Tenant B
            const mockAlert = {
                alert_id: 'alert-b-1',
                tenant_id: TENANT_B_ID,
                device_id: DEVICE_TENANT_B,
            };

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([mockAlert]),
                }),
            });

            const request = mockRequest(
                'http://localhost:3000/api/firewall/alerts/alert-b-1/acknowledge',
                'PUT'
            );

            const response = await acknowledgeAlert(request, { params: { id: 'alert-b-1' } });
            const data = await response.json();

            expect([403, 404]).toContain(response.status);
            expect(data.success).toBe(false);
        });
    });

    describe('Tenant Isolation - Metrics and Health Data', () => {
        it('should prevent accessing metrics from another tenant device', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_ADMIN_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.TENANT_ADMIN,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            // Device belongs to Tenant B
            const mockDevice = {
                device_id: DEVICE_TENANT_B,
                tenant_id: TENANT_B_ID,
            };

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([mockDevice]),
                }),
            });

            const request = mockRequest(`http://localhost:3000/api/firewall/metrics/${DEVICE_TENANT_B}`);
            const response = await getMetrics(request, { params: { deviceId: DEVICE_TENANT_B } });
            const data = await response.json();

            expect([403, 404]).toContain(response.status);
            expect(data.success).toBe(false);
        });

        it('should prevent accessing health snapshots from another tenant device', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_ANALYST_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.ANALYST,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            // Device belongs to Tenant B
            const mockDevice = {
                device_id: DEVICE_TENANT_B,
                tenant_id: TENANT_B_ID,
            };

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([mockDevice]),
                }),
            });

            const request = mockRequest(`http://localhost:3000/api/firewall/health/${DEVICE_TENANT_B}`);
            const response = await getHealth(request, { params: { deviceId: DEVICE_TENANT_B } });
            const data = await response.json();

            expect([403, 404]).toContain(response.status);
            expect(data.success).toBe(false);
        });

        it('should prevent accessing licenses from another tenant device', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_ANALYST_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.ANALYST,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            // Device belongs to Tenant B
            const mockDevice = {
                device_id: DEVICE_TENANT_B,
                tenant_id: TENANT_B_ID,
            };

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([mockDevice]),
                }),
            });

            const request = mockRequest(`http://localhost:3000/api/firewall/licenses/${DEVICE_TENANT_B}`);
            const response = await getLicenses(request, { params: { deviceId: DEVICE_TENANT_B } });
            const data = await response.json();

            expect([403, 404]).toContain(response.status);
            expect(data.success).toBe(false);
        });
    });

    describe('Tenant Isolation - Configuration Risks', () => {
        it('should prevent accessing config risks from another tenant device', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_ADMIN_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.TENANT_ADMIN,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            // Device belongs to Tenant B
            const mockDevice = {
                device_id: DEVICE_TENANT_B,
                tenant_id: TENANT_B_ID,
            };

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([mockDevice]),
                }),
            });

            const request = mockRequest(`http://localhost:3000/api/firewall/config/risks/${DEVICE_TENANT_B}`);
            const response = await getConfigRisks(request, { params: { deviceId: DEVICE_TENANT_B } });
            const data = await response.json();

            expect([403, 404]).toContain(response.status);
            expect(data.success).toBe(false);
        });
    });

    describe('Comprehensive Tenant Isolation Verification', () => {
        it('should enforce tenant isolation across all read endpoints', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_ANALYST_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.ANALYST,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            // Mock device from different tenant
            const mockDevice = {
                device_id: DEVICE_TENANT_B,
                tenant_id: TENANT_B_ID,
            };

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([mockDevice]),
                }),
            });

            const endpoints = [
                { handler: getDevice, url: `http://localhost:3000/api/firewall/devices/${DEVICE_TENANT_B}`, params: { params: { id: DEVICE_TENANT_B } } },
                { handler: getPosture, url: `http://localhost:3000/api/firewall/posture/${DEVICE_TENANT_B}`, params: { params: { deviceId: DEVICE_TENANT_B } } },
                { handler: getHealth, url: `http://localhost:3000/api/firewall/health/${DEVICE_TENANT_B}`, params: { params: { deviceId: DEVICE_TENANT_B } } },
                { handler: getLicenses, url: `http://localhost:3000/api/firewall/licenses/${DEVICE_TENANT_B}`, params: { params: { deviceId: DEVICE_TENANT_B } } },
                { handler: getConfigRisks, url: `http://localhost:3000/api/firewall/config/risks/${DEVICE_TENANT_B}`, params: { params: { deviceId: DEVICE_TENANT_B } } },
                { handler: getMetrics, url: `http://localhost:3000/api/firewall/metrics/${DEVICE_TENANT_B}`, params: { params: { deviceId: DEVICE_TENANT_B } } },
            ];

            for (const endpoint of endpoints) {
                const request = mockRequest(endpoint.url);
                const response = await endpoint.handler(request, endpoint.params as any);
                const data = await response.json();

                // All should deny access to cross-tenant resources
                expect([403, 404]).toContain(response.status);
                expect(data.success).toBe(false);
            }
        });
    });

    describe('Error Response Consistency', () => {
        it('should return consistent error format for authentication failures', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: false,
                error: 'Authentication required',
            });

            const request = mockRequest('http://localhost:3000/api/firewall/devices');
            const response = await getDevices(request);
            const data = await response.json();

            expect(data).toHaveProperty('success');
            expect(data).toHaveProperty('error');
            expect(data.error).toHaveProperty('code');
            expect(data.error).toHaveProperty('message');
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should return consistent error format for authorization failures', async () => {
            (authMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                user: {
                    user_id: USER_ANALYST_TENANT_A,
                    tenant_id: TENANT_A_ID,
                    role: UserRole.ANALYST,
                },
            });

            (tenantMiddleware as jest.Mock).mockResolvedValue({
                success: true,
                tenant: { id: TENANT_A_ID },
            });

            const request = mockRequest(
                `http://localhost:3000/api/firewall/devices/${DEVICE_TENANT_A}`,
                'DELETE'
            );

            const response = await deleteDevice(request, { params: { id: DEVICE_TENANT_A } });
            const data = await response.json();

            expect(data).toHaveProperty('success');
            expect(data).toHaveProperty('error');
            expect(data.error).toHaveProperty('code');
            expect(data.error).toHaveProperty('message');
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INSUFFICIENT_PERMISSIONS');
        });
    });
});
