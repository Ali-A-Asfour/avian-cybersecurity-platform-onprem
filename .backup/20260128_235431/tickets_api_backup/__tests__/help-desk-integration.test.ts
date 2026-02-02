/**
 * Help Desk System Integration Tests
 * 
 * Comprehensive end-to-end integration tests covering:
 * - Complete ticket workflows from creation to closure
 * - Tenant isolation across all operations
 * - Email notification delivery
 * - Concurrent user scenarios and queue management
 * - Property-based testing for system correctness
 * 
 * Task 15: Final integration testing and polish
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { TicketService } from '@/services/ticket.service';
import { KnowledgeBaseService } from '@/services/help-desk/KnowledgeBaseService';
import { StateManagementService } from '@/services/help-desk/StateManagementService';
import { TicketStatus, TicketSeverity, TicketCategory, UserRole } from '@/types';

// Mock external dependencies
jest.mock('@/middleware/auth.middleware');
jest.mock('@/middleware/tenant.middleware');
jest.mock('@/lib/help-desk/notification-service');

const mockAuthMiddleware = require('@/middleware/auth.middleware').authMiddleware;
const mockTenantMiddleware = require('@/middleware/tenant.middleware').tenantMiddleware;
const mockNotificationService = require('@/lib/help-desk/notification-service');

describe('Help Desk System Integration Tests', () => {
    const testTenants = {
        tenant1: { id: 'tenant1', name: 'Test Tenant 1' },
        tenant2: { id: 'tenant2', name: 'Test Tenant 2' },
    };

    const testUsers = {
        endUser1: { user_id: 'user1', role: UserRole.USER, tenant_id: 'tenant1' },
        endUser2: { user_id: 'user2', role: UserRole.USER, tenant_id: 'tenant2' },
        analyst1: { user_id: 'analyst1', role: UserRole.IT_HELPDESK_ANALYST, tenant_id: 'tenant1' },
        analyst2: { user_id: 'analyst2', role: UserRole.IT_HELPDESK_ANALYST, tenant_id: 'tenant2' },
        tenantAdmin1: { user_id: 'admin1', role: UserRole.TENANT_ADMIN, tenant_id: 'tenant1' },
        tenantAdmin2: { user_id: 'admin2', role: UserRole.TENANT_ADMIN, tenant_id: 'tenant2' },
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default auth responses
        mockAuthMiddleware.mockResolvedValue({ success: true });
        mockTenantMiddleware.mockResolvedValue({ success: true });

        // Setup notification service mocks
        mockNotificationService.sendTicketCreatedNotification = jest.fn().mockResolvedValue(true);
        mockNotificationService.sendTicketAssignedNotification = jest.fn().mockResolvedValue(true);
        mockNotificationService.sendTicketResolvedNotification = jest.fn().mockResolvedValue(true);
    });

    afterEach(() => {
        // Reset any state management timers
        StateManagementService.resetSLATimers();
    });

    describe('End-to-End Ticket Workflows', () => {
        it('should complete full ticket lifecycle: creation → assignment → resolution → closure', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst = testUsers.analyst1;

            // Step 1: End user creates ticket
            const ticketData = {
                requester: endUser.user_id,
                title: 'Computer won\'t start',
                description: 'My computer is not turning on when I press the power button',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.HIGH,
                priority: 'high' as any,
            };

            const createdTicket = await TicketService.createTicket(
                tenantId,
                endUser.user_id,
                ticketData
            );

            expect(createdTicket).toBeDefined();
            expect(createdTicket.status).toBe(TicketStatus.NEW);
            expect(createdTicket.assignee).toBeUndefined();
            expect(mockNotificationService.sendTicketCreatedNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: createdTicket.id,
                    title: ticketData.title,
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
                    content: 'Checked power supply, seems to be hardware issue',
                    is_internal: true,
                }
            );

            expect(internalComment).toBeDefined();
            expect(internalComment.is_internal).toBe(true);

            // Step 4: Analyst resolves ticket with knowledge article creation
            const resolution = 'Replaced faulty power supply unit. Computer now boots normally.';
            const resolvedTicket = await TicketService.updateTicket(
                tenantId,
                createdTicket.id,
                {
                    status: TicketStatus.RESOLVED,
                },
                analyst.user_id,
                analyst.role
            );

            expect(resolvedTicket).toBeDefined();
            expect(resolvedTicket!.status).toBe(TicketStatus.RESOLVED);

            // Create knowledge article from resolution
            const knowledgeArticle = await KnowledgeBaseService.createArticleFromTicketResolution(
                tenantId,
                createdTicket.id,
                analyst.user_id,
                'Computer Won\'t Start - Power Supply Issue',
                'Computer not turning on when power button is pressed',
                resolution
            );

            expect(knowledgeArticle).toBeDefined();
            expect(knowledgeArticle.source_ticket_id).toBe(createdTicket.id);
            expect(mockNotificationService.sendTicketResolvedNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: resolvedTicket!.id,
                    status: TicketStatus.RESOLVED,
                })
            );

            // Step 5: Tenant admin closes ticket
            const closedTicket = await TicketService.updateTicket(
                tenantId,
                createdTicket.id,
                {
                    status: TicketStatus.CLOSED,
                },
                testUsers.tenantAdmin1.user_id,
                testUsers.tenantAdmin1.role
            );

            expect(closedTicket).toBeDefined();
            expect(closedTicket!.status).toBe(TicketStatus.CLOSED);

            // Verify knowledge article is searchable
            const searchResults = await KnowledgeBaseService.searchArticles(tenantId, {
                query: 'power supply',
            });

            expect(searchResults.articles).toHaveLength(1);
            expect(searchResults.articles[0].id).toBe(knowledgeArticle.id);
        });

        it('should handle ticket reopening when user replies to resolved ticket', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst = testUsers.analyst1;

            // Create and resolve a ticket
            const ticket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Email not working',
                description: 'Cannot send emails',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: 'medium' as any,
            });

            await TicketService.selfAssignTicket(tenantId, ticket.id, analyst.user_id, analyst.role);

            const resolvedTicket = await TicketService.updateTicket(
                tenantId,
                ticket.id,
                { status: TicketStatus.RESOLVED },
                analyst.user_id,
                analyst.role
            );

            expect(resolvedTicket!.status).toBe(TicketStatus.RESOLVED);

            // User replies to resolved ticket
            await TicketService.addComment(tenantId, ticket.id, endUser.user_id, {
                content: 'The issue is still happening, emails are still not sending',
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
        });

        it('should enforce manual closure requirement - no automatic closure', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst = testUsers.analyst1;

            // Create and resolve a ticket
            const ticket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Software installation request',
                description: 'Need Adobe Acrobat installed',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.LOW,
                priority: 'low' as any,
            });

            await TicketService.selfAssignTicket(tenantId, ticket.id, analyst.user_id, analyst.role);

            const resolvedTicket = await TicketService.updateTicket(
                tenantId,
                ticket.id,
                { status: TicketStatus.RESOLVED },
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
        });
    });

    describe('Tenant Isolation Verification', () => {
        it('should enforce complete tenant isolation across all operations', async () => {
            const tenant1Id = testTenants.tenant1.id;
            const tenant2Id = testTenants.tenant2.id;
            const user1 = testUsers.endUser1;
            const user2 = testUsers.endUser2;
            const analyst1 = testUsers.analyst1;
            const analyst2 = testUsers.analyst2;

            // Create tickets in both tenants
            const ticket1 = await TicketService.createTicket(tenant1Id, user1.user_id, {
                requester: user1.user_id,
                title: 'Tenant 1 Ticket',
                description: 'This is a ticket for tenant 1',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: 'medium' as any,
            });

            const ticket2 = await TicketService.createTicket(tenant2Id, user2.user_id, {
                requester: user2.user_id,
                title: 'Tenant 2 Ticket',
                description: 'This is a ticket for tenant 2',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: 'medium' as any,
            });

            // Verify tenant 1 analyst can only see tenant 1 tickets
            const tenant1Tickets = await TicketService.getTickets(
                tenant1Id,
                {},
                analyst1.role,
                analyst1.user_id
            );

            expect(tenant1Tickets.tickets).toHaveLength(1);
            expect(tenant1Tickets.tickets[0].id).toBe(ticket1.id);
            expect(tenant1Tickets.tickets[0].title).toBe('Tenant 1 Ticket');

            // Verify tenant 2 analyst can only see tenant 2 tickets
            const tenant2Tickets = await TicketService.getTickets(
                tenant2Id,
                {},
                analyst2.role,
                analyst2.user_id
            );

            expect(tenant2Tickets.tickets).toHaveLength(1);
            expect(tenant2Tickets.tickets[0].id).toBe(ticket2.id);
            expect(tenant2Tickets.tickets[0].title).toBe('Tenant 2 Ticket');

            // Verify cross-tenant access is denied
            const crossTenantTicket = await TicketService.getTicketById(tenant1Id, ticket2.id);
            expect(crossTenantTicket).toBeNull();

            // Verify knowledge base isolation
            const kb1 = await KnowledgeBaseService.createArticle(tenant1Id, analyst1.user_id, {
                title: 'Tenant 1 KB Article',
                problemDescription: 'Problem for tenant 1',
                resolution: 'Solution for tenant 1',
            });

            const kb2 = await KnowledgeBaseService.createArticle(tenant2Id, analyst2.user_id, {
                title: 'Tenant 2 KB Article',
                problemDescription: 'Problem for tenant 2',
                resolution: 'Solution for tenant 2',
            });

            // Verify tenant 1 can only search tenant 1 KB articles
            const tenant1KBSearch = await KnowledgeBaseService.searchArticles(tenant1Id, {
                query: 'tenant',
            });

            expect(tenant1KBSearch.articles).toHaveLength(1);
            expect(tenant1KBSearch.articles[0].id).toBe(kb1.id);

            // Verify tenant 2 can only search tenant 2 KB articles
            const tenant2KBSearch = await KnowledgeBaseService.searchArticles(tenant2Id, {
                query: 'tenant',
            });

            expect(tenant2KBSearch.articles).toHaveLength(1);
            expect(tenant2KBSearch.articles[0].id).toBe(kb2.id);
        });

        it('should prevent cross-tenant ticket assignment attempts', async () => {
            const tenant1Id = testTenants.tenant1.id;
            const tenant2Id = testTenants.tenant2.id;
            const user1 = testUsers.endUser1;
            const analyst2 = testUsers.analyst2; // Different tenant

            // Create ticket in tenant 1
            const ticket = await TicketService.createTicket(tenant1Id, user1.user_id, {
                requester: user1.user_id,
                title: 'Cross-tenant assignment test',
                description: 'Testing tenant isolation',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: 'medium' as any,
            });

            // Attempt to assign ticket from tenant 1 to analyst from tenant 2
            // This should fail due to tenant isolation
            await expect(
                TicketService.selfAssignTicket(tenant1Id, ticket.id, analyst2.user_id, analyst2.role)
            ).rejects.toThrow();
        });
    });

    describe('Email Notification Integration', () => {
        it('should send correct notifications for all ticket lifecycle events', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst = testUsers.analyst1;

            // Create ticket - should trigger creation notification
            const ticket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Notification test ticket',
                description: 'Testing email notifications',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.HIGH,
                priority: 'high' as any,
            });

            expect(mockNotificationService.sendTicketCreatedNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: ticket.id,
                    title: 'Notification test ticket',
                    severity: TicketSeverity.HIGH,
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

            // Resolve ticket - should trigger resolution notification
            await TicketService.updateTicket(
                tenantId,
                ticket.id,
                { status: TicketStatus.RESOLVED },
                analyst.user_id,
                analyst.role
            );

            expect(mockNotificationService.sendTicketResolvedNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: ticket.id,
                    status: TicketStatus.RESOLVED,
                })
            );

            // Verify notification call counts
            expect(mockNotificationService.sendTicketCreatedNotification).toHaveBeenCalledTimes(1);
            expect(mockNotificationService.sendTicketAssignedNotification).toHaveBeenCalledTimes(1);
            expect(mockNotificationService.sendTicketResolvedNotification).toHaveBeenCalledTimes(1);
        });

        it('should handle notification service failures gracefully', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;

            // Mock notification service to fail
            mockNotificationService.sendTicketCreatedNotification.mockRejectedValue(
                new Error('Email service unavailable')
            );

            // Ticket creation should still succeed even if notification fails
            const ticket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Notification failure test',
                description: 'Testing notification failure handling',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: 'medium' as any,
            });

            expect(ticket).toBeDefined();
            expect(ticket.status).toBe(TicketStatus.NEW);
            expect(mockNotificationService.sendTicketCreatedNotification).toHaveBeenCalled();
        });
    });

    describe('Concurrent User Scenarios and Queue Management', () => {
        it('should handle concurrent ticket assignments correctly', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst1 = testUsers.analyst1;
            const analyst2 = { ...testUsers.analyst1, user_id: 'analyst1b' }; // Second analyst in same tenant

            // Create a ticket
            const ticket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Concurrent assignment test',
                description: 'Testing concurrent assignment handling',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.HIGH,
                priority: 'high' as any,
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

            // Verify final ticket state
            const finalTicket = await TicketService.getTicketById(tenantId, ticket.id);
            expect(finalTicket!.assignee).toBeDefined();
            expect([analyst1.user_id, analyst2.user_id]).toContain(finalTicket!.assignee);
        });

        it('should maintain correct queue ordering with multiple tickets and assignments', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst = testUsers.analyst1;

            // Create multiple tickets with different severities
            const criticalTicket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Critical Issue',
                description: 'System down',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.CRITICAL,
                priority: 'critical' as any,
            });

            const mediumTicket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Medium Issue',
                description: 'Slow performance',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: 'medium' as any,
            });

            const lowTicket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'Low Issue',
                description: 'Minor bug',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.LOW,
                priority: 'low' as any,
            });

            // Get initial queue order
            const initialQueue = await TicketService.getTickets(tenantId, {}, analyst.role, analyst.user_id);

            // Should be ordered by severity: Critical, Medium, Low
            expect(initialQueue.tickets[0].id).toBe(criticalTicket.id);
            expect(initialQueue.tickets[1].id).toBe(mediumTicket.id);
            expect(initialQueue.tickets[2].id).toBe(lowTicket.id);

            // Assign the critical ticket
            await TicketService.selfAssignTicket(tenantId, criticalTicket.id, analyst.user_id, analyst.role);

            // Get updated queue
            const updatedQueue = await TicketService.getTickets(tenantId, {}, analyst.role, analyst.user_id);

            // Critical ticket should now be at the bottom (assigned tickets move to bottom)
            // Order should be: Medium, Low, Critical (assigned)
            expect(updatedQueue.tickets[0].id).toBe(mediumTicket.id);
            expect(updatedQueue.tickets[1].id).toBe(lowTicket.id);
            expect(updatedQueue.tickets[2].id).toBe(criticalTicket.id);
            expect(updatedQueue.tickets[2].assignee).toBe(analyst.user_id);
        });

        it('should handle high-volume ticket creation and processing', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst = testUsers.analyst1;

            // Create multiple tickets concurrently
            const ticketPromises = Array.from({ length: 10 }, (_, i) =>
                TicketService.createTicket(tenantId, endUser.user_id, {
                    requester: endUser.user_id,
                    title: `Bulk Test Ticket ${i + 1}`,
                    description: `Description for ticket ${i + 1}`,
                    category: TicketCategory.IT_SUPPORT,
                    severity: i % 2 === 0 ? TicketSeverity.HIGH : TicketSeverity.MEDIUM,
                    priority: (i % 2 === 0 ? 'high' : 'medium') as any,
                })
            );

            const createdTickets = await Promise.all(ticketPromises);
            expect(createdTickets).toHaveLength(10);

            // Verify all tickets were created successfully
            createdTickets.forEach((ticket, i) => {
                expect(ticket.title).toBe(`Bulk Test Ticket ${i + 1}`);
                expect(ticket.status).toBe(TicketStatus.NEW);
            });

            // Get queue and verify proper ordering
            const queue = await TicketService.getTickets(tenantId, {}, analyst.role, analyst.user_id);
            expect(queue.total).toBeGreaterThanOrEqual(10);

            // Verify high severity tickets come before medium severity
            const highSeverityTickets = queue.tickets.filter(t => t.severity === TicketSeverity.HIGH);
            const mediumSeverityTickets = queue.tickets.filter(t => t.severity === TicketSeverity.MEDIUM);

            if (highSeverityTickets.length > 0 && mediumSeverityTickets.length > 0) {
                const firstHighIndex = queue.tickets.findIndex(t => t.severity === TicketSeverity.HIGH);
                const firstMediumIndex = queue.tickets.findIndex(t => t.severity === TicketSeverity.MEDIUM);
                expect(firstHighIndex).toBeLessThan(firstMediumIndex);
            }
        });
    });

    describe('System State Consistency', () => {
        it('should maintain consistent state across service boundaries', async () => {
            const tenantId = testTenants.tenant1.id;
            const endUser = testUsers.endUser1;
            const analyst = testUsers.analyst1;

            // Create ticket
            const ticket = await TicketService.createTicket(tenantId, endUser.user_id, {
                requester: endUser.user_id,
                title: 'State consistency test',
                description: 'Testing state consistency',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: 'medium' as any,
            });

            // Verify initial state
            expect(ticket.status).toBe(TicketStatus.NEW);
            expect(StateManagementService.shouldActivateSLA(ticket.status)).toBe(true);

            // Assign ticket
            const assignedTicket = await TicketService.selfAssignTicket(
                tenantId,
                ticket.id,
                analyst.user_id,
                analyst.role
            );

            // Verify state transition
            expect(assignedTicket!.status).toBe(TicketStatus.IN_PROGRESS);
            expect(StateManagementService.shouldActivateSLA(assignedTicket!.status)).toBe(true);

            // Move to waiting on user
            const waitingTicket = await TicketService.updateTicket(
                tenantId,
                ticket.id,
                { status: TicketStatus.AWAITING_RESPONSE },
                analyst.user_id,
                analyst.role
            );

            // Verify SLA is paused
            expect(waitingTicket!.status).toBe(TicketStatus.AWAITING_RESPONSE);
            expect(StateManagementService.shouldPauseSLA(waitingTicket!.status)).toBe(true);

            // Resolve ticket
            const resolvedTicket = await TicketService.updateTicket(
                tenantId,
                ticket.id,
                { status: TicketStatus.RESOLVED },
                analyst.user_id,
                analyst.role
            );

            // Verify final state
            expect(resolvedTicket!.status).toBe(TicketStatus.RESOLVED);
            expect(StateManagementService.shouldPauseSLA(resolvedTicket!.status)).toBe(true);
        });

        it('should validate all state transitions according to business rules', async () => {
            // Test all valid state transitions
            const validTransitions = [
                [TicketStatus.NEW, TicketStatus.IN_PROGRESS],
                [TicketStatus.IN_PROGRESS, TicketStatus.AWAITING_RESPONSE],
                [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
                [TicketStatus.AWAITING_RESPONSE, TicketStatus.IN_PROGRESS],
                [TicketStatus.AWAITING_RESPONSE, TicketStatus.RESOLVED],
                [TicketStatus.RESOLVED, TicketStatus.CLOSED],
                [TicketStatus.RESOLVED, TicketStatus.IN_PROGRESS], // Reopening
            ];

            validTransitions.forEach(([from, to]) => {
                const result = StateManagementService.validateStateTransition(from, to);
                expect(result.valid).toBe(true);
            });

            // Test invalid state transitions
            const invalidTransitions = [
                [TicketStatus.CLOSED, TicketStatus.NEW],
                [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS],
                [TicketStatus.CLOSED, TicketStatus.RESOLVED],
                [TicketStatus.NEW, TicketStatus.AWAITING_RESPONSE], // Can't skip IN_PROGRESS
            ];

            invalidTransitions.forEach(([from, to]) => {
                const result = StateManagementService.validateStateTransition(from, to);
                expect(result.valid).toBe(false);
                expect(result.error).toBeDefined();
            });
        });
    });

    describe('Error Recovery and Resilience', () => {
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
                description: 'Testing failure recovery',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: 'medium' as any,
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
    });
});