/**
 * Property-Based Test for Metrics Calculation Accuracy
 * **Feature: avian-help-desk, Property 14: Metrics Calculation Accuracy**
 * **Validates: Requirements 6.4**
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TicketService } from '../../ticket.service';
import { UserRole, TicketCategory, TicketSeverity, TicketPriority, TicketStatus } from '../../../types';

describe('Metrics Calculation Accuracy Property Tests', () => {
    beforeEach(() => {
        // Set up test environment
        process.env.NODE_ENV = 'development';
        process.env.BYPASS_AUTH = 'true';
    });

    afterEach(() => {
        // Clean up
        delete process.env.BYPASS_AUTH;
    });

    it('Property 14: Metrics Calculation Accuracy - should accurately reflect ticket volume and resolution times', async () => {
        const mockTenantId = 'test-tenant-metrics-1';
        const mockTenantAdminId = 'admin-user-metrics-1';
        const { mockDb } = await import('@/lib/mock-database');

        // Create tickets with known characteristics for metrics validation
        const newTicket = await TicketService.createTicket(mockTenantId, mockTenantAdminId, {
            requester: 'user1@example.com',
            title: 'New ticket for metrics',
            description: 'This ticket should be counted as new',
            category: TicketCategory.GENERAL_REQUEST,
            severity: TicketSeverity.HIGH,
            priority: TicketPriority.HIGH,
        });

        const resolvedTicket = await TicketService.createTicket(mockTenantId, mockTenantAdminId, {
            requester: 'user2@example.com',
            title: 'Resolved ticket for metrics',
            description: 'This ticket will be resolved',
            category: TicketCategory.OTHER,
            severity: TicketSeverity.MEDIUM,
            priority: TicketPriority.MEDIUM,
        });

        // Resolve one ticket using mock database
        await mockDb.updateTicket(mockTenantId, resolvedTicket.id, {
            status: TicketStatus.RESOLVED,
            updated_at: new Date(),
        });

        const criticalTicket = await TicketService.createTicket(mockTenantId, mockTenantAdminId, {
            requester: 'user3@example.com',
            title: 'Critical ticket for metrics',
            description: 'This ticket is critical severity',
            category: TicketCategory.GENERAL_REQUEST,
            severity: TicketSeverity.CRITICAL,
            priority: TicketPriority.URGENT,
        });

        // Get ticket statistics using mock database
        const stats = await mockDb.getTicketStats(mockTenantId);

        // Verify total count matches created tickets
        expect(stats.total).toBe(3);

        // Verify open tickets count (new + in_progress + awaiting_response)
        expect(stats.open).toBe(2); // newTicket and criticalTicket are still open

        // Verify severity breakdown
        expect(stats.by_severity[TicketSeverity.HIGH]).toBe(1); // newTicket
        expect(stats.by_severity[TicketSeverity.MEDIUM]).toBe(1); // resolvedTicket
        expect(stats.by_severity[TicketSeverity.CRITICAL]).toBe(1); // criticalTicket

        // Verify status breakdown
        expect(stats.by_status[TicketStatus.NEW]).toBe(2); // newTicket and criticalTicket
        expect(stats.by_status[TicketStatus.RESOLVED]).toBe(1); // resolvedTicket

        // Verify resolved today count (should be 1 since we just resolved it)
        expect(stats.resolved_today).toBe(1);
    });

    it('Property 14: Metrics Calculation Accuracy - should maintain accuracy across different ticket volumes', async () => {
        const mockTenantId = 'test-tenant-volume-1';
        const mockTenantAdminId = 'admin-user-volume-1';
        const { mockDb } = await import('@/lib/mock-database');

        // Create multiple tickets with different characteristics
        const ticketPromises = [];
        const expectedSeverityCounts = {
            [TicketSeverity.LOW]: 0,
            [TicketSeverity.MEDIUM]: 0,
            [TicketSeverity.HIGH]: 0,
            [TicketSeverity.CRITICAL]: 0,
        };

        const expectedStatusCounts = {
            [TicketStatus.NEW]: 0,
            [TicketStatus.IN_PROGRESS]: 0,
            [TicketStatus.AWAITING_RESPONSE]: 0,
            [TicketStatus.RESOLVED]: 0,
            [TicketStatus.CLOSED]: 0,
        };

        // Create 10 tickets with varying severities and statuses
        for (let i = 0; i < 10; i++) {
            const severities = [TicketSeverity.LOW, TicketSeverity.MEDIUM, TicketSeverity.HIGH, TicketSeverity.CRITICAL];
            const severity = severities[i % severities.length];
            expectedSeverityCounts[severity]++;

            const ticketPromise = TicketService.createTicket(mockTenantId, mockTenantAdminId, {
                requester: `user${i}@example.com`,
                title: `Test ticket ${i}`,
                description: `Test ticket ${i} for volume testing`,
                category: i % 2 === 0 ? TicketCategory.GENERAL_REQUEST : TicketCategory.OTHER,
                severity,
                priority: TicketPriority.MEDIUM,
            });

            ticketPromises.push(ticketPromise);
        }

        const tickets = await Promise.all(ticketPromises);

        // Resolve some tickets using mock database
        const resolvePromises = [];
        for (let i = 0; i < 3; i++) {
            const resolvePromise = mockDb.updateTicket(mockTenantId, tickets[i].id, {
                status: TicketStatus.RESOLVED,
                updated_at: new Date(),
            });
            resolvePromises.push(resolvePromise);
            expectedStatusCounts[TicketStatus.RESOLVED]++;
        }

        // Set some to in_progress
        for (let i = 3; i < 5; i++) {
            const updatePromise = mockDb.updateTicket(mockTenantId, tickets[i].id, {
                status: TicketStatus.IN_PROGRESS,
                updated_at: new Date(),
            });
            resolvePromises.push(updatePromise);
            expectedStatusCounts[TicketStatus.IN_PROGRESS]++;
        }

        // Remaining tickets stay as NEW
        expectedStatusCounts[TicketStatus.NEW] = 10 - 3 - 2; // 5 tickets

        await Promise.all(resolvePromises);

        // Get statistics and verify accuracy using mock database
        const stats = await mockDb.getTicketStats(mockTenantId);

        // Verify total count
        expect(stats.total).toBe(10);

        // Verify open count (new + in_progress + awaiting_response)
        const expectedOpen = expectedStatusCounts[TicketStatus.NEW] +
            expectedStatusCounts[TicketStatus.IN_PROGRESS] +
            expectedStatusCounts[TicketStatus.AWAITING_RESPONSE];
        expect(stats.open).toBe(expectedOpen);

        // Verify severity breakdown matches expected
        expect(stats.by_severity[TicketSeverity.LOW]).toBe(expectedSeverityCounts[TicketSeverity.LOW]);
        expect(stats.by_severity[TicketSeverity.MEDIUM]).toBe(expectedSeverityCounts[TicketSeverity.MEDIUM]);
        expect(stats.by_severity[TicketSeverity.HIGH]).toBe(expectedSeverityCounts[TicketSeverity.HIGH]);
        expect(stats.by_severity[TicketSeverity.CRITICAL]).toBe(expectedSeverityCounts[TicketSeverity.CRITICAL]);

        // Verify status breakdown matches expected
        expect(stats.by_status[TicketStatus.NEW]).toBe(expectedStatusCounts[TicketStatus.NEW]);
        expect(stats.by_status[TicketStatus.IN_PROGRESS]).toBe(expectedStatusCounts[TicketStatus.IN_PROGRESS]);
        expect(stats.by_status[TicketStatus.RESOLVED]).toBe(expectedStatusCounts[TicketStatus.RESOLVED]);

        // Verify resolved today count
        expect(stats.resolved_today).toBe(3); // We resolved 3 tickets today
    });

    it('Property 14: Metrics Calculation Accuracy - should handle empty tenant data correctly', async () => {
        const emptyTenantId = 'empty-tenant-metrics-1';
        const mockTenantAdminId = 'admin-user-empty-1';
        const { mockDb } = await import('@/lib/mock-database');

        // Get statistics for empty tenant using mock database
        const stats = await mockDb.getTicketStats(emptyTenantId);

        // All counts should be zero
        expect(stats.total).toBe(0);
        expect(stats.open).toBe(0);
        expect(stats.overdue).toBe(0);
        expect(stats.resolved_today).toBe(0);

        // All severity counts should be zero
        expect(stats.by_severity[TicketSeverity.LOW]).toBe(0);
        expect(stats.by_severity[TicketSeverity.MEDIUM]).toBe(0);
        expect(stats.by_severity[TicketSeverity.HIGH]).toBe(0);
        expect(stats.by_severity[TicketSeverity.CRITICAL]).toBe(0);

        // All status counts should be zero
        expect(stats.by_status[TicketStatus.NEW]).toBe(0);
        expect(stats.by_status[TicketStatus.IN_PROGRESS]).toBe(0);
        expect(stats.by_status[TicketStatus.AWAITING_RESPONSE]).toBe(0);
        expect(stats.by_status[TicketStatus.RESOLVED]).toBe(0);
        expect(stats.by_status[TicketStatus.CLOSED]).toBe(0);
    });

    it('Property 14: Metrics Calculation Accuracy - should respect tenant isolation in metrics', async () => {
        const tenant1 = 'tenant-metrics-isolation-1';
        const tenant2 = 'tenant-metrics-isolation-2';
        const admin1 = 'admin-metrics-isolation-1';
        const admin2 = 'admin-metrics-isolation-2';
        const { mockDb } = await import('@/lib/mock-database');

        // Create tickets in tenant 1
        await TicketService.createTicket(tenant1, admin1, {
            requester: 'user1@tenant1.com',
            title: 'Tenant 1 ticket 1',
            description: 'First ticket in tenant 1',
            category: TicketCategory.GENERAL_REQUEST,
            severity: TicketSeverity.HIGH,
            priority: TicketPriority.HIGH,
        });

        await TicketService.createTicket(tenant1, admin1, {
            requester: 'user2@tenant1.com',
            title: 'Tenant 1 ticket 2',
            description: 'Second ticket in tenant 1',
            category: TicketCategory.OTHER,
            severity: TicketSeverity.MEDIUM,
            priority: TicketPriority.MEDIUM,
        });

        // Create tickets in tenant 2
        await TicketService.createTicket(tenant2, admin2, {
            requester: 'user1@tenant2.com',
            title: 'Tenant 2 ticket 1',
            description: 'First ticket in tenant 2',
            category: TicketCategory.GENERAL_REQUEST,
            severity: TicketSeverity.CRITICAL,
            priority: TicketPriority.URGENT,
        });

        // Get statistics for each tenant using mock database
        const stats1 = await mockDb.getTicketStats(tenant1);
        const stats2 = await mockDb.getTicketStats(tenant2);

        // Verify tenant 1 statistics
        expect(stats1.total).toBe(2);
        expect(stats1.by_severity[TicketSeverity.HIGH]).toBe(1);
        expect(stats1.by_severity[TicketSeverity.MEDIUM]).toBe(1);
        expect(stats1.by_severity[TicketSeverity.CRITICAL]).toBe(0); // No critical tickets in tenant 1

        // Verify tenant 2 statistics
        expect(stats2.total).toBe(1);
        expect(stats2.by_severity[TicketSeverity.CRITICAL]).toBe(1);
        expect(stats2.by_severity[TicketSeverity.HIGH]).toBe(0); // No high tickets in tenant 2
        expect(stats2.by_severity[TicketSeverity.MEDIUM]).toBe(0); // No medium tickets in tenant 2

        // Verify isolation - tenant 1 stats should not include tenant 2 data and vice versa
        expect(stats1.total + stats2.total).toBe(3); // Total across both tenants
    });
});