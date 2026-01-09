import { eq, and, desc, asc, or, sql, isNull } from 'drizzle-orm';
import { tickets } from '../../../database/schemas/tenant';
import { getTenantDatabase } from '../../lib/tenant-schema';
import {
    Ticket,
    TicketFilters,
    UserRole,
    TicketStatus,
    TicketSeverity
} from '../../types';
import { TicketAccessControl } from '../../middleware/ticket-access.middleware';

export interface QueueFilters extends TicketFilters {
    unassigned_only?: boolean;
    assigned_to?: string;
}

export interface QueueMetrics {
    total_tickets: number;
    unassigned_tickets: number;
    assigned_tickets: number;
    overdue_tickets: number;
    by_severity: Record<TicketSeverity, number>;
    by_status: Record<TicketStatus, number>;
    average_queue_time: number; // in hours
}

/**
 * Queue Management Service for Help Desk
 * 
 * Implements deterministic queue sorting and management functionality
 * according to Requirements 2.1, 2.3, and 6.1
 */
export class QueueManagementService {
    /**
     * Helper function to get severity order value
     */
    private static getSeverityOrder(severity: string): number {
        const severityOrder: Record<string, number> = {
            critical: 4,
            high: 3,
            medium: 2,
            low: 1
        };
        return severityOrder[severity] || 0;
    }

    /**
     * Helper function to sort tickets by queue rules
     */
    private static sortTicketsByQueueRules(tickets: any[]): void {
        tickets.sort((a: any, b: any) => {
            // First by assignment status (unassigned tickets at top)
            const aAssigned = !!a.assignee;
            const bAssigned = !!b.assignee;
            if (aAssigned !== bAssigned) {
                return aAssigned ? 1 : -1; // Unassigned (false) comes first
            }

            // Then by severity (critical > high > medium > low)
            const severityDiff = this.getSeverityOrder(b.severity) - this.getSeverityOrder(a.severity);
            if (severityDiff !== 0) return severityDiff;

            // Then by queue position (oldest first)
            const queueDiff = new Date(a.queue_position_updated_at).getTime() -
                new Date(b.queue_position_updated_at).getTime();
            if (queueDiff !== 0) return queueDiff;

            // Finally by ID for deterministic ordering
            return a.id.localeCompare(b.id);
        });
    }

    /**
     * Get general ticket queue with deterministic sorting
     * Shows all tickets with unassigned tickets at top, assigned tickets at bottom
     * Sorting: assignment status ASC (unassigned first), severity DESC, queue_position_updated_at ASC, id ASC
     * 
     * @param tenantId Tenant ID
     * @param userRole User role for access control
     * @param _userId User ID for access control (unused but kept for interface compatibility)
     * @param filters Optional filters
     * @returns All tickets sorted by queue rules
     */
    static async getUnassignedQueue(
        tenantId: string,
        userRole: UserRole,
        _userId?: string,
        filters: QueueFilters = {}
    ): Promise<{ tickets: Ticket[]; total: number }> {
        // Use mock database in development
        if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
            const { mockDb } = await import('../../lib/mock-database');
            
            console.log('=== QUEUE MANAGEMENT DEBUG ===');
            console.log('Tenant ID:', tenantId);
            console.log('User Role:', userRole);
            console.log('Is super admin or all-tenants:', (userRole === UserRole.SUPER_ADMIN || tenantId === 'all-tenants'));
            
            // For super admins, get tickets from all tenants; for others, filter by tenant
            const searchTenantId = (userRole === UserRole.SUPER_ADMIN || tenantId === 'all-tenants') ? null : tenantId;
            console.log('Search tenant ID (null = all tenants):', searchTenantId);
            
            const result = await mockDb.getTickets(searchTenantId, {
                ...filters,
                assignee: null, // Filter for unassigned tickets only
            });

            console.log('Raw tickets found:', result.tickets.length);
            result.tickets.forEach(ticket => {
                console.log(`  - ${ticket.id}: ${ticket.title} (tenant: ${ticket.tenant_id}, assignee: ${ticket.assignee})`);
            });

            // Apply role-based filtering
            const allowedCategories = TicketAccessControl.getCategoryFilter(userRole);
            console.log('Allowed categories for role:', allowedCategories);
            if (allowedCategories) {
                result.tickets = result.tickets.filter((ticket: any) =>
                    allowedCategories.includes(ticket.category)
                );
            }

            console.log('Tickets after category filtering:', result.tickets.length);
            result.tickets.forEach(ticket => {
                console.log(`  - ${ticket.id}: ${ticket.title} (category: ${ticket.category})`);
            });

            // Sort by queue rules: assignment status ASC (unassigned first), severity DESC, queue_position_updated_at ASC, id ASC
            this.sortTicketsByQueueRules(result.tickets);

            result.total = result.tickets.length;
            console.log('Final result count:', result.total);
            console.log('=== END QUEUE MANAGEMENT DEBUG ===');
            return result;
        }

