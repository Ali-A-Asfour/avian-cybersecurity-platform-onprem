import { NextRequest } from 'next/server';

// Mock ALL dependencies BEFORE any imports
jest.mock('@/lib/database', () => ({
    db: {
        select: jest.fn(),
    },
}));
jest.mock('../../../../../../database/schemas/edr', () => ({
    edrCompliance: {},
}));
jest.mock('drizzle-orm', () => ({
    eq: jest.fn(),
    and: jest.fn(),
    sql: jest.fn(),
}));
jest.mock('@/middleware/auth.middleware', () => ({
    authMiddleware: jest.fn(),
}));
jest.mock('@/middleware/tenant.middleware', () => ({
    tenantMiddleware: jest.fn(),
}));

import { GET } from '../route';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';

describe('GET /api/edr/compliance', () => {
    const mockTenantId = '123e4567-e89b-12d3-a456-426614174000';
    const mockDeviceId = '123e4567-e89b-12d3-a456-426614174001';

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock successful authentication
        (authMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            user: {
                id: 'user-123',
                tenant_id: mockTenantId,
                email: 'test@example.com',
                role: 'admin',
            },
        });

        // Mock successful tenant validation
        (tenantMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            tenant: {
                id: mockTenantId,
                name: 'Test Tenant',
            },
        });
    });

    it('should return compliance records for authenticated tenant', async () => {
        const mockCompliance = [
            {
                id: 'comp-1',
                tenantId: mockTenantId,
                deviceId: mockDeviceId,
                complianceState: 'compliant',
                failedRules: null,
                securityBaselineStatus: 'compliant',
                requiredAppsStatus: null,
                checkedAt: new Date('2024-01-01T00:00:00Z'),
                createdAt: new Date('2024-01-01T00:00:00Z'),
                updatedAt: new Date('2024-01-01T00:00:00Z'),
            },
        ];

        const mockSelect = jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue(mockCompliance),
            }),
        });

        (db.select as jest.Mock).mockReturnValue(mockSelect() as any);

        const request = new NextRequest('http://localhost:3000/api/edr/compliance');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(1);
        expect(data.data[0].complianceState).toBe('compliant');
    });

    it('should filter by compliance state', async () => {
        const mockCompliance = [
            {
                id: 'comp-1',
                tenantId: mockTenantId,
                deviceId: mockDeviceId,
                complianceState: 'noncompliant',
                failedRules: [{ ruleName: 'Password Policy', state: 'failed' }],
                securityBaselineStatus: 'noncompliant',
                requiredAppsStatus: null,
                checkedAt: new Date('2024-01-01T00:00:00Z'),
                createdAt: new Date('2024-01-01T00:00:00Z'),
                updatedAt: new Date('2024-01-01T00:00:00Z'),
            },
        ];

        const mockSelect = jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue(mockCompliance),
            }),
        });

        (db.select as jest.Mock).mockReturnValue(mockSelect() as any);

        const request = new NextRequest(
            'http://localhost:3000/api/edr/compliance?state=noncompliant'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(1);
        expect(data.data[0].complianceState).toBe('noncompliant');
        expect(data.data[0].failedRules).toHaveLength(1);
    });

    it('should filter by device ID', async () => {
        const mockCompliance = [
            {
                id: 'comp-1',
                tenantId: mockTenantId,
                deviceId: mockDeviceId,
                complianceState: 'compliant',
                failedRules: null,
                securityBaselineStatus: 'compliant',
                requiredAppsStatus: null,
                checkedAt: new Date('2024-01-01T00:00:00Z'),
                createdAt: new Date('2024-01-01T00:00:00Z'),
                updatedAt: new Date('2024-01-01T00:00:00Z'),
            },
        ];

        const mockSelect = jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue(mockCompliance),
            }),
        });

        (db.select as jest.Mock).mockReturnValue(mockSelect() as any);

        const request = new NextRequest(
            `http://localhost:3000/api/edr/compliance?deviceId=${mockDeviceId}`
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(1);
        expect(data.data[0].deviceId).toBe(mockDeviceId);
    });

    it('should return 400 for invalid state parameter', async () => {
        // Clear all mocks and set up successful auth/tenant
        jest.clearAllMocks();
        (authMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            user: {
                id: 'user-123',
                tenant_id: mockTenantId,
                email: 'test@example.com',
                role: 'admin',
            },
        });
        (tenantMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            tenant: {
                id: mockTenantId,
                name: 'Test Tenant',
            },
        });

        const request = new NextRequest(
            'http://localhost:3000/api/edr/compliance?state=invalid'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('VALIDATION_ERROR');
        expect(data.error.message).toContain('State must be one of');
    });

    it('should return 400 for invalid device ID format', async () => {
        // Clear all mocks and set up successful auth/tenant
        jest.clearAllMocks();
        (authMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            user: {
                id: 'user-123',
                tenant_id: mockTenantId,
                email: 'test@example.com',
                role: 'admin',
            },
        });
        (tenantMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            tenant: {
                id: mockTenantId,
                name: 'Test Tenant',
            },
        });

        const request = new NextRequest(
            'http://localhost:3000/api/edr/compliance?deviceId=invalid-uuid'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('VALIDATION_ERROR');
        expect(data.error.message).toContain('Device ID must be a valid UUID');
    });

    it('should return 401 when authentication fails', async () => {
        // Clear all mocks and set up authentication failure
        jest.clearAllMocks();
        (authMiddleware as jest.Mock).mockResolvedValue({
            success: false,
            error: 'Invalid token',
        });

        const request = new NextRequest('http://localhost:3000/api/edr/compliance');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 403 when tenant validation fails', async () => {
        // Clear all mocks and set up tenant validation failure
        jest.clearAllMocks();
        (authMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            user: {
                id: 'user-123',
                tenant_id: mockTenantId,
                email: 'test@example.com',
                role: 'admin',
            },
        });
        (tenantMiddleware as jest.Mock).mockResolvedValue({
            success: false,
            error: { message: 'Tenant not found' },
        });

        const request = new NextRequest('http://localhost:3000/api/edr/compliance');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('TENANT_ERROR');
    });

    it('should return 500 when database query fails', async () => {
        // Clear all mocks and set up successful auth/tenant
        jest.clearAllMocks();
        (authMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            user: {
                id: 'user-123',
                tenant_id: mockTenantId,
                email: 'test@example.com',
                role: 'admin',
            },
        });
        (tenantMiddleware as jest.Mock).mockResolvedValue({
            success: true,
            tenant: {
                id: mockTenantId,
                name: 'Test Tenant',
            },
        });

        // Mock database error
        const mockSelect = jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockRejectedValue(new Error('Database error')),
            }),
        });
        (db.select as jest.Mock).mockReturnValue(mockSelect() as any);

        const request = new NextRequest('http://localhost:3000/api/edr/compliance');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('INTERNAL_ERROR');
    });

    it('should include failed rules in response', async () => {
        const mockCompliance = [
            {
                id: 'comp-1',
                tenantId: mockTenantId,
                deviceId: mockDeviceId,
                complianceState: 'noncompliant',
                failedRules: [
                    { ruleName: 'Password Policy', state: 'failed' },
                    { ruleName: 'Encryption Required', state: 'failed' },
                ],
                securityBaselineStatus: 'noncompliant',
                requiredAppsStatus: [
                    { appName: 'Antivirus', installed: false },
                ],
                checkedAt: new Date('2024-01-01T00:00:00Z'),
                createdAt: new Date('2024-01-01T00:00:00Z'),
                updatedAt: new Date('2024-01-01T00:00:00Z'),
            },
        ];

        const mockSelect = jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue(mockCompliance),
            }),
        });

        (db.select as jest.Mock).mockReturnValue(mockSelect() as any);

        const request = new NextRequest('http://localhost:3000/api/edr/compliance');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data[0].failedRules).toHaveLength(2);
        expect(data.data[0].requiredAppsStatus).toHaveLength(1);
    });

    it('should return empty array when no compliance records exist', async () => {
        const mockSelect = jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue([]),
            }),
        });

        (db.select as jest.Mock).mockReturnValue(mockSelect() as any);

        const request = new NextRequest('http://localhost:3000/api/edr/compliance');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(0);
    });

    it('should filter by both state and device ID', async () => {
        const mockCompliance = [
            {
                id: 'comp-1',
                tenantId: mockTenantId,
                deviceId: mockDeviceId,
                complianceState: 'noncompliant',
                failedRules: [{ ruleName: 'Password Policy', state: 'failed' }],
                securityBaselineStatus: 'noncompliant',
                requiredAppsStatus: null,
                checkedAt: new Date('2024-01-01T00:00:00Z'),
                createdAt: new Date('2024-01-01T00:00:00Z'),
                updatedAt: new Date('2024-01-01T00:00:00Z'),
            },
        ];

        const mockSelect = jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue(mockCompliance),
            }),
        });

        (db.select as jest.Mock).mockReturnValue(mockSelect() as any);

        const request = new NextRequest(
            `http://localhost:3000/api/edr/compliance?state=noncompliant&deviceId=${mockDeviceId}`
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(1);
        expect(data.data[0].complianceState).toBe('noncompliant');
        expect(data.data[0].deviceId).toBe(mockDeviceId);
    });
});
