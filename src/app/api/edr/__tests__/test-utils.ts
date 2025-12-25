/**
 * Centralized test utilities for EDR API tests
 * Provides consistent mocking setup across all EDR endpoint tests
 */

import { UserRole } from '@/types';

export const mockUser = {
    user_id: 'user-123',
    tenant_id: 'tenant-123',
    role: UserRole.TENANT_ADMIN,
    iat: Date.now(),
    exp: Date.now() + 3600000,
};

export const mockTenant = {
    id: 'tenant-123',
    name: 'Test Tenant',
};

/**
 * Setup standard mocks for EDR API tests
 * Call this in beforeEach() of your test suite
 */
export function setupEDRMocks() {
    // Mock database
    const mockDb = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
    };

    // Get the mocked modules
    const dbModule = require('@/lib/database');
    const { authMiddleware } = require('@/middleware/auth.middleware');
    const { tenantMiddleware } = require('@/middleware/tenant.middleware');

    // Setup database
    dbModule.db = mockDb;

    // Setup successful auth by default
    (authMiddleware as jest.Mock).mockResolvedValue({
        success: true,
        user: mockUser,
    });

    // Setup successful tenant validation by default
    (tenantMiddleware as jest.Mock).mockResolvedValue({
        success: true,
        tenant: mockTenant,
    });

    return {
        mockDb,
        authMiddleware: authMiddleware as jest.Mock,
        tenantMiddleware: tenantMiddleware as jest.Mock,
    };
}

/**
 * Setup auth failure mock
 */
export function mockAuthFailure(authMiddleware: jest.Mock, error: string = 'Invalid token') {
    authMiddleware.mockResolvedValue({
        success: false,
        error,
    });
}

/**
 * Setup tenant validation failure mock
 */
export function mockTenantFailure(tenantMiddleware: jest.Mock, error: string = 'Invalid tenant') {
    tenantMiddleware.mockResolvedValue({
        success: false,
        error: { message: error },
    });
}

/**
 * Setup database unavailable mock
 */
export function mockDatabaseUnavailable() {
    const dbModule = require('@/lib/database');
    dbModule.db = null;
}

/**
 * Mock drizzle-orm functions
 */
export function setupDrizzleMocks() {
    const drizzle = require('drizzle-orm');

    (drizzle.eq as jest.Mock).mockImplementation((field, value) => ({ field, value, op: 'eq' }));
    (drizzle.and as jest.Mock).mockImplementation((...conditions) => ({ conditions, op: 'and' }));
    (drizzle.or as jest.Mock).mockImplementation((...conditions) => ({ conditions, op: 'or' }));
    (drizzle.like as jest.Mock).mockImplementation((field, value) => ({ field, value, op: 'like' }));
    (drizzle.gte as jest.Mock).mockImplementation((field, value) => ({ field, value, op: 'gte' }));
    (drizzle.lte as jest.Mock).mockImplementation((field, value) => ({ field, value, op: 'lte' }));
    (drizzle.desc as jest.Mock).mockImplementation((field) => ({ field, op: 'desc' }));
    (drizzle.asc as jest.Mock).mockImplementation((field) => ({ field, op: 'asc' }));
    (drizzle.sql as jest.Mock).mockImplementation((strings, ...values) => ({ strings, values, op: 'sql' }));
}

/**
 * Create a mock database query result
 */
export function createMockQueryResult<T>(data: T[], total?: number) {
    return {
        data,
        count: total !== undefined ? [{ count: total }] : [{ count: data.length }],
    };
}