        const db = await getTenantDatabase(tenantId);

        const {
            page = 1,
            limit = 20,
            status,
            severity,
            priority,
            category,
            created_after,
            created_before,
        } = filters;

        // Build where conditions for unassigned tickets only
        const conditions = [
            isNull(tickets.assignee), // Only show unassigned tickets
        ];

        // Super admins can see tickets from all tenants
        if (userRole !== UserRole.SUPER_ADMIN && tenantId !== 'all-tenants') {
            conditions.push(eq(tickets.tenant_id, tenantId));
        }

        // Apply role-based category filtering
        const allowedCategories = TicketAccessControl.getCategoryFilter(userRole);
        if (allowedCategories) {
            const categoryConditions = allowedCategories.map(cat => eq(tickets.category, cat));
            if (categoryConditions.length > 0) {
                conditions.push(or(...categoryConditions)!);
            }
        }

        // Apply additional filters
        if (status?.length) {
            const statusConditions = status.map(s => eq(tickets.status, s));
            conditions.push(or(...statusConditions)!);
        }
        if (severity?.length) {
            const severityConditions = severity.map(s => eq(tickets.severity, s));
            conditions.push(or(...severityConditions)!);
        }
        if (priority?.length) {
            const priorityConditions = priority.map(p => eq(tickets.priority, p));
            conditions.push(or(...priorityConditions)!);
        }
        if (category?.length) {
            const categoryConditions = category.map(c => eq(tickets.category, c));
            conditions.push(or(...categoryConditions)!);
        }
        if (created_after) {
            conditions.push(sql`${tickets.created_at} >= ${created_after.toISOString()}`);
        }
        if (created_before) {
            conditions.push(sql`${tickets.created_at} <= ${created_before.toISOString()}`);
        }

        const whereClause = and(...conditions);

        // Get total count
        const [{ count: totalCount }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(tickets)
            .where(whereClause);

        // Get tickets with queue sorting and pagination
        const offset = (page - 1) * limit;

        const ticketResults = await db
            .select()
            .from(tickets)
            .where(whereClause)
            .orderBy(
                sql`CASE WHEN ${tickets.assignee} IS NULL THEN 0 ELSE 1 END`, // Unassigned first (0), assigned second (1)
                desc(tickets.severity), // Impact level (critical > high > medium > low)
                asc(tickets.queue_position_updated_at), // Queue position (oldest first)
                asc(tickets.id) // ID as tie-breaker for deterministic ordering
            )
            .limit(limit)
            .offset(offset);

        return {
            tickets: ticketResults.map(this.formatTicket),
            total: totalCount,
        };
    }

