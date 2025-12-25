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
    firewallSecurityPosture,
} from '../../../../../../../database/schemas/firewall';
import { eq, and, desc } from 'drizzle-orm';

const mockAuthMiddleware = authMiddleware as jest.MockedFunction<typeof authMiddleware>;
const mockTenantMiddleware = tenantMiddleware as jest.MockedFunction<typeof tenantMiddleware>;

describe('GET /api/firewall/posture/:deviceId', () => {
    const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        tenant_id: '550e8400-e29b-41d4-a716-446655440001',
        role: 'tenant_admin' as UserRole,
        email: 'admin@test.com',
    };

    const mockTenant = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Tenant',
    };

    const validDeviceId = '550e8400-e29b-41d4-a716-446655440000';

    const mockDevice = {
        id: validDeviceId,
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        model: 'TZ-400',
        firmwareVersion: '7.0.1',
        serialNumber: 'SN123456',
        managementIp: '192.168.1.1',
        apiUsername: 'admin',
        apiPasswordEncrypted: 'encrypted',
        uptimeSeconds: BigInt(86400),
        lastSeenAt: new Date(),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockPosture = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        deviceId: validDeviceId,
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

    describe('Authentication and Authorization', () => {
        it('should return 401 if authentication fails', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: false,
                error: 'Invalid token',
            });

            const request = new NextRequest('http://localhost/api/firewall/posture/device-123');
            const response = await GET(request, { params: { deviceId: 'device-123' } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 403 if tenant validation fails', async () => {
            mockTenantMiddleware.mockResolvedValue({
                success: false,
                error: { message: 'Invalid tenant' },
            });

            const request = new NextRequest('http://localhost/api/firewall/posture/device-123');
            const response = await GET(request, { params: { deviceId: 'device-123' } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });

        it('should return 503 if database is not available', async () => {
            // Mock the database module to return null
            jest.doMock('@/lib/database', () => ({
                db: null,
            }));

            // Re-import the route handler with the mocked database
            jest.resetModules();
            const { GET: GET_WITH_NULL_DB } = await import('../route');

            const request = new NextRequest('http://localhost/api/firewall/posture/device-123');
            const response = await GET_WITH_NULL_DB(request, { params: { deviceId: 'device-123' } });
            const data = await response.json();

            expect(response.status).toBe(503);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('DATABASE_ERROR');

            // Restore the original mock
            jest.resetModules();
        });
    });

    describe('Input Validation', () => {
        it('should return 400 for invalid device ID format', async () => {
            const request = new NextRequest('http://localhost/api/firewall/posture/invalid-id');
            const response = await GET(request, { params: { deviceId: 'invalid-id' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INVALID_ID');
            expect(data.error.message).toContain('Invalid device ID format');
        });

        it('should accept valid UUID format', async () => {
            const validUuid = '550e8400-e29b-41d4-a716-446655440000';

            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([mockDevice]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const mockPostureSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([mockPosture]),
                        }),
                    }),
                }),
            });
            (db.select as jest.Mock) = jest.fn()
                .mockReturnValueOnce(mockSelect())
                .mockReturnValueOnce(mockPostureSelect());

            const request = new NextRequest(`http://localhost/api/firewall/posture/${validUuid}`);
            const response = await GET(request, { params: { deviceId: validUuid } });

            expect(response.status).not.toBe(400);
        });
    });

    describe('Device Validation', () => {
        it('should return 404 if device does not exist', async () => {
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(`http://localhost/api/firewall/posture/${validDeviceId}`);
            const response = await GET(request, { params: { deviceId: validDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBe('Device not found');
        });

        it('should return 403 if device belongs to different tenant', async () => {
            const otherTenantDevice = { ...mockDevice, tenantId: '550e8400-e29b-41d4-a716-446655440099' };

            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([otherTenantDevice]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(`http://localhost/api/firewall/posture/${validDeviceId}`);
            const response = await GET(request, { params: { deviceId: validDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');
            expect(data.error.message).toBe('Access denied. Device belongs to another tenant');
        });

        it('should allow super admin to access devices from any tenant', async () => {
            const superAdminUser = { ...mockUser, role: UserRole.SUPER_ADMIN };
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: superAdminUser,
            });

            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([mockDevice]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const mockPostureSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([mockPosture]),
                        }),
                    }),
                }),
            });
            (db.select as jest.Mock) = jest.fn()
                .mockReturnValueOnce(mockSelect())
                .mockReturnValueOnce(mockPostureSelect());

            const request = new NextRequest(`http://localhost/api/firewall/posture/${validDeviceId}`);
            const response = await GET(request, { params: { deviceId: validDeviceId } });

            expect(response.status).toBe(200);
        });
    });

    describe('Posture Data Retrieval', () => {
        it('should return 404 if no posture data exists for device', async () => {
            const mockDeviceSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([mockDevice]),
                    }),
                }),
            });

            const mockPostureSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([]),
                        }),
                    }),
                }),
            });

            (db.select as jest.Mock) = jest.fn()
                .mockReturnValueOnce(mockDeviceSelect())
                .mockReturnValueOnce(mockPostureSelect());

            const request = new NextRequest(`http://localhost/api/firewall/posture/${validDeviceId}`);
            const response = await GET(request, { params: { deviceId: validDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toBe('No security posture data found for this device');
        });

        it('should return latest security posture successfully', async () => {
            const mockDeviceSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([mockDevice]),
                    }),
                }),
            });

            const mockPostureSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([mockPosture]),
                        }),
                    }),
                }),
            });

            (db.select as jest.Mock) = jest.fn()
                .mockReturnValueOnce(mockDeviceSelect())
                .mockReturnValueOnce(mockPostureSelect());

            const request = new NextRequest(`http://localhost/api/firewall/posture/${validDeviceId}`);
            const response = await GET(request, { params: { deviceId: validDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toBeDefined();
            expect(data.data.id).toBe(mockPosture.id);
            expect(data.data.deviceId).toBe(mockPosture.deviceId);
        });

        it('should include all security feature states in response', async () => {
            const mockDeviceSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([mockDevice]),
                    }),
                }),
            });

            const mockPostureSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([mockPosture]),
                        }),
                    }),
                }),
            });

            (db.select as jest.Mock) = jest.fn()
                .mockReturnValueOnce(mockDeviceSelect())
                .mockReturnValueOnce(mockPostureSelect());

            const request = new NextRequest(`http://localhost/api/firewall/posture/${validDeviceId}`);
            const response = await GET(request, { params: { deviceId: validDeviceId } });
            const data = await response.json();

            expect(data.data).toMatchObject({
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
            });
        });

        it('should include timestamp in response', async () => {
            const mockDeviceSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([mockDevice]),
                    }),
                }),
            });

            const mockPostureSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([mockPosture]),
                        }),
                    }),
                }),
            });

            (db.select as jest.Mock) = jest.fn()
                .mockReturnValueOnce(mockDeviceSelect())
                .mockReturnValueOnce(mockPostureSelect());

            const request = new NextRequest(`http://localhost/api/firewall/posture/${validDeviceId}`);
            const response = await GET(request, { params: { deviceId: validDeviceId } });
            const data = await response.json();

            expect(data.data.timestamp).toBeDefined();
            // Timestamp is serialized as ISO string in JSON response
            expect(new Date(data.data.timestamp)).toEqual(mockPosture.timestamp);
        });
    });

    describe('Error Handling', () => {
        it('should return 500 if database query fails', async () => {
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockRejectedValue(new Error('Database error')),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(`http://localhost/api/firewall/posture/${validDeviceId}`);
            const response = await GET(request, { params: { deviceId: validDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
        });

        it('should handle unexpected errors gracefully', async () => {
            mockAuthMiddleware.mockRejectedValue(new Error('Unexpected error'));

            const request = new NextRequest('http://localhost/api/firewall/posture/device-123');
            const response = await GET(request, { params: { deviceId: 'device-123' } });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
        });
    });

    describe('Tenant Isolation', () => {
        it('should enforce tenant isolation for regular users', async () => {
            const mockSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });
            (db.select as jest.Mock) = mockSelect;

            const request = new NextRequest(`http://localhost/api/firewall/posture/${validDeviceId}`);
            const response = await GET(request, { params: { deviceId: validDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.error.message).toBe('Device not found');
        });

        it('should not enforce tenant isolation for super admins', async () => {
            const superAdminUser = { ...mockUser, role: UserRole.SUPER_ADMIN };
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: superAdminUser,
            });

            const mockDeviceSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([mockDevice]),
                    }),
                }),
            });

            const mockPostureSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockResolvedValue([mockPosture]),
                        }),
                    }),
                }),
            });

            (db.select as jest.Mock) = jest.fn()
                .mockReturnValueOnce(mockDeviceSelect())
                .mockReturnValueOnce(mockPostureSelect());

            const request = new NextRequest(`http://localhost/api/firewall/posture/${validDeviceId}`);
            const response = await GET(request, { params: { deviceId: validDeviceId } });

            expect(response.status).toBe(200);
        });
    });
});
