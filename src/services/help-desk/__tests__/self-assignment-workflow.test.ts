/**
 * Unit Test for Self-Assignment Workflow
 * Tests the self-assignment functionality for help desk tickets
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TicketService } from '../../ticket.service';
import { UserRole, TicketCategory, TicketSeverity, TicketPriority, TicketStatus } from '../../../types';

// Mock dependencies
jest.mock('../../../lib/tenant-schema', () => ({
    getTenantDatabase: jest.fn(),
}));

jest.mock('../../../lib/mock-database', () => ({
    mockDb: {
        getTicketById: jest.fn(),
        updateTicket: jest.fn(),
    },
}));

// Set up development environment
process.env.NODE_ENV = 'development';
process.env.BYPASS_AUTH = 'true';

describe('Self-Assignment Workflow Tests', () => {
    const mockTenantId = 'test-tenant-123';
    const mockUserId = 'user-123';
    const mockTicketId = 'TKT-001';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should successfully self-assign an unassigned ticket', async () => {
        // Mock an unassigned ticket
        const mockTicket = {
            id: mockTicketId,
            tenant_id: mockTenantId,
            title: 'Test Help Desk Ticket',
            description: 'Test description',
            category: TicketCategory.IT_SUPPORT,
            severity: TicketSeverity.MEDIUM,
            priority: TicketPriority.MEDIUM,
            status: TicketStatus.NEW,
            assignee: undefined,
            requester: 'test@example.com',
            tags: [],
            created_by: 'creator-123',
            queue_position_updated_at: new Date('2024-01-01T10:00:00Z'),
            created_at: new Date('2024-01-01T10:00:00Z'),
            updated_at: new Date('2024-01-01T10:00:00Z'),
        };

        const updatedTicket = {
            ...mockTicket,
            assignee: mockUserId,
            status: TicketStatus.IN_PROGRESS,
            queue_position_updated_at: new Date('2024-01-01T11:00:00Z'),
            updated_at: new Date('2024-01-01T11:00:00Z'),
        };

        // Mock the database calls
        const { mockDb } = await import('../../../lib/mock-database');
        (mockDb.getTicketById as jest.Mock).mockResolvedValue(mockTicket);
        (mockDb.updateTicket as jest.Mock).mockResolvedValue(updatedTicket);

        // Test self-assignment
        const result = await TicketService.selfAssignTicket(
            mockTenantId,
            mockTicketId,
            mockUserId,
            UserRole.IT_HELPDESK_ANALYST
        );

        // Verify the result
        expect(result).toBeDefined();
        expect(result?.assignee).toBe(mockUserId);
        expect(result?.status).toBe(TicketStatus.IN_PROGRESS);
        expect(mockDb.updateTicket).toHaveBeenCalledWith(
            mockTenantId,
            mockTicketId,
            expect.objectContaining({
                assignee: mockUserId,
                status: TicketStatus.IN_PROGRESS,
                queue_position_updated_at: expect.any(Date),
                updated_at: expect.any(Date),
            })
        );
    });

    it('should return null for non-existent ticket', async () => {
        // Mock non-existent ticket
        const { mockDb } = await import('../../../lib/mock-database');
        (mockDb.getTicketById as jest.Mock).mockResolvedValue(null);

        // Test self-assignment
        const result = await TicketService.selfAssignTicket(
            mockTenantId,
            'non-existent-ticket',
            mockUserId,
            UserRole.IT_HELPDESK_ANALYST
        );

        // Verify the result
        expect(result).toBeNull();
        expect(mockDb.updateTicket).not.toHaveBeenCalled();
    });

    it('should validate category access for user role', () => {
        // Test IT Helpdesk Analyst can access IT support categories
        const itSupportValidation = TicketService.validateCategoryAccess(
            UserRole.IT_HELPDESK_ANALYST,
            TicketCategory.IT_SUPPORT,
            'update'
        );
        expect(itSupportValidation.valid).toBe(true);

        // Test IT Helpdesk Analyst cannot access security categories
        const securityValidation = TicketService.validateCategoryAccess(
            UserRole.IT_HELPDESK_ANALYST,
            TicketCategory.SECURITY_INCIDENT,
            'update'
        );
        expect(securityValidation.valid).toBe(false);
        expect(securityValidation.error).toContain('not authorized');
    });

    it('should get allowed categories for IT Helpdesk Analyst', () => {
        const allowedCategories = TicketService.getAllowedCategories(UserRole.IT_HELPDESK_ANALYST);

        expect(allowedCategories).toContain(TicketCategory.IT_SUPPORT);
        expect(allowedCategories).toContain(TicketCategory.HARDWARE_ISSUE);
        expect(allowedCategories).toContain(TicketCategory.SOFTWARE_ISSUE);
        expect(allowedCategories).toContain(TicketCategory.NETWORK_ISSUE);
        expect(allowedCategories).toContain(TicketCategory.ACCESS_REQUEST);
        expect(allowedCategories).toContain(TicketCategory.ACCOUNT_SETUP);

        // Should not contain security categories
        expect(allowedCategories).not.toContain(TicketCategory.SECURITY_INCIDENT);
        expect(allowedCategories).not.toContain(TicketCategory.VULNERABILITY);
    });
});