    /**
     * Get personal "My Tickets" queue for an analyst
     * 
     * @param tenantId Tenant ID
     * @param analystId Analyst user ID
     * @param userRole User role for access control
     * @param filters Optional filters
     * @returns Tickets assigned to the analyst
     */
    static async getMyTicketsQueue(
        tenantId: string,
        analystId: string,
        userRole: UserRole,
        filters: QueueFilters = {}
    ): Promise<{ tickets: Ticket[]; total: number }> {
        // Use mock database in development
        if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
            const { mockDb } = await import('../../lib/mock-database');

            let result;
            // For super admins, get tickets from all tenants; for others, filter by tenant
            const searchTenantId = (userRole === UserRole.SUPER_ADMIN || tenantId === 'all-tenants') ? null : tenantId;
            
            if (userRole === UserRole.USER) {
                // For regular users, get tickets they created (excluding closed tickets)
                result = await mockDb.getTickets(searchTenantId, {
                    ...filters,
                    requester: analystId, // Tickets created by this user
                });
            } else {
                // For help desk staff, get tickets assigned to them (excluding closed tickets)
                result = await mockDb.getTickets(searchTenantId, {
                    ...filters,
                    assignee: analystId, // Only tickets assigned to this analyst
                });
            }

            // Filter out closed tickets from "My Tickets" queue
            result.tickets = result.tickets.filter((ticket: any) => 
                ticket.status !== 'closed'
            );

            // Apply role-based filtering
            const allowedCategories = TicketAccessControl.getCategoryFilter(userRole);
            if (allowedCategories) {
                result.tickets = result.tickets.filter((ticket: any) =>
                    allowedCategories.includes(ticket.category)
                );
            }

            // Sort by queue rules: severity DESC, queue_position_updated_at ASC, id ASC
            this.sortTicketsByQueueRules(result.tickets);

            result.total = result.tickets.length;
            return result;
        }

        const db = await getTenantDatabase(tenantId);

        const {
            page = 1,
            limit = 20,
            status,
            severity,
            priority,
            category,
            created_after,
            created_before,
        } = filters;

        // Build where conditions based on user role
        const conditions = [
            // Exclude closed tickets from "My Tickets" queue
            sql`${tickets.status} != 'closed'`,
        ];

        // Super admins can see tickets from all tenants
        if (userRole !== UserRole.SUPER_ADMIN && tenantId !== 'all-tenants') {
            conditions.push(eq(tickets.tenant_id, tenantId));
        }

        // For regular users, show tickets they created
        // For help desk staff, show tickets assigned to them
        if (userRole === UserRole.USER) {
            // Regular users see tickets they created
            conditions.push(
                or(
                    eq(tickets.requester, analystId),
                    eq(tickets.created_by, analystId)
                )!
            );
        } else {
            // Help desk staff see tickets assigned to them
            conditions.push(eq(tickets.assignee, analystId));
        }

        // Apply role-based category filtering
        const allowedCategories = TicketAccessControl.getCategoryFilter(userRole);
        if (allowedCategories) {
            const categoryConditions = allowedCategories.map(cat => eq(tickets.category, cat));
            if (categoryConditions.length > 0) {
                conditions.push(or(...categoryConditions)!);
            }
        }

        // Apply additional filters
        if (status?.length) {
            const statusConditions = status.map(s => eq(tickets.status, s));
            conditions.push(or(...statusConditions)!);
        }
        if (severity?.length) {
            const severityConditions = severity.map(s => eq(tickets.severity, s));
            conditions.push(or(...severityConditions)!);
        }
        if (priority?.length) {
            const priorityConditions = priority.map(p => eq(tickets.priority, p));
            conditions.push(or(...priorityConditions)!);
        }
        if (category?.length) {
            const categoryConditions = category.map(c => eq(tickets.category, c));
            conditions.push(or(...categoryConditions)!);
        }
        if (created_after) {
            conditions.push(sql`${tickets.created_at} >= ${created_after.toISOString()}`);
        }
        if (created_before) {
            conditions.push(sql`${tickets.created_at} <= ${created_before.toISOString()}`);
        }

        const whereClause = and(...conditions);

        // Get total count
        const [{ count: totalCount }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(tickets)
            .where(whereClause);

        // Get tickets with queue sorting and pagination
        const offset = (page - 1) * limit;

        const ticketResults = await db
            .select()
            .from(tickets)
            .where(whereClause)
            .orderBy(
                desc(tickets.severity), // Impact level (critical > high > medium > low)
                asc(tickets.queue_position_updated_at), // Queue position (oldest first)
                asc(tickets.id) // ID as tie-breaker for deterministic ordering
            )
            .limit(limit)
            .offset(offset);

        return {
            tickets: ticketResults.map(this.formatTicket),
            total: totalCount,
        };
    }

