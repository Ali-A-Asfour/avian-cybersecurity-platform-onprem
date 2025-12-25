/**
 * Tests for GET /api/firewall/config/risks/:deviceId
 * 
 * Requirements: 15.5 - Configuration API
 * - Test risk retrieval for a device
 * - Test severity filtering
 * - Test tenant isolation
 * - Test authentication and authorization
 * - Test error handling
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
        insert: jest.fn(),
        delete: jest.fn(),
    },
}));

// Mock the risk storage functions
jest.mock('@/lib/firewall-risk-storage', () => ({
    getRisksByDevice: jest.fn(),
    getRisksByDeviceAndSeverity: jest.fn(),
    countRisksBySeverity: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { db } from '@/lib/database';
import { firewallDevices, firewallConfigRisks } from '@/../database/schemas/firewall';
import { eq } from 'drizzle-orm';

import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { getRisksByDevice, getRisksByDeviceAndSeverity, countRisksBySeverity } from '@/lib/firewall-risk-storage';

const mockAuthMiddleware = authMiddleware as jest.MockedFunction<typeof authMiddleware>;
const mockTenantMiddleware = tenantMiddleware as jest.MockedFunction<typeof tenantMiddleware>;
const mockGetRisksByDevice = getRisksByDevice as jest.MockedFunction<typeof getRisksByDevice>;
const mockGetRisksByDeviceAndSeverity = getRisksByDeviceAndSeverity as jest.MockedFunction<typeof getRisksByDeviceAndSeverity>;
const mockCountRisksBySeverity = countRisksBySeverity as jest.MockedFunction<typeof countRisksBySeverity>;

describe('GET /api/firewall/config/risks/:deviceId', () => {
    const mockDeviceId = '123e4567-e89b-12d3-a456-426614174000';
    const mockTenantId = '987e6543-e21b-12d3-a456-426614174999';
    const mockUserId = '111e2222-e33b-44d5-a666-777777777777';

    const mockUser = {
        id: mockUserId,
        tenant_id: mockTenantId,
        role: UserRole.TENANT_ADMIN,
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
        firmwareVersion: '7.0.1-5050',
        serialNumber: 'ABC123456',
        managementIp: '192.168.1.1',
        apiUsername: 'admin',
        apiPasswordEncrypted: 'encrypted',
        uptimeSeconds: 86400,
        lastSeenAt: new Date(),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockRisks = [
        {
            id: 'risk-1',
            deviceId: mockDeviceId,
            snapshotId: null,
            riskCategory: 'exposure_risk',
            riskType: 'WAN_MANAGEMENT_ENABLED',
            severity: 'critical',
            description: 'WAN management access enabled',
            remediation: 'Disable WAN management',
            detectedAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
            id: 'risk-2',
            deviceId: mockDeviceId,
            snapshotId: null,
            riskCategory: 'security_feature_disabled',
            riskType: 'IPS_DISABLED',
            severity: 'critical',
            description: 'IPS is disabled',
            remediation: 'Enable IPS',
            detectedAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
            id: 'risk-3',
            deviceId: mockDeviceId,
            snapshotId: null,
            riskCategory: 'best_practice_violation',
            riskType: 'ADMIN_NO_MFA',
            severity: 'high',
            description: 'MFA not enabled',
            remediation: 'Enable MFA',
            detectedAt: new Date('2024-01-01T10:00:00Z'),
        },
    ];

    const mockRiskCounts = {
        critical: 2,
        high: 1,
        medium: 0,
        low: 0,
        total: 3,
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default successful auth
        mockAuthMiddleware.mockResolvedValue({
            success: true,
            user: mockUser,
        });

        // Setup default successful tenant validation
        mockTenantMiddleware.mockResolvedValue({
            success: true,
            tenant: mockTenant,
        });

        // Setup default database mock
        (db.select as jest.Mock).mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue([mockDevice]),
                }),
            }),
        });

        // Setup default risk storage mocks
        mockGetRisksByDevice.mockResolvedValue(mockRisks as any);
        mockCountRisksBySeverity.mockResolvedValue(mockRiskCounts);
    });

    describe('Authentication and Authorization', () => {
        it('should return 401 if user is not authenticated', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: false,
                error: 'Authentication required',
            });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}`
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
                `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });

        it('should return 403 if user tries to access device from another tenant', async () => {
            const differentTenantDevice = {
                ...mockDevice,
                tenantId: 'different-tenant-id',
            };

            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([differentTenantDevice]),
                    }),
                }),
            });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');
            expect(data.error.message).toContain('another tenant');
        });

        it('should allow super admin to access device from any tenant', async () => {
            const superAdminUser = {
                ...mockUser,
                role: UserRole.SUPER_ADMIN,
                tenant_id: 'different-tenant-id',
            };

            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: superAdminUser,
            });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });
    });

    describe('Input Validation', () => {
        it('should return 400 if deviceId is empty', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/firewall/config/risks/'
            );

            const response = await GET(request, { params: { deviceId: '' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Device ID is required');
        });

        it('should return 400 if severity parameter is invalid', async () => {
            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}?severity=invalid`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid severity parameter');
        });

        it('should accept valid severity parameters', async () => {
            const validSeverities = ['critical', 'high', 'medium', 'low'];

            for (const severity of validSeverities) {
                mockGetRisksByDeviceAndSeverity.mockResolvedValue(
                    mockRisks.filter(r => r.severity === severity) as any
                );

                const request = new NextRequest(
                    `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}?severity=${severity}`
                );

                const response = await GET(request, { params: { deviceId: mockDeviceId } });
                const data = await response.json();

                expect(response.status).toBe(200);
                expect(data.success).toBe(true);
            }
        });
    });

    describe('Device Validation', () => {
        it('should return 404 if device does not exist', async () => {
            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([]),
                    }),
                }),
            });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(data.error.message).toContain('device not found');
        });
    });

    describe('Risk Retrieval', () => {
        it('should retrieve all risks for a device without filters', async () => {
            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.deviceId).toBe(mockDeviceId);
            expect(data.data.risks).toHaveLength(3);
            expect(data.data.riskCounts).toEqual(mockRiskCounts);
            expect(mockGetRisksByDevice).toHaveBeenCalledWith(mockDeviceId);
        });

        it('should filter risks by severity when parameter is provided', async () => {
            const criticalRisks = mockRisks.filter(r => r.severity === 'critical');
            mockGetRisksByDeviceAndSeverity.mockResolvedValue(criticalRisks as any);

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}?severity=critical`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.risks).toHaveLength(2);
            expect(data.data.risks.every((r: any) => r.severity === 'critical')).toBe(true);
            expect(mockGetRisksByDeviceAndSeverity).toHaveBeenCalledWith(mockDeviceId, 'critical');
        });

        it('should return empty array if no risks exist for device', async () => {
            mockGetRisksByDevice.mockResolvedValue([]);
            mockCountRisksBySeverity.mockResolvedValue({
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                total: 0,
            });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.risks).toHaveLength(0);
            expect(data.data.riskCounts.total).toBe(0);
        });

        it('should include device information in response', async () => {
            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.device).toEqual({
                id: mockDevice.id,
                model: mockDevice.model,
                firmwareVersion: mockDevice.firmwareVersion,
                serialNumber: mockDevice.serialNumber,
                managementIp: mockDevice.managementIp,
            });
        });

        it('should include risk details in response', async () => {
            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            const risk = data.data.risks[0];
            expect(risk).toHaveProperty('riskId');
            expect(risk).toHaveProperty('riskCategory');
            expect(risk).toHaveProperty('riskType');
            expect(risk).toHaveProperty('severity');
            expect(risk).toHaveProperty('description');
            expect(risk).toHaveProperty('remediation');
            expect(risk).toHaveProperty('detectedAt');
            expect(risk).toHaveProperty('snapshotId');
        });
    });

    describe('Error Handling', () => {
        it('should return 500 if database query fails', async () => {
            mockGetRisksByDevice.mockRejectedValue(new Error('Database error'));

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('QUERY_ERROR');
        });

        it('should continue without counts if countRisksBySeverity fails', async () => {
            mockCountRisksBySeverity.mockRejectedValue(new Error('Count error'));

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.riskCounts).toEqual({
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                total: 0,
            });
        });

        it('should return 503 if database connection is not available', async () => {
            // Mock the db module to return null
            jest.resetModules();
            jest.doMock('@/lib/database', () => ({
                db: null,
            }));

            // Re-import the route handler with the mocked db
            const { GET: GET_WITH_NULL_DB } = await import('../route');

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}`
            );

            const response = await GET_WITH_NULL_DB(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(503);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('DATABASE_ERROR');

            // Restore the original mock
            jest.resetModules();
        });

        it('should handle unexpected errors gracefully', async () => {
            mockGetRisksByDevice.mockImplementation(() => {
                throw new Error('Unexpected error');
            });

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
        });
    });

    describe('Response Format', () => {
        it('should include appropriate message for unfiltered results', async () => {
            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.message).toContain('Retrieved 3 risk(s) for device');
        });

        it('should include appropriate message for filtered results', async () => {
            mockGetRisksByDeviceAndSeverity.mockResolvedValue(
                mockRisks.filter(r => r.severity === 'critical') as any
            );

            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}?severity=critical`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.message).toContain('Retrieved 2 critical risk(s) for device');
        });

        it('should include filter information in response', async () => {
            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}?severity=high`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.filters).toEqual({
                severity: 'high',
            });
        });

        it('should set severity filter to null when not provided', async () => {
            const request = new NextRequest(
                `http://localhost:3000/api/firewall/config/risks/${mockDeviceId}`
            );

            const response = await GET(request, { params: { deviceId: mockDeviceId } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.filters.severity).toBeNull();
        });
    });
});
