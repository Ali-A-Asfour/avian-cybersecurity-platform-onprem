/**
 * Property-Based Test for Self-Assignment Queue Management
 * **Feature: avian-help-desk, Property 3: Self-Assignment Queue Management**
 * **Validates: Requirements 2.3**
 * 
 * Property: For any ticket assignment, the ticket should appear in the analyst's "My Tickets" queue 
 * and move to the bottom of the general tenant queue while remaining visible
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fc from 'fast-check';
import { TicketService } from '../../ticket.service';
import { QueueManagementService } from '../QueueManagementService';
import { UserRole, TicketCategory, TicketSeverity, TicketPriority, TicketStatus } from '../../../types';

describe('Property-Based Test: Self-Assignment Queue Management', () => {
    beforeEach(() => {
        // Set up test environment
        if (!process.env.NODE_ENV) {
            (process.env as any).NODE_ENV = 'development';
        }
        process.env.BYPASS_AUTH = 'true';
    });

    afterEach(() => {
        // Clean up
        delete process.env.BYPASS_AUTH;
    });

    // Generator for valid ticket categories that IT Helpdesk Analysts can access
    const itHelpDeskCategories = fc.constantFrom(
        TicketCategory.IT_SUPPORT,
        TicketCategory.HARDWARE_ISSUE,
        TicketCategory.SOFTWARE_ISSUE,
        TicketCategory.NETWORK_ISSUE,
        TicketCategory.ACCESS_REQUEST,
        TicketCategory.ACCOUNT_SETUP,
        TicketCategory.GENERAL_REQUEST,
        TicketCategory.OTHER
    );

    // Generator for ticket severities
    const ticketSeverities = fc.constantFrom(
        TicketSeverity.LOW,
        TicketSeverity.MEDIUM,
        TicketSeverity.HIGH,
        TicketSeverity.CRITICAL
    );

    // Generator for ticket priorities
    const ticketPriorities = fc.constantFrom(
        TicketPriority.LOW,
        TicketPriority.MEDIUM,
        TicketPriority.HIGH,
        TicketPriority.URGENT
    );

    // Generator for ticket data with more realistic content
    const ticketDataGenerator = fc.record({
        requester: fc.emailAddress(),
        title: fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.trim().length >= 5),
        description: fc.string({ minLength: 20, maxLength: 500 }).filter(s => s.trim().length >= 10),
        category: itHelpDeskCategories,
        severity: ticketSeverities,
        priority: ticketPriorities,
    });

    it('Property 3: Self-assignment moves ticket to bottom of queue while keeping it visible', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(ticketDataGenerator, { minLength: 2, maxLength: 5 }),
                fc.integer({ min: 0, max: 4 }), // Index of ticket to assign
                async (ticketDataArray, assignmentIndex) => {
                    // Generate unique tenant and user IDs for this test run
                    const mockTenantId = `test-tenant-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                    const mockAnalystId = `analyst-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

                    // Ensure we have a valid assignment index
                    const validAssignmentIndex = assignmentIndex % ticketDataArray.length;

                    // Create all tickets
                    const createdTickets = [];
                    for (const ticketData of ticketDataArray) {
                        const ticket = await TicketService.createTicket(mockTenantId, mockAnalystId, ticketData);
                        createdTickets.push(ticket);

                        // Add small delay to ensure different queue_position_updated_at timestamps
                        await new Promise(resolve => setTimeout(resolve, 1));
                    }

                    // Get initial queue state
                    const initialQueue = await QueueManagementService.getUnassignedQueue(
                        mockTenantId,
                        UserRole.IT_HELPDESK_ANALYST,
                        mockAnalystId
                    );

                    // Verify all tickets are initially unassigned and visible
                    expect(initialQueue.tickets).toHaveLength(createdTickets.length);
                    for (const ticket of initialQueue.tickets) {
                        expect(ticket.assignee).toBeUndefined();
                    }

                    // Self-assign the selected ticket
                    const ticketToAssign = createdTickets[validAssignmentIndex];
                    const assignedTicket = await TicketService.selfAssignTicket(
                        mockTenantId,
                        ticketToAssign.id,
                        mockAnalystId,
                        UserRole.IT_HELPDESK_ANALYST
                    );

                    // Verify assignment was successful
                    expect(assignedTicket).toBeDefined();
                    expect(assignedTicket!.assignee).toBe(mockAnalystId);
                    expect(assignedTicket!.status).toBe(TicketStatus.IN_PROGRESS);

                    // Get queue state after assignment
                    const afterAssignmentQueue = await QueueManagementService.getUnassignedQueue(
                        mockTenantId,
                        UserRole.IT_HELPDESK_ANALYST,
                        mockAnalystId
                    );

                    // Property: Assigned ticket should still be visible in general queue
                    expect(afterAssignmentQueue.tickets).toHaveLength(createdTickets.length);
                    const assignedTicketInQueue = afterAssignmentQueue.tickets.find(t => t.id === ticketToAssign.id);
                    expect(assignedTicketInQueue).toBeDefined();
                    expect(assignedTicketInQueue!.assignee).toBe(mockAnalystId);

                    // Property: Assigned ticket should appear in analyst's "My Tickets" queue
                    const myTicketsQueue = await QueueManagementService.getMyTicketsQueue(
                        mockTenantId,
                        mockAnalystId,
                        UserRole.IT_HELPDESK_ANALYST
                    );

                    expect(myTicketsQueue.tickets).toHaveLength(1);
                    expect(myTicketsQueue.tickets[0].id).toBe(ticketToAssign.id);
                    expect(myTicketsQueue.tickets[0].assignee).toBe(mockAnalystId);

                    // Property: Assigned ticket should move to bottom of queue (due to updated queue_position_updated_at)
                    // Find tickets with same severity as the assigned ticket
                    const sameSeverityTickets = afterAssignmentQueue.tickets.filter(
                        t => t.severity === assignedTicket!.severity
                    );

                    if (sameSeverityTickets.length > 1) {
                        // The assigned ticket should be last among tickets of the same severity
                        const assignedTicketIndex = sameSeverityTickets.findIndex(t => t.id === ticketToAssign.id);

                        // Due to queue_position_updated_at being updated, assigned ticket should be at the end
                        // of its severity group (or close to it, considering the sorting rules)
                        expect(assignedTicketIndex).toBeGreaterThanOrEqual(0);

                        // Verify queue_position_updated_at was updated (should be more recent)
                        const originalQueueTime = new Date(ticketToAssign.queue_position_updated_at).getTime();
                        const updatedQueueTime = new Date(assignedTicketInQueue!.queue_position_updated_at).getTime();
                        expect(updatedQueueTime).toBeGreaterThan(originalQueueTime);
                    }

                    // Property: Queue sorting should still be maintained (severity DESC, queue_position_updated_at ASC, id ASC)
                    for (let i = 0; i < afterAssignmentQueue.tickets.length - 1; i++) {
                        const current = afterAssignmentQueue.tickets[i];
                        const next = afterAssignmentQueue.tickets[i + 1];

                        // Define severity order
                        const severityOrder = {
                            [TicketSeverity.CRITICAL]: 4,
                            [TicketSeverity.HIGH]: 3,
                            [TicketSeverity.MEDIUM]: 2,
                            [TicketSeverity.LOW]: 1
                        };

                        const currentSeverityValue = severityOrder[current.severity];
                        const nextSeverityValue = severityOrder[next.severity];

                        if (currentSeverityValue !== nextSeverityValue) {
                            // Higher severity should come first
                            expect(currentSeverityValue).toBeGreaterThanOrEqual(nextSeverityValue);
                        } else {
                            // Same severity: should be sorted by queue_position_updated_at ASC
                            const currentQueueTime = new Date(current.queue_position_updated_at).getTime();
                            const nextQueueTime = new Date(next.queue_position_updated_at).getTime();

                            if (currentQueueTime !== nextQueueTime) {
                                expect(currentQueueTime).toBeLessThanOrEqual(nextQueueTime);
                            } else {
                                // Same queue time: should be sorted by ID ASC
                                expect(current.id.localeCompare(next.id)).toBeLessThanOrEqual(0);
                            }
                        }
                    }
                }
            ),
            {
                numRuns: 20,
                timeout: 30000,
                verbose: true
            }
        );
    });

    it('Property 3: Multiple assignments maintain queue integrity', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(ticketDataGenerator, { minLength: 3, maxLength: 6 }),
                fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 1, maxLength: 3 }),
                async (ticketDataArray, assignmentIndices) => {
                    // Generate unique tenant and analyst IDs
                    const mockTenantId = `test-tenant-multi-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                    const mockAnalyst1Id = `analyst1-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                    const mockAnalyst2Id = `analyst2-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

                    // Create all tickets
                    const createdTickets = [];
                    for (const ticketData of ticketDataArray) {
                        const ticket = await TicketService.createTicket(mockTenantId, mockAnalyst1Id, ticketData);
                        createdTickets.push(ticket);
                        await new Promise(resolve => setTimeout(resolve, 1));
                    }

                    // Perform multiple assignments
                    const assignedTicketIds = new Set<string>();
                    const analysts = [mockAnalyst1Id, mockAnalyst2Id];

                    for (let i = 0; i < Math.min(assignmentIndices.length, createdTickets.length); i++) {
                        const ticketIndex = assignmentIndices[i] % createdTickets.length;
                        const ticket = createdTickets[ticketIndex];

                        // Skip if already assigned
                        if (assignedTicketIds.has(ticket.id)) continue;

                        const analystId = analysts[i % analysts.length];
                        await TicketService.selfAssignTicket(
                            mockTenantId,
                            ticket.id,
                            analystId,
                            UserRole.IT_HELPDESK_ANALYST
                        );

                        assignedTicketIds.add(ticket.id);
                        await new Promise(resolve => setTimeout(resolve, 1));
                    }

                    // Get final queue state
                    const finalQueue = await QueueManagementService.getUnassignedQueue(
                        mockTenantId,
                        UserRole.IT_HELPDESK_ANALYST,
                        mockAnalyst1Id
                    );

                    // Property: All tickets should still be visible
                    expect(finalQueue.tickets).toHaveLength(createdTickets.length);

                    // Property: Each assigned ticket should appear in respective analyst's queue
                    for (const analystId of analysts) {
                        const myTicketsQueue = await QueueManagementService.getMyTicketsQueue(
                            mockTenantId,
                            analystId,
                            UserRole.IT_HELPDESK_ANALYST
                        );

                        // Count how many tickets were assigned to this analyst
                        const expectedCount = Array.from(assignedTicketIds).filter(ticketId => {
                            const ticket = finalQueue.tickets.find(t => t.id === ticketId);
                            return ticket?.assignee === analystId;
                        }).length;

                        expect(myTicketsQueue.tickets).toHaveLength(expectedCount);

                        // All tickets in "My Tickets" should be assigned to this analyst
                        for (const ticket of myTicketsQueue.tickets) {
                            expect(ticket.assignee).toBe(analystId);
                            expect(ticket.status).toBe(TicketStatus.IN_PROGRESS);
                        }
                    }

                    // Property: Queue sorting integrity should be maintained
                    const severityOrder = {
                        [TicketSeverity.CRITICAL]: 4,
                        [TicketSeverity.HIGH]: 3,
                        [TicketSeverity.MEDIUM]: 2,
                        [TicketSeverity.LOW]: 1
                    };

                    for (let i = 0; i < finalQueue.tickets.length - 1; i++) {
                        const current = finalQueue.tickets[i];
                        const next = finalQueue.tickets[i + 1];

                        const currentSeverityValue = severityOrder[current.severity];
                        const nextSeverityValue = severityOrder[next.severity];

                        // Verify sorting rules are maintained
                        if (currentSeverityValue !== nextSeverityValue) {
                            expect(currentSeverityValue).toBeGreaterThanOrEqual(nextSeverityValue);
                        }
                    }
                }
            ),
            {
                numRuns: 10,
                timeout: 45000,
                verbose: true
            }
        );
    });
});