    /**
     * Get tenant admin view showing all tenant tickets
     * 
     * @param tenantId Tenant ID
     * @param userRole User role (should be tenant_admin)
     * @param userId User ID for access control
     * @param filters Optional filters
     * @returns All tickets for the tenant
     */
    static async getTenantAdminQueue(
        tenantId: string,
        userRole: UserRole,
        userId: string,
        filters: QueueFilters = {}
    ): Promise<{ tickets: Ticket[]; total: number }> {
        // Validate that user is tenant admin
        if (userRole !== UserRole.TENANT_ADMIN) {
            throw new Error('Access denied: Only tenant admins can view all tenant tickets');
        }

        // Use mock database in development
        if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
            const { mockDb } = await import('../../lib/mock-database');
            
            // For super admins, get tickets from all tenants; for others, filter by tenant
            const searchTenantId = userRole === UserRole.SUPER_ADMIN ? null : tenantId;
            const result = await mockDb.getTickets(searchTenantId, filters);

            // For tenant admins, show only tickets they created or are assigned to
            if (userRole === UserRole.TENANT_ADMIN) {
                result.tickets = result.tickets.filter((ticket: any) =>
                    ticket.created_by === userId || ticket.assignee === userId
                );
            }

            // Sort by queue rules: severity DESC, queue_position_updated_at ASC, id ASC
            this.sortTicketsByQueueRules(result.tickets);

            result.total = result.tickets.length;
            return result;
        }

        const db = await getTenantDatabase(tenantId);

        const {
            page = 1,
            limit = 20,
            status,
            severity,
            priority,
            category,
            assignee,
            requester,
            created_after,
            created_before,
        } = filters;

        // Build where conditions for tenant admin view
        const conditions = [];

        // Super admins can see tickets from all tenants
        if (userRole !== UserRole.SUPER_ADMIN) {
            conditions.push(eq(tickets.tenant_id, tenantId));
        }

        // Tenant admins can only see tickets they created or are assigned to
        if (userRole === UserRole.TENANT_ADMIN) {
            conditions.push(
                or(
                    eq(tickets.created_by, userId),
                    eq(tickets.assignee, userId)
                )!
            );
        }

        // Apply additional filters
        if (status?.length) {
            const statusConditions = status.map(s => eq(tickets.status, s));
            conditions.push(or(...statusConditions)!);
        }
        if (severity?.length) {
            const severityConditions = severity.map(s => eq(tickets.severity, s));
            conditions.push(or(...severityConditions)!);
        }
        if (priority?.length) {
            const priorityConditions = priority.map(p => eq(tickets.priority, p));
            conditions.push(or(...priorityConditions)!);
        }
        if (category?.length) {
            const categoryConditions = category.map(c => eq(tickets.category, c));
            conditions.push(or(...categoryConditions)!);
        }
        if (assignee) {
            conditions.push(eq(tickets.assignee, assignee));
        }
        if (requester) {
            conditions.push(eq(tickets.requester, requester));
        }
        if (created_after) {
            conditions.push(sql`${tickets.created_at} >= ${created_after.toISOString()}`);
        }
        if (created_before) {
            conditions.push(sql`${tickets.created_at} <= ${created_before.toISOString()}`);
        }

        const whereClause = and(...conditions);

        // Get total count
        const [{ count: totalCount }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(tickets)
            .where(whereClause);

        // Get tickets with queue sorting and pagination
        const offset = (page - 1) * limit;

        const ticketResults = await db
            .select()
            .from(tickets)
            .where(whereClause)
            .orderBy(
                desc(tickets.severity), // Impact level (critical > high > medium > low)
                asc(tickets.queue_position_updated_at), // Queue position (oldest first)
                asc(tickets.id) // ID as tie-breaker for deterministic ordering
            )
            .limit(limit)
            .offset(offset);

        return {
            tickets: ticketResults.map(this.formatTicket),
            total: totalCount,
        };
    }

