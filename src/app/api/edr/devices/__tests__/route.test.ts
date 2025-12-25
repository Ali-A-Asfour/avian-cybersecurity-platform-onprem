import { NextRequest } from 'next/server';

// Mock ALL dependencies BEFORE any imports
jest.mock('@/lib/database', () => ({
    db: null,
}));
jest.mock('../../../../../../database/schemas/edr', () => ({
    edrDevices: {},
}));
jest.mock('../../../../../../database/schemas/main', () => ({
    tenants: {},
    users: {},
}));
jest.mock('../../../../../../database/schemas/firewall', () => ({
    firewallDevices: {},
}));
jest.mock('drizzle-orm', () => ({
    eq: jest.fn(),
    and: jest.fn(),
    or: jest.fn(),
    like: jest.fn(),
    gte: jest.fn(),
    desc: jest.fn(),
    sql: jest.fn(),
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
jest.mock('@/middleware/auth.middleware', () => ({
    authMiddleware: jest.fn(),
}));
jest.mock('@/middleware/tenant.middleware', () => ({
    tenantMiddleware: jest.fn(),
}));

// Import after mocks using require to ensure we get the mocked version
const { GET } = require('../route');
const { authMiddleware } = require('@/middleware/auth.middleware');
const { tenantMiddleware } = require('@/middleware/tenant.middleware');
import { db } from '@/lib/database';
import { edrDevices } from '../../../../../../database/schemas/edr';
import { eq, and, or, like, gte, desc, sql } from 'drizzle-orm';

const mockAuthMiddleware = authMiddleware as jest.MockedFunction<typeof authMiddleware>;
const mockTenantMiddleware = tenantMiddleware as jest.MockedFunction<typeof tenantMiddleware>;

describe('GET /api/edr/devices', () => {
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

    const mockDevices = [
        {
            id: 'device-1',
            tenantId: 'tenant-123',
            microsoftDeviceId: 'ms-device-1',
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
        },
        {
            id: 'device-2',
            tenantId: 'tenant-123',
            microsoftDeviceId: 'ms-device-2',
            deviceName: 'LAPTOP-002',
            operatingSystem: 'Windows 10',
            osVersion: '21H2',
            primaryUser: 'jane.smith@example.com',
            defenderHealthStatus: 'active',
            riskScore: 75,
            exposureLevel: 'high',
            intuneComplianceState: 'noncompliant',
            intuneEnrollmentStatus: 'enrolled',
            lastSeenAt: new Date('2024-01-14T15:30:00Z'),
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-14T15:30:00Z'),
        },
    ];

    let mockDb: any;
    let dbModule: any;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules(); // Clear module cache to ensure mocks are used

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
            offset: jest.fn().mockReturnThis(),
        };

        // Mock the db module
        dbModule = require('@/lib/database');
        dbModule.db = mockDb;

        // Mock drizzle-orm functions
        (eq as jest.Mock).mockImplementation((field, value) => ({ field, value, op: 'eq' }));
        (and as jest.Mock).mockImplementation((...conditions) => ({ conditions, op: 'and' }));
        (or as jest.Mock).mockImplementation((...conditions) => ({ conditions, op: 'or' }));
        (like as jest.Mock).mockImplementation((field, value) => ({ field, value, op: 'like' }));
        (gte as jest.Mock).mockImplementation((field, value) => ({ field, value, op: 'gte' }));
        (desc as jest.Mock).mockImplementation((field) => ({ field, op: 'desc' }));
        (sql as jest.Mock).mockImplementation((strings, ...values) => ({ strings, values, op: 'sql' }));
    });

    describe('Authentication and Authorization', () => {
        it('should return 401 if authentication fails', async () => {
            // Clear any previous mocks and set up failure
            mockAuthMiddleware.mockClear();
            mockAuthMiddleware.mockResolvedValue({
                success: false,
                error: 'Invalid token',
            });

            const request = new NextRequest('http://localhost:3000/api/edr/devices');
            const response = await GET(request);
            const data = await response.json();

            // Debug: Check how many times mock was called and what it returned
            console.log('Mock called', mockAuthMiddleware.mock.calls.length, 'times');
            for (let i = 0; i < mockAuthMiddleware.mock.results.length; i++) {
                const result = await mockAuthMiddleware.mock.results[i].value;
                console.log(`Call ${i + 1} returned:`, result);
            }
            console.log('Response status:', response.status);
            console.log('Response data:', data);

            expect(mockAuthMiddleware).toHaveBeenCalled();
            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 403 if tenant validation fails', async () => {
            mockTenantMiddleware.mockResolvedValue({
                success: false,
                error: { message: 'Invalid tenant' },
            });

            const request = new NextRequest('http://localhost:3000/api/edr/devices');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });

        it('should return 503 if database is not available', async () => {
            dbModule.db = null;

            const request = new NextRequest('http://localhost:3000/api/edr/devices');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(503);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('DATABASE_ERROR');
        });
    });

    describe('Input Validation', () => {
        it('should return 400 for invalid page parameter', async () => {
            const request = new NextRequest('http://localhost:3000/api/edr/devices?page=0');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Page must be a positive number');
        });

        it('should return 400 for invalid limit parameter', async () => {
            const request = new NextRequest('http://localhost:3000/api/edr/devices?limit=200');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Limit must be a number between 1 and 100');
        });

        it('should return 400 for invalid risk level', async () => {
            const request = new NextRequest('http://localhost:3000/api/edr/devices?riskLevel=invalid');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Risk level must be one of');
        });

        it('should return 400 for invalid compliance state', async () => {
            const request = new NextRequest('http://localhost:3000/api/edr/devices?complianceState=invalid');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Compliance state must be one of');
        });

        it('should return 400 for invalid lastSeenAfter date', async () => {
            const request = new NextRequest('http://localhost:3000/api/edr/devices?lastSeenAfter=invalid-date');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid lastSeenAfter date format');
        });
    });

    describe('Device Listing', () => {
        it('should return devices for authenticated tenant', async () => {
            // Mock device query
            mockDb.offset.mockResolvedValueOnce(mockDevices);

            // Mock count query
            const mockSelect = jest.fn().mockReturnThis();
            const mockFrom = jest.fn().mockReturnThis();
            const mockWhere = jest.fn().mockResolvedValue([{ count: 2 }]);

            dbModule.db.select = mockSelect;
            mockSelect.mockReturnValueOnce({
                from: mockFrom,
            });
            mockFrom.mockReturnValueOnce({
                where: mockWhere,
            });

            const request = new NextRequest('http://localhost:3000/api/edr/devices');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toHaveLength(2);
            expect(data.meta.total).toBe(2);
            expect(data.meta.page).toBe(1);
            expect(data.meta.limit).toBe(50);
        });

        it('should apply search filter for hostname', async () => {
            mockDb.offset.mockResolvedValueOnce([mockDevices[0]]);

            const mockSelect = jest.fn().mockReturnThis();
            const mockFrom = jest.fn().mockReturnThis();
            const mockWhere = jest.fn().mockResolvedValue([{ count: 1 }]);

            dbModule.db.select = mockSelect;
            mockSelect.mockReturnValueOnce({
                from: mockFrom,
            });
            mockFrom.mockReturnValueOnce({
                where: mockWhere,
            });

            const request = new NextRequest('http://localhost:3000/api/edr/devices?search=DESKTOP');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(or).toHaveBeenCalled();
            expect(like).toHaveBeenCalled();
        });

        it('should apply OS filter', async () => {
            mockDb.offset.mockResolvedValueOnce([mockDevices[0]]);

            const mockSelect = jest.fn().mockReturnThis();
            const mockFrom = jest.fn().mockReturnThis();
            const mockWhere = jest.fn().mockResolvedValue([{ count: 1 }]);

            dbModule.db.select = mockSelect;
            mockSelect.mockReturnValueOnce({
                from: mockFrom,
            });
            mockFrom.mockReturnValueOnce({
                where: mockWhere,
            });

            const request = new NextRequest('http://localhost:3000/api/edr/devices?os=Windows 11');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(like).toHaveBeenCalled();
        });

        it('should apply risk level filter', async () => {
            mockDb.offset.mockResolvedValueOnce([mockDevices[1]]);

            const mockSelect = jest.fn().mockReturnThis();
            const mockFrom = jest.fn().mockReturnThis();
            const mockWhere = jest.fn().mockResolvedValue([{ count: 1 }]);

            dbModule.db.select = mockSelect;
            mockSelect.mockReturnValueOnce({
                from: mockFrom,
            });
            mockFrom.mockReturnValueOnce({
                where: mockWhere,
            });

            const request = new NextRequest('http://localhost:3000/api/edr/devices?riskLevel=high');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });

        it('should apply compliance state filter', async () => {
            mockDb.offset.mockResolvedValueOnce([mockDevices[0]]);

            const mockSelect = jest.fn().mockReturnThis();
            const mockFrom = jest.fn().mockReturnThis();
            const mockWhere = jest.fn().mockResolvedValue([{ count: 1 }]);

            dbModule.db.select = mockSelect;
            mockSelect.mockReturnValueOnce({
                from: mockFrom,
            });
            mockFrom.mockReturnValueOnce({
                where: mockWhere,
            });

            const request = new NextRequest('http://localhost:3000/api/edr/devices?complianceState=compliant');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(eq).toHaveBeenCalled();
        });

        it('should apply lastSeenAfter date filter', async () => {
            mockDb.offset.mockResolvedValueOnce([mockDevices[0]]);

            const mockSelect = jest.fn().mockReturnThis();
            const mockFrom = jest.fn().mockReturnThis();
            const mockWhere = jest.fn().mockResolvedValue([{ count: 1 }]);

            dbModule.db.select = mockSelect;
            mockSelect.mockReturnValueOnce({
                from: mockFrom,
            });
            mockFrom.mockReturnValueOnce({
                where: mockWhere,
            });

            const request = new NextRequest('http://localhost:3000/api/edr/devices?lastSeenAfter=2024-01-15T00:00:00Z');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(gte).toHaveBeenCalled();
        });

        it('should handle pagination correctly', async () => {
            mockDb.offset.mockResolvedValueOnce([mockDevices[1]]);

            const mockSelect = jest.fn().mockReturnThis();
            const mockFrom = jest.fn().mockReturnThis();
            const mockWhere = jest.fn().mockResolvedValue([{ count: 2 }]);

            dbModule.db.select = mockSelect;
            mockSelect.mockReturnValueOnce({
                from: mockFrom,
            });
            mockFrom.mockReturnValueOnce({
                where: mockWhere,
            });

            const request = new NextRequest('http://localhost:3000/api/edr/devices?page=2&limit=1');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.meta.page).toBe(2);
            expect(data.meta.limit).toBe(1);
            expect(data.meta.totalPages).toBe(2);
            expect(mockDb.offset).toHaveBeenCalledWith(1);
        });
    });

    describe('Error Handling', () => {
        it('should return 500 on database error', async () => {
            mockDb.offset.mockRejectedValueOnce(new Error('Database error'));

            const request = new NextRequest('http://localhost:3000/api/edr/devices');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
        });
    });
});
