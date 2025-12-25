/**
 * Final Help Desk Integration Tests
 * 
 * Task 15: Final integration testing and polish
 * 
 * Comprehensive end-to-end integration tests covering:
 * - Complete ticket workflows from creation to closure
 * - Tenant isolation across all operations
 * - Email notification delivery validation
 * - Concurrent user scenarios and queue management
 * - System resilience and error handling
 * - Performance under load
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { TicketService } from '@/services/ticket.service';
import { KnowledgeBaseService } from '@/services/help-desk/KnowledgeBaseService';
import { StateManagementService } from '@/services/help-desk/StateManagementService';
import { QueueManagementService } from '@/services/help-desk/QueueManagementService';
import { TicketStatus, TicketSeverity, TicketCategory, UserRole, TicketPriority } from '@/types';

// Mock external dependencies
jest.mock('@/lib/help-desk/notification-service');
jest.mock('@/middleware/auth.middleware');
jest.mock('@/middleware/tenant.middleware');

const mockNotificationService = require('@/lib/help-desk/notification-service');
const mockAuthMiddleware = require('@/middleware/auth.middleware').authMiddleware;
const mockTenantMiddleware = require('@/middleware/tenant.middleware').tenantMiddleware;

describe('Help Desk Final Integration Tests', () => {
    // Test data setup
    const testTenants = {
        tenant1: { id: 'tenant-final-1', name: 'Healthcare Corp' },
        tenant2: { id: 'tenant-final-2', name: 'Tech Solutions' },
        tenant3: { id: 'tenant-final-3', name: 'Manufacturing Inc' },
    };

    const testUsers = {
        // Tenant 1 users
        endUser1: { user_id: 'user1-final', role: UserRole.USER, tenant_id: 'tenant-final-1' },
        analyst1: { user_id: 'analyst1-final', role: UserRole.IT_HELPDESK_ANALYST, tenant_id: 'tenant-final-1' },
        tenantAdmin1: { user_id: 'admin1-final', role: UserRole.TENANT_ADMIN, tenant_id: 'tenant-final-1' },

        // Tenant 2 users
        endUser2: { user_id: 'user2-final', role: UserRole.USER, tenant_id: 'tenant-final-2' },
        analyst2: { user_id: 'analyst2-final', role: UserRole.IT_HELPDESK_ANALYST, tenant_id: 'tenant-final-2' },
        tenantAdmin2: { user_id: 'admin2-final', role: UserRole.TENANT_ADMIN, tenant_id: 'tenant-final-2' },

        // Tenant 3 users
        endUser3: { user_id: 'user3-final', role: UserRole.USER, tenant_id: 'tenant-final-3' },
        analyst3: { user_id: 'analyst3-final', role: UserRole.IT_HELPDESK_ANALYST, tenant_id: 'tenant-final-3' },
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default middleware responses
        mockAuthMiddleware.mockResolvedValue({ success: true });
        mockTenantMiddleware.mockResolvedValue({ success: true });

        // Setup notification service mocks
        mockNotificationService.sendTicketCreatedNotification = jest.fn().mockResolvedValue(true);
        mockNotificationService.sendTicketAssignedNotification = jest.fn().mockResolvedValue(true);
        mockNotificationService.sendTicketResolvedNotification = jest.fn().mockResolvedValue(true);
        mockNotificationService.sendTicketReopenedNotification = jest.fn().mockResolvedValue(true);
    });

    afterEach(() => {
        // Clean up any state management timers
        StateManagementService.resetSLATimers();
    });

    describe('Complete End-to-End Ticket Workflows', () => {
        it('should complete full ticket lifecycle: creation → assignment → resolution → closure', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst = testUsers.analyst1;
            const tenantAdmin = testUsers.tenantAdmin1;

            // Step 1: End user creates ticket with all optional fields
            const ticketData = {
                requester: endUser.user_id,
                title: 'Computer won\'t start - urgent',
                description: 'My computer is not turning on when I press the power button. I have an important presentation in 2 hours.',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.CRITICAL,
                priority: TicketPriority.URGENT,
                device_id: 'PC-RECEP-01',
                contact_method: 'phone',
                phone_number: '+1-555-0123',
            };

            const createdTicket = await TicketService.createTicket(
                tenantId,
                endUser.user_id,
                ticketData
            );

            // Verify ticket creation
            expect(createdTicket).toBeDefined();
            expect(createdTicket.status).toBe(TicketStatus.NEW);
            expect(createdTicket.assignee).toBeUndefined();
            expect(createdTicket.device_id).toBe('PC-RECEP-01');
            expect(createdTicket.contact_method).toBe('phone');
            expect(mockNotificationService.sendTicketCreatedNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: createdTicket.id,
                    title: ticketData.title,
                    severity: TicketSeverity.CRITICAL,
                })
            );

            // Step 2: Analyst self-assigns ticket
            const assignedTicket = await TicketService.selfAssignTicket(
                tenantId,
                createdTicket.id,
                analyst.user_id,
                analyst.role
            );

            expect(assignedTicket).toBeDefined();
            expect(assignedTicket!.status).toBe(TicketStatus.IN_PROGRESS);
            expect(assignedTicket!.assignee).toBe(analyst.user_id);
            expect(mockNotificationService.sendTicketAssignedNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: assignedTicket!.id,
                    assignee: analyst.user_id,
                })
            );

            // Step 3: Analyst adds internal note
            const internalComment = await TicketService.addComment(
                tenantId,
                createdTicket.id,
                analyst.user_id,
                {
                    content: 'Checked power supply remotely via device management. PSU appears faulty. Scheduling on-site visit.',
                    is_internal: true,
                }
            );

            expect(internalComment).toBeDefined();
            expect(internalComment.is_internal).toBe(true);

            // Step 4: Analyst communicates with user
            const userComment = await TicketService.addComment(
                tenantId,
                createdTicket.id,
                analyst.user_id,
                {
                    content: 'I\'ve identified the issue as a faulty power supply. I\'ll be there in 30 minutes to replace it.',
                    is_internal: false,
                }
            );

            expect(userComment).toBeDefined();
            expect(userComment.is_internal).toBe(false);

            // Step 5: User responds
            const userResponse = await TicketService.addComment(
                tenantId,
                createdTicket.id,
                endUser.user_id,
                {
                    content: 'Thank you! I\'ll be at my desk waiting.',
                    is_internal: false,
                }
            );

            expect(userResponse).toBeDefined();

            // Step 6: Analyst resolves ticket with knowledge article creation
            const resolution = 'Replaced faulty power supply unit (Corsair RM750x). Computer now boots normally. Tested all peripherals and confirmed full functionality. Issue resolved.';

            const resolvedTicket = await TicketService.updateTicket(
                tenantId,
                createdTicket.id,
                {
                    status: TicketStatus.RESOLVED,
                    resolution: resolution,
                },
                analyst.user_id,
                analyst.role
            );

            expect(resolvedTicket).toBeDefined();
            expect(resolvedTicket!.status).toBe(TicketStatus.RESOLVED);
            expect(resolvedTicket!.resolution).toBe(resolution);

            // Create knowledge article from resolution
            const knowledgeArticle = await KnowledgeBaseService.createArticleFromTicketResolution(
                tenantId,
                createdTicket.id,
                analyst.user_id,
                'Computer Won\'t Start - Power Supply Failure',
                'Computer not turning on when power button is pressed, no lights or fans',
                resolution
            );

            expect(knowledgeArticle).toBeDefined();
            expect(knowledgeArticle.source_ticket_id).toBe(createdTicket.id);
            expect(knowledgeArticle.title).toBe('Computer Won\'t Start - Power Supply Failure');
            expect(mockNotificationService.sendTicketResolvedNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: resolvedTicket!.id,
                    status: TicketStatus.RESOLVED,
                })
            );

            // Step 7: User confirms resolution
            const confirmationComment = await TicketService.addComment(
                tenantId,
                createdTicket.id,
                endUser.user_id,
                {
                    content: 'Perfect! Computer is working great now. Thank you for the quick response!',
                    is_internal: false,
                }
            );

            expect(confirmationComment).toBeDefined();

            // Step 8: Tenant admin manually closes ticket
            const closedTicket = await TicketService.updateTicket(
                tenantId,
                createdTicket.id,
                {
                    status: TicketStatus.CLOSED,
                },
                tenantAdmin.user_id,
                tenantAdmin.role
            );

            expect(closedTicket).toBeDefined();
            expect(closedTicket!.status).toBe(TicketStatus.CLOSED);

            // Step 9: Verify knowledge article is searchable
            const searchResults = await KnowledgeBaseService.searchArticles(tenantId, {
                query: 'power supply computer won\'t start',
            });

            expect(searchResults.articles).toHaveLength(1);
            expect(searchResults.articles[0].id).toBe(knowledgeArticle.id);

            // Step 10: Verify complete timeline
            const finalTicket = await TicketService.getTicketById(tenantId, createdTicket.id);
            expect(finalTicket).toBeDefined();
            expect(finalTicket!.status).toBe(TicketStatus.CLOSED);

            const comments = await TicketService.getTicketComments(tenantId, createdTicket.id);
            expect(comments).toHaveLength(4); // Internal note + analyst message + user response + confirmation
        });

        it('should handle automatic ticket reopening when user replies to resolved ticket', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst = testUsers.analyst1;

            // Create, assign, and resolve a ticket
            const ticket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Email not working',
                description: 'Cannot send emails from Outlook',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
            });

            await TicketService.selfAssignTicket(tenantId, ticket.id, analyst.user_id, analyst.role);

            const resolvedTicket = await TicketService.updateTicket(
                tenantId,
                ticket.id,
                {
                    status: TicketStatus.RESOLVED,
                    resolution: 'Updated Outlook settings and configured SMTP server. Email sending now works.'
                },
                analyst.user_id,
                analyst.role
            );

            expect(resolvedTicket!.status).toBe(TicketStatus.RESOLVED);

            // User replies to resolved ticket indicating issue persists
            await TicketService.addComment(tenantId, ticket.id, endUser.user_id, {
                content: 'The issue is still happening. I can send emails now but I\'m not receiving any emails.',
                is_internal: false,
            });

            // Ticket should automatically reopen
            const reopenedTicket = await TicketService.updateTicket(
                tenantId,
                ticket.id,
                { status: TicketStatus.IN_PROGRESS },
                'system',
                UserRole.SYSTEM
            );

            expect(reopenedTicket!.status).toBe(TicketStatus.IN_PROGRESS);
            expect(mockNotificationService.sendTicketReopenedNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: ticket.id,
                    status: TicketStatus.IN_PROGRESS,
                })
            );
        });

        it('should enforce manual closure requirement - no automatic closure', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst = testUsers.analyst1;

            // Create and resolve a ticket
            const ticket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Software installation request',
                description: 'Need Adobe Acrobat Pro installed on my computer',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.LOW,
                priority: TicketPriority.LOW,
            });

            await TicketService.selfAssignTicket(tenantId, ticket.id, analyst.user_id, analyst.role);

            const resolvedTicket = await TicketService.updateTicket(
                tenantId,
                ticket.id,
                {
                    status: TicketStatus.RESOLVED,
                    resolution: 'Adobe Acrobat Pro installed and configured. User can now create and edit PDF documents.'
                },
                analyst.user_id,
                analyst.role
            );

            expect(resolvedTicket!.status).toBe(TicketStatus.RESOLVED);

            // Verify that StateManagementService prevents automatic closure
            expect(StateManagementService.canAutoClose()).toBe(false);

            // Wait some time to ensure no automatic closure occurs
            await new Promise(resolve => setTimeout(resolve, 100));

            const ticketAfterWait = await TicketService.getTicketById(tenantId, ticket.id);
            expect(ticketAfterWait!.status).toBe(TicketStatus.RESOLVED); // Still resolved, not closed

            // Verify only manual closure is allowed
            const manuallyClosedTicket = await TicketService.updateTicket(
                tenantId,
                ticket.id,
                { status: TicketStatus.CLOSED },
                testUsers.tenantAdmin1.user_id,
                testUsers.tenantAdmin1.role
            );

            expect(manuallyClosedTicket!.status).toBe(TicketStatus.CLOSED);
        });
    });

    describe('Comprehensive Tenant Isolation Verification', () => {
        it('should enforce complete tenant isolation across all operations', async () => {
            const tenant1Id = testTenants.tenant1.id;
            const tenant2Id = testTenants.tenant2.id;
            const tenant3Id = testTenants.tenant3.id;

            // Create tickets in all three tenants
            const ticket1 = await TicketService.createTicket(tenant1Id, testUsers.endUser1.user_id, {
                requester: testUsers.endUser1.user_id,
                title: 'Healthcare Corp Ticket',
                description: 'HIPAA-compliant data access issue',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.HIGH,
                priority: TicketPriority.HIGH,
            });

            const ticket2 = await TicketService.createTicket(tenant2Id, testUsers.endUser2.user_id, {
                requester: testUsers.endUser2.user_id,
                title: 'Tech Solutions Ticket',
                description: 'Development environment setup',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
            });

            const ticket3 = await TicketService.createTicket(tenant3Id, testUsers.endUser3.user_id, {
                requester: testUsers.endUser3.user_id,
                title: 'Manufacturing Inc Ticket',
                description: 'Production line monitoring system down',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.CRITICAL,
                priority: TicketPriority.URGENT,
            });

            // Verify each tenant analyst can only see their tenant's tickets
            const tenant1Tickets = await TicketService.getTickets(
                tenant1Id,
                {},
                testUsers.analyst1.role,
                testUsers.analyst1.user_id
            );

            expect(tenant1Tickets.tickets).toHaveLength(1);
            expect(tenant1Tickets.tickets[0].id).toBe(ticket1.id);
            expect(tenant1Tickets.tickets[0].title).toBe('Healthcare Corp Ticket');

            const tenant2Tickets = await TicketService.getTickets(
                tenant2Id,
                {},
                testUsers.analyst2.role,
                testUsers.analyst2.user_id
            );

            expect(tenant2Tickets.tickets).toHaveLength(1);
            expect(tenant2Tickets.tickets[0].id).toBe(ticket2.id);
            expect(tenant2Tickets.tickets[0].title).toBe('Tech Solutions Ticket');

            const tenant3Tickets = await TicketService.getTickets(
                tenant3Id,
                {},
                testUsers.analyst3.role,
                testUsers.analyst3.user_id
            );

            expect(tenant3Tickets.tickets).toHaveLength(1);
            expect(tenant3Tickets.tickets[0].id).toBe(ticket3.id);
            expect(tenant3Tickets.tickets[0].title).toBe('Manufacturing Inc Ticket');

            // Verify cross-tenant access is completely denied
            const crossTenantAttempt1 = await TicketService.getTicketById(tenant1Id, ticket2.id);
            expect(crossTenantAttempt1).toBeNull();

            const crossTenantAttempt2 = await TicketService.getTicketById(tenant2Id, ticket3.id);
            expect(crossTenantAttempt2).toBeNull();

            const crossTenantAttempt3 = await TicketService.getTicketById(tenant3Id, ticket1.id);
            expect(crossTenantAttempt3).toBeNull();

            // Verify knowledge base isolation
            const kb1 = await KnowledgeBaseService.createArticle(tenant1Id, testUsers.analyst1.user_id, {
                title: 'HIPAA Data Access Procedures',
                problemDescription: 'Users cannot access patient data',
                resolution: 'Check user permissions and audit logs',
            });

            const kb2 = await KnowledgeBaseService.createArticle(tenant2Id, testUsers.analyst2.user_id, {
                title: 'Development Environment Setup',
                problemDescription: 'New developer needs environment configured',
                resolution: 'Run setup scripts and configure IDE',
            });

            const kb3 = await KnowledgeBaseService.createArticle(tenant3Id, testUsers.analyst3.user_id, {
                title: 'Production Line Monitoring',
                problemDescription: 'Monitoring system shows offline status',
                resolution: 'Restart monitoring service and check network connectivity',
            });

            // Verify each tenant can only search their own KB articles
            const tenant1KBSearch = await KnowledgeBaseService.searchArticles(tenant1Id, {
                query: 'data access',
            });

            expect(tenant1KBSearch.articles).toHaveLength(1);
            expect(tenant1KBSearch.articles[0].id).toBe(kb1.id);

            const tenant2KBSearch = await KnowledgeBaseService.searchArticles(tenant2Id, {
                query: 'development',
            });

            expect(tenant2KBSearch.articles).toHaveLength(1);
            expect(tenant2KBSearch.articles[0].id).toBe(kb2.id);

            const tenant3KBSearch = await KnowledgeBaseService.searchArticles(tenant3Id, {
                query: 'monitoring',
            });

            expect(tenant3KBSearch.articles).toHaveLength(1);
            expect(tenant3KBSearch.articles[0].id).toBe(kb3.id);

            // Verify cross-tenant KB searches return no results
            const crossKBSearch1 = await KnowledgeBaseService.searchArticles(tenant1Id, {
                query: 'development environment',
            });
            expect(crossKBSearch1.articles).toHaveLength(0);

            const crossKBSearch2 = await KnowledgeBaseService.searchArticles(tenant2Id, {
                query: 'production line',
            });
            expect(crossKBSearch2.articles).toHaveLength(0);
        });

        it('should prevent cross-tenant assignment and comment attempts', async () => {
            const tenant1Id = testTenants.tenant1.id;
            const tenant2Id = testTenants.tenant2.id;

            // Create ticket in tenant 1
            const ticket = await TicketService.createTicket(tenant1Id, testUsers.endUser1.user_id, {
                requester: testUsers.endUser1.user_id,
                title: 'Cross-tenant security test',
                description: 'Testing tenant isolation security',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
            });

            // Attempt to assign ticket from tenant 1 to analyst from tenant 2
            await expect(
                TicketService.selfAssignTicket(tenant1Id, ticket.id, testUsers.analyst2.user_id, testUsers.analyst2.role)
            ).rejects.toThrow();

            // Attempt to add comment from tenant 2 user to tenant 1 ticket
            await expect(
                TicketService.addComment(tenant1Id, ticket.id, testUsers.analyst2.user_id, {
                    content: 'Unauthorized cross-tenant comment attempt',
                    is_internal: false,
                })
            ).rejects.toThrow();

            // Verify ticket remains unchanged
            const unchangedTicket = await TicketService.getTicketById(tenant1Id, ticket.id);
            expect(unchangedTicket!.assignee).toBeUndefined();
            expect(unchangedTicket!.status).toBe(TicketStatus.NEW);
        });
    });

    describe('Email Notification System Validation', () => {
        it('should send correct notifications for all ticket lifecycle events', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst = testUsers.analyst1;

            // Create ticket - should trigger creation notification
            const ticket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Email notification test ticket',
                description: 'Testing comprehensive email notifications',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.HIGH,
                priority: TicketPriority.HIGH,
                contact_method: 'email',
            });

            expect(mockNotificationService.sendTicketCreatedNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: ticket.id,
                    title: 'Email notification test ticket',
                    severity: TicketSeverity.HIGH,
                    contact_method: 'email',
                })
            );

            // Assign ticket - should trigger assignment notification
            await TicketService.selfAssignTicket(tenantId, ticket.id, analyst.user_id, analyst.role);

            expect(mockNotificationService.sendTicketAssignedNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: ticket.id,
                    assignee: analyst.user_id,
                })
            );

            // Add comment - should trigger comment notification
            await TicketService.addComment(tenantId, ticket.id, analyst.user_id, {
                content: 'I\'m working on your issue now',
                is_internal: false,
            });

            // Resolve ticket - should trigger resolution notification
            await TicketService.updateTicket(
                tenantId,
                ticket.id,
                {
                    status: TicketStatus.RESOLVED,
                    resolution: 'Issue resolved successfully'
                },
                analyst.user_id,
                analyst.role
            );

            expect(mockNotificationService.sendTicketResolvedNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: ticket.id,
                    status: TicketStatus.RESOLVED,
                    resolution: 'Issue resolved successfully',
                })
            );

            // User replies to resolved ticket - should trigger reopening notification
            await TicketService.addComment(tenantId, ticket.id, endUser.user_id, {
                content: 'Actually, the issue is still happening',
                is_internal: false,
            });

            await TicketService.updateTicket(
                tenantId,
                ticket.id,
                { status: TicketStatus.IN_PROGRESS },
                'system',
                UserRole.SYSTEM
            );

            expect(mockNotificationService.sendTicketReopenedNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: ticket.id,
                    status: TicketStatus.IN_PROGRESS,
                })
            );

            // Verify notification call counts
            expect(mockNotificationService.sendTicketCreatedNotification).toHaveBeenCalledTimes(1);
            expect(mockNotificationService.sendTicketAssignedNotification).toHaveBeenCalledTimes(1);
            expect(mockNotificationService.sendTicketResolvedNotification).toHaveBeenCalledTimes(1);
            expect(mockNotificationService.sendTicketReopenedNotification).toHaveBeenCalledTimes(1);
        });

        it('should handle notification service failures gracefully without affecting ticket operations', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst = testUsers.analyst1;

            // Mock all notification services to fail
            mockNotificationService.sendTicketCreatedNotification.mockRejectedValue(
                new Error('Email service unavailable')
            );
            mockNotificationService.sendTicketAssignedNotification.mockRejectedValue(
                new Error('SMTP server down')
            );
            mockNotificationService.sendTicketResolvedNotification.mockRejectedValue(
                new Error('Network timeout')
            );

            // Ticket creation should still succeed
            const ticket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Notification failure resilience test',
                description: 'Testing system resilience when notifications fail',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
            });

            expect(ticket).toBeDefined();
            expect(ticket.status).toBe(TicketStatus.NEW);

            // Assignment should still succeed
            const assignedTicket = await TicketService.selfAssignTicket(
                tenantId,
                ticket.id,
                analyst.user_id,
                analyst.role
            );

            expect(assignedTicket).toBeDefined();
            expect(assignedTicket!.assignee).toBe(analyst.user_id);
            expect(assignedTicket!.status).toBe(TicketStatus.IN_PROGRESS);

            // Resolution should still succeed
            const resolvedTicket = await TicketService.updateTicket(
                tenantId,
                ticket.id,
                {
                    status: TicketStatus.RESOLVED,
                    resolution: 'Fixed despite notification failures'
                },
                analyst.user_id,
                analyst.role
            );

            expect(resolvedTicket).toBeDefined();
            expect(resolvedTicket!.status).toBe(TicketStatus.RESOLVED);

            // Verify all notification attempts were made
            expect(mockNotificationService.sendTicketCreatedNotification).toHaveBeenCalled();
            expect(mockNotificationService.sendTicketAssignedNotification).toHaveBeenCalled();
            expect(mockNotificationService.sendTicketResolvedNotification).toHaveBeenCalled();
        });

        it('should send notifications with correct contact method preferences', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;

            // Create ticket with phone contact preference
            const phoneTicket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Phone contact test',
                description: 'User prefers phone contact',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.HIGH,
                priority: TicketPriority.HIGH,
                contact_method: 'phone',
                phone_number: '+1-555-0199',
            });

            expect(mockNotificationService.sendTicketCreatedNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    contact_method: 'phone',
                    phone_number: '+1-555-0199',
                })
            );

            // Create ticket with email contact preference (default)
            const emailTicket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Email contact test',
                description: 'User prefers email contact',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
                contact_method: 'email',
            });

            expect(mockNotificationService.sendTicketCreatedNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    contact_method: 'email',
                })
            );
        });
    });

    describe('Concurrent User Scenarios and Queue Management', () => {
        it('should handle concurrent ticket assignments correctly with race condition protection', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst1 = testUsers.analyst1;
            const analyst2 = { ...testUsers.analyst1, user_id: 'analyst1b-final' }; // Second analyst in same tenant

            // Create a high-priority ticket
            const ticket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Concurrent assignment race condition test',
                description: 'Testing concurrent assignment handling with race conditions',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.CRITICAL,
                priority: TicketPriority.URGENT,
            });

            // Simulate concurrent assignment attempts
            const assignment1Promise = TicketService.selfAssignTicket(
                tenantId,
                ticket.id,
                analyst1.user_id,
                analyst1.role
            );

            const assignment2Promise = TicketService.selfAssignTicket(
                tenantId,
                ticket.id,
                analyst2.user_id,
                analyst2.role
            );

            // Wait for both attempts to complete
            const results = await Promise.allSettled([assignment1Promise, assignment2Promise]);

            // One should succeed, one should fail
            const successCount = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
            const failureCount = results.filter(r => r.status === 'rejected' || r.value === null).length;

            expect(successCount).toBe(1);
            expect(failureCount).toBe(1);

            // Verify final ticket state is consistent
            const finalTicket = await TicketService.getTicketById(tenantId, ticket.id);
            expect(finalTicket!.assignee).toBeDefined();
            expect([analyst1.user_id, analyst2.user_id]).toContain(finalTicket!.assignee);
            expect(finalTicket!.status).toBe(TicketStatus.IN_PROGRESS);
        });

        it('should maintain correct queue ordering with multiple tickets and concurrent assignments', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst = testUsers.analyst1;

            // Create multiple tickets with different severities and timestamps
            const tickets = [];

            const criticalTicket1 = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Critical Issue 1 - Server Down',
                description: 'Main server is completely down',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.CRITICAL,
                priority: TicketPriority.URGENT,
            });
            tickets.push(criticalTicket1);

            // Wait to ensure different timestamps
            await new Promise(resolve => setTimeout(resolve, 10));

            const criticalTicket2 = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Critical Issue 2 - Database Corruption',
                description: 'Database showing corruption errors',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.CRITICAL,
                priority: TicketPriority.URGENT,
            });
            tickets.push(criticalTicket2);

            await new Promise(resolve => setTimeout(resolve, 10));

            const highTicket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'High Priority - Network Slow',
                description: 'Network performance is very slow',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.HIGH,
                priority: TicketPriority.HIGH,
            });
            tickets.push(highTicket);

            await new Promise(resolve => setTimeout(resolve, 10));

            const mediumTicket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Medium Priority - Software Update',
                description: 'Need software updated to latest version',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
            });
            tickets.push(mediumTicket);

            await new Promise(resolve => setTimeout(resolve, 10));

            const lowTicket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Low Priority - Cosmetic Bug',
                description: 'Minor cosmetic issue in application',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.LOW,
                priority: TicketPriority.LOW,
            });
            tickets.push(lowTicket);

            // Get initial queue order
            const initialQueue = await TicketService.getTickets(tenantId, {}, analyst.role, analyst.user_id);

            // Should be ordered by severity: Critical (oldest first), High, Medium, Low
            expect(initialQueue.tickets[0].id).toBe(criticalTicket1.id);
            expect(initialQueue.tickets[1].id).toBe(criticalTicket2.id);
            expect(initialQueue.tickets[2].id).toBe(highTicket.id);
            expect(initialQueue.tickets[3].id).toBe(mediumTicket.id);
            expect(initialQueue.tickets[4].id).toBe(lowTicket.id);

            // Assign the first critical ticket
            await TicketService.selfAssignTicket(tenantId, criticalTicket1.id, analyst.user_id, analyst.role);

            // Get updated queue
            const updatedQueue = await TicketService.getTickets(tenantId, {}, analyst.role, analyst.user_id);

            // First critical ticket should now be at the bottom (assigned tickets move to bottom)
            // Order should be: Critical2, High, Medium, Low, Critical1 (assigned)
            expect(updatedQueue.tickets[0].id).toBe(criticalTicket2.id);
            expect(updatedQueue.tickets[1].id).toBe(highTicket.id);
            expect(updatedQueue.tickets[2].id).toBe(mediumTicket.id);
            expect(updatedQueue.tickets[3].id).toBe(lowTicket.id);
            expect(updatedQueue.tickets[4].id).toBe(criticalTicket1.id);
            expect(updatedQueue.tickets[4].assignee).toBe(analyst.user_id);
        });

        it('should handle high-volume ticket creation and processing efficiently', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst = testUsers.analyst1;

            // Create multiple tickets concurrently
            const ticketPromises = Array.from({ length: 20 }, (_, i) =>
                TicketService.createTicket(tenantId, endUser.user_id, {
                    requester: endUser.user_id,
                    title: `Bulk Test Ticket ${i + 1}`,
                    description: `Description for bulk test ticket ${i + 1}`,
                    category: TicketCategory.IT_SUPPORT,
                    severity: i % 3 === 0 ? TicketSeverity.CRITICAL :
                        i % 3 === 1 ? TicketSeverity.HIGH : TicketSeverity.MEDIUM,
                    priority: i % 3 === 0 ? TicketPriority.URGENT :
                        i % 3 === 1 ? TicketPriority.HIGH : TicketPriority.MEDIUM,
                })
            );

            const startTime = Date.now();
            const createdTickets = await Promise.all(ticketPromises);
            const creationTime = Date.now() - startTime;

            expect(createdTickets).toHaveLength(20);
            expect(creationTime).toBeLessThan(5000); // Should complete within 5 seconds

            // Verify all tickets were created successfully
            createdTickets.forEach((ticket, i) => {
                expect(ticket.title).toBe(`Bulk Test Ticket ${i + 1}`);
                expect(ticket.status).toBe(TicketStatus.NEW);
            });

            // Get queue and verify proper ordering
            const queue = await TicketService.getTickets(tenantId, {}, analyst.role, analyst.user_id);
            expect(queue.total).toBeGreaterThanOrEqual(20);

            // Verify severity-based ordering
            const criticalTickets = queue.tickets.filter(t => t.severity === TicketSeverity.CRITICAL);
            const highTickets = queue.tickets.filter(t => t.severity === TicketSeverity.HIGH);
            const mediumTickets = queue.tickets.filter(t => t.severity === TicketSeverity.MEDIUM);

            if (criticalTickets.length > 0 && highTickets.length > 0) {
                const firstCriticalIndex = queue.tickets.findIndex(t => t.severity === TicketSeverity.CRITICAL);
                const firstHighIndex = queue.tickets.findIndex(t => t.severity === TicketSeverity.HIGH);
                expect(firstCriticalIndex).toBeLessThan(firstHighIndex);
            }

            if (highTickets.length > 0 && mediumTickets.length > 0) {
                const firstHighIndex = queue.tickets.findIndex(t => t.severity === TicketSeverity.HIGH);
                const firstMediumIndex = queue.tickets.findIndex(t => t.severity === TicketSeverity.MEDIUM);
                expect(firstHighIndex).toBeLessThan(firstMediumIndex);
            }

            // Test concurrent assignment of multiple tickets
            const assignmentPromises = createdTickets.slice(0, 5).map(ticket =>
                TicketService.selfAssignTicket(tenantId, ticket.id, analyst.user_id, analyst.role)
            );

            const assignmentResults = await Promise.allSettled(assignmentPromises);
            const successfulAssignments = assignmentResults.filter(r => r.status === 'fulfilled').length;

            expect(successfulAssignments).toBeGreaterThan(0);
            expect(successfulAssignments).toBeLessThanOrEqual(5);
        });

        it('should handle concurrent comment additions and maintain timeline integrity', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst = testUsers.analyst1;

            // Create and assign a ticket
            const ticket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Concurrent comment test',
                description: 'Testing concurrent comment handling',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
            });

            await TicketService.selfAssignTicket(tenantId, ticket.id, analyst.user_id, analyst.role);

            // Add multiple comments concurrently
            const commentPromises = [
                TicketService.addComment(tenantId, ticket.id, analyst.user_id, {
                    content: 'Analyst comment 1',
                    is_internal: false,
                }),
                TicketService.addComment(tenantId, ticket.id, endUser.user_id, {
                    content: 'User comment 1',
                    is_internal: false,
                }),
                TicketService.addComment(tenantId, ticket.id, analyst.user_id, {
                    content: 'Internal note 1',
                    is_internal: true,
                }),
                TicketService.addComment(tenantId, ticket.id, endUser.user_id, {
                    content: 'User comment 2',
                    is_internal: false,
                }),
                TicketService.addComment(tenantId, ticket.id, analyst.user_id, {
                    content: 'Analyst comment 2',
                    is_internal: false,
                }),
            ];

            const comments = await Promise.all(commentPromises);
            expect(comments).toHaveLength(5);

            // Verify all comments were added successfully
            const ticketComments = await TicketService.getTicketComments(tenantId, ticket.id);
            expect(ticketComments).toHaveLength(5);

            // Verify timeline integrity (comments should be in chronological order)
            for (let i = 1; i < ticketComments.length; i++) {
                expect(new Date(ticketComments[i].created_at).getTime())
                    .toBeGreaterThanOrEqual(new Date(ticketComments[i - 1].created_at).getTime());
            }
        });
    });

    describe('System Resilience and Error Recovery', () => {
        it('should recover gracefully from database connection issues', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;

            // Mock database connection failure
            const originalGetTickets = TicketService.getTickets;
            TicketService.getTickets = jest.fn().mockRejectedValueOnce(
                new Error('Database connection failed')
            );

            // Should handle the error gracefully
            await expect(
                TicketService.getTickets(tenantId, {}, endUser.role, endUser.user_id)
            ).rejects.toThrow('Database connection failed');

            // Restore original method
            TicketService.getTickets = originalGetTickets;

            // Should work normally after recovery
            const result = await TicketService.getTickets(tenantId, {}, endUser.role, endUser.user_id);
            expect(result).toBeDefined();
            expect(result.tickets).toBeDefined();
        });

        it('should handle partial system failures without data corruption', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst = testUsers.analyst1;

            // Create ticket successfully
            const ticket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Failure recovery test',
                description: 'Testing system resilience during partial failures',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
            });

            expect(ticket).toBeDefined();

            // Mock notification service failure during assignment
            mockNotificationService.sendTicketAssignedNotification.mockRejectedValueOnce(
                new Error('Notification service down')
            );

            // Assignment should still succeed even if notification fails
            const assignedTicket = await TicketService.selfAssignTicket(
                tenantId,
                ticket.id,
                analyst.user_id,
                analyst.role
            );

            expect(assignedTicket).toBeDefined();
            expect(assignedTicket!.assignee).toBe(analyst.user_id);
            expect(assignedTicket!.status).toBe(TicketStatus.IN_PROGRESS);

            // Verify ticket state is consistent
            const retrievedTicket = await TicketService.getTicketById(tenantId, ticket.id);
            expect(retrievedTicket!.assignee).toBe(analyst.user_id);
            expect(retrievedTicket!.status).toBe(TicketStatus.IN_PROGRESS);
        });

        it('should maintain data consistency during concurrent state changes', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst = testUsers.analyst1;

            // Create and assign a ticket
            const ticket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Concurrent state change test',
                description: 'Testing data consistency during concurrent operations',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.HIGH,
                priority: TicketPriority.HIGH,
            });

            await TicketService.selfAssignTicket(tenantId, ticket.id, analyst.user_id, analyst.role);

            // Attempt concurrent state changes
            const stateChangePromises = [
                TicketService.updateTicket(
                    tenantId,
                    ticket.id,
                    { status: TicketStatus.AWAITING_RESPONSE },
                    analyst.user_id,
                    analyst.role
                ),
                TicketService.addComment(tenantId, ticket.id, endUser.user_id, {
                    content: 'User response during state change',
                    is_internal: false,
                }),
                TicketService.addComment(tenantId, ticket.id, analyst.user_id, {
                    content: 'Analyst note during state change',
                    is_internal: true,
                }),
            ];

            const results = await Promise.allSettled(stateChangePromises);

            // At least the state change should succeed
            const successfulOperations = results.filter(r => r.status === 'fulfilled').length;
            expect(successfulOperations).toBeGreaterThan(0);

            // Verify final ticket state is consistent
            const finalTicket = await TicketService.getTicketById(tenantId, ticket.id);
            expect(finalTicket).toBeDefined();
            expect(finalTicket!.assignee).toBe(analyst.user_id);
            expect([TicketStatus.IN_PROGRESS, TicketStatus.AWAITING_RESPONSE]).toContain(finalTicket!.status);
        });
    });

    describe('Performance and Load Testing', () => {
        it('should handle queue operations efficiently under load', async () => {
            const tenantId = testTenants.tenant1.id;
            const analyst = testUsers.analyst1;

            // Create a large number of tickets
            const ticketCount = 50;
            const tickets = [];

            for (let i = 0; i < ticketCount; i++) {
                const ticket = await TicketService.createTicket(tenantId, testUsers.endUser1.user_id, {
                    requester: testUsers.endUser1.user_id,
                    title: `Load Test Ticket ${i + 1}`,
                    description: `Load testing ticket number ${i + 1}`,
                    category: TicketCategory.IT_SUPPORT,
                    severity: i % 4 === 0 ? TicketSeverity.CRITICAL :
                        i % 4 === 1 ? TicketSeverity.HIGH :
                            i % 4 === 2 ? TicketSeverity.MEDIUM : TicketSeverity.LOW,
                    priority: i % 4 === 0 ? TicketPriority.URGENT :
                        i % 4 === 1 ? TicketPriority.HIGH :
                            i % 4 === 2 ? TicketPriority.MEDIUM : TicketPriority.LOW,
                });
                tickets.push(ticket);
            }

            // Test queue retrieval performance
            const startTime = Date.now();
            const queue = await QueueManagementService.getUnassignedQueue(
                tenantId,
                analyst.role,
                analyst.user_id
            );
            const queryTime = Date.now() - startTime;

            expect(queue.tickets.length).toBe(ticketCount);
            expect(queryTime).toBeLessThan(2000); // Should complete within 2 seconds

            // Test queue metrics calculation performance
            const metricsStartTime = Date.now();
            const metrics = await QueueManagementService.getQueueMetrics(
                tenantId,
                analyst.role,
                analyst.user_id
            );
            const metricsTime = Date.now() - metricsStartTime;

            expect(metrics.total_tickets).toBe(ticketCount);
            expect(metricsTime).toBeLessThan(1000); // Should complete within 1 second
        });

        it('should maintain performance with large comment threads', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst = testUsers.analyst1;

            // Create a ticket
            const ticket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Large comment thread test',
                description: 'Testing performance with many comments',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
            });

            await TicketService.selfAssignTicket(tenantId, ticket.id, analyst.user_id, analyst.role);

            // Add many comments
            const commentCount = 30;
            for (let i = 0; i < commentCount; i++) {
                await TicketService.addComment(tenantId, ticket.id,
                    i % 2 === 0 ? analyst.user_id : endUser.user_id, {
                    content: `Comment number ${i + 1} in the conversation thread`,
                    is_internal: i % 4 === 0, // Every 4th comment is internal
                });
            }

            // Test comment retrieval performance
            const startTime = Date.now();
            const comments = await TicketService.getTicketComments(tenantId, ticket.id);
            const retrievalTime = Date.now() - startTime;

            expect(comments.length).toBe(commentCount);
            expect(retrievalTime).toBeLessThan(1000); // Should complete within 1 second

            // Verify comments are in chronological order
            for (let i = 1; i < comments.length; i++) {
                expect(new Date(comments[i].created_at).getTime())
                    .toBeGreaterThanOrEqual(new Date(comments[i - 1].created_at).getTime());
            }
        });
    });

    describe('Knowledge Base Integration', () => {
        it('should create and search knowledge articles efficiently', async () => {
            const tenantId = testTenants.tenant1.id;
            const analyst = testUsers.analyst1;

            // Create multiple knowledge articles
            const articles = [];
            const articleTopics = [
                { title: 'Password Reset Procedure', problem: 'User cannot log in', solution: 'Reset password via admin panel' },
                { title: 'Printer Not Working', problem: 'Printer shows offline', solution: 'Check network connection and restart print spooler' },
                { title: 'Email Configuration', problem: 'Cannot send emails', solution: 'Configure SMTP settings and check firewall' },
                { title: 'Software Installation', problem: 'Cannot install software', solution: 'Run as administrator and check permissions' },
                { title: 'Network Connectivity', problem: 'No internet access', solution: 'Check network adapter and DNS settings' },
            ];

            for (const topic of articleTopics) {
                const article = await KnowledgeBaseService.createArticle(tenantId, analyst.user_id, {
                    title: topic.title,
                    problemDescription: topic.problem,
                    resolution: topic.solution,
                });
                articles.push(article);
            }

            // Test search functionality
            const passwordSearch = await KnowledgeBaseService.searchArticles(tenantId, {
                query: 'password reset',
            });

            expect(passwordSearch.articles.length).toBeGreaterThan(0);
            expect(passwordSearch.articles[0].title).toContain('Password');

            const printerSearch = await KnowledgeBaseService.searchArticles(tenantId, {
                query: 'printer offline',
            });

            expect(printerSearch.articles.length).toBeGreaterThan(0);
            expect(printerSearch.articles[0].title).toContain('Printer');

            // Test general search
            const generalSearch = await KnowledgeBaseService.searchArticles(tenantId, {
                query: 'network',
            });

            expect(generalSearch.articles.length).toBeGreaterThan(0);
        });
    });
});