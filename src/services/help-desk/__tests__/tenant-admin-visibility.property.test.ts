/**
 * Property-Based Test for Tenant Admin Visibility
 * **Feature: avian-help-desk, Property 13: Tenant Admin Visibility**
 * **Validates: Requirements 6.1, 6.3**
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TicketService } from '../../ticket.service';
import { UserRole, TicketCategory, TicketSeverity, TicketPriority, TicketStatus } from '../../../types';

describe('Tenant Admin Visibility Property Tests', () => {
    beforeEach(() => {
        // Set up test environment
        process.env.NODE_ENV = 'development';
        process.env.BYPASS_AUTH = 'true';
    });

    afterEach(() => {
        // Clean up
        delete process.env.BYPASS_AUTH;
    });

    it('Property 13: Tenant Admin Visibility - should see tickets they created or are assigned to', async () => {
        const mockTenantId = 'test-tenant-visibility-1';
        const mockTenantAdminId = 'admin-user-visibility-1';
        const mockOtherUserId = 'other-user-visibility-1';
        const mockAnalystId = 'analyst-visibility-1';

        // Create tickets with different creators and assignees within the same tenant
        const ticket1 = await TicketService.createTicket(mockTenantId, mockTenantAdminId, {
            requester: 'user1@example.com',
            title: 'Admin created ticket',
            description: 'Ticket created by tenant admin',
            category: TicketCategory.GENERAL_REQUEST, // Tenant admin can only access general categories
            severity: TicketSeverity.MEDIUM,
            priority: TicketPriority.MEDIUM,
        });

        const ticket2 = await TicketService.createTicket(mockTenantId, mockOtherUserId, {
            requester: 'user2@example.com',
            assignee: mockAnalystId,
            title: 'Other user ticket',
            description: 'Ticket created by another user',
            category: TicketCategory.GENERAL_REQUEST,
            severity: TicketSeverity.LOW,
            priority: TicketPriority.LOW,
        });

        const ticket3 = await TicketService.createTicket(mockTenantId, mockAnalystId, {
            requester: 'user3@example.com',
            assignee: mockTenantAdminId,
            title: 'Analyst created ticket',
            description: 'Ticket created by analyst, assigned to admin',
            category: TicketCategory.OTHER, // Tenant admin can access this category when assigned
            severity: TicketSeverity.HIGH,
            priority: TicketPriority.HIGH,
        });

        // Test tenant admin can see tickets they created or are assigned to
        const adminTickets = await TicketService.getTickets(
            mockTenantId,
            {},
            UserRole.TENANT_ADMIN,
            mockTenantAdminId
        );

        // Tenant admin should see tickets they created or are assigned to
        expect(adminTickets.tickets).toHaveLength(2);

        const ticketIds = adminTickets.tickets.map(t => t.id);
        expect(ticketIds).toContain(ticket1.id); // Created by admin
        expect(ticketIds).toContain(ticket3.id); // Assigned to admin
        expect(ticketIds).not.toContain(ticket2.id); // Neither created by nor assigned to admin

        // Verify total count matches
        expect(adminTickets.total).toBe(2);
    });

    it('Property 13: Tenant Admin Visibility - should allow creating tickets on behalf of other users', async () => {
        const mockTenantId = 'test-tenant-proxy-1';
        const mockTenantAdminId = 'admin-user-proxy-1';

        // Test that tenant admin can create tickets on behalf of other users
        const proxyTicket = await TicketService.createTicket(mockTenantId, mockTenantAdminId, {
            requester: 'enduser@example.com', // Different from creator
            title: 'Proxy ticket creation',
            description: 'Ticket created by admin on behalf of end user',
            category: TicketCategory.GENERAL_REQUEST, // Tenant admin can only create general categories
            severity: TicketSeverity.MEDIUM,
            priority: TicketPriority.MEDIUM,
        });

        expect(proxyTicket).toBeDefined();
        expect(proxyTicket.requester).toBe('enduser@example.com');
        expect(proxyTicket.created_by).toBe(mockTenantAdminId);
        expect(proxyTicket.title).toBe('Proxy ticket creation');

        // Verify the admin can see this ticket in their queue (since they created it)
        const adminTickets = await TicketService.getTickets(
            mockTenantId,
            {},
            UserRole.TENANT_ADMIN,
            mockTenantAdminId
        );

        const createdTicket = adminTickets.tickets.find(t => t.id === proxyTicket.id);
        expect(createdTicket).toBeDefined();
    });

    it('Property 13: Tenant Admin Visibility - should not see tickets from other tenants', async () => {
        const otherTenantId = 'other-tenant-isolation-1';
        const mockTenantId = 'test-tenant-isolation-1';
        const mockTenantAdminId = 'admin-user-isolation-1';

        // Create ticket in different tenant
        const otherTenantTicket = await TicketService.createTicket(otherTenantId, mockTenantAdminId, {
            requester: 'user@othertenant.com',
            title: 'Other tenant ticket',
            description: 'Ticket in different tenant',
            category: TicketCategory.GENERAL_REQUEST,
            severity: TicketSeverity.MEDIUM,
            priority: TicketPriority.MEDIUM,
        });

        // Create ticket in admin's tenant
        const ownTenantTicket = await TicketService.createTicket(mockTenantId, mockTenantAdminId, {
            requester: 'user@owntenant.com',
            title: 'Own tenant ticket',
            description: 'Ticket in admin\'s tenant',
            category: TicketCategory.GENERAL_REQUEST,
            severity: TicketSeverity.MEDIUM,
            priority: TicketPriority.MEDIUM,
        });

        // Admin should only see tickets from their own tenant that they created or are assigned to
        const adminTickets = await TicketService.getTickets(
            mockTenantId,
            {},
            UserRole.TENANT_ADMIN,
            mockTenantAdminId
        );

        const ticketIds = adminTickets.tickets.map(t => t.id);
        expect(ticketIds).toContain(ownTenantTicket.id);
        expect(ticketIds).not.toContain(otherTenantTicket.id);
    });

    it('Property 13: Tenant Admin Visibility - should maintain tenant isolation across all operations', async () => {
        // Test that tenant isolation is maintained across different operations
        const tenant1 = 'tenant-isolation-1';
        const tenant2 = 'tenant-isolation-2';
        const admin1 = 'admin-isolation-1';
        const admin2 = 'admin-isolation-2';

        // Create tickets in both tenants
        const ticket1 = await TicketService.createTicket(tenant1, admin1, {
            requester: 'user1@tenant1.com',
            title: 'Tenant 1 ticket',
            description: 'Ticket in tenant 1',
            category: TicketCategory.GENERAL_REQUEST,
            severity: TicketSeverity.MEDIUM,
            priority: TicketPriority.MEDIUM,
        });

        const ticket2 = await TicketService.createTicket(tenant2, admin2, {
            requester: 'user2@tenant2.com',
            title: 'Tenant 2 ticket',
            description: 'Ticket in tenant 2',
            category: TicketCategory.GENERAL_REQUEST,
            severity: TicketSeverity.MEDIUM,
            priority: TicketPriority.MEDIUM,
        });

        // Admin 1 should only see tenant 1 tickets they created or are assigned to
        const admin1Tickets = await TicketService.getTickets(
            tenant1,
            {},
            UserRole.TENANT_ADMIN,
            admin1
        );

        // Admin 2 should only see tenant 2 tickets they created or are assigned to
        const admin2Tickets = await TicketService.getTickets(
            tenant2,
            {},
            UserRole.TENANT_ADMIN,
            admin2
        );

        expect(admin1Tickets.tickets).toHaveLength(1);
        expect(admin1Tickets.tickets[0].id).toBe(ticket1.id);

        expect(admin2Tickets.tickets).toHaveLength(1);
        expect(admin2Tickets.tickets[0].id).toBe(ticket2.id);

        // Cross-tenant access should be blocked
        expect(admin1Tickets.tickets.map(t => t.id)).not.toContain(ticket2.id);
        expect(admin2Tickets.tickets.map(t => t.id)).not.toContain(ticket1.id);
    });

    it('Property 13: Tenant Admin Visibility - should see assigned tickets even if not created by them', async () => {
        const mockTenantId = 'test-tenant-assigned-1';
        const mockTenantAdminId = 'admin-user-assigned-1';
        const mockOtherUserId = 'other-user-assigned-1';

        // Create a ticket by another user but assign it to the tenant admin
        const assignedTicket = await TicketService.createTicket(mockTenantId, mockOtherUserId, {
            requester: 'user@example.com',
            assignee: mockTenantAdminId, // Assigned to admin
            title: 'Assigned to admin',
            description: 'Ticket assigned to tenant admin',
            category: TicketCategory.OTHER, // Tenant admin can access when assigned
            severity: TicketSeverity.MEDIUM,
            priority: TicketPriority.MEDIUM,
        });

        // Admin should see this ticket because they are assigned to it
        const adminTickets = await TicketService.getTickets(
            mockTenantId,
            {},
            UserRole.TENANT_ADMIN,
            mockTenantAdminId
        );

        const ticketIds = adminTickets.tickets.map(t => t.id);
        expect(ticketIds).toContain(assignedTicket.id);
        expect(adminTickets.tickets).toHaveLength(1);
    });
});