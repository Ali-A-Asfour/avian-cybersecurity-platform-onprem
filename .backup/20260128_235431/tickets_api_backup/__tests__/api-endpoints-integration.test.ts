/**
 * Help Desk API Endpoints Integration Tests
 * 
 * Comprehensive tests for all help desk API endpoints covering:
 * - Request/response validation
 * - Authentication and authorization
 * - Error handling and edge cases
 * - Performance and concurrent access
 * 
 * Task 15: Final integration testing and polish
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';
import { TicketStatus, TicketSeverity, TicketCategory, UserRole } from '@/types';

// Import API route handlers
import { GET as getTickets, POST as createTicket } from '../route';
import { POST as assignTicket } from '../[id]/assign/route';
import { POST as resolveTicket } from '../[id]/resolve/route';
import { GET as getMyTickets } from '../my/route';

// Mock dependencies
jest.mock('@/middleware/auth.middleware');
jest.mock('@/middleware/tenant.middleware');
jest.mock('@/services/ticket.service');
jest.mock('@/services/help-desk/KnowledgeBaseService');
jest.mock('@/lib/help-desk/notification-service');

const mockAuthMiddleware = require('@/middleware/auth.middleware').authMiddleware;
const mockTenantMiddleware = require('@/middleware/tenant.middleware').tenantMiddleware;
const mockTicketService = require('@/services/ticket.service').TicketService;
const mockKnowledgeBaseService = require('@/services/help-desk/KnowledgeBaseService').KnowledgeBaseService;
const mockNotificationService = require('@/lib/help-desk/notification-service');

describe('Help Desk API Endpoints Integration Tests', () => {
    const testTenant = { id: 'tenant1', name: 'Test Tenant' };
    const testUsers = {
        endUser: { user_id: 'user1', role: UserRole.USER, tenant_id: 'tenant1' },
        analyst: { user_id: 'analyst1', role: UserRole.IT_HELPDESK_ANALYST, tenant_id: 'tenant1' },
        tenantAdmin: { user_id: 'admin1', role: UserRole.TENANT_ADMIN, tenant_id: 'tenant1' },
        otherTenantUser: { user_id: 'user2', role: UserRole.USER, tenant_id: 'tenant2' },
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Default successful auth/tenant middleware responses
        mockAuthMiddleware.mockResolvedValue({
            success: true,
            user: testUsers.endUser,
        });

        mockTenantMiddleware.mockResolvedValue({
            success: true,
            tenant: testTenant,
        });

        // Default notification service responses
        mockNotificationService.sendTicketCreatedNotification = jest.fn().mockResolvedValue(true);
        mockNotificationService.sendTicketAssignedNotification = jest.fn().mockResolvedValue(true);
        mockNotificationService.sendTicketResolvedNotification = jest.fn().mockResolvedValue(true);
    });

    describe('POST /api/tickets - Ticket Creation', () => {
        it('should create ticket with valid data', async () => {
            const mockTicket = {
                id: 'ticket1',
                title: 'Test Ticket',
                description: 'Test description',
                status: TicketStatus.NEW,
                severity: TicketSeverity.MEDIUM,
                category: TicketCategory.IT_SUPPORT,
                requester: 'user1',
                created_at: new Date(),
            };

            mockTicketService.createTicket.mockResolvedValue(mockTicket);

            const request = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Test Ticket',
                    description: 'Test description',
                    impactLevel: 'medium',
                    deviceId: 'PC-001',
                    contactMethod: 'email',
                }),
            });

            const response = await createTicket(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockTicket);
            expect(mockTicketService.createTicket).toHaveBeenCalledWith(
                testTenant.id,
                testUsers.endUser.user_id,
                expect.objectContaining({
                    title: 'Test Ticket',
                    description: 'Test description',
                    severity: TicketSeverity.MEDIUM,
                    category: TicketCategory.IT_SUPPORT,
                })
            );
        });

        it('should validate required fields', async () => {
            const request = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: '', // Empty title
                    description: '', // Empty description
                    impactLevel: 'invalid', // Invalid impact level
                }),
            });

            const response = await createTicket(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.details.errors).toContain('Title is required');
            expect(data.error.details.errors).toContain('Description is required');
        });

        it('should handle phone contact method validation', async () => {
            const request = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Test Ticket',
                    description: 'Test description',
                    impactLevel: 'medium',
                    contactMethod: 'phone',
                    // phoneNumber missing
                }),
            });

            const response = await createTicket(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.details.errors).toContain('Phone number is required when phone contact is selected');
        });

        it('should handle service errors gracefully', async () => {
            mockTicketService.createTicket.mockRejectedValue(
                new Error('Database connection failed')
            );

            const request = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Test Ticket',
                    description: 'Test description',
                    impactLevel: 'medium',
                }),
            });

            const response = await createTicket(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_SERVER_ERROR');
        });

        it('should enforce tenant isolation', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: testUsers.otherTenantUser,
            });

            mockTenantMiddleware.mockResolvedValue({
                success: true,
                tenant: { id: 'tenant2', name: 'Other Tenant' },
            });

            const mockTicket = {
                id: 'ticket1',
                title: 'Test Ticket',
                tenant_id: 'tenant2', // Different tenant
            };

            mockTicketService.createTicket.mockResolvedValue(mockTicket);

            const request = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Test Ticket',
                    description: 'Test description',
                    impactLevel: 'medium',
                }),
            });

            const response = await createTicket(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(mockTicketService.createTicket).toHaveBeenCalledWith(
                'tenant2', // Should use correct tenant
                testUsers.otherTenantUser.user_id,
                expect.any(Object)
            );
        });
    });

    describe('GET /api/tickets - Ticket Listing', () => {
        it('should return paginated tickets with role-based filtering', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: testUsers.analyst,
            });

            const mockTickets = [
                {
                    id: 'ticket1',
                    title: 'IT Support Ticket',
                    category: TicketCategory.IT_SUPPORT,
                    status: TicketStatus.NEW,
                    severity: TicketSeverity.HIGH,
                },
                {
                    id: 'ticket2',
                    title: 'Another IT Ticket',
                    category: TicketCategory.IT_SUPPORT,
                    status: TicketStatus.IN_PROGRESS,
                    severity: TicketSeverity.MEDIUM,
                },
            ];

            mockTicketService.getTickets.mockResolvedValue({
                tickets: mockTickets,
                total: 2,
            });

            const request = new NextRequest('http://localhost/api/tickets?page=1&limit=10');

            const response = await getTickets(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.tickets).toEqual(mockTickets);
            expect(data.data.total).toBe(2);
            expect(data.data.pagination).toEqual({
                page: 1,
                limit: 10,
                total: 2,
                pages: 1,
            });

            expect(mockTicketService.getTickets).toHaveBeenCalledWith(
                testTenant.id,
                expect.objectContaining({
                    page: 1,
                    limit: 10,
                }),
                testUsers.analyst.role,
                testUsers.analyst.user_id
            );
        });

        it('should handle filtering parameters', async () => {
            mockTicketService.getTickets.mockResolvedValue({
                tickets: [],
                total: 0,
            });

            const request = new NextRequest(
                'http://localhost/api/tickets?status=new,in_progress&severity=high&assignee=analyst1'
            );

            const response = await getTickets(request);

            expect(response.status).toBe(200);
            expect(mockTicketService.getTickets).toHaveBeenCalledWith(
                testTenant.id,
                expect.objectContaining({
                    status: ['new', 'in_progress'],
                    severity: ['high'],
                    assignee: 'analyst1',
                }),
                testUsers.endUser.role,
                testUsers.endUser.user_id
            );
        });

        it('should enforce authentication', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: false,
                error: 'Invalid token',
            });

            const request = new NextRequest('http://localhost/api/tickets');

            const response = await getTickets(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });
    });

    describe('POST /api/tickets/[id]/assign - Self Assignment', () => {
        it('should assign ticket to analyst successfully', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: testUsers.analyst,
            });

            const mockAssignedTicket = {
                id: 'ticket1',
                title: 'Test Ticket',
                status: TicketStatus.IN_PROGRESS,
                assignee: testUsers.analyst.user_id,
            };

            mockTicketService.getTicketById.mockResolvedValue({
                id: 'ticket1',
                status: TicketStatus.NEW,
                assignee: null,
                category: TicketCategory.IT_SUPPORT,
            });

            mockTicketService.selfAssignTicket.mockResolvedValue(mockAssignedTicket);

            const request = new NextRequest('http://localhost/api/tickets/ticket1/assign', {
                method: 'POST',
            });

            const response = await assignTicket(request, {
                params: Promise.resolve({ id: 'ticket1' }),
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockAssignedTicket);
            expect(mockTicketService.selfAssignTicket).toHaveBeenCalledWith(
                testTenant.id,
                'ticket1',
                testUsers.analyst.user_id,
                testUsers.analyst.role
            );
        });

        it('should prevent assignment of already assigned tickets', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: testUsers.analyst,
            });

            mockTicketService.getTicketById.mockResolvedValue({
                id: 'ticket1',
                status: TicketStatus.IN_PROGRESS,
                assignee: 'other_analyst',
                category: TicketCategory.IT_SUPPORT,
            });

            const request = new NextRequest('http://localhost/api/tickets/ticket1/assign', {
                method: 'POST',
            });

            const response = await assignTicket(request, {
                params: Promise.resolve({ id: 'ticket1' }),
            });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TICKET_ALREADY_ASSIGNED');
        });

        it('should prevent cross-category assignment', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: testUsers.analyst, // IT Helpdesk Analyst
            });

            mockTicketService.getTicketById.mockResolvedValue({
                id: 'ticket1',
                status: TicketStatus.NEW,
                assignee: null,
                category: TicketCategory.SECURITY_INCIDENT, // Security category
            });

            const request = new NextRequest('http://localhost/api/tickets/ticket1/assign', {
                method: 'POST',
            });

            const response = await assignTicket(request, {
                params: Promise.resolve({ id: 'ticket1' }),
            });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('QUEUE_ACCESS_DENIED');
        });

        it('should handle non-existent tickets', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: testUsers.analyst,
            });

            mockTicketService.getTicketById.mockResolvedValue(null);

            const request = new NextRequest('http://localhost/api/tickets/nonexistent/assign', {
                method: 'POST',
            });

            const response = await assignTicket(request, {
                params: Promise.resolve({ id: 'nonexistent' }),
            });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TICKET_NOT_FOUND');
        });
    });

    describe('POST /api/tickets/[id]/resolve - Ticket Resolution', () => {
        it('should resolve ticket with knowledge article creation', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: testUsers.analyst,
            });

            const mockTicket = {
                id: 'ticket1',
                title: 'Computer Issues',
                status: TicketStatus.IN_PROGRESS,
                assignee: testUsers.analyst.user_id,
            };

            const mockResolvedTicket = {
                ...mockTicket,
                status: TicketStatus.RESOLVED,
            };

            const mockKnowledgeArticle = {
                id: 'kb1',
                title: 'Computer Startup Issues',
                source_ticket_id: 'ticket1',
            };

            mockTicketService.getTicketById.mockResolvedValue(mockTicket);
            mockTicketService.updateTicket.mockResolvedValue(mockResolvedTicket);
            mockKnowledgeBaseService.createArticleFromTicketResolution.mockResolvedValue(mockKnowledgeArticle);

            const request = new NextRequest('http://localhost/api/tickets/ticket1/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resolution: 'Replaced faulty power supply',
                    createKnowledgeArticle: true,
                    knowledgeArticleTitle: 'Computer Startup Issues',
                }),
            });

            const response = await resolveTicket(request, {
                params: Promise.resolve({ id: 'ticket1' }),
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.ticket).toEqual(mockResolvedTicket);
            expect(data.data.knowledgeArticle).toEqual(mockKnowledgeArticle);

            expect(mockTicketService.updateTicket).toHaveBeenCalledWith(
                testTenant.id,
                'ticket1',
                { status: TicketStatus.RESOLVED },
                testUsers.analyst.user_id,
                testUsers.analyst.role
            );

            expect(mockKnowledgeBaseService.createArticleFromTicketResolution).toHaveBeenCalledWith(
                testTenant.id,
                'ticket1',
                testUsers.analyst.user_id,
                'Computer Startup Issues',
                mockTicket.title,
                'Replaced faulty power supply'
            );
        });

        it('should resolve ticket without knowledge article creation', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: testUsers.analyst,
            });

            const mockTicket = {
                id: 'ticket1',
                status: TicketStatus.IN_PROGRESS,
                assignee: testUsers.analyst.user_id,
            };

            const mockResolvedTicket = {
                ...mockTicket,
                status: TicketStatus.RESOLVED,
            };

            mockTicketService.getTicketById.mockResolvedValue(mockTicket);
            mockTicketService.updateTicket.mockResolvedValue(mockResolvedTicket);

            const request = new NextRequest('http://localhost/api/tickets/ticket1/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resolution: 'Issue resolved by user restart',
                    createKnowledgeArticle: false,
                }),
            });

            const response = await resolveTicket(request, {
                params: Promise.resolve({ id: 'ticket1' }),
            });
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.ticket).toEqual(mockResolvedTicket);
            expect(data.data.knowledgeArticle).toBeUndefined();

            expect(mockKnowledgeBaseService.createArticleFromTicketResolution).not.toHaveBeenCalled();
        });

        it('should require resolution description', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: testUsers.analyst,
            });

            const request = new NextRequest('http://localhost/api/tickets/ticket1/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resolution: '', // Empty resolution
                    createKnowledgeArticle: false,
                }),
            });

            const response = await resolveTicket(request, {
                params: Promise.resolve({ id: 'ticket1' }),
            });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.details.errors).toContain('Resolution description is required');
        });

        it('should prevent non-analysts from resolving tickets', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: testUsers.endUser, // Regular user, not analyst
            });

            const request = new NextRequest('http://localhost/api/tickets/ticket1/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resolution: 'Fixed it myself',
                    createKnowledgeArticle: false,
                }),
            });

            const response = await resolveTicket(request, {
                params: Promise.resolve({ id: 'ticket1' }),
            });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INSUFFICIENT_PERMISSIONS');
        });
    });

    describe('GET /api/tickets/my - Personal Queue', () => {
        it('should return tickets assigned to the current user', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: testUsers.analyst,
            });

            const mockMyTickets = [
                {
                    id: 'ticket1',
                    title: 'My Assigned Ticket 1',
                    assignee: testUsers.analyst.user_id,
                    status: TicketStatus.IN_PROGRESS,
                },
                {
                    id: 'ticket2',
                    title: 'My Assigned Ticket 2',
                    assignee: testUsers.analyst.user_id,
                    status: TicketStatus.AWAITING_RESPONSE,
                },
            ];

            mockTicketService.getMyTickets.mockResolvedValue({
                tickets: mockMyTickets,
                total: 2,
            });

            const request = new NextRequest('http://localhost/api/tickets/my');

            const response = await getMyTickets(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.tickets).toEqual(mockMyTickets);
            expect(data.data.total).toBe(2);

            expect(mockTicketService.getMyTickets).toHaveBeenCalledWith(
                testTenant.id,
                testUsers.analyst.user_id,
                testUsers.analyst.role,
                expect.any(Object)
            );
        });

        it('should return empty list for users with no assigned tickets', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: testUsers.analyst,
            });

            mockTicketService.getMyTickets.mockResolvedValue({
                tickets: [],
                total: 0,
            });

            const request = new NextRequest('http://localhost/api/tickets/my');

            const response = await getMyTickets(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.tickets).toEqual([]);
            expect(data.data.total).toBe(0);
        });
    });

    describe('Performance and Concurrent Access', () => {
        it('should handle multiple concurrent ticket creation requests', async () => {
            const mockTickets = Array.from({ length: 5 }, (_, i) => ({
                id: `ticket${i + 1}`,
                title: `Concurrent Ticket ${i + 1}`,
                status: TicketStatus.NEW,
            }));

            mockTicketService.createTicket
                .mockResolvedValueOnce(mockTickets[0])
                .mockResolvedValueOnce(mockTickets[1])
                .mockResolvedValueOnce(mockTickets[2])
                .mockResolvedValueOnce(mockTickets[3])
                .mockResolvedValueOnce(mockTickets[4]);

            const requests = Array.from({ length: 5 }, (_, i) =>
                new NextRequest('http://localhost/api/tickets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: `Concurrent Ticket ${i + 1}`,
                        description: `Description ${i + 1}`,
                        impactLevel: 'medium',
                    }),
                })
            );

            const responses = await Promise.all(
                requests.map(request => createTicket(request))
            );

            // All requests should succeed
            responses.forEach((response, i) => {
                expect(response.status).toBe(201);
            });

            expect(mockTicketService.createTicket).toHaveBeenCalledTimes(5);
        });

        it('should handle large result sets with pagination', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: testUsers.analyst,
            });

            const mockLargeTicketSet = Array.from({ length: 100 }, (_, i) => ({
                id: `ticket${i + 1}`,
                title: `Ticket ${i + 1}`,
                status: TicketStatus.NEW,
            }));

            mockTicketService.getTickets.mockResolvedValue({
                tickets: mockLargeTicketSet.slice(0, 20), // First page
                total: 100,
            });

            const request = new NextRequest('http://localhost/api/tickets?page=1&limit=20');

            const response = await getTickets(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.data.tickets).toHaveLength(20);
            expect(data.data.total).toBe(100);
            expect(data.data.pagination.pages).toBe(5);
        });

        it('should handle timeout scenarios gracefully', async () => {
            mockTicketService.createTicket.mockImplementation(
                () => new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), 100)
                )
            );

            const request = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Timeout Test',
                    description: 'Testing timeout handling',
                    impactLevel: 'medium',
                }),
            });

            const response = await createTicket(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_SERVER_ERROR');
        });
    });

    describe('Data Consistency and Validation', () => {
        it('should maintain referential integrity across operations', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: testUsers.analyst,
            });

            // Create ticket
            const mockTicket = {
                id: 'ticket1',
                title: 'Consistency Test',
                status: TicketStatus.NEW,
                tenant_id: testTenant.id,
                requester: testUsers.endUser.user_id,
            };

            mockTicketService.createTicket.mockResolvedValue(mockTicket);

            // Assign ticket
            const mockAssignedTicket = {
                ...mockTicket,
                status: TicketStatus.IN_PROGRESS,
                assignee: testUsers.analyst.user_id,
            };

            mockTicketService.getTicketById.mockResolvedValue(mockTicket);
            mockTicketService.selfAssignTicket.mockResolvedValue(mockAssignedTicket);

            // Create ticket
            const createRequest = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Consistency Test',
                    description: 'Testing data consistency',
                    impactLevel: 'medium',
                }),
            });

            const createResponse = await createTicket(createRequest);
            expect(createResponse.status).toBe(201);

            // Assign ticket
            const assignRequest = new NextRequest('http://localhost/api/tickets/ticket1/assign', {
                method: 'POST',
            });

            const assignResponse = await assignTicket(assignRequest, {
                params: Promise.resolve({ id: 'ticket1' }),
            });
            expect(assignResponse.status).toBe(200);

            // Verify all operations used consistent tenant and user data
            expect(mockTicketService.createTicket).toHaveBeenCalledWith(
                testTenant.id,
                testUsers.endUser.user_id,
                expect.any(Object)
            );

            expect(mockTicketService.selfAssignTicket).toHaveBeenCalledWith(
                testTenant.id,
                'ticket1',
                testUsers.analyst.user_id,
                testUsers.analyst.role
            );
        });

        it('should validate input sanitization', async () => {
            const maliciousInput = {
                title: '<script>alert("xss")</script>Malicious Title',
                description: 'javascript:alert("xss")',
                impactLevel: 'medium',
            };

            mockTicketService.createTicket.mockResolvedValue({
                id: 'ticket1',
                title: 'Malicious Title', // Should be sanitized
                description: 'javascript:alert("xss")', // Should be sanitized
                status: TicketStatus.NEW,
            });

            const request = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(maliciousInput),
            });

            const response = await createTicket(request);
            const data = await response.json();

            expect(response.status).toBe(201);
            // Verify that the service was called with sanitized input
            expect(mockTicketService.createTicket).toHaveBeenCalledWith(
                testTenant.id,
                testUsers.endUser.user_id,
                expect.objectContaining({
                    title: expect.not.stringContaining('<script>'),
                    description: expect.not.stringContaining('javascript:'),
                })
            );
        });
    });
});