    /**
     * Update queue position for a ticket (moves to bottom of queue)
     * Used when tickets are assigned or status changes
     * 
     * @param tenantId Tenant ID
     * @param ticketId Ticket ID
     * @returns Updated ticket or null if not found
     */
    static async updateQueuePosition(
        tenantId: string,
        ticketId: string
    ): Promise<Ticket | null> {
        // Use mock database in development
        if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
            const { mockDb } = await import('../../lib/mock-database');

            const currentTicket = await mockDb.getTicketById(tenantId, ticketId);
            if (!currentTicket) return null;

            return await mockDb.updateTicket(tenantId, ticketId, {
                queue_position_updated_at: new Date(),
                updated_at: new Date(),
            });
        }

        const db = await getTenantDatabase(tenantId);

        const now = new Date();
        const [updatedTicket] = await db
            .update(tickets)
            .set({
                queue_position_updated_at: now,
                updated_at: now,
            })
            .where(and(eq(tickets.id, ticketId), eq(tickets.tenant_id, tenantId)))
            .returning();

        return updatedTicket ? this.formatTicket(updatedTicket) : null;
    }

    /**
     * Get queue metrics for dashboard display
     * 
     * @param tenantId Tenant ID
     * @param userRole User role for access control
     * @param userId User ID for access control
     * @returns Queue metrics
     */
    static async getQueueMetrics(
        tenantId: string,
        userRole: UserRole,
        userId?: string
    ): Promise<QueueMetrics> {
        // Use mock database in development
        if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
            const { mockDb } = await import('../../lib/mock-database');
            
            // For super admins, get tickets from all tenants; for others, filter by tenant
            const searchTenantId = userRole === UserRole.SUPER_ADMIN ? null : tenantId;
            const result = await mockDb.getTickets(searchTenantId, {});

            // Apply role-based filtering
            let filteredTickets = result.tickets;
            const allowedCategories = TicketAccessControl.getCategoryFilter(userRole);
            if (allowedCategories) {
                filteredTickets = result.tickets.filter((ticket: any) =>
                    allowedCategories.includes(ticket.category)
                );
            }

            // Special handling for tenant admins
            if (userRole === UserRole.TENANT_ADMIN && userId) {
                filteredTickets = filteredTickets.filter((ticket: any) =>
                    ticket.created_by === userId || ticket.assignee === userId
                );
            }

            // Calculate metrics
            const totalTickets = filteredTickets.length;
            const unassignedTickets = filteredTickets.filter((t: any) => !t.assignee).length;
            const assignedTickets = filteredTickets.filter((t: any) => t.assignee).length;
            const overdueTickets = filteredTickets.filter((t: any) =>
                t.sla_deadline && new Date(t.sla_deadline) < new Date()
            ).length;

            // Count by severity
            const bySeverity = filteredTickets.reduce((acc: any, ticket: any) => {
                acc[ticket.severity] = (acc[ticket.severity] || 0) + 1;
                return acc;
            }, {});

            // Count by status
            const byStatus = filteredTickets.reduce((acc: any, ticket: any) => {
                acc[ticket.status] = (acc[ticket.status] || 0) + 1;
                return acc;
            }, {});

            // Calculate average queue time (simplified)
            const now = new Date();
            const queueTimes = filteredTickets
                .filter((t: any) => !t.assignee) // Only unassigned tickets
                .map((t: any) => (now.getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60)); // hours

            const averageQueueTime = queueTimes.length > 0
                ? queueTimes.reduce((sum, time) => sum + time, 0) / queueTimes.length
                : 0;

            return {
                total_tickets: totalTickets,
                unassigned_tickets: unassignedTickets,
                assigned_tickets: assignedTickets,
                overdue_tickets: overdueTickets,
                by_severity: {
                    low: bySeverity.low || 0,
                    medium: bySeverity.medium || 0,
                    high: bySeverity.high || 0,
                    critical: bySeverity.critical || 0,
                },
                by_status: {
                    new: byStatus.new || 0,
                    in_progress: byStatus.in_progress || 0,
                    awaiting_response: byStatus.awaiting_response || 0,
                    resolved: byStatus.resolved || 0,
                    closed: byStatus.closed || 0,
                },
                average_queue_time: averageQueueTime,
            };
        }

        const db = await getTenantDatabase(tenantId);

        // Build base conditions with role-based filtering
        const baseConditions = [];

        // Super admins can see tickets from all tenants
        if (userRole !== UserRole.SUPER_ADMIN) {
            baseConditions.push(eq(tickets.tenant_id, tenantId));
        }

        const allowedCategories = TicketAccessControl.getCategoryFilter(userRole);
        if (allowedCategories) {
            const categoryConditions = allowedCategories.map(cat => eq(tickets.category, cat));
            if (categoryConditions.length > 0) {
                baseConditions.push(or(...categoryConditions)!);
            }
        }

        // Special handling for tenant admins
        if (userRole === UserRole.TENANT_ADMIN && userId) {
            baseConditions.push(
                or(
                    eq(tickets.created_by, userId),
                    eq(tickets.assignee, userId)
                )!
            );
        }

        const whereClause = and(...baseConditions);

        // Get total count
        const [{ count: totalTickets }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(tickets)
            .where(whereClause);

        // Get unassigned count
        const [{ count: unassignedTickets }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(tickets)
            .where(and(whereClause, sql`${tickets.assignee} IS NULL`));

        // Get assigned count
        const [{ count: assignedTickets }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(tickets)
            .where(and(whereClause, sql`${tickets.assignee} IS NOT NULL`));

        // Get overdue count
        const [{ count: overdueTickets }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(tickets)
            .where(and(
                whereClause,
                sql`${tickets.sla_deadline} < NOW()`,
                or(
                    eq(tickets.status, TicketStatus.NEW),
                    eq(tickets.status, TicketStatus.IN_PROGRESS),
                    eq(tickets.status, TicketStatus.AWAITING_RESPONSE)
                )
            ));

        // Get counts by severity
        const severityCounts = await db
            .select({
                severity: tickets.severity,
                count: sql<number>`count(*)`,
            })
            .from(tickets)
            .where(whereClause)
            .groupBy(tickets.severity);

        // Get counts by status
        const statusCounts = await db
            .select({
                status: tickets.status,
                count: sql<number>`count(*)`,
            })
            .from(tickets)
            .where(whereClause)
            .groupBy(tickets.status);

        // Calculate average queue time for unassigned tickets
        const [{ avg: avgQueueTime }] = await db
            .select({
                avg: sql<number>`AVG(EXTRACT(EPOCH FROM (NOW() - ${tickets.created_at})) / 3600)`,
            })
            .from(tickets)
            .where(and(whereClause, sql`${tickets.assignee} IS NULL`));

        // Format results
        const bySeverity = Object.values(TicketSeverity).reduce((acc, severity) => {
            acc[severity] = severityCounts.find((s: any) => s.severity === severity)?.count || 0;
            return acc;
        }, {} as Record<TicketSeverity, number>);

        const byStatus = Object.values(TicketStatus).reduce((acc, status) => {
            acc[status] = statusCounts.find((s: any) => s.status === status)?.count || 0;
            return acc;
        }, {} as Record<TicketStatus, number>);

        return {
            total_tickets: totalTickets,
            unassigned_tickets: unassignedTickets,
            assigned_tickets: assignedTickets,
            overdue_tickets: overdueTickets,
            by_severity: bySeverity,
            by_status: byStatus,
            average_queue_time: avgQueueTime || 0,
        };
    }

    /**
     * Format ticket data for API response
     */
    private static formatTicket(ticket: any): Ticket {
        return {
            ...ticket,
            tags: typeof ticket.tags === 'string' ? JSON.parse(ticket.tags) : ticket.tags,
        };
    }
}