import { NextRequest } from 'next/server';
import { UserRole } from '@/types';

// Mock ALL dependencies BEFORE any imports
jest.mock('@/lib/database', () => ({
    db: null,
}));
jest.mock('../../../../../../database/schemas/edr', () => ({
    edrDevices: {},
    edrAlerts: {},
    edrVulnerabilities: {},
    edrDeviceVulnerabilities: {},
    edrCompliance: {},
}));
jest.mock('../../../../../../database/schemas/main', () => ({
    tenants: {},
    users: {},
}));
jest.mock('../../../../../../database/schemas/firewall', () => ({
    firewallDevices: {},
}));
jest.mock('drizzle-orm', () => ({
    eq: jest.fn((field, value) => ({ field, value, op: 'eq' })),
    and: jest.fn((...conditions) => ({ conditions, op: 'and' })),
    desc: jest.fn((field) => ({ field, op: 'desc' })),
    relations: jest.fn(),
}));
jest.mock('@/services/auth.service', () => ({
    AuthenticationService: {
        validateSession: jest.fn(),
    },
}));
jest.mock('@/lib/auth', () => ({
    AuthService: {
        verifyAccessToken: jest.fn(),
    },
    RBACService: {},
}));
jest.mock('@/lib/monitoring', () => ({
    monitoring: {
        startSpan: jest.fn(() => ({ spanId: 'test-span' })),
        tagSpan: jest.fn(),
        finishSpan: jest.fn(),
        recordMetric: jest.fn(),
    },
}));
jest.mock('@/lib/logger', () => ({
    logger: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));
jest.mock('@/middleware/auth.middleware');
jest.mock('@/middleware/tenant.middleware');

// Import after mocks
import { GET } from '../route';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';

const mockAuthMiddleware = authMiddleware as jest.MockedFunction<typeof authMiddleware>;
const mockTenantMiddleware = tenantMiddleware as jest.MockedFunction<typeof tenantMiddleware>;

describe('GET /api/edr/devices/:id', () => {
    const mockUser = {
        user_id: 'user-123',
        tenant_id: 'tenant-123',
        role: 'tenant_admin' as const,
        iat: Date.now(),
        exp: Date.now() + 3600000,
    };

    const mockTenant = {
        id: 'tenant-123',
        name: 'Test Tenant',
    };

    const mockDevice = {
        id: 'device-123',
        tenantId: 'tenant-123',
        microsoftDeviceId: 'ms-device-123',
        deviceName: 'DESKTOP-001',
        operatingSystem: 'Windows 11',
        osVersion: '22H2',
        primaryUser: 'john.doe@example.com',
        defenderHealthStatus: 'active',
        riskScore: 25,
        exposureLevel: 'low',
        intuneComplianceState: 'compliant',
        intuneEnrollmentStatus: 'enrolled',
        lastSeenAt: new Date('2024-01-15T10:00:00Z'),
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-15T10:00:00Z'),
    };

    const mockAlerts = [
        {
            id: 'alert-1',
            tenantId: 'tenant-123',
            deviceId: 'device-123',
            microsoftAlertId: 'ms-alert-1',
            severity: 'high',
            threatType: 'malware',
            threatName: 'Trojan.Generic',
            status: 'active',
            description: 'Malware detected',
            detectedAt: new Date('2024-01-15T09:00:00Z'),
            createdAt: new Date('2024-01-15T09:00:00Z'),
            updatedAt: new Date('2024-01-15T09:00:00Z'),
        },
    ];

    const mockVulnerabilities = [
        {
            id: 'vuln-1',
            tenantId: 'tenant-123',
            cveId: 'CVE-2024-0001',
            severity: 'critical',
            cvssScore: 9.8,
            exploitability: 'high',
            description: 'Critical vulnerability',
            detectedAt: new Date('2024-01-14T00:00:00Z'),
            createdAt: new Date('2024-01-14T00:00:00Z'),
            updatedAt: new Date('2024-01-14T00:00:00Z'),
        },
    ];

    const mockCompliance = {
        id: 'compliance-1',
        tenantId: 'tenant-123',
        deviceId: 'device-123',
        complianceState: 'compliant',
        failedRules: [],
        securityBaselineStatus: 'compliant',
        requiredAppsStatus: [],
        checkedAt: new Date('2024-01-15T08:00:00Z'),
        createdAt: new Date('2024-01-15T08:00:00Z'),
        updatedAt: new Date('2024-01-15T08:00:00Z'),
    };

    let mockDb: any;
    let dbModule: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default successful auth and tenant middleware
        mockAuthMiddleware.mockResolvedValue({
            success: true,
            user: mockUser,
        });

        mockTenantMiddleware.mockResolvedValue({
            success: true,
            tenant: mockTenant,
        });

        // Setup mock database
        mockDb = {
            select: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            innerJoin: jest.fn().mockReturnThis(),
        };

        // Mock the db module
        dbModule = require('@/lib/database');
        dbModule.db = mockDb;
    });

    describe('Authentication and Authorization', () => {
        it('should return 401 if authentication fails', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: false,
                error: 'Invalid token',
            });

            const request = new NextRequest('http://localhost:3000/api/edr/devices/device-123');
            const response = await GET(request, { params: { id: 'device-123' } });
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

            const request = new NextRequest('http://localhost:3000/api/edr/devices/device-123');
            const response = await GET(request, { params: { id: 'device-123' } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });

        it('should return 503 if database is not available', async () => {
            dbModule.db = null;

            const request = new NextRequest('http://localhost:3000/api/edr/devices/device-123');
            const response = await GET(request, { params: { id: 'device-123' } });
            const data = await response.json();

            expect(response.status).toBe(503);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('DATABASE_ERROR');
        });
    });

    describe('Input Validation', () => {
        it('should return 400 for invalid UUID format', async () => {
            const request = new NextRequest('http://localhost:3000/api/edr/devices/invalid-id');
            const response = await GET(request, { params: { id: 'invalid-id' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INVALID_ID');
        });
    });

    describe('Device Retrieval', () => {
        it('should return 404 if device not found', async () => {
            mockDb.limit.mockResolvedValueOnce([]);

            const request = new NextRequest('http://localhost:3000/api/edr/devices/00000000-0000-0000-0000-000000000000');
            const response = await GET(request, { params: { id: '00000000-0000-0000-0000-000000000000' } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should return 403 if device belongs to different tenant', async () => {
            const otherTenantDevice = { ...mockDevice, tenantId: 'other-tenant' };
            mockDb.limit.mockResolvedValueOnce([otherTenantDevice]);

            const request = new NextRequest('http://localhost:3000/api/edr/devices/device-123');
            const response = await GET(request, { params: { id: 'device-123' } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');
        });

        it('should allow super admin to access any tenant device', async () => {
            const superAdminUser = { ...mockUser, role: UserRole.SUPER_ADMIN };
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: superAdminUser,
            });

            const otherTenantDevice = { ...mockDevice, tenantId: 'other-tenant' };

            // Mock device query
            mockDb.limit
                .mockResolvedValueOnce([otherTenantDevice]) // Device check
                .mockResolvedValueOnce(mockAlerts) // Alerts
                .mockResolvedValueOnce(mockVulnerabilities) // Vulnerabilities
                .mockResolvedValueOnce([mockCompliance]); // Compliance

            const request = new NextRequest('http://localhost:3000/api/edr/devices/device-123');
            const response = await GET(request, { params: { id: 'device-123' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it('should return device with all related data', async () => {
            // Mock device query
            mockDb.limit
                .mockResolvedValueOnce([mockDevice]) // Device check
                .mockResolvedValueOnce(mockAlerts) // Alerts
                .mockResolvedValueOnce(mockVulnerabilities) // Vulnerabilities
                .mockResolvedValueOnce([mockCompliance]); // Compliance

            const request = new NextRequest('http://localhost:3000/api/edr/devices/device-123');
            const response = await GET(request, { params: { id: 'device-123' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.device).toBeDefined();
            expect(data.data.device.id).toBe('device-123');
            expect(data.data.alerts).toBeDefined();
            expect(data.data.alerts).toHaveLength(1);
            expect(data.data.vulnerabilities).toBeDefined();
            expect(data.data.vulnerabilities).toHaveLength(1);
            expect(data.data.compliance).toBeDefined();
            expect(data.data.availableActions).toBeDefined();
        });

        it('should return null compliance if not found', async () => {
            // Mock device query
            mockDb.limit
                .mockResolvedValueOnce([mockDevice]) // Device check
                .mockResolvedValueOnce(mockAlerts) // Alerts
                .mockResolvedValueOnce(mockVulnerabilities) // Vulnerabilities
                .mockResolvedValueOnce([]); // No compliance

            const request = new NextRequest('http://localhost:3000/api/edr/devices/device-123');
            const response = await GET(request, { params: { id: 'device-123' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.compliance).toBeNull();
        });

        it('should include isolate action for non-isolated device', async () => {
            // Mock device query
            mockDb.limit
                .mockResolvedValueOnce([mockDevice]) // Device check
                .mockResolvedValueOnce([]) // No alerts
                .mockResolvedValueOnce([]) // No vulnerabilities
                .mockResolvedValueOnce([]); // No compliance

            const request = new NextRequest('http://localhost:3000/api/edr/devices/device-123');
            const response = await GET(request, { params: { id: 'device-123' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.availableActions).toContainEqual(
                expect.objectContaining({ type: 'isolate' })
            );
            expect(data.data.availableActions).not.toContainEqual(
                expect.objectContaining({ type: 'unisolate' })
            );
        });

        it('should include unisolate action for isolated device', async () => {
            const isolatedDevice = { ...mockDevice, defenderHealthStatus: 'isolated' };

            // Mock device query
            mockDb.limit
                .mockResolvedValueOnce([isolatedDevice]) // Device check
                .mockResolvedValueOnce([]) // No alerts
                .mockResolvedValueOnce([]) // No vulnerabilities
                .mockResolvedValueOnce([]); // No compliance

            const request = new NextRequest('http://localhost:3000/api/edr/devices/device-123');
            const response = await GET(request, { params: { id: 'device-123' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.availableActions).toContainEqual(
                expect.objectContaining({ type: 'unisolate' })
            );
            expect(data.data.availableActions).not.toContainEqual(
                expect.objectContaining({ type: 'isolate' })
            );
        });

        it('should always include scan action', async () => {
            // Mock device query
            mockDb.limit
                .mockResolvedValueOnce([mockDevice]) // Device check
                .mockResolvedValueOnce([]) // No alerts
                .mockResolvedValueOnce([]) // No vulnerabilities
                .mockResolvedValueOnce([]); // No compliance

            const request = new NextRequest('http://localhost:3000/api/edr/devices/device-123');
            const response = await GET(request, { params: { id: 'device-123' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.availableActions).toContainEqual(
                expect.objectContaining({ type: 'scan' })
            );
        });
    });

    describe('Error Handling', () => {
        it('should return 500 on database error', async () => {
            mockDb.limit.mockRejectedValueOnce(new Error('Database error'));

            const request = new NextRequest('http://localhost:3000/api/edr/devices/device-123');
            const response = await GET(request, { params: { id: 'device-123' } });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
        });
    });
});
