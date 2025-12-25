/**
 * MVP Test Suite for GET /api/edr/devices
 * 
 * Focus: Auth, Validation, One Happy-Path
 * Complex query/filter tests marked for Phase 2
 */

import { NextRequest } from 'next/server';
import { UserRole } from '@/types';

// Mock dependencies
jest.mock('@/lib/database', () => ({
    db: {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue([]),
    },
}));

jest.mock('../../../../../../database/schemas/edr', () => ({
    edrDevices: {},
    edrAlerts: {},
    edrVulnerabilities: {},
    edrDeviceVulnerabilities: {},
    edrCompliance: {},
    edrActions: {},
    edrPostureScores: {},
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
    or: jest.fn((...conditions) => ({ conditions, op: 'or' })),
    like: jest.fn((field, value) => ({ field, value, op: 'like' })),
    gte: jest.fn((field, value) => ({ field, value, op: 'gte' })),
    desc: jest.fn((field) => ({ field, op: 'desc' })),
    sql: jest.fn((strings, ...values) => ({ strings, values, op: 'sql' })),
    relations: jest.fn(() => ({})),
}));

// Import route after mocks
import { GET } from '../route';
import { db } from '@/lib/database';

const mockDb = db as jest.Mocked<typeof db>;

describe('GET /api/edr/devices - MVP Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset mock to default working state
        mockDb.select = jest.fn().mockReturnThis();
        mockDb.from = jest.fn().mockReturnThis();
        mockDb.where = jest.fn().mockReturnThis();
        mockDb.orderBy = jest.fn().mockReturnThis();
        mockDb.limit = jest.fn().mockReturnThis();
        mockDb.offset = jest.fn().mockResolvedValue([]);
    });

    describe('Authentication (with BYPASS_AUTH=true)', () => {
        it('should allow requests when auth bypass is enabled', async () => {
            // With BYPASS_AUTH=true in jest.setup.js, auth middleware returns success
            const request = new NextRequest('http://localhost:3000/api/edr/devices');
            const response = await GET(request);

            // Should not return 401
            expect(response.status).not.toBe(401);
        });

        // TODO Phase 2: Add proper auth mocking tests
        // - Test 401 for missing/invalid JWT
        // - Test 403 for cross-tenant access
        // - Test role-based permissions
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

        it('should return 400 for invalid date format', async () => {
            const request = new NextRequest('http://localhost:3000/api/edr/devices?lastSeenAfter=invalid-date');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid lastSeenAfter date format');
        });
    });

    describe('Happy Path', () => {
        it('should return device list with minimal mock data', async () => {
            // Simple mock: return 2 devices
            const mockDevices = [
                {
                    id: 'device-1',
                    tenantId: 'dev-tenant-123',
                    microsoftDeviceId: 'ms-device-1',
                    deviceName: 'TEST-DEVICE-1',
                    operatingSystem: 'Windows 11',
                    osVersion: '22H2',
                    primaryUser: 'test@example.com',
                    defenderHealthStatus: 'active',
                    riskScore: 25,
                    exposureLevel: 'low',
                    intuneComplianceState: 'compliant',
                    intuneEnrollmentStatus: 'enrolled',
                    lastSeenAt: new Date('2024-01-15T10:00:00Z'),
                    createdAt: new Date('2024-01-01T00:00:00Z'),
                    updatedAt: new Date('2024-01-15T10:00:00Z'),
                },
            ];

            // Mock the query chain
            mockDb.offset = jest.fn().mockResolvedValue(mockDevices);

            // Mock count query - need to return a new chain
            const mockCountSelect = jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue([{ count: 1 }]),
                }),
            });

            // Override select for count query
            let selectCallCount = 0;
            mockDb.select = jest.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                    // First call: main query
                    return mockDb;
                } else {
                    // Second call: count query
                    return mockCountSelect();
                }
            });

            const request = new NextRequest('http://localhost:3000/api/edr/devices');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toBeInstanceOf(Array);
            expect(data.data.length).toBe(1);
            expect(data.data[0].deviceName).toBe('TEST-DEVICE-1');
            expect(data.meta).toHaveProperty('total');
            expect(data.meta).toHaveProperty('page');
            expect(data.meta).toHaveProperty('limit');
        });
    });

    // TODO Phase 2: Complex query tests (mark as .skip for now)
    describe.skip('Complex Filters - Phase 2', () => {
        it.skip('should apply multiple filters simultaneously', () => {
            // Test combining search + OS + risk level + compliance + date filters
        });

        it.skip('should handle pagination edge cases', () => {
            // Test page 999, limit 0, etc.
        });

        it.skip('should apply search filter for hostname', () => {
            // Complex search scenarios
        });

        it.skip('should apply OS filter', () => {
            // OS filtering logic
        });

        it.skip('should apply risk level filter', () => {
            // Risk level filtering logic
        });

        it.skip('should apply compliance state filter', () => {
            // Compliance filtering logic
        });

        it.skip('should apply lastSeenAfter date filter', () => {
            // Date filtering logic
        });
    });

    describe('Error Handling', () => {
        it('should return 503 if database is not available', async () => {
            // Temporarily set db to null
            const dbModule = require('@/lib/database');
            const originalDb = dbModule.db;
            dbModule.db = null;

            const request = new NextRequest('http://localhost:3000/api/edr/devices');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(503);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('DATABASE_ERROR');

            // Restore
            dbModule.db = originalDb;
        });

        // TODO Phase 2: Add more error scenarios
        // - Network timeouts
        // - Database query failures
        // - Malformed responses
    });
});
