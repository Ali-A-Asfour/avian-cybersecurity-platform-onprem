import { NextRequest } from 'next/server';
import { GET } from '../route';

// Mock the auth and tenant middleware
jest.mock('@/middleware/auth.middleware', () => ({
    authMiddleware: jest.fn().mockResolvedValue({
        success: true,
        user: {
            user_id: 'dev-user-123',
            tenant_id: 'dev-tenant-123',
            role: 'super_admin',
        },
    }),
}));

jest.mock('@/middleware/tenant.middleware', () => ({
    tenantMiddleware: jest.fn().mockResolvedValue({
        success: true,
        tenant: {
            id: 'dev-tenant-123',
            name: 'Development Tenant',
        },
    }),
}));

describe('GET /api/tickets/user-tickets', () => {
    it('should return only tickets created by or assigned to the current user', async () => {
        const request = new NextRequest('http://localhost:3000/api/tickets/user-tickets');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('tickets');
        expect(data.data).toHaveProperty('total');

        // Verify that all returned tickets are either created by or assigned to dev-user-123
        const tickets = data.data.tickets;
        tickets.forEach((ticket: any) => {
            expect(
                ticket.created_by === 'dev-user-123' || ticket.assignee === 'dev-user-123'
            ).toBe(true);
        });
    });

    it('should return empty array when user has no tickets', async () => {
        // Mock a different user
        const { authMiddleware } = require('@/middleware/auth.middleware');
        authMiddleware.mockResolvedValueOnce({
            success: true,
            user: {
                user_id: 'user-with-no-tickets',
                tenant_id: 'dev-tenant-123',
                role: 'user',
            },
        });

        const request = new NextRequest('http://localhost:3000/api/tickets/user-tickets');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.tickets).toEqual([]);
        expect(data.data.total).toBe(0);
    });

    it('should handle query parameters for filtering', async () => {
        const request = new NextRequest('http://localhost:3000/api/tickets/user-tickets?status=new,in_progress&limit=5');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);

        // Verify that returned tickets match the status filter
        const tickets = data.data.tickets;
        tickets.forEach((ticket: any) => {
            expect(['new', 'in_progress']).toContain(ticket.status);
        });
    });
});