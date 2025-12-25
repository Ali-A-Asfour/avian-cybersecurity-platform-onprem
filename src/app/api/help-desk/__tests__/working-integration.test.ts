/**
 * Working Help Desk Integration Tests
 * 
 * Task 15: Final integration testing and polish
 * 
 * Simplified integration tests that work with the current system implementation
 * and validate core functionality without complex mocking.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TicketService } from '@/services/ticket.service';
import { KnowledgeBaseService } from '@/services/help-desk/KnowledgeBaseService';
import { QueueManagementService } from '@/services/help-desk/QueueManagementService';
import { TicketStatus, TicketSeverity, TicketCategory, UserRole, TicketPriority } from '@/types';

describe('Help Desk Working Integration Tests', () => {
    // Use unique identifiers to avoid test interference
    const testTenantId = `integration-test-${Date.now()}`;
    const testUsers = {
        endUser: {
            user_id: `user-${Date.now()}`,
            role: UserRole.USER,
            tenant_id: testTenantId,
        },
        analyst: {
            user_id: `analyst-${Date.now()}`,
            role: UserRole.IT_HELPDESK_ANALYST,
            tenant_id: testTenantId,
        },
        tenantAdmin: {
            user_id: `admin-${Date.now()}`,
            role: UserRole.TENANT_ADMIN,
            tenant_id: testTenantId,
        }
    };

    let createdTicketIds: string[] = [];

    beforeEach(() => {
        // Set up test environment
        process.env.NODE_ENV = 'test';
        createdTicketIds = [];
    });

    afterEach(() => {
        // Clean up would go here in a real system
        createdTicketIds = [];
    });

    describe('Basic Ticket Workflow Integration', () => {
        it('should create a ticket successfully', async () => {
            const ticketData = {
                requester: testUsers.endUser.user_id,
                title: 'Integration Test Ticket',
                description: 'Testing basic ticket creation',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
            };

            const ticket = await TicketService.createTicket(
                testTenantId,
                testUsers.endUser.user_id,
                ticketData
            );

            expect(ticket).toBeDefined();
            expect(ticket.title).toBe('Integration Test Ticket');
            expect(ticket.status).toBe(TicketStatus.NEW);
            expect(ticket.tenant_id).toBe(testTenantId);
            expect(ticket.requester).toBe(testUsers.endUser.user_id);

            createdTicketIds.push(ticket.id);
        });

        it('should retrieve tickets for a tenant', async () => {
            // Create a test ticket first
            const ticketData = {
                requester: testUsers.endUser.user_id,
                title: 'Retrieval Test Ticket',
                description: 'Testing ticket retrieval',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.LOW,
                priority: TicketPriority.LOW,
            };

            const createdTicket = await TicketService.createTicket(
                testTenantId,
                testUsers.endUser.user_id,
                ticketData
            );
            createdTicketIds.push(createdTicket.id);

            // Retrieve tickets
            const result = await TicketService.getTickets(
                testTenantId,
                {},
                testUsers.analyst.role,
                testUsers.analyst.user_id
            );

            expect(result).toBeDefined();
            expect(result.tickets).toBeDefined();
            expect(Array.isArray(result.tickets)).toBe(true);

            // Should find our created ticket
            const foundTicket = result.tickets.find(t => t.id === createdTicket.id);
            expect(foundTicket).toBeDefined();
            expect(foundTicket?.title).toBe('Retrieval Test Ticket');
        });

        it('should assign a ticket to an analyst', async () => {
            // Create a ticket
            const ticketData = {
                requester: testUsers.endUser.user_id,
                title: 'Assignment Test Ticket',
                description: 'Testing ticket assignment',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.HIGH,
                priority: TicketPriority.HIGH,
            };

            const ticket = await TicketService.createTicket(
                testTenantId,
                testUsers.endUser.user_id,
                ticketData
            );
            createdTicketIds.push(ticket.id);

            // Assign the ticket
            const assignedTicket = await TicketService.selfAssignTicket(
                testTenantId,
                ticket.id,
                testUsers.analyst.user_id,
                testUsers.analyst.role
            );

            expect(assignedTicket).toBeDefined();
            expect(assignedTicket!.assignee).toBe(testUsers.analyst.user_id);
            expect(assignedTicket!.status).toBe(TicketStatus.IN_PROGRESS);
        });

        it('should update ticket status', async () => {
            // Create and assign a ticket
            const ticketData = {
                requester: testUsers.endUser.user_id,
                title: 'Status Update Test',
                description: 'Testing status updates',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
            };

            const ticket = await TicketService.createTicket(
                testTenantId,
                testUsers.endUser.user_id,
                ticketData
            );
            createdTicketIds.push(ticket.id);

            await TicketService.selfAssignTicket(
                testTenantId,
                ticket.id,
                testUsers.analyst.user_id,
                testUsers.analyst.role
            );

            // Update to resolved
            const updatedTicket = await TicketService.updateTicket(
                testTenantId,
                ticket.id,
                {
                    status: TicketStatus.RESOLVED,
                    resolution: 'Issue resolved successfully'
                },
                testUsers.analyst.user_id,
                testUsers.analyst.role
            );

            expect(updatedTicket).toBeDefined();
            expect(updatedTicket!.status).toBe(TicketStatus.RESOLVED);
            expect(updatedTicket!.resolution).toBe('Issue resolved successfully');
        });

        it('should add comments to tickets', async () => {
            // Create a ticket
            const ticketData = {
                requester: testUsers.endUser.user_id,
                title: 'Comment Test Ticket',
                description: 'Testing comment functionality',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
            };

            const ticket = await TicketService.createTicket(
                testTenantId,
                testUsers.endUser.user_id,
                ticketData
            );
            createdTicketIds.push(ticket.id);

            // Add a comment
            const comment = await TicketService.addComment(
                testTenantId,
                ticket.id,
                testUsers.analyst.user_id,
                {
                    content: 'This is a test comment',
                    is_internal: false,
                }
            );

            expect(comment).toBeDefined();
            expect(comment.content).toBe('This is a test comment');
            expect(comment.is_internal).toBe(false);
            expect(comment.user_id).toBe(testUsers.analyst.user_id);
        });
    });

    describe('Queue Management Integration', () => {
        it('should retrieve unassigned queue', async () => {
            // Create an unassigned ticket
            const ticketData = {
                requester: testUsers.endUser.user_id,
                title: 'Unassigned Queue Test',
                description: 'Testing unassigned queue',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.HIGH,
                priority: TicketPriority.HIGH,
            };

            const ticket = await TicketService.createTicket(
                testTenantId,
                testUsers.endUser.user_id,
                ticketData
            );
            createdTicketIds.push(ticket.id);

            // Get unassigned queue
            const queue = await QueueManagementService.getUnassignedQueue(
                testTenantId,
                testUsers.analyst.role,
                testUsers.analyst.user_id
            );

            expect(queue).toBeDefined();
            expect(queue.tickets).toBeDefined();
            expect(Array.isArray(queue.tickets)).toBe(true);

            // Should find our unassigned ticket
            const foundTicket = queue.tickets.find(t => t.id === ticket.id);
            expect(foundTicket).toBeDefined();
            expect(foundTicket?.assignee).toBeUndefined();
        });

        it('should retrieve analyst personal queue', async () => {
            // Create and assign a ticket
            const ticketData = {
                requester: testUsers.endUser.user_id,
                title: 'Personal Queue Test',
                description: 'Testing personal queue',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
            };

            const ticket = await TicketService.createTicket(
                testTenantId,
                testUsers.endUser.user_id,
                ticketData
            );
            createdTicketIds.push(ticket.id);

            await TicketService.selfAssignTicket(
                testTenantId,
                ticket.id,
                testUsers.analyst.user_id,
                testUsers.analyst.role
            );

            // Get analyst's personal queue
            const queue = await QueueManagementService.getMyTicketsQueue(
                testTenantId,
                testUsers.analyst.user_id,
                testUsers.analyst.role
            );

            expect(queue).toBeDefined();
            expect(queue.tickets).toBeDefined();
            expect(Array.isArray(queue.tickets)).toBe(true);

            // Should find our assigned ticket
            const foundTicket = queue.tickets.find(t => t.id === ticket.id);
            expect(foundTicket).toBeDefined();
            expect(foundTicket?.assignee).toBe(testUsers.analyst.user_id);
        });

        it('should calculate queue metrics', async () => {
            // Create tickets with different severities
            const tickets = [];

            for (let i = 0; i < 3; i++) {
                const ticketData = {
                    requester: testUsers.endUser.user_id,
                    title: `Metrics Test Ticket ${i + 1}`,
                    description: `Testing metrics calculation ${i + 1}`,
                    category: TicketCategory.IT_SUPPORT,
                    severity: i === 0 ? TicketSeverity.CRITICAL :
                        i === 1 ? TicketSeverity.HIGH : TicketSeverity.MEDIUM,
                    priority: i === 0 ? TicketPriority.URGENT :
                        i === 1 ? TicketPriority.HIGH : TicketPriority.MEDIUM,
                };

                const ticket = await TicketService.createTicket(
                    testTenantId,
                    testUsers.endUser.user_id,
                    ticketData
                );
                tickets.push(ticket);
                createdTicketIds.push(ticket.id);
            }

            // Assign one ticket
            await TicketService.selfAssignTicket(
                testTenantId,
                tickets[0].id,
                testUsers.analyst.user_id,
                testUsers.analyst.role
            );

            // Get metrics
            const metrics = await QueueManagementService.getQueueMetrics(
                testTenantId,
                testUsers.analyst.role,
                testUsers.analyst.user_id
            );

            expect(metrics).toBeDefined();
            expect(metrics.total_tickets).toBeGreaterThanOrEqual(3);
            expect(metrics.unassigned_tickets).toBeGreaterThanOrEqual(2);
            expect(metrics.assigned_tickets).toBeGreaterThanOrEqual(1);
            expect(metrics.by_severity).toBeDefined();
            expect(metrics.by_status).toBeDefined();
        });
    });

    describe('Knowledge Base Integration', () => {
        it('should create knowledge base articles', async () => {
            const articleData = {
                title: 'Integration Test Article',
                problemDescription: 'Testing knowledge base integration',
                resolution: 'This is a test resolution for integration testing',
            };

            const article = await KnowledgeBaseService.createArticle(
                testTenantId,
                testUsers.analyst.user_id,
                articleData
            );

            expect(article).toBeDefined();
            expect(article.title).toBe('Integration Test Article');
            expect(article.problem_description).toBe('Testing knowledge base integration');
            expect(article.resolution).toBe('This is a test resolution for integration testing');
            expect(article.created_by).toBe(testUsers.analyst.user_id);
            expect(article.tenant_id).toBe(testTenantId);
        });

        it('should search knowledge base articles', async () => {
            // Create a test article
            const articleData = {
                title: 'Searchable Test Article',
                problemDescription: 'Testing search functionality',
                resolution: 'This article should be findable via search',
            };

            const article = await KnowledgeBaseService.createArticle(
                testTenantId,
                testUsers.analyst.user_id,
                articleData
            );

            // Search for the article
            const searchResults = await KnowledgeBaseService.searchArticles(testTenantId, {
                query: 'searchable test',
            });

            expect(searchResults).toBeDefined();
            expect(searchResults.articles).toBeDefined();
            expect(Array.isArray(searchResults.articles)).toBe(true);

            // Should find our article
            const foundArticle = searchResults.articles.find(a => a.id === article.id);
            expect(foundArticle).toBeDefined();
            expect(foundArticle?.title).toBe('Searchable Test Article');
        });

        it('should create knowledge articles from ticket resolutions', async () => {
            // Create and resolve a ticket
            const ticketData = {
                requester: testUsers.endUser.user_id,
                title: 'KB Creation Test Ticket',
                description: 'Testing KB article creation from resolution',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
            };

            const ticket = await TicketService.createTicket(
                testTenantId,
                testUsers.endUser.user_id,
                ticketData
            );
            createdTicketIds.push(ticket.id);

            await TicketService.selfAssignTicket(
                testTenantId,
                ticket.id,
                testUsers.analyst.user_id,
                testUsers.analyst.role
            );

            // Create KB article from resolution
            const article = await KnowledgeBaseService.createArticleFromTicketResolution(
                testTenantId,
                ticket.id,
                testUsers.analyst.user_id,
                'KB Test Article Title',
                'Problem description from ticket',
                'Resolution steps from ticket'
            );

            expect(article).toBeDefined();
            expect(article.title).toBe('KB Test Article Title');
            expect(article.problem_description).toBe('Problem description from ticket');
            expect(article.resolution).toBe('Resolution steps from ticket');
            expect(article.source_ticket_id).toBe(ticket.id);
        });
    });

    describe('Basic Tenant Isolation', () => {
        it('should isolate tickets by tenant', async () => {
            const otherTenantId = `other-tenant-${Date.now()}`;
            const otherUser = {
                user_id: `other-user-${Date.now()}`,
                role: UserRole.USER,
                tenant_id: otherTenantId,
            };

            // Create ticket in our test tenant
            const ourTicketData = {
                requester: testUsers.endUser.user_id,
                title: 'Our Tenant Ticket',
                description: 'This belongs to our tenant',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
            };

            const ourTicket = await TicketService.createTicket(
                testTenantId,
                testUsers.endUser.user_id,
                ourTicketData
            );
            createdTicketIds.push(ourTicket.id);

            // Create ticket in other tenant
            const otherTicketData = {
                requester: otherUser.user_id,
                title: 'Other Tenant Ticket',
                description: 'This belongs to other tenant',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
            };

            const otherTicket = await TicketService.createTicket(
                otherTenantId,
                otherUser.user_id,
                otherTicketData
            );

            // Get tickets for our tenant
            const ourTickets = await TicketService.getTickets(
                testTenantId,
                {},
                testUsers.analyst.role,
                testUsers.analyst.user_id
            );

            // Should only see our tenant's tickets
            const ourTicketIds = ourTickets.tickets.map(t => t.id);
            expect(ourTicketIds).toContain(ourTicket.id);
            expect(ourTicketIds).not.toContain(otherTicket.id);

            // Get tickets for other tenant
            const otherTickets = await TicketService.getTickets(
                otherTenantId,
                {},
                UserRole.IT_HELPDESK_ANALYST,
                'other-analyst'
            );

            // Should only see other tenant's tickets
            const otherTicketIds = otherTickets.tickets.map(t => t.id);
            expect(otherTicketIds).toContain(otherTicket.id);
            expect(otherTicketIds).not.toContain(ourTicket.id);
        });

        it('should isolate knowledge base by tenant', async () => {
            const otherTenantId = `kb-tenant-${Date.now()}`;

            // Create article in our tenant
            const ourArticle = await KnowledgeBaseService.createArticle(
                testTenantId,
                testUsers.analyst.user_id,
                {
                    title: 'Our Tenant Article',
                    problemDescription: 'Our tenant problem',
                    resolution: 'Our tenant solution',
                }
            );

            // Create article in other tenant
            const otherArticle = await KnowledgeBaseService.createArticle(
                otherTenantId,
                'other-analyst',
                {
                    title: 'Other Tenant Article',
                    problemDescription: 'Other tenant problem',
                    resolution: 'Other tenant solution',
                }
            );

            // Search in our tenant
            const ourSearch = await KnowledgeBaseService.searchArticles(testTenantId, {
                query: 'tenant',
            });

            const ourArticleIds = ourSearch.articles.map(a => a.id);
            expect(ourArticleIds).toContain(ourArticle.id);
            expect(ourArticleIds).not.toContain(otherArticle.id);

            // Search in other tenant
            const otherSearch = await KnowledgeBaseService.searchArticles(otherTenantId, {
                query: 'tenant',
            });

            const otherArticleIds = otherSearch.articles.map(a => a.id);
            expect(otherArticleIds).toContain(otherArticle.id);
            expect(otherArticleIds).not.toContain(ourArticle.id);
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid ticket creation gracefully', async () => {
            const invalidTicketData = {
                // Missing required fields
                requester: testUsers.endUser.user_id,
                description: 'Missing title',
            };

            await expect(
                TicketService.createTicket(
                    testTenantId,
                    testUsers.endUser.user_id,
                    invalidTicketData as any
                )
            ).rejects.toThrow();
        });

        it('should handle non-existent ticket access', async () => {
            const nonExistentId = 'non-existent-ticket-id';

            const result = await TicketService.getTicketById(testTenantId, nonExistentId);
            expect(result).toBeNull();
        });

        it('should handle invalid assignment attempts', async () => {
            const nonExistentTicketId = 'non-existent-ticket';

            await expect(
                TicketService.selfAssignTicket(
                    testTenantId,
                    nonExistentTicketId,
                    testUsers.analyst.user_id,
                    testUsers.analyst.role
                )
            ).rejects.toThrow();
        });
    });

    describe('Performance Validation', () => {
        it('should handle multiple ticket operations efficiently', async () => {
            const startTime = Date.now();
            const ticketCount = 5;
            const tickets = [];

            // Create multiple tickets
            for (let i = 0; i < ticketCount; i++) {
                const ticketData = {
                    requester: testUsers.endUser.user_id,
                    title: `Performance Test Ticket ${i + 1}`,
                    description: `Testing performance ${i + 1}`,
                    category: TicketCategory.IT_SUPPORT,
                    severity: TicketSeverity.MEDIUM,
                    priority: TicketPriority.MEDIUM,
                };

                const ticket = await TicketService.createTicket(
                    testTenantId,
                    testUsers.endUser.user_id,
                    ticketData
                );
                tickets.push(ticket);
                createdTicketIds.push(ticket.id);
            }

            const creationTime = Date.now() - startTime;
            expect(creationTime).toBeLessThan(5000); // Should complete within 5 seconds

            // Retrieve all tickets
            const retrievalStartTime = Date.now();
            const result = await TicketService.getTickets(
                testTenantId,
                {},
                testUsers.analyst.role,
                testUsers.analyst.user_id
            );
            const retrievalTime = Date.now() - retrievalStartTime;

            expect(result.tickets.length).toBeGreaterThanOrEqual(ticketCount);
            expect(retrievalTime).toBeLessThan(2000); // Should complete within 2 seconds
        });
    });
});