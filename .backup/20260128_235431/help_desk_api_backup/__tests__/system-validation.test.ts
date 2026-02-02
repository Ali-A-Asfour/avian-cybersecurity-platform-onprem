/**
 * Help Desk System Validation Tests
 * 
 * Task 15: Final integration testing and polish
 * 
 * These tests validate the actual deployed help desk system by making
 * real API calls and verifying system behavior in a production-like environment.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Import API route handlers
import { GET as getTickets, POST as createTicket } from '@/app/api/tickets/route';
import { GET as getTicketById, PUT as updateTicket } from '@/app/api/tickets/[id]/route';
import { POST as assignTicket } from '@/app/api/tickets/[id]/assign/route';
import { POST as resolveTicket } from '@/app/api/tickets/[id]/resolve/route';
import { GET as getUnassignedQueue } from '@/app/api/help-desk/queue/unassigned/route';
import { GET as getMyTicketsQueue } from '@/app/api/help-desk/queue/my-tickets/route';
import { GET as getTenantAdminQueue } from '@/app/api/help-desk/queue/tenant-admin/route';
import { GET as getKnowledgeBase, POST as createKnowledgeArticle } from '@/app/api/help-desk/knowledge-base/route';

import { TicketStatus, TicketSeverity, TicketCategory, UserRole, TicketPriority } from '@/types';

describe('Help Desk System Validation Tests', () => {
    // Test environment setup
    const testTenantId = 'validation-tenant-' + Date.now();
    const testUsers = {
        endUser: {
            user_id: 'validation-user-' + Date.now(),
            role: UserRole.USER,
            tenant_id: testTenantId,
            email: 'user@validation.test'
        },
        analyst: {
            user_id: 'validation-analyst-' + Date.now(),
            role: UserRole.IT_HELPDESK_ANALYST,
            tenant_id: testTenantId,
            email: 'analyst@validation.test'
        },
        tenantAdmin: {
            user_id: 'validation-admin-' + Date.now(),
            role: UserRole.TENANT_ADMIN,
            tenant_id: testTenantId,
            email: 'admin@validation.test'
        }
    };

    let createdTicketIds: string[] = [];

    beforeAll(() => {
        // Set up test environment
        process.env.NODE_ENV = 'test';
        process.env.BYPASS_AUTH = 'true';
    });

    afterAll(async () => {
        // Clean up created test data
        console.log(`Cleaning up ${createdTicketIds.length} test tickets...`);
        // Note: In a real system, you'd want to clean up test data
        delete process.env.BYPASS_AUTH;
    });

    describe('API Endpoint Validation', () => {
        it('should create ticket via API endpoint', async () => {
            const ticketData = {
                title: 'API Validation Test Ticket',
                description: 'Testing ticket creation via API endpoint',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
                requester: testUsers.endUser.user_id,
                device_id: 'API-TEST-001',
                contact_method: 'email'
            };

            const request = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.endUser.user_id,
                    'x-user-role': testUsers.endUser.role,
                },
                body: JSON.stringify(ticketData)
            });

            const response = await createTicket(request);
            expect(response.status).toBe(201);

            const responseData = await response.json();
            expect(responseData.success).toBe(true);
            expect(responseData.ticket).toBeDefined();
            expect(responseData.ticket.title).toBe(ticketData.title);
            expect(responseData.ticket.status).toBe(TicketStatus.NEW);
            expect(responseData.ticket.device_id).toBe('API-TEST-001');

            createdTicketIds.push(responseData.ticket.id);
        });

        it('should retrieve tickets via API endpoint', async () => {
            const request = new NextRequest('http://localhost/api/tickets', {
                method: 'GET',
                headers: {
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.analyst.user_id,
                    'x-user-role': testUsers.analyst.role,
                }
            });

            const response = await getTickets(request);
            expect(response.status).toBe(200);

            const responseData = await response.json();
            expect(responseData.success).toBe(true);
            expect(responseData.tickets).toBeDefined();
            expect(Array.isArray(responseData.tickets)).toBe(true);
        });

        it('should assign ticket via API endpoint', async () => {
            // First create a ticket
            const ticketData = {
                title: 'Assignment Test Ticket',
                description: 'Testing ticket assignment via API',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.HIGH,
                priority: TicketPriority.HIGH,
                requester: testUsers.endUser.user_id,
            };

            const createRequest = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.endUser.user_id,
                    'x-user-role': testUsers.endUser.role,
                },
                body: JSON.stringify(ticketData)
            });

            const createResponse = await createTicket(createRequest);
            const createData = await createResponse.json();
            const ticketId = createData.ticket.id;
            createdTicketIds.push(ticketId);

            // Now assign the ticket
            const assignRequest = new NextRequest(`http://localhost/api/tickets/${ticketId}/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.analyst.user_id,
                    'x-user-role': testUsers.analyst.role,
                },
                body: JSON.stringify({})
            });

            const assignResponse = await assignTicket(assignRequest, { params: { id: ticketId } });
            expect(assignResponse.status).toBe(200);

            const assignData = await assignResponse.json();
            expect(assignData.success).toBe(true);
            expect(assignData.ticket.assignee).toBe(testUsers.analyst.user_id);
            expect(assignData.ticket.status).toBe(TicketStatus.IN_PROGRESS);
        });

        it('should resolve ticket via API endpoint', async () => {
            // Create and assign a ticket first
            const ticketData = {
                title: 'Resolution Test Ticket',
                description: 'Testing ticket resolution via API',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
                requester: testUsers.endUser.user_id,
            };

            const createRequest = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.endUser.user_id,
                    'x-user-role': testUsers.endUser.role,
                },
                body: JSON.stringify(ticketData)
            });

            const createResponse = await createTicket(createRequest);
            const createData = await createResponse.json();
            const ticketId = createData.ticket.id;
            createdTicketIds.push(ticketId);

            // Assign the ticket
            const assignRequest = new NextRequest(`http://localhost/api/tickets/${ticketId}/assign`, {
                method: 'POST',
                headers: {
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.analyst.user_id,
                    'x-user-role': testUsers.analyst.role,
                }
            });

            await assignTicket(assignRequest, { params: { id: ticketId } });

            // Now resolve the ticket
            const resolveRequest = new NextRequest(`http://localhost/api/tickets/${ticketId}/resolve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.analyst.user_id,
                    'x-user-role': testUsers.analyst.role,
                },
                body: JSON.stringify({
                    resolution: 'Issue resolved successfully via API test',
                    create_knowledge_article: true,
                    knowledge_article_title: 'API Resolution Test Article'
                })
            });

            const resolveResponse = await resolveTicket(resolveRequest, { params: { id: ticketId } });
            expect(resolveResponse.status).toBe(200);

            const resolveData = await resolveResponse.json();
            expect(resolveData.success).toBe(true);
            expect(resolveData.ticket.status).toBe(TicketStatus.RESOLVED);
            expect(resolveData.ticket.resolution).toBe('Issue resolved successfully via API test');
        });
    });

    describe('Queue Management API Validation', () => {
        it('should retrieve unassigned queue via API', async () => {
            const request = new NextRequest('http://localhost/api/help-desk/queue/unassigned', {
                method: 'GET',
                headers: {
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.analyst.user_id,
                    'x-user-role': testUsers.analyst.role,
                }
            });

            const response = await getUnassignedQueue(request);
            expect(response.status).toBe(200);

            const responseData = await response.json();
            expect(responseData.success).toBe(true);
            expect(responseData.tickets).toBeDefined();
            expect(Array.isArray(responseData.tickets)).toBe(true);
        });

        it('should retrieve my tickets queue via API', async () => {
            const request = new NextRequest('http://localhost/api/help-desk/queue/my-tickets', {
                method: 'GET',
                headers: {
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.analyst.user_id,
                    'x-user-role': testUsers.analyst.role,
                }
            });

            const response = await getMyTicketsQueue(request);
            expect(response.status).toBe(200);

            const responseData = await response.json();
            expect(responseData.success).toBe(true);
            expect(responseData.tickets).toBeDefined();
            expect(Array.isArray(responseData.tickets)).toBe(true);
        });

        it('should retrieve tenant admin queue via API', async () => {
            const request = new NextRequest('http://localhost/api/help-desk/queue/tenant-admin', {
                method: 'GET',
                headers: {
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.tenantAdmin.user_id,
                    'x-user-role': testUsers.tenantAdmin.role,
                }
            });

            const response = await getTenantAdminQueue(request);
            expect(response.status).toBe(200);

            const responseData = await response.json();
            expect(responseData.success).toBe(true);
            expect(responseData.tickets).toBeDefined();
            expect(Array.isArray(responseData.tickets)).toBe(true);
        });

        it('should deny tenant admin queue access to non-admin users', async () => {
            const request = new NextRequest('http://localhost/api/help-desk/queue/tenant-admin', {
                method: 'GET',
                headers: {
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.analyst.user_id,
                    'x-user-role': testUsers.analyst.role,
                }
            });

            const response = await getTenantAdminQueue(request);
            expect(response.status).toBe(403);

            const responseData = await response.json();
            expect(responseData.success).toBe(false);
            expect(responseData.error).toContain('Access denied');
        });
    });

    describe('Knowledge Base API Validation', () => {
        it('should create knowledge article via API', async () => {
            const articleData = {
                title: 'API Knowledge Base Test Article',
                problem_description: 'Testing knowledge article creation via API',
                resolution: 'This is a test resolution created via API validation',
            };

            const request = new NextRequest('http://localhost/api/help-desk/knowledge-base', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.analyst.user_id,
                    'x-user-role': testUsers.analyst.role,
                },
                body: JSON.stringify(articleData)
            });

            const response = await createKnowledgeArticle(request);
            expect(response.status).toBe(201);

            const responseData = await response.json();
            expect(responseData.success).toBe(true);
            expect(responseData.article).toBeDefined();
            expect(responseData.article.title).toBe(articleData.title);
            expect(responseData.article.problem_description).toBe(articleData.problem_description);
            expect(responseData.article.resolution).toBe(articleData.resolution);
        });

        it('should search knowledge base via API', async () => {
            const request = new NextRequest('http://localhost/api/help-desk/knowledge-base?query=API', {
                method: 'GET',
                headers: {
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.analyst.user_id,
                    'x-user-role': testUsers.analyst.role,
                }
            });

            const response = await getKnowledgeBase(request);
            expect(response.status).toBe(200);

            const responseData = await response.json();
            expect(responseData.success).toBe(true);
            expect(responseData.articles).toBeDefined();
            expect(Array.isArray(responseData.articles)).toBe(true);
        });
    });

    describe('Error Handling Validation', () => {
        it('should handle invalid ticket creation data', async () => {
            const invalidTicketData = {
                // Missing required fields
                description: 'Invalid ticket test',
            };

            const request = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.endUser.user_id,
                    'x-user-role': testUsers.endUser.role,
                },
                body: JSON.stringify(invalidTicketData)
            });

            const response = await createTicket(request);
            expect(response.status).toBe(400);

            const responseData = await response.json();
            expect(responseData.success).toBe(false);
            expect(responseData.error).toBeDefined();
        });

        it('should handle unauthorized access attempts', async () => {
            const request = new NextRequest('http://localhost/api/tickets', {
                method: 'GET',
                headers: {
                    // Missing authentication headers
                }
            });

            const response = await getTickets(request);
            expect(response.status).toBe(401);

            const responseData = await response.json();
            expect(responseData.success).toBe(false);
            expect(responseData.error).toContain('authentication');
        });

        it('should handle non-existent ticket access', async () => {
            const nonExistentTicketId = 'non-existent-ticket-id';

            const request = new NextRequest(`http://localhost/api/tickets/${nonExistentTicketId}`, {
                method: 'GET',
                headers: {
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.analyst.user_id,
                    'x-user-role': testUsers.analyst.role,
                }
            });

            const response = await getTicketById(request, { params: { id: nonExistentTicketId } });
            expect(response.status).toBe(404);

            const responseData = await response.json();
            expect(responseData.success).toBe(false);
            expect(responseData.error).toContain('not found');
        });
    });

    describe('Tenant Isolation Validation', () => {
        it('should prevent cross-tenant ticket access', async () => {
            const otherTenantId = 'other-tenant-' + Date.now();

            // Create ticket in original tenant
            const ticketData = {
                title: 'Cross-tenant isolation test',
                description: 'Testing tenant isolation',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
                requester: testUsers.endUser.user_id,
            };

            const createRequest = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.endUser.user_id,
                    'x-user-role': testUsers.endUser.role,
                },
                body: JSON.stringify(ticketData)
            });

            const createResponse = await createTicket(createRequest);
            const createData = await createResponse.json();
            const ticketId = createData.ticket.id;
            createdTicketIds.push(ticketId);

            // Try to access ticket from different tenant
            const accessRequest = new NextRequest(`http://localhost/api/tickets/${ticketId}`, {
                method: 'GET',
                headers: {
                    'x-tenant-id': otherTenantId, // Different tenant
                    'x-user-id': 'other-user',
                    'x-user-role': UserRole.IT_HELPDESK_ANALYST,
                }
            });

            const accessResponse = await getTicketById(accessRequest, { params: { id: ticketId } });
            expect(accessResponse.status).toBe(404); // Should not find ticket in different tenant

            const accessData = await accessResponse.json();
            expect(accessData.success).toBe(false);
        });

        it('should isolate queue access by tenant', async () => {
            const otherTenantId = 'queue-isolation-tenant-' + Date.now();

            // Try to access queue from different tenant
            const request = new NextRequest('http://localhost/api/help-desk/queue/unassigned', {
                method: 'GET',
                headers: {
                    'x-tenant-id': otherTenantId, // Different tenant
                    'x-user-id': 'other-analyst',
                    'x-user-role': UserRole.IT_HELPDESK_ANALYST,
                }
            });

            const response = await getUnassignedQueue(request);
            expect(response.status).toBe(200);

            const responseData = await response.json();
            expect(responseData.success).toBe(true);
            expect(responseData.tickets).toBeDefined();

            // Should not contain tickets from our test tenant
            const ticketTenants = responseData.tickets.map((ticket: any) => ticket.tenant_id);
            expect(ticketTenants).not.toContain(testTenantId);
        });
    });

    describe('Performance Validation', () => {
        it('should handle API requests within acceptable time limits', async () => {
            const startTime = Date.now();

            const request = new NextRequest('http://localhost/api/tickets', {
                method: 'GET',
                headers: {
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.analyst.user_id,
                    'x-user-role': testUsers.analyst.role,
                }
            });

            const response = await getTickets(request);
            const responseTime = Date.now() - startTime;

            expect(response.status).toBe(200);
            expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
        });

        it('should handle concurrent API requests efficiently', async () => {
            const concurrentRequests = 10;
            const startTime = Date.now();

            const requests = Array.from({ length: concurrentRequests }, () => {
                const request = new NextRequest('http://localhost/api/help-desk/queue/unassigned', {
                    method: 'GET',
                    headers: {
                        'x-tenant-id': testTenantId,
                        'x-user-id': testUsers.analyst.user_id,
                        'x-user-role': testUsers.analyst.role,
                    }
                });
                return getUnassignedQueue(request);
            });

            const responses = await Promise.all(requests);
            const totalTime = Date.now() - startTime;

            // All requests should succeed
            responses.forEach(response => {
                expect(response.status).toBe(200);
            });

            // Should handle concurrent requests efficiently
            expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
        });
    });

    describe('Data Integrity Validation', () => {
        it('should maintain data consistency across operations', async () => {
            // Create a ticket
            const ticketData = {
                title: 'Data Integrity Test',
                description: 'Testing data consistency',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.HIGH,
                priority: TicketPriority.HIGH,
                requester: testUsers.endUser.user_id,
                device_id: 'INTEGRITY-001',
            };

            const createRequest = new NextRequest('http://localhost/api/tickets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.endUser.user_id,
                    'x-user-role': testUsers.endUser.role,
                },
                body: JSON.stringify(ticketData)
            });

            const createResponse = await createTicket(createRequest);
            const createData = await createResponse.json();
            const ticketId = createData.ticket.id;
            createdTicketIds.push(ticketId);

            // Verify ticket appears in unassigned queue
            const queueRequest = new NextRequest('http://localhost/api/help-desk/queue/unassigned', {
                method: 'GET',
                headers: {
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.analyst.user_id,
                    'x-user-role': testUsers.analyst.role,
                }
            });

            const queueResponse = await getUnassignedQueue(queueRequest);
            const queueData = await queueResponse.json();

            const ticketInQueue = queueData.tickets.find((ticket: any) => ticket.id === ticketId);
            expect(ticketInQueue).toBeDefined();
            expect(ticketInQueue.device_id).toBe('INTEGRITY-001');

            // Assign the ticket
            const assignRequest = new NextRequest(`http://localhost/api/tickets/${ticketId}/assign`, {
                method: 'POST',
                headers: {
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.analyst.user_id,
                    'x-user-role': testUsers.analyst.role,
                }
            });

            await assignTicket(assignRequest, { params: { id: ticketId } });

            // Verify ticket appears in analyst's queue
            const myTicketsRequest = new NextRequest('http://localhost/api/help-desk/queue/my-tickets', {
                method: 'GET',
                headers: {
                    'x-tenant-id': testTenantId,
                    'x-user-id': testUsers.analyst.user_id,
                    'x-user-role': testUsers.analyst.role,
                }
            });

            const myTicketsResponse = await getMyTicketsQueue(myTicketsRequest);
            const myTicketsData = await myTicketsResponse.json();

            const assignedTicket = myTicketsData.tickets.find((ticket: any) => ticket.id === ticketId);
            expect(assignedTicket).toBeDefined();
            expect(assignedTicket.assignee).toBe(testUsers.analyst.user_id);
            expect(assignedTicket.status).toBe(TicketStatus.IN_PROGRESS);
        });
    });
});