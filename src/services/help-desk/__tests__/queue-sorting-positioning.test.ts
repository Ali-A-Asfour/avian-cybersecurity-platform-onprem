/**
 * Test for Queue Sorting with Assigned Ticket Positioning
 * Validates: Requirements 2.3 (Property 3: Self-Assignment Queue Management)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TicketService } from '../../ticket.service';
import { UserRole, TicketCategory, TicketSeverity, TicketPriority, TicketStatus } from '../../../types';

describe('Queue Sorting with Assigned Ticket Positioning', () => {
    beforeEach(() => {
        // Set up test environment
        process.env.NODE_ENV = 'development';
        process.env.BYPASS_AUTH = 'true';
    });

    afterEach(() => {
        // Clean up
        delete process.env.BYPASS_AUTH;
    });

    it('should sort tickets by impact level DESC, queuePositionUpdatedAt ASC, id ASC', async () => {
        const mockTenantId = 'test-tenant-queue-sorting-1';
        const mockAnalystId = 'analyst-queue-sorting-1';

        // Create tickets with different severities and timestamps
        const lowSeverityTicket = await TicketService.createTicket(mockTenantId, mockAnalystId, {
            requester: 'user1@example.com',
            title: 'Low severity ticket',
            description: 'This is a low severity ticket',
            category: TicketCategory.GENERAL_REQUEST,
            severity: TicketSeverity.LOW,
            priority: TicketPriority.LOW,
        });

        const highSeverityTicket = await TicketService.createTicket(mockTenantId, mockAnalystId, {
            requester: 'user2@example.com',
            title: 'High severity ticket',
            description: 'This is a high severity ticket',
            category: TicketCategory.OTHER,
            severity: TicketSeverity.HIGH,
            priority: TicketPriority.HIGH,
        });

        const criticalSeverityTicket = await TicketService.createTicket(mockTenantId, mockAnalystId, {
            requester: 'user3@example.com',
            title: 'Critical severity ticket',
            description: 'This is a critical severity ticket',
            category: TicketCategory.GENERAL_REQUEST,
            severity: TicketSeverity.CRITICAL,
            priority: TicketPriority.URGENT,
        });

        const mediumSeverityTicket = await TicketService.createTicket(mockTenantId, mockAnalystId, {
            requester: 'user4@example.com',
            title: 'Medium severity ticket',
            description: 'This is a medium severity ticket',
            category: TicketCategory.OTHER,
            severity: TicketSeverity.MEDIUM,
            priority: TicketPriority.MEDIUM,
        });

        // Get tickets and verify sorting
        const result = await TicketService.getTickets(mockTenantId, {}, UserRole.IT_HELPDESK_ANALYST, mockAnalystId);

        expect(result.tickets).toHaveLength(4);

        // Verify sorting order: critical > high > medium > low
        expect(result.tickets[0].id).toBe(criticalSeverityTicket.id);
        expect(result.tickets[1].id).toBe(highSeverityTicket.id);
        expect(result.tickets[2].id).toBe(mediumSeverityTicket.id);
        expect(result.tickets[3].id).toBe(lowSeverityTicket.id);
    });

    it('should move assigned tickets to bottom of queue while keeping them visible', async () => {
        const mockTenantId = 'test-tenant-assignment-positioning-1';
        const mockAnalystId = 'analyst-assignment-positioning-1';

        // Create multiple tickets with same severity
        const ticket1 = await TicketService.createTicket(mockTenantId, mockAnalystId, {
            requester: 'user1@example.com',
            title: 'First ticket',
            description: 'First ticket created',
            category: TicketCategory.GENERAL_REQUEST,
            severity: TicketSeverity.HIGH,
            priority: TicketPriority.HIGH,
        });

        const ticket2 = await TicketService.createTicket(mockTenantId, mockAnalystId, {
            requester: 'user2@example.com',
            title: 'Second ticket',
            description: 'Second ticket created',
            category: TicketCategory.OTHER,
            severity: TicketSeverity.HIGH,
            priority: TicketPriority.HIGH,
        });

        const ticket3 = await TicketService.createTicket(mockTenantId, mockAnalystId, {
            requester: 'user3@example.com',
            title: 'Third ticket',
            description: 'Third ticket created',
            category: TicketCategory.GENERAL_REQUEST,
            severity: TicketSeverity.HIGH,
            priority: TicketPriority.HIGH,
        });

        // Get initial queue order
        const initialResult = await TicketService.getTickets(mockTenantId, {}, UserRole.IT_HELPDESK_ANALYST, mockAnalystId);
        expect(initialResult.tickets).toHaveLength(3);

        // Tickets should be in creation order (oldest queue_position_updated_at first)
        expect(initialResult.tickets[0].id).toBe(ticket1.id);
        expect(initialResult.tickets[1].id).toBe(ticket2.id);
        expect(initialResult.tickets[2].id).toBe(ticket3.id);

        // Self-assign the first ticket
        await TicketService.selfAssignTicket(mockTenantId, ticket1.id, mockAnalystId, UserRole.IT_HELPDESK_ANALYST);

        // Get queue after assignment
        const afterAssignmentResult = await TicketService.getTickets(mockTenantId, {}, UserRole.IT_HELPDESK_ANALYST, mockAnalystId);
        expect(afterAssignmentResult.tickets).toHaveLength(3);

        // The assigned ticket should now be at the bottom (due to updated queue_position_updated_at)
        expect(afterAssignmentResult.tickets[0].id).toBe(ticket2.id);
        expect(afterAssignmentResult.tickets[1].id).toBe(ticket3.id);
        expect(afterAssignmentResult.tickets[2].id).toBe(ticket1.id);

        // Verify the assigned ticket is still visible and has the correct status
        const assignedTicket = afterAssignmentResult.tickets.find(t => t.id === ticket1.id);
        expect(assignedTicket).toBeDefined();
        expect(assignedTicket!.assignee).toBe(mockAnalystId);
        expect(assignedTicket!.status).toBe(TicketStatus.IN_PROGRESS);
    });

    it('should maintain proper sorting when mixing severities and assignments', async () => {
        const mockTenantId = 'test-tenant-mixed-sorting-1';
        const mockAnalyst1Id = 'analyst-mixed-sorting-1';
        const mockAnalyst2Id = 'analyst-mixed-sorting-2';

        // Create tickets with different severities
        const criticalTicket = await TicketService.createTicket(mockTenantId, mockAnalyst1Id, {
            requester: 'user1@example.com',
            title: 'Critical ticket',
            description: 'Critical severity ticket',
            category: TicketCategory.GENERAL_REQUEST,
            severity: TicketSeverity.CRITICAL,
            priority: TicketPriority.URGENT,
        });

        const highTicket1 = await TicketService.createTicket(mockTenantId, mockAnalyst1Id, {
            requester: 'user2@example.com',
            title: 'High ticket 1',
            description: 'First high severity ticket',
            category: TicketCategory.OTHER,
            severity: TicketSeverity.HIGH,
            priority: TicketPriority.HIGH,
        });

        const highTicket2 = await TicketService.createTicket(mockTenantId, mockAnalyst1Id, {
            requester: 'user3@example.com',
            title: 'High ticket 2',
            description: 'Second high severity ticket',
            category: TicketCategory.GENERAL_REQUEST,
            severity: TicketSeverity.HIGH,
            priority: TicketPriority.HIGH,
        });

        const mediumTicket = await TicketService.createTicket(mockTenantId, mockAnalyst1Id, {
            requester: 'user4@example.com',
            title: 'Medium ticket',
            description: 'Medium severity ticket',
            category: TicketCategory.OTHER,
            severity: TicketSeverity.MEDIUM,
            priority: TicketPriority.MEDIUM,
        });

        // Add a small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));

        // Assign one of the high severity tickets
        await TicketService.selfAssignTicket(mockTenantId, highTicket1.id, mockAnalyst2Id, UserRole.IT_HELPDESK_ANALYST);

        // Get queue and verify sorting
        const result = await TicketService.getTickets(mockTenantId, {}, UserRole.IT_HELPDESK_ANALYST, mockAnalyst1Id);
        expect(result.tickets).toHaveLength(4);



        // Expected order:
        // 1. Critical (unassigned) - highest severity
        // 2. High ticket 2 (unassigned) - high severity, older queue position than assigned ticket
        // 3. High ticket 1 (assigned) - high severity, newer queue position due to assignment
        // 4. Medium (unassigned) - medium severity
        expect(result.tickets[0].id).toBe(criticalTicket.id);
        expect(result.tickets[1].id).toBe(highTicket2.id);
        expect(result.tickets[2].id).toBe(highTicket1.id);
        expect(result.tickets[3].id).toBe(mediumTicket.id);

        // Verify the assigned ticket has correct properties
        expect(result.tickets[2].assignee).toBe(mockAnalyst2Id);
        expect(result.tickets[2].status).toBe(TicketStatus.IN_PROGRESS);
    });
});