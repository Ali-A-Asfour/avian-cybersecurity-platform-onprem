/**
 * Integration Test for Queue Management Service
 * Tests the complete queue management functionality
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { QueueManagementService } from '../QueueManagementService';
import { TicketService } from '../../ticket.service';
import { UserRole, TicketCategory, TicketSeverity, TicketPriority, TicketStatus } from '../../../types';

describe('QueueManagementService Integration Tests', () => {
    // Use unique tenant IDs for each test to avoid interference
    const generateTenantId = () => `test-tenant-queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const mockAnalyst1Id = 'analyst-queue-integration-1';
    const mockAnalyst2Id = 'analyst-queue-integration-2';
    const mockTenantAdminId = 'tenant-admin-queue-integration';

    beforeEach(() => {
        // Set up test environment
        process.env.NODE_ENV = 'development';
        process.env.BYPASS_AUTH = 'true';
    });

    afterEach(() => {
        // Clean up
        delete process.env.BYPASS_AUTH;
    });

    describe('Unassigned Queue', () => {
        it('should return unassigned tickets sorted by queue rules', async () => {
            const mockTenantId = generateTenantId();

            // Create tickets with different severities
            const lowTicket = await TicketService.createTicket(mockTenantId, mockAnalyst1Id, {
                requester: 'user1@example.com',
                title: 'Low severity ticket',
                description: 'This is a low severity ticket',
                category: TicketCategory.GENERAL_REQUEST,
                severity: TicketSeverity.LOW,
                priority: TicketPriority.LOW,
            });

            const criticalTicket = await TicketService.createTicket(mockTenantId, mockAnalyst1Id, {
                requester: 'user2@example.com',
                title: 'Critical severity ticket',
                description: 'This is a critical severity ticket',
                category: TicketCategory.OTHER,
                severity: TicketSeverity.CRITICAL,
                priority: TicketPriority.URGENT,
            });

            const highTicket = await TicketService.createTicket(mockTenantId, mockAnalyst1Id, {
                requester: 'user3@example.com',
                title: 'High severity ticket',
                description: 'This is a high severity ticket',
                category: TicketCategory.GENERAL_REQUEST,
                severity: TicketSeverity.HIGH,
                priority: TicketPriority.HIGH,
            });

            // Get unassigned queue
            const result = await QueueManagementService.getUnassignedQueue(
                mockTenantId,
                UserRole.IT_HELPDESK_ANALYST,
                mockAnalyst1Id
            );

            expect(result.tickets).toHaveLength(3);

            // Verify sorting: critical > high > low
            expect(result.tickets[0].id).toBe(criticalTicket.id);
            expect(result.tickets[1].id).toBe(highTicket.id);
            expect(result.tickets[2].id).toBe(lowTicket.id);
        });

        it('should filter by role-based categories', async () => {
            const mockTenantId = generateTenantId();

            // Create tickets in different categories
            const itTicket = await TicketService.createTicket(mockTenantId, mockAnalyst1Id, {
                requester: 'user1@example.com',
                title: 'IT Support ticket',
                description: 'IT support request',
                category: TicketCategory.IT_SUPPORT,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
            });

            const securityTicket = await TicketService.createTicket(mockTenantId, mockAnalyst1Id, {
                requester: 'user2@example.com',
                title: 'Security incident',
                description: 'Security incident report',
                category: TicketCategory.SECURITY_INCIDENT,
                severity: TicketSeverity.HIGH,
                priority: TicketPriority.HIGH,
            });

            // IT Helpdesk Analyst should only see IT support tickets
            const itResult = await QueueManagementService.getUnassignedQueue(
                mockTenantId,
                UserRole.IT_HELPDESK_ANALYST,
                mockAnalyst1Id
            );

            // Should include IT ticket but not security ticket
            const itTicketIds = itResult.tickets.map(t => t.id);
            expect(itTicketIds).toContain(itTicket.id);
            expect(itTicketIds).not.toContain(securityTicket.id);

            // Security Analyst should only see security tickets
            const securityResult = await QueueManagementService.getUnassignedQueue(
                mockTenantId,
                UserRole.SECURITY_ANALYST,
                mockAnalyst2Id
            );

            const securityTicketIds = securityResult.tickets.map(t => t.id);
            expect(securityTicketIds).toContain(securityTicket.id);
            expect(securityTicketIds).not.toContain(itTicket.id);
        });
    });

    describe('My Tickets Queue', () => {
        it('should return only tickets assigned to the analyst', async () => {
            const mockTenantId = generateTenantId();

            // Create tickets and assign one to analyst1
            const ticket1 = await TicketService.createTicket(mockTenantId, mockAnalyst1Id, {
                requester: 'user1@example.com',
                title: 'Ticket 1',
                description: 'First ticket',
                category: TicketCategory.GENERAL_REQUEST,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
            });

            const ticket2 = await TicketService.createTicket(mockTenantId, mockAnalyst1Id, {
                requester: 'user2@example.com',
                title: 'Ticket 2',
                description: 'Second ticket',
                category: TicketCategory.OTHER,
                severity: TicketSeverity.HIGH,
                priority: TicketPriority.HIGH,
            });

            // Assign ticket1 to analyst1
            await TicketService.selfAssignTicket(mockTenantId, ticket1.id, mockAnalyst1Id, UserRole.IT_HELPDESK_ANALYST);

            // Get analyst1's tickets
            const result = await QueueManagementService.getMyTicketsQueue(
                mockTenantId,
                mockAnalyst1Id,
                UserRole.IT_HELPDESK_ANALYST
            );

            expect(result.tickets).toHaveLength(1);
            expect(result.tickets[0].id).toBe(ticket1.id);
            expect(result.tickets[0].assignee).toBe(mockAnalyst1Id);
        });
    });

    describe('Tenant Admin Queue', () => {
        it('should return tickets created by or assigned to tenant admin', async () => {
            const mockTenantId = generateTenantId();

            // Create ticket as tenant admin
            const adminTicket = await TicketService.createTicket(mockTenantId, mockTenantAdminId, {
                requester: 'admin@example.com',
                title: 'Admin ticket',
                description: 'Ticket created by admin',
                category: TicketCategory.GENERAL_REQUEST,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
            });

            // Create ticket by another user
            const userTicket = await TicketService.createTicket(mockTenantId, mockAnalyst1Id, {
                requester: 'user@example.com',
                title: 'User ticket',
                description: 'Ticket created by user',
                category: TicketCategory.OTHER,
                severity: TicketSeverity.LOW,
                priority: TicketPriority.LOW,
            });

            // Get tenant admin queue
            const result = await QueueManagementService.getTenantAdminQueue(
                mockTenantId,
                UserRole.TENANT_ADMIN,
                mockTenantAdminId
            );

            // Should only see tickets created by admin
            expect(result.tickets).toHaveLength(1);
            expect(result.tickets[0].id).toBe(adminTicket.id);
        });

        it('should throw error for non-tenant-admin users', async () => {
            const mockTenantId = generateTenantId();

            await expect(
                QueueManagementService.getTenantAdminQueue(
                    mockTenantId,
                    UserRole.IT_HELPDESK_ANALYST,
                    mockAnalyst1Id
                )
            ).rejects.toThrow('Access denied: Only tenant admins can view all tenant tickets');
        });
    });

    describe('Queue Metrics', () => {
        it('should calculate correct queue metrics', async () => {
            const mockTenantId = generateTenantId();

            // Create tickets with different statuses and severities
            const newTicket = await TicketService.createTicket(mockTenantId, mockAnalyst1Id, {
                requester: 'user1@example.com',
                title: 'New ticket',
                description: 'New ticket',
                category: TicketCategory.GENERAL_REQUEST,
                severity: TicketSeverity.CRITICAL,
                priority: TicketPriority.URGENT,
            });

            const assignedTicket = await TicketService.createTicket(mockTenantId, mockAnalyst1Id, {
                requester: 'user2@example.com',
                title: 'Assigned ticket',
                description: 'Assigned ticket',
                category: TicketCategory.OTHER,
                severity: TicketSeverity.HIGH,
                priority: TicketPriority.HIGH,
            });

            // Assign one ticket
            await TicketService.selfAssignTicket(mockTenantId, assignedTicket.id, mockAnalyst1Id, UserRole.IT_HELPDESK_ANALYST);

            // Get metrics
            const metrics = await QueueManagementService.getQueueMetrics(
                mockTenantId,
                UserRole.IT_HELPDESK_ANALYST,
                mockAnalyst1Id
            );

            expect(metrics.total_tickets).toBe(2);
            expect(metrics.unassigned_tickets).toBe(1);
            expect(metrics.assigned_tickets).toBe(1);
            expect(metrics.by_severity.critical).toBe(1);
            expect(metrics.by_severity.high).toBe(1);
            expect(metrics.by_status.new).toBe(1);
            expect(metrics.by_status.in_progress).toBe(1);
        });
    });

    describe('Queue Position Updates', () => {
        it('should update queue position when ticket is assigned', async () => {
            const mockTenantId = generateTenantId();

            const ticket = await TicketService.createTicket(mockTenantId, mockAnalyst1Id, {
                requester: 'user@example.com',
                title: 'Test ticket',
                description: 'Test ticket for queue position',
                category: TicketCategory.GENERAL_REQUEST,
                severity: TicketSeverity.MEDIUM,
                priority: TicketPriority.MEDIUM,
            });

            const originalQueueTime = ticket.queue_position_updated_at;

            // Wait a moment to ensure different timestamp
            await new Promise(resolve => setTimeout(resolve, 10));

            // Update queue position
            const updatedTicket = await QueueManagementService.updateQueuePosition(
                mockTenantId,
                ticket.id
            );

            expect(updatedTicket).toBeDefined();
            expect(new Date(updatedTicket!.queue_position_updated_at).getTime())
                .toBeGreaterThan(new Date(originalQueueTime).getTime());
        });
    });
});