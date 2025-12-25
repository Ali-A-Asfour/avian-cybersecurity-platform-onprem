/**
 * Tests for GET /api/edr/alerts endpoint
 * 
 * Requirements: 2.4, 9.4, 14.2, 14.5
 * - List alerts filtered by tenant
 * - Support filters (severity, device, status, date range)
 * - Support pagination
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
    gte: jest.fn(),
    lte: jest.fn(),
    desc: jest.fn(),
    sql: jest.fn(),
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

describe('GET /api/edr/alerts', () => {
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

    const mockAlerts = [
        {
            id: 'alert-1',
            tenantId: 'tenant-123',
            deviceId: 'device-1',
            microsoftAlertId: 'ms-alert-1',
            severity: 'high',
            threatType: 'malware',
            threatName: 'Trojan.Generic',
            status: 'new',
            description: 'Malware detected on device',
            detectedAt: new Date('2024-01-15T10:00:00Z'),
            createdAt: new Date('2024-01-15T10:00:00Z'),
            updatedAt: new Date('2024-01-15T10:00:00Z'),
        },
        {
            id: 'alert-2',
            tenantId: 'tenant-123',
            deviceId: 'device-2',
            microsoftAlertId: 'ms-alert-2',
            severity: 'medium',
            threatType: 'suspicious_activity',
            threatName: 'Suspicious Process',
            status: 'in_progress',
            description: 'Suspicious activity detected',
            detectedAt: new Date('2024-01-14T10:00:00Z'),
            createdAt: new Date('2024-01-14T10:00:00Z'),
            updatedAt: new Date('2024-01-14T10:00:00Z'),
        },
    ];

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

            const request = new NextRequest('http://localhost:3000/api/edr/alerts');
            const response = await GET(request);
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

            const request = new NextRequest('http://localhost:3000/api/edr/alerts');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });
    });

    describe('Input Validation', () => {
        it('should return 400 for invalid page parameter', async () => {
            const request = new NextRequest('http://localhost:3000/api/edr/alerts?page=0');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Page must be a positive number');
        });

        it('should return 400 for invalid limit parameter', async () => {
            const request = new NextRequest('http://localhost:3000/api/edr/alerts?limit=200');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Limit must be a number between 1 and 100');
        });

        it('should return 400 for invalid severity parameter', async () => {
            const request = new NextRequest('http://localhost:3000/api/edr/alerts?severity=invalid');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Severity must be one of');
        });

        it('should return 400 for invalid status parameter', async () => {
            const request = new NextRequest('http://localhost:3000/api/edr/alerts?status=invalid');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Status must be one of');
        });

        it('should return 400 for invalid deviceId format', async () => {
            const request = new NextRequest('http://localhost:3000/api/edr/alerts?deviceId=invalid-uuid');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Device ID must be a valid UUID');
        });

        it('should return 400 for invalid startDate format', async () => {
            const request = new NextRequest('http://localhost:3000/api/edr/alerts?startDate=invalid-date');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid startDate format');
        });

        it('should return 400 for invalid endDate format', async () => {
            const request = new NextRequest('http://localhost:3000/api/edr/alerts?endDate=invalid-date');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid endDate format');
        });

        it('should return 400 when startDate is after endDate', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/edr/alerts?startDate=2024-01-20T00:00:00Z&endDate=2024-01-10T00:00:00Z'
            );
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Start date must be before or equal to end date');
        });
    });

    describe('Alert Listing', () => {
        it('should return alerts for authenticated tenant', async () => {
            const mockSelect = jest.fn().mockReturnThis();
            const mockFrom = jest.fn().mockReturnThis();
            const mockWhere = jest.fn().mockReturnThis();
            const mockOrderBy = jest.fn().mockReturnThis();
            const mockLimit = jest.fn().mockReturnThis();
            const mockOffset = jest.fn().mockResolvedValue(mockAlerts);

            (db.select as jest.Mock).mockReturnValue({
                from: mockFrom,
            });

            mockFrom.mockReturnValue({
                where: mockWhere,
            });

            mockWhere.mockReturnValue({
                orderBy: mockOrderBy,
            });

            mockOrderBy.mockReturnValue({
                limit: mockLimit,
            });

            mockLimit.mockReturnValue({
                offset: mockOffset,
            });

            // Mock count query
            mockSelect.mockReturnValueOnce({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([{ count: 2 }]),
                }),
            });

            const request = new NextRequest('http://localhost:3000/api/edr/alerts');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(2);
            expect(data.meta.total).toBe(2);
            expect(data.meta.page).toBe(1);
            expect(data.meta.limit).toBe(50);
        });

        it('should apply pagination correctly', async () => {
            const mockSelect = jest.fn().mockReturnThis();
            const mockFrom = jest.fn().mockReturnThis();
            const mockWhere = jest.fn().mockReturnThis();
            const mockOrderBy = jest.fn().mockReturnThis();
            const mockLimit = jest.fn().mockReturnThis();
            const mockOffset = jest.fn().mockResolvedValue([mockAlerts[0]]);

            (db.select as jest.Mock).mockReturnValue({
                from: mockFrom,
            });

            mockFrom.mockReturnValue({
                where: mockWhere,
            });

            mockWhere.mockReturnValue({
                orderBy: mockOrderBy,
            });

            mockOrderBy.mockReturnValue({
                limit: mockLimit,
            });

            mockLimit.mockReturnValue({
                offset: mockOffset,
            });

            // Mock count query
            mockSelect.mockReturnValueOnce({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([{ count: 10 }]),
                }),
            });

            const request = new NextRequest('http://localhost:3000/api/edr/alerts?page=2&limit=5');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.meta.page).toBe(2);
            expect(data.meta.limit).toBe(5);
            expect(data.meta.total).toBe(10);
            expect(data.meta.totalPages).toBe(2);
        });

        it('should filter by severity', async () => {
            const mockSelect = jest.fn().mockReturnThis();
            const mockFrom = jest.fn().mockReturnThis();
            const mockWhere = jest.fn().mockReturnThis();
            const mockOrderBy = jest.fn().mockReturnThis();
            const mockLimit = jest.fn().mockReturnThis();
            const mockOffset = jest.fn().mockResolvedValue([mockAlerts[0]]);

            (db.select as jest.Mock).mockReturnValue({
                from: mockFrom,
            });

            mockFrom.mockReturnValue({
                where: mockWhere,
            });

            mockWhere.mockReturnValue({
                orderBy: mockOrderBy,
            });

            mockOrderBy.mockReturnValue({
                limit: mockLimit,
            });

            mockLimit.mockReturnValue({
                offset: mockOffset,
            });

            // Mock count query
            mockSelect.mockReturnValueOnce({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([{ count: 1 }]),
                }),
            });

            const request = new NextRequest('http://localhost:3000/api/edr/alerts?severity=high');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(1);
            expect(data.data[0].severity).toBe('high');
        });

        it('should return empty array when no alerts found', async () => {
            const mockSelect = jest.fn().mockReturnThis();
            const mockFrom = jest.fn().mockReturnThis();
            const mockWhere = jest.fn().mockReturnThis();
            const mockOrderBy = jest.fn().mockReturnThis();
            const mockLimit = jest.fn().mockReturnThis();
            const mockOffset = jest.fn().mockResolvedValue([]);

            (db.select as jest.Mock).mockReturnValue({
                from: mockFrom,
            });

            mockFrom.mockReturnValue({
                where: mockWhere,
            });

            mockWhere.mockReturnValue({
                orderBy: mockOrderBy,
            });

            mockOrderBy.mockReturnValue({
                limit: mockLimit,
            });

            mockLimit.mockReturnValue({
                offset: mockOffset,
            });

            // Mock count query
            mockSelect.mockReturnValueOnce({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([{ count: 0 }]),
                }),
            });

            const request = new NextRequest('http://localhost:3000/api/edr/alerts');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(0);
            expect(data.meta.total).toBe(0);
        });
    });

    describe('Error Handling', () => {
        it('should return 503 when database is unavailable', async () => {
            // Temporarily set db to null
            const originalDb = require('@/lib/database').db;
            require('@/lib/database').db = null;

            const request = new NextRequest('http://localhost:3000/api/edr/alerts');
            const response = await GET(request);
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

            const request = new NextRequest('http://localhost:3000/api/edr/alerts');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
        });
    });
});
