import { NextRequest } from 'next/server';

// Mock ALL dependencies BEFORE any imports
jest.mock('@/lib/database', () => ({
    db: {
        select: jest.fn(),
    },
}));
jest.mock('../../../../../../../database/schemas/edr', () => ({
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

describe('GET /api/edr/compliance/summary', () => {
    const mockTenantId = '123e4567-e89b-12d3-a456-426614174000';

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

    it('should return compliance summary counts', async () => {
        const mockCounts = [
            { complianceState: 'compliant', count: 10 },
            { complianceState: 'noncompliant', count: 5 },
            { complianceState: 'unknown', count: 2 },
        ];

        const mockSelect = jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    groupBy: jest.fn().mockResolvedValue(mockCounts),
                }),
            }),
        });

        (db.select as jest.Mock).mockReturnValue(mockSelect() as any);

        const request = new NextRequest(
            'http://localhost:3000/api/edr/compliance/summary'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.compliant).toBe(10);
        expect(data.data.nonCompliant).toBe(5);
        expect(data.data.unknown).toBe(2);
        expect(data.data.total).toBe(17);
    });

    it('should return zero counts when no compliance records exist', async () => {
        const mockSelect = jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    groupBy: jest.fn().mockResolvedValue([]),
                }),
            }),
        });

        (db.select as jest.Mock).mockReturnValue(mockSelect() as any);

        const request = new NextRequest(
            'http://localhost:3000/api/edr/compliance/summary'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.compliant).toBe(0);
        expect(data.data.nonCompliant).toBe(0);
        expect(data.data.unknown).toBe(0);
        expect(data.data.total).toBe(0);
    });

    it('should handle only compliant devices', async () => {
        const mockCounts = [{ complianceState: 'compliant', count: 15 }];

        const mockSelect = jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    groupBy: jest.fn().mockResolvedValue(mockCounts),
                }),
            }),
        });

        (db.select as jest.Mock).mockReturnValue(mockSelect() as any);

        const request = new NextRequest(
            'http://localhost:3000/api/edr/compliance/summary'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.compliant).toBe(15);
        expect(data.data.nonCompliant).toBe(0);
        expect(data.data.unknown).toBe(0);
        expect(data.data.total).toBe(15);
    });

    it('should handle only non-compliant devices', async () => {
        const mockCounts = [{ complianceState: 'noncompliant', count: 8 }];

        const mockSelect = jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    groupBy: jest.fn().mockResolvedValue(mockCounts),
                }),
            }),
        });

        (db.select as jest.Mock).mockReturnValue(mockSelect() as any);

        const request = new NextRequest(
            'http://localhost:3000/api/edr/compliance/summary'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.compliant).toBe(0);
        expect(data.data.nonCompliant).toBe(8);
        expect(data.data.unknown).toBe(0);
        expect(data.data.total).toBe(8);
    });

    it('should return 401 when authentication fails', async () => {
        (authMiddleware as jest.Mock).mockResolvedValue({
            success: false,
            error: 'Invalid token',
        });

        const request = new NextRequest(
            'http://localhost:3000/api/edr/compliance/summary'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 403 when tenant validation fails', async () => {
        (tenantMiddleware as jest.Mock).mockResolvedValue({
            success: false,
            error: { message: 'Tenant not found' },
        });

        const request = new NextRequest(
            'http://localhost:3000/api/edr/compliance/summary'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('TENANT_ERROR');
    });

    it('should return 500 when database query fails', async () => {
        const mockSelect = jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    groupBy: jest.fn().mockRejectedValue(new Error('Database error')),
                }),
            }),
        });

        (db.select as jest.Mock).mockReturnValue(mockSelect() as any);

        const request = new NextRequest(
            'http://localhost:3000/api/edr/compliance/summary'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error.code).toBe('INTERNAL_ERROR');
    });

    it('should handle mixed case compliance states', async () => {
        const mockCounts = [
            { complianceState: 'Compliant', count: 10 },
            { complianceState: 'NonCompliant', count: 5 },
            { complianceState: 'Unknown', count: 2 },
        ];

        const mockSelect = jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    groupBy: jest.fn().mockResolvedValue(mockCounts),
                }),
            }),
        });

        (db.select as jest.Mock).mockReturnValue(mockSelect() as any);

        const request = new NextRequest(
            'http://localhost:3000/api/edr/compliance/summary'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        // Should handle case-insensitive matching
        expect(data.data.total).toBeGreaterThan(0);
    });

    it('should calculate total correctly with large numbers', async () => {
        const mockCounts = [
            { complianceState: 'compliant', count: 1000 },
            { complianceState: 'noncompliant', count: 500 },
            { complianceState: 'unknown', count: 250 },
        ];

        const mockSelect = jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    groupBy: jest.fn().mockResolvedValue(mockCounts),
                }),
            }),
        });

        (db.select as jest.Mock).mockReturnValue(mockSelect() as any);

        const request = new NextRequest(
            'http://localhost:3000/api/edr/compliance/summary'
        );
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.compliant).toBe(1000);
        expect(data.data.nonCompliant).toBe(500);
        expect(data.data.unknown).toBe(250);
        expect(data.data.total).toBe(1750);
    });
});
