/**
 * Integration Tests for Posture, Health, and License Query Endpoints
 * 
 * Requirements: 15.6 - Posture and Health API
 * Tests the integration between posture, health, and license endpoints
 * to ensure they work cohesively for complete device monitoring
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
import { GET as getPosture } from '../posture/[deviceId]/route';
import { GET as getHealth } from '../health/[deviceId]/route';
import { GET as getLicenses } from '../licenses/[deviceId]/route';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';

const mockAuthMiddleware = authMiddleware as jest.MockedFunction<typeof authMiddleware>;
const mockTenantMiddleware = tenantMiddleware as jest.MockedFunction<typeof tenantMiddleware>;

describe('Posture, Health, and License Integration Tests', () => {
    const mockDeviceId = '550e8400-e29b-41d4-a716-446655440000';
    const mockTenantId = 'tenant-123';
    const mockUserId = 'user-123';

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
        apiUsername: 'admin',
        apiPasswordEncrypted: 'encrypted',
        uptimeSeconds: BigInt(86400),
        lastSeenAt: new Date('2024-01-15T12:00:00Z'),
        status: 'active',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-15T12:00:00Z'),
    };

    const mockPosture = {
        id: 'posture-1',
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
        timestamp: new Date('2024-01-15T12:00:00Z'),
    };

    const mockHealthSnapshots = [
        {
            id: 'snapshot-1',
            deviceId: mockDeviceId,
            cpuPercent: 45.5,
            ramPercent: 60.2,
            uptimeSeconds: BigInt(86400),
            wanStatus: 'up',
            vpnStatus: 'up',
            interfaceStatus: { X0: 'up', X1: 'up' },
            wifiStatus: 'on',
            haStatus: 'active',
            timestamp: new Date('2024-01-15T12:00:00Z'),
        },
        {
            id: 'snapshot-2',
            deviceId: mockDeviceId,
            cpuPercent: 42.1,
            ramPercent: 58.7,
            uptimeSeconds: BigInt(82800),
            wanStatus: 'up',
            vpnStatus: 'up',
            interfaceStatus: { X0: 'up', X1: 'up' },
            wifiStatus: 'on',
            haStatus: 'active',
            timestamp: new Date('2024-01-15T08:00:00Z'),
        },
    ];

    const mockLicense = {
        id: 'license-1',
        deviceId: mockDeviceId,
        ipsExpiry: '2024-12-31',
        gavExpiry: '2024-11-15',
        atpExpiry: '2025-06-30',
        appControlExpiry: '2024-10-01',
        contentFilterExpiry: '2025-03-15',
        supportExpiry: '2024-12-31',
        licenseWarnings: ['GAV expiring in 15 days'],
        timestamp: new Date('2024-01-15T12:00:00Z'),
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

    describe('Complete Device Monitoring Workflow', () => {
        it('should retrieve posture, health, and license data for a device', async () => {
            // Setup mocks for posture query
            const mockPostureDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };
            const mockPostureQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockPosture]),
            };

            // Setup mocks for health query
            const mockHealthDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };
            const mockHealthQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue(mockHealthSnapshots),
            };

            // Setup mocks for license query
            const mockLicenseDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };
            const mockLicenseQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockLicense]),
            };

            // Get posture
            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockPostureDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockPostureQuery) });

            const postureRequest = new NextRequest(`http://localhost:3000/api/firewall/posture/${mockDeviceId}`);
            const postureResponse = await getPosture(postureRequest, { params: { deviceId: mockDeviceId } });
            const postureData = await postureResponse.json();

            // Get health
            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockHealthDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockHealthQuery) });

            const healthRequest = new NextRequest(`http://localhost:3000/api/firewall/health/${mockDeviceId}`);
            const healthResponse = await getHealth(healthRequest, { params: { deviceId: mockDeviceId } });
            const healthData = await healthResponse.json();

            // Get licenses
            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockLicenseDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockLicenseQuery) });

            const licenseRequest = new NextRequest(`http://localhost:3000/api/firewall/licenses/${mockDeviceId}`);
            const licenseResponse = await getLicenses(licenseRequest, { params: { deviceId: mockDeviceId } });
            const licenseData = await licenseResponse.json();

            // Verify all responses are successful
            expect(postureResponse.status).toBe(200);
            expect(healthResponse.status).toBe(200);
            expect(licenseResponse.status).toBe(200);

            // Verify posture data
            expect(postureData.success).toBe(true);
            expect(postureData.data.deviceId).toBe(mockDeviceId);
            expect(postureData.data.ipsEnabled).toBe(true);
            expect(postureData.data.gavEnabled).toBe(true);

            // Verify health data
            expect(healthData.success).toBe(true);
            expect(healthData.data.deviceId).toBe(mockDeviceId);
            expect(healthData.data.snapshots).toHaveLength(2);
            expect(healthData.data.snapshots[0].cpuPercent).toBe(45.5);

            // Verify license data
            expect(licenseData.success).toBe(true);
            expect(licenseData.data.deviceId).toBe(mockDeviceId);
            expect(licenseData.data.ipsExpiry).toBe('2024-12-31');
            expect(licenseData.data.licenseWarnings).toEqual(['GAV expiring in 15 days']);
        });

        it('should correlate security feature status across posture and license data', async () => {
            // Setup mocks
            const mockPostureDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };
            const mockPostureQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockPosture]),
            };
            const mockLicenseDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };
            const mockLicenseQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockLicense]),
            };

            // Get posture
            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockPostureDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockPostureQuery) });

            const postureRequest = new NextRequest(`http://localhost:3000/api/firewall/posture/${mockDeviceId}`);
            const postureResponse = await getPosture(postureRequest, { params: { deviceId: mockDeviceId } });
            const postureData = await postureResponse.json();

            // Get licenses
            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockLicenseDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockLicenseQuery) });

            const licenseRequest = new NextRequest(`http://localhost:3000/api/firewall/licenses/${mockDeviceId}`);
            const licenseResponse = await getLicenses(licenseRequest, { params: { deviceId: mockDeviceId } });
            const licenseData = await licenseResponse.json();

            // Verify IPS is enabled and has valid license
            expect(postureData.data.ipsEnabled).toBe(true);
            expect(postureData.data.ipsLicenseStatus).toBe('active');
            expect(licenseData.data.ipsExpiry).toBeDefined();

            // Verify GAV is enabled and has valid license
            expect(postureData.data.gavEnabled).toBe(true);
            expect(postureData.data.gavLicenseStatus).toBe('active');
            expect(licenseData.data.gavExpiry).toBeDefined();

            // Verify ATP is enabled and has valid license
            expect(postureData.data.atpEnabled).toBe(true);
            expect(postureData.data.atpLicenseStatus).toBe('active');
            expect(licenseData.data.atpExpiry).toBeDefined();
        });

        it('should handle device with no health snapshots but valid posture and license', async () => {
            // Setup mocks
            const mockPostureDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };
            const mockPostureQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockPosture]),
            };
            const mockHealthDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };
            const mockHealthQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]), // No snapshots
            };
            const mockLicenseDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };
            const mockLicenseQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockLicense]),
            };

            // Get posture
            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockPostureDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockPostureQuery) });

            const postureRequest = new NextRequest(`http://localhost:3000/api/firewall/posture/${mockDeviceId}`);
            const postureResponse = await getPosture(postureRequest, { params: { deviceId: mockDeviceId } });
            const postureData = await postureResponse.json();

            // Get health (should return empty array)
            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockHealthDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockHealthQuery) });

            const healthRequest = new NextRequest(`http://localhost:3000/api/firewall/health/${mockDeviceId}`);
            const healthResponse = await getHealth(healthRequest, { params: { deviceId: mockDeviceId } });
            const healthData = await healthResponse.json();

            // Get licenses
            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockLicenseDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockLicenseQuery) });

            const licenseRequest = new NextRequest(`http://localhost:3000/api/firewall/licenses/${mockDeviceId}`);
            const licenseResponse = await getLicenses(licenseRequest, { params: { deviceId: mockDeviceId } });
            const licenseData = await licenseResponse.json();

            // Verify posture and license are successful
            expect(postureResponse.status).toBe(200);
            expect(postureData.success).toBe(true);
            expect(licenseResponse.status).toBe(200);
            expect(licenseData.success).toBe(true);

            // Verify health returns empty array (not error)
            expect(healthResponse.status).toBe(200);
            expect(healthData.success).toBe(true);
            expect(healthData.data.snapshots).toHaveLength(0);
        });
    });

    describe('Tenant Isolation Across All Endpoints', () => {
        it('should enforce tenant isolation consistently across posture, health, and license endpoints', async () => {
            const otherTenantDevice = { ...mockDevice, tenantId: 'other-tenant-id' };

            // Mock device queries to return device from different tenant
            const mockDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([otherTenantDevice]),
            };

            // Test posture endpoint
            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue(mockDeviceQuery),
            });

            const postureRequest = new NextRequest(`http://localhost:3000/api/firewall/posture/${mockDeviceId}`);
            const postureResponse = await getPosture(postureRequest, { params: { deviceId: mockDeviceId } });
            const postureData = await postureResponse.json();

            expect(postureResponse.status).toBe(403);
            expect(postureData.error.code).toBe('FORBIDDEN');

            // Test health endpoint
            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue(mockDeviceQuery),
            });

            const healthRequest = new NextRequest(`http://localhost:3000/api/firewall/health/${mockDeviceId}`);
            const healthResponse = await getHealth(healthRequest, { params: { deviceId: mockDeviceId } });
            const healthData = await healthResponse.json();

            expect(healthResponse.status).toBe(403);
            expect(healthData.error.code).toBe('FORBIDDEN');

            // Test license endpoint
            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue(mockDeviceQuery),
            });

            const licenseRequest = new NextRequest(`http://localhost:3000/api/firewall/licenses/${mockDeviceId}`);
            const licenseResponse = await getLicenses(licenseRequest, { params: { deviceId: mockDeviceId } });
            const licenseData = await licenseResponse.json();

            expect(licenseResponse.status).toBe(403);
            expect(licenseData.error.code).toBe('FORBIDDEN');
        });

        it('should allow super admin to access all endpoints for any tenant', async () => {
            const superAdminUser = {
                ...mockUser,
                role: UserRole.SUPER_ADMIN,
                tenant_id: 'different-tenant-id',
            };

            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: superAdminUser,
            });

            // Setup mocks
            const mockPostureDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };
            const mockPostureQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockPosture]),
            };
            const mockHealthDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };
            const mockHealthQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue(mockHealthSnapshots),
            };
            const mockLicenseDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockDevice]),
            };
            const mockLicenseQuery = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([mockLicense]),
            };

            // Test posture endpoint
            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockPostureDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockPostureQuery) });

            const postureRequest = new NextRequest(`http://localhost:3000/api/firewall/posture/${mockDeviceId}`);
            const postureResponse = await getPosture(postureRequest, { params: { deviceId: mockDeviceId } });

            expect(postureResponse.status).toBe(200);

            // Test health endpoint
            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockHealthDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockHealthQuery) });

            const healthRequest = new NextRequest(`http://localhost:3000/api/firewall/health/${mockDeviceId}`);
            const healthResponse = await getHealth(healthRequest, { params: { deviceId: mockDeviceId } });

            expect(healthResponse.status).toBe(200);

            // Test license endpoint
            (db.select as jest.Mock)
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockLicenseDeviceQuery) })
                .mockReturnValueOnce({ from: jest.fn().mockReturnValue(mockLicenseQuery) });

            const licenseRequest = new NextRequest(`http://localhost:3000/api/firewall/licenses/${mockDeviceId}`);
            const licenseResponse = await getLicenses(licenseRequest, { params: { deviceId: mockDeviceId } });

            expect(licenseResponse.status).toBe(200);
        });
    });

    describe('Error Handling Consistency', () => {
        it('should return consistent 404 errors for non-existent device across all endpoints', async () => {
            const mockDeviceQuery = {
                where: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue([]), // Device not found
            };

            // Test posture endpoint
            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue(mockDeviceQuery),
            });

            const postureRequest = new NextRequest(`http://localhost:3000/api/firewall/posture/${mockDeviceId}`);
            const postureResponse = await getPosture(postureRequest, { params: { deviceId: mockDeviceId } });
            const postureData = await postureResponse.json();

            expect(postureResponse.status).toBe(404);
            expect(postureData.error.code).toBe('NOT_FOUND');
            expect(postureData.error.message).toBe('Device not found');

            // Test health endpoint
            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue(mockDeviceQuery),
            });

            const healthRequest = new NextRequest(`http://localhost:3000/api/firewall/health/${mockDeviceId}`);
            const healthResponse = await getHealth(healthRequest, { params: { deviceId: mockDeviceId } });
            const healthData = await healthResponse.json();

            expect(healthResponse.status).toBe(404);
            expect(healthData.error.code).toBe('NOT_FOUND');
            expect(healthData.error.message).toBe('Device not found');

            // Test license endpoint
            (db.select as jest.Mock).mockReturnValue({
                from: jest.fn().mockReturnValue(mockDeviceQuery),
            });

            const licenseRequest = new NextRequest(`http://localhost:3000/api/firewall/licenses/${mockDeviceId}`);
            const licenseResponse = await getLicenses(licenseRequest, { params: { deviceId: mockDeviceId } });
            const licenseData = await licenseResponse.json();

            expect(licenseResponse.status).toBe(404);
            expect(licenseData.error.code).toBe('NOT_FOUND');
            expect(licenseData.error.message).toBe('Device not found');
        });

        it('should return consistent 400 errors for invalid device ID across all endpoints', async () => {
            const invalidDeviceId = 'invalid-uuid';

            // Test posture endpoint
            const postureRequest = new NextRequest(`http://localhost:3000/api/firewall/posture/${invalidDeviceId}`);
            const postureResponse = await getPosture(postureRequest, { params: { deviceId: invalidDeviceId } });
            const postureData = await postureResponse.json();

            expect(postureResponse.status).toBe(400);
            expect(postureData.error.code).toBe('INVALID_ID');

            // Test health endpoint
            const healthRequest = new NextRequest(`http://localhost:3000/api/firewall/health/${invalidDeviceId}`);
            const healthResponse = await getHealth(healthRequest, { params: { deviceId: invalidDeviceId } });
            const healthData = await healthResponse.json();

            expect(healthResponse.status).toBe(400);
            expect(healthData.error.code).toBe('INVALID_ID');

            // Test license endpoint
            const licenseRequest = new NextRequest(`http://localhost:3000/api/firewall/licenses/${invalidDeviceId}`);
            const licenseResponse = await getLicenses(licenseRequest, { params: { deviceId: invalidDeviceId } });
            const licenseData = await licenseResponse.json();

            expect(licenseResponse.status).toBe(400);
            expect(licenseData.error.code).toBe('INVALID_ID');
        });
    });
});
