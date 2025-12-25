/**
 * Tests for GET /api/edr/alerts/:id endpoint
 * 
 * Requirements: 2.4, 9.4, 14.5
 * - Retrieve alert by ID
 * - Include device information
 * - Enforce tenant isolation
 */

import { NextRequest } from 'next/server';

// Mock ALL dependencies BEFORE any imports
jest.mock('@/lib/database', () => ({
    db: {
        select: jest.fn(),
    },
}));
jest.mock('../../../../../../database/schemas/edr', () => ({
    edrAlerts: {},
    edrDevices: {},
}));
jest.mock('../../../../../../database/schemas/main', () => ({
    tenants: {},
    users: {},
}));
jest.mock('drizzle-orm', () => ({
    eq: jest.fn(),
    and: jest.fn(),
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

describe('GET /api/edr/alerts/:id', () => {
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

    const mockAlert = {
        id: 'alert-123',
        tenantId: 'tenant-123',
        deviceId: 'device-123',
        microsoftAlertId: 'ms-alert-123',
        severity: 'high',
        threatType: 'malware',
        threatName: 'Trojan.Generic',
        status: 'new',
        description: 'Malware detected on device',
        detectedAt: new Date('2024-01-15T10:00:00Z'),
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T10:00:00Z'),
    };

    const mockDevice = {
        id: 'device-123',
        tenantId: 'tenant-123',
        microsoftDeviceId: 'ms-device-123',
        deviceName: 'DESKTOP-TEST',
        operatingSystem: 'Windows 11',
        osVersion: '22H2',
        primaryUser: 'test@example.com',
        defenderHealthStatus: 'active',
        riskScore: 75,
        exposureLevel: 'high',
        intuneComplianceState: 'compliant',
        intuneEnrollmentStatus: 'enrolled',
        lastSeenAt: new Date('2024-01-15T10:00:00Z'),
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-15T10:00:00Z'),
    };

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
    });

    describe('Authentication and Authorization', () => {
        it('should return 401 when authentication fails', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: false,
                error: 'Invalid token',
            });

            const request = new NextRequest('http://localhost:3000/api/edr/alerts/alert-123');
            const response = await GET(request, { params: { id: 'alert-123' } });
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 403 when tenant validation fails', async () => {
            mockTenantMiddleware.mockResolvedValue({
                success: false,
                error: { message: 'Tenant not found' },
            });

            const request = new NextRequest('http://localhost:3000/api/edr/alerts/alert-123');
            const response = await GET(request, { params: { id: 'alert-123' } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });
    });

    describe('Input Validation', () => {
        it('should return 400 for invalid alert ID format', async () => {
            const request = new NextRequest('http://localhost:3000/api/edr/alerts/invalid-uuid');
            const response = await GET(request, { params: { id: 'invalid-uuid' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Alert ID must be a valid UUID');
        });
    });

    describe('Alert Retrieval', () => {
        it('should return alert with device information', async () => {
            const mockSelect = jest.fn().mockReturnThis();
            const mockFrom = jest.fn().mockReturnThis();
            const mockLeftJoin = jest.fn().mockReturnThis();
            const mockWhere = jest.fn().mockReturnThis();
            const mockLimit = jest.fn().mockResolvedValue([
                {
                    alert: mockAlert,
                    device: mockDevice,
                },
            ]);

            (db.select as jest.Mock).mockReturnValue({
                from: mockFrom,
            });

            mockFrom.mockReturnValue({
                leftJoin: mockLeftJoin,
            });

            mockLeftJoin.mockReturnValue({
                where: mockWhere,
            });

            mockWhere.mockReturnValue({
                limit: mockLimit,
            });

            const request = new NextRequest('http://localhost:3000/api/edr/alerts/alert-123');
            const response = await GET(request, { params: { id: 'alert-123' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.id).toBe('alert-123');
            expect(data.data.severity).toBe('high');
            expect(data.data.device).toBeDefined();
            expect(data.data.device.id).toBe('device-123');
            expect(data.data.device.deviceName).toBe('DESKTOP-TEST');
        });

        it('should return alert without device when device is null', async () => {
            const mockSelect = jest.fn().mockReturnThis();
            const mockFrom = jest.fn().mockReturnThis();
            const mockLeftJoin = jest.fn().mockReturnThis();
            const mockWhere = jest.fn().mockReturnThis();
            const mockLimit = jest.fn().mockResolvedValue([
                {
                    alert: mockAlert,
                    device: null,
                },
            ]);

            (db.select as jest.Mock).mockReturnValue({
                from: mockFrom,
            });

            mockFrom.mockReturnValue({
                leftJoin: mockLeftJoin,
            });

            mockLeftJoin.mockReturnValue({
                where: mockWhere,
            });

            mockWhere.mockReturnValue({
                limit: mockLimit,
            });

            const request = new NextRequest('http://localhost:3000/api/edr/alerts/alert-123');
            const response = await GET(request, { params: { id: 'alert-123' } });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.id).toBe('alert-123');
            expect(data.data.device).toBeNull();
        });

        it('should return 404 when alert not found', async () => {
            const mockSelect = jest.fn().mockReturnThis();
            const mockFrom = jest.fn().mockReturnThis();
            const mockLeftJoin = jest.fn().mockReturnThis();
            const mockWhere = jest.fn().mockReturnThis();
            const mockLimit = jest.fn().mockResolvedValue([]);

            (db.select as jest.Mock).mockReturnValue({
                from: mockFrom,
            });

            mockFrom.mockReturnValue({
                leftJoin: mockLeftJoin,
            });

            mockLeftJoin.mockReturnValue({
                where: mockWhere,
            });

            mockWhere.mockReturnValue({
                limit: mockLimit,
            });

            const request = new NextRequest('http://localhost:3000/api/edr/alerts/alert-999');
            const response = await GET(request, {
                params: { id: '00000000-0000-0000-0000-000000000999' },
            });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });

        it('should enforce tenant isolation', async () => {
            const mockSelect = jest.fn().mockReturnThis();
            const mockFrom = jest.fn().mockReturnThis();
            const mockLeftJoin = jest.fn().mockReturnThis();
            const mockWhere = jest.fn().mockReturnThis();
            const mockLimit = jest.fn().mockResolvedValue([]);

            (db.select as jest.Mock).mockReturnValue({
                from: mockFrom,
            });

            mockFrom.mockReturnValue({
                leftJoin: mockLeftJoin,
            });

            mockLeftJoin.mockReturnValue({
                where: mockWhere,
            });

            mockWhere.mockReturnValue({
                limit: mockLimit,
            });

            const request = new NextRequest('http://localhost:3000/api/edr/alerts/alert-other-tenant');
            const response = await GET(request, {
                params: { id: '00000000-0000-0000-0000-000000000001' },
            });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });
    });

    describe('Error Handling', () => {
        it('should return 503 when database is unavailable', async () => {
            // Temporarily set db to null
            const originalDb = require('@/lib/database').db;
            require('@/lib/database').db = null;

            const request = new NextRequest('http://localhost:3000/api/edr/alerts/alert-123');
            const response = await GET(request, { params: { id: 'alert-123' } });
            const data = await response.json();

            expect(response.status).toBe(503);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('DATABASE_ERROR');

            // Restore db
            require('@/lib/database').db = originalDb;
        });

        it('should return 500 when database query fails', async () => {
            (db.select as jest.Mock).mockImplementation(() => {
                throw new Error('Database error');
            });

            const request = new NextRequest('http://localhost:3000/api/edr/alerts/alert-123');
            const response = await GET(request, { params: { id: 'alert-123' } });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
        });
    });
});
