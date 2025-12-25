/**
 * Help Desk API Error Handling Integration Tests
 * 
 * Tests the integration of error handling across API routes,
 * validation, and business rules.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { POST as assignPost } from '../[id]/assign/route';

// Mock the dependencies
jest.mock('@/middleware/auth.middleware');
jest.mock('@/middleware/tenant.middleware');
jest.mock('@/services/ticket.service');

const mockAuthMiddleware = require('@/middleware/auth.middleware').authMiddleware;
const mockTenantMiddleware = require('@/middleware/tenant.middleware').tenantMiddleware;
const mockTicketService = require('@/services/ticket.service').TicketService;

describe('Help Desk API Error Handling Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/tickets', () => {
        it('should return 401 when authentication fails', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: false,
                error: 'Invalid token',
            });

            const request = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                body: JSON.stringify({}),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 403 when tenant access is denied', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: { user_id: 'user1', role: 'user' },
            });

            mockTenantMiddleware.mockResolvedValue({
                success: false,
                error: { message: 'Tenant access denied' },
            });

            const request = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                body: JSON.stringify({}),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');
        });

        it('should return 400 when validation fails', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: { user_id: 'user1', role: 'user' },
            });

            mockTenantMiddleware.mockResolvedValue({
                success: true,
                tenant: { id: 'tenant1', name: 'Test Tenant' },
            });

            const request = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                body: JSON.stringify({
                    title: '', // Invalid: empty title
                    description: '', // Invalid: empty description
                    impactLevel: 'invalid', // Invalid: not in enum
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.details.errors).toBeDefined();
        });

        it('should return 403 when user cannot access ticket category', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: { user_id: 'user1', role: 'it_helpdesk_analyst' },
            });

            mockTenantMiddleware.mockResolvedValue({
                success: true,
                tenant: { id: 'tenant1', name: 'Test Tenant' },
            });

            // Mock category validation to fail
            mockTicketService.validateCategoryAccess.mockReturnValue({
                valid: false,
                error: 'Role it_helpdesk_analyst cannot access security_incident tickets',
            });

            const request = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                body: JSON.stringify({
                    title: 'Security Issue',
                    description: 'There is a security problem',
                    impactLevel: 'critical',
                    category: 'security_incident', // IT analyst cannot access security tickets
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('QUEUE_ACCESS_DENIED');
        });

        it('should return 201 when ticket creation succeeds', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: { user_id: 'user1', role: 'it_helpdesk_analyst' },
            });

            mockTenantMiddleware.mockResolvedValue({
                success: true,
                tenant: { id: 'tenant1', name: 'Test Tenant' },
            });

            mockTicketService.validateCategoryAccess.mockReturnValue({
                valid: true,
            });

            const mockTicket = {
                id: 'ticket1',
                title: 'Test Ticket',
                description: 'Test description',
                status: 'new',
            };

            mockTicketService.createTicket.mockResolvedValue(mockTicket);

            const request = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                body: JSON.stringify({
                    title: 'Test Ticket',
                    description: 'Test description',
                    impactLevel: 'medium',
                    category: 'it_support',
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockTicket);
        });
    });

    describe('POST /api/tickets/[id]/assign', () => {
        it('should return 404 when ticket not found', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: { user_id: 'analyst1', role: 'it_helpdesk_analyst' },
            });

            mockTenantMiddleware.mockResolvedValue({
                success: true,
                tenant: { id: 'tenant1', name: 'Test Tenant' },
            });

            mockTicketService.getTicketById.mockResolvedValue(null);

            const request = new NextRequest('http://localhost/api/tickets/nonexistent/assign', {
                method: 'POST',
            });

            const response = await assignPost(request, {
                params: Promise.resolve({ id: 'nonexistent' }),
            });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TICKET_NOT_FOUND');
        });

        it('should return 400 when ticket is already assigned', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: { user_id: 'analyst1', role: 'it_helpdesk_analyst' },
            });

            mockTenantMiddleware.mockResolvedValue({
                success: true,
                tenant: { id: 'tenant1', name: 'Test Tenant' },
            });

            const assignedTicket = {
                id: 'ticket1',
                assignee: 'analyst2',
                category: 'it_support',
            };

            mockTicketService.getTicketById.mockResolvedValue(assignedTicket);

            const request = new NextRequest('http://localhost/api/tickets/ticket1/assign', {
                method: 'POST',
            });

            const response = await assignPost(request, {
                params: Promise.resolve({ id: 'ticket1' }),
            });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TICKET_ALREADY_ASSIGNED');
        });

        it('should return 403 when user cannot access ticket category', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: { user_id: 'analyst1', role: 'it_helpdesk_analyst' },
            });

            mockTenantMiddleware.mockResolvedValue({
                success: true,
                tenant: { id: 'tenant1', name: 'Test Tenant' },
            });

            const securityTicket = {
                id: 'ticket1',
                assignee: 'Unassigned',
                category: 'security_incident', // IT analyst cannot access security tickets
            };

            mockTicketService.getTicketById.mockResolvedValue(securityTicket);

            const request = new NextRequest('http://localhost/api/tickets/ticket1/assign', {
                method: 'POST',
            });

            const response = await assignPost(request, {
                params: Promise.resolve({ id: 'ticket1' }),
            });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('QUEUE_ACCESS_DENIED');
        });

        it('should return 200 when assignment succeeds', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: { user_id: 'analyst1', role: 'it_helpdesk_analyst' },
            });

            mockTenantMiddleware.mockResolvedValue({
                success: true,
                tenant: { id: 'tenant1', name: 'Test Tenant' },
            });

            const unassignedTicket = {
                id: 'ticket1',
                assignee: 'Unassigned',
                category: 'it_support',
            };

            const assignedTicket = {
                ...unassignedTicket,
                assignee: 'analyst1',
                status: 'in_progress',
            };

            mockTicketService.getTicketById.mockResolvedValue(unassignedTicket);
            mockTicketService.selfAssignTicket.mockResolvedValue(assignedTicket);

            const request = new NextRequest('http://localhost/api/tickets/ticket1/assign', {
                method: 'POST',
            });

            const response = await assignPost(request, {
                params: Promise.resolve({ id: 'ticket1' }),
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toEqual(assignedTicket);
        });
    });

    describe('Error Response Format', () => {
        it('should return consistent error response format', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: false,
                error: 'Token expired',
            });

            const request = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                body: JSON.stringify({}),
            });

            const response = await POST(request);
            const data = await response.json();

            // Verify consistent error response structure
            expect(data).toHaveProperty('success', false);
            expect(data).toHaveProperty('error');
            expect(data.error).toHaveProperty('code');
            expect(data.error).toHaveProperty('message');
            expect(data.error).toHaveProperty('timestamp');
            expect(data.error).toHaveProperty('request_id');
        });
    });
});