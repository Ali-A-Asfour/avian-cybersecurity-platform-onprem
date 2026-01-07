// import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and, desc, asc, sql, count, or, like } from 'drizzle-orm';
import postgres from 'postgres';
import {
  tickets,
  ticketComments,
  ticketAttachments,
  ticketStatusEnum,
  ticketSeverityEnum,
  ticketPriorityEnum,
  ticketCategoryEnum
} from '../../database/schemas/tenant';
import {
  Ticket,
  TicketComment,
  TicketAttachment,
  TicketFilters,
  TicketStatus,
  TicketSeverity,
  TicketPriority,
  TicketCategory,
  UserRole,
  ApiResponse
} from '../types';
import { TicketAccessControl } from '../middleware/ticket-access.middleware';
import { getTenantDatabase } from '../lib/tenant-schema';

export interface CreateTicketRequest {
  requester: string;
  assignee?: string;
  title: string;
  description: string;
  category: TicketCategory;
  severity: TicketSeverity;
  priority: TicketPriority;
  tags?: string[];
  phoneNumber?: string;
}

export interface UpdateTicketRequest {
  assignee?: string;
  title?: string;
  description?: string;
  category?: TicketCategory;
  severity?: TicketSeverity;
  priority?: TicketPriority;
  status?: TicketStatus;
  tags?: string[];
}

export interface CreateCommentRequest {
  content: string;
  is_internal?: boolean;
}

export class TicketService {
  private static readonly SLA_HOURS_BY_SEVERITY = {
    [TicketSeverity.CRITICAL]: 4,
    [TicketSeverity.HIGH]: 24,
    [TicketSeverity.MEDIUM]: 72,
    [TicketSeverity.LOW]: 168, // 1 week
  };

  /**
   * Create a new ticket
   */
  static async createTicket(
    tenantId: string,
    userId: string,
    data: CreateTicketRequest
  ): Promise<Ticket> {
    // Use mock database in development
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      const { mockDb } = await import('@/lib/mock-database');

      // Calculate SLA deadline based on severity
      const slaHours = this.SLA_HOURS_BY_SEVERITY[data.severity];
      const slaDeadline = new Date();
      slaDeadline.setHours(slaDeadline.getHours() + slaHours);

      return await mockDb.createTicket(tenantId, {
        requester: data.requester,
        assignee: data.assignee,
        title: data.title,
        description: data.description,
        category: data.category,
        severity: data.severity,
        priority: data.priority,
        status: TicketStatus.NEW,
        tags: data.tags || [],
        created_by: userId,
        sla_deadline: slaDeadline,
        queue_position_updated_at: new Date(),
      });
    }

    const db = await getTenantDatabase(tenantId);

    // Calculate SLA deadline based on severity
    const slaHours = this.SLA_HOURS_BY_SEVERITY[data.severity];
    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + slaHours);

    const [ticket] = await db
      .insert(tickets)
      .values({
        tenant_id: tenantId,
        requester: data.requester,
        assignee: data.assignee,
        title: data.title,
        description: data.description,
        category: data.category,
        severity: data.severity,
        priority: data.priority,
        status: TicketStatus.NEW,
        tags: JSON.stringify(data.tags || []),
        created_by: userId,
        sla_deadline: slaDeadline,
        queue_position_updated_at: new Date(),
      })
      .returning();

    // Initialize SLA timer for the new ticket (optional - don't fail if service unavailable)
    try {
      const { StateManagementService } = await import('./help-desk/StateManagementService');
      if (StateManagementService && StateManagementService.initializeSLATimer) {
        StateManagementService.initializeSLATimer(ticket.id, slaDeadline, TicketStatus.NEW);
      }
    } catch (error) {
      // SLA timer initialization is optional - log but don't fail ticket creation
      console.warn('Failed to initialize SLA timer:', error);
    }

    return this.formatTicket(ticket);
  }

  /**
   * Get tickets with filtering and pagination
   */
  static async getTickets(
    tenantId: string,
    filters: TicketFilters = {},
    userRole?: UserRole,
    userId?: string
  ): Promise<{ tickets: Ticket[]; total: number }> {
    // Use mock database in development - force mock mode for now
    const shouldUseMock = !process.env.DATABASE_URL || process.env.BYPASS_AUTH === 'true';

    if (shouldUseMock) {
      console.log('Using mock database for getTickets');
      const { mockDb } = await import('@/lib/mock-database');
      const result = await mockDb.getTickets(tenantId, filters);

      // Apply role-based filtering to mock data
      if (userRole) {
        const allowedCategories = TicketAccessControl.getCategoryFilter(userRole);
        if (allowedCategories) {
          result.tickets = result.tickets.filter((ticket: any) =>
            allowedCategories.includes(ticket.category) ||
            (userId && TicketAccessControl.canAccessAssignedTicket(userRole, ticket.category, ticket.assignee, userId))
          );
        }

        // Special handling for tenant admins - they can only see their own tickets
        if (userRole === UserRole.TENANT_ADMIN && userId) {
          result.tickets = result.tickets.filter((ticket: any) =>
            ticket.created_by === userId || ticket.assignee === userId
          );
        }

        result.total = result.tickets.length;
      }

      return result;
    }

    const db = await getTenantDatabase(tenantId);

    const {
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc',
      status,
      severity,
      priority,
      category,
      assignee,
      requester,
      tags,
      created_after,
      created_before,
    } = filters;

    // Build where conditions
    const conditions = [eq(tickets.tenant_id, tenantId)];

    // Apply role-based category filtering
    if (userRole) {
      const allowedCategories = TicketAccessControl.getCategoryFilter(userRole);
      if (allowedCategories) {
        const categoryConditions = allowedCategories.map(cat => eq(tickets.category, cat));

        // If user ID is provided, also include tickets assigned to them regardless of category
        if (userId) {
          categoryConditions.push(eq(tickets.assignee, userId));
        }

        if (categoryConditions.length > 0) {
          conditions.push(or(...categoryConditions)!);
        }
      }

      // Special handling for tenant admins - they can only see their own tickets
      if (userRole === UserRole.TENANT_ADMIN && userId) {
        conditions.push(
          or(
            eq(tickets.created_by, userId),
            eq(tickets.assignee, userId)
          )!
        );
      }
    }

    if (status?.length) {
      const statusConditions = status.map(s => eq(tickets.status, s));
      if (statusConditions.length > 0) {
        conditions.push(or(...statusConditions)!);
      }
    }
    if (severity?.length) {
      const severityConditions = severity.map(s => eq(tickets.severity, s));
      if (severityConditions.length > 0) {
        conditions.push(or(...severityConditions)!);
      }
    }
    if (priority?.length) {
      const priorityConditions = priority.map(p => eq(tickets.priority, p));
      if (priorityConditions.length > 0) {
        conditions.push(or(...priorityConditions)!);
      }
    }
    if (category?.length) {
      const categoryConditions = category.map(c => eq(tickets.category, c));
      if (categoryConditions.length > 0) {
        conditions.push(or(...categoryConditions)!);
      }
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
      .select({ count: count() })
      .from(tickets)
      .where(whereClause);

    // Get tickets with pagination
    const offset = (page - 1) * limit;

    // Implement queue sorting: impact level DESC, queue_position_updated_at ASC, id ASC
    // This ensures tickets are sorted by impact first, then by queue position (oldest first), then by ID as tie-breaker
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
   * Get a single ticket by ID
   */
  static async getTicketById(tenantId: string, ticketId: string): Promise<Ticket | null> {
    // Debug environment variables
    console.log('getTicketById - Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      BYPASS_AUTH: process.env.BYPASS_AUTH,
      shouldUseMock: process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true'
    });

    // Use mock database in development - force mock mode for now
    const shouldUseMock = !process.env.DATABASE_URL || process.env.BYPASS_AUTH === 'true';

    if (shouldUseMock) {
      console.log('Using mock database for getTicketById');
      const { mockDb } = await import('@/lib/mock-database');
      return await mockDb.getTicketById(tenantId, ticketId);
    }

    const db = await getTenantDatabase(tenantId);

    const [ticket] = await db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.tenant_id, tenantId)));

    return ticket ? this.formatTicket(ticket) : null;
  }

  /**
   * Update a ticket with field-level access control
   */
  static async updateTicket(
    tenantId: string,
    ticketId: string,
    data: UpdateTicketRequest,
    updatedBy?: string,
    userRole?: UserRole
  ): Promise<Ticket | null> {
    // Use mock database in development - force mock mode for now
    const shouldUseMock = !process.env.DATABASE_URL || process.env.BYPASS_AUTH === 'true';

    if (shouldUseMock) {
      console.log('Using mock database for updateTicket');
      const { mockDb } = await import('@/lib/mock-database');

      // Get current ticket for workflow processing
      const currentTicket = await mockDb.getTicketById(tenantId, ticketId);
      if (!currentTicket) return null;

      // Apply field-level access control if user info is provided
      let allowedData = data;
      if (updatedBy && userRole) {
        const { validateTicketFieldAccess } = await import('@/middleware/ticket-field-access.middleware');
        const validation = await validateTicketFieldAccess(
          ticketId,
          updatedBy,
          currentTicket.created_by,
          userRole,
          data,
          tenantId
        );

        if (!validation.success) {
          throw new Error(`Field access denied: ${validation.errors.join(', ')}`);
        }

        allowedData = validation.allowedModifications as UpdateTicketRequest;
      }

      // Update ticket using mock database
      const updatedTicket = await mockDb.updateTicket(tenantId, ticketId, allowedData);

      if (updatedTicket && updatedBy) {
        // Handle status change workflow if status was updated
        if (data.status && data.status !== currentTicket.status) {
          // Import StateManagementService dynamically to avoid circular dependency
          const { StateManagementService } = await import('./help-desk/StateManagementService');

          // Validate and process state transition
          const transitionResult = StateManagementService.processStateTransition(
            ticketId,
            currentTicket.status,
            data.status,
            userRole || UserRole.USER,
            updatedBy
          );

          if (!transitionResult.valid) {
            throw new Error(`State transition failed: ${transitionResult.error}`);
          }

          // Import WorkflowService dynamically to avoid circular dependency
          const { WorkflowService } = await import('./workflow.service');
          await WorkflowService.handleStatusChange(
            tenantId,
            ticketId,
            currentTicket.status,
            data.status,
            updatedBy
          );
        }
      }

      return updatedTicket;
    }

    const db = await getTenantDatabase(tenantId);

    // Get current ticket for workflow processing
    const currentTicket = await this.getTicketById(tenantId, ticketId);
    if (!currentTicket) return null;

    // Apply field-level access control if user info is provided
    let allowedData = data;
    if (updatedBy && userRole) {
      const { validateTicketFieldAccess } = await import('@/middleware/ticket-field-access.middleware');
      const validation = await validateTicketFieldAccess(
        ticketId,
        updatedBy,
        currentTicket.created_by,
        userRole,
        data,
        tenantId
      );

      if (!validation.success) {
        throw new Error(`Field access denied: ${validation.errors.join(', ')}`);
      }

      allowedData = validation.allowedModifications as UpdateTicketRequest;
    }

    const updateData: any = {
      updated_at: new Date(),
    };

    if (allowedData.assignee !== undefined) updateData.assignee = allowedData.assignee;
    if (allowedData.title) updateData.title = allowedData.title;
    if (allowedData.description) updateData.description = allowedData.description;
    if (allowedData.category) updateData.category = allowedData.category;
    if (allowedData.severity) updateData.severity = allowedData.severity;
    if (allowedData.priority) updateData.priority = allowedData.priority;
    if (allowedData.status) updateData.status = allowedData.status;
    if (allowedData.tags) updateData.tags = JSON.stringify(allowedData.tags);

    const [updatedTicket] = await db
      .update(tickets)
      .set(updateData)
      .where(and(eq(tickets.id, ticketId), eq(tickets.tenant_id, tenantId)))
      .returning();

    if (updatedTicket && updatedBy) {
      // Handle status change workflow if status was updated
      if (data.status && data.status !== currentTicket.status) {
        // Import StateManagementService dynamically to avoid circular dependency
        const { StateManagementService } = await import('./help-desk/StateManagementService');

        // Validate and process state transition
        const transitionResult = StateManagementService.processStateTransition(
          ticketId,
          currentTicket.status,
          data.status,
          userRole || UserRole.USER,
          updatedBy
        );

        if (!transitionResult.valid) {
          throw new Error(`State transition failed: ${transitionResult.error}`);
        }

        // Import WorkflowService dynamically to avoid circular dependency
        const { WorkflowService } = await import('./workflow.service');
        await WorkflowService.handleStatusChange(
          tenantId,
          ticketId,
          currentTicket.status,
          data.status,
          updatedBy
        );
      }
    }

    return updatedTicket ? this.formatTicket(updatedTicket) : null;
  }

  /**
   * Delete a ticket
   */
  static async deleteTicket(tenantId: string, ticketId: string): Promise<boolean> {
    const db = await getTenantDatabase(tenantId);

    const _result = await db
      .delete(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.tenant_id, tenantId)));

    return true; // Assume success for now
  }

  /**
   * Add a comment to a ticket
   */
  static async addComment(
    tenantId: string,
    ticketId: string,
    userId: string,
    data: CreateCommentRequest
  ): Promise<TicketComment> {
    // Use mock database in development - force mock mode for now
    const shouldUseMock = !process.env.DATABASE_URL || process.env.BYPASS_AUTH === 'true';

    if (shouldUseMock) {
      console.log('Using mock database for addComment');
      const { mockDb } = await import('@/lib/mock-database');
      return await mockDb.addComment(tenantId, ticketId, userId, data);
    }

    const db = await getTenantDatabase(tenantId);

    const [comment] = await db
      .insert(ticketComments)
      .values({
        ticket_id: ticketId,
        user_id: userId,
        content: data.content,
        is_internal: data.is_internal || false,
      })
      .returning();

    return comment;
  }

  /**
   * Get comments for a ticket
   */
  static async getComments(tenantId: string, ticketId: string): Promise<TicketComment[]> {
    const db = await getTenantDatabase(tenantId);

    const comments = await db
      .select()
      .from(ticketComments)
      .where(eq(ticketComments.ticket_id, ticketId))
      .orderBy(asc(ticketComments.created_at));

    return comments;
  }

  /**
   * Add an attachment to a ticket
   */
  static async addAttachment(
    tenantId: string,
    ticketId: string,
    userId: string,
    attachment: Omit<TicketAttachment, 'id' | 'ticket_id' | 'uploaded_by' | 'created_at'>
  ): Promise<TicketAttachment> {
    const db = await getTenantDatabase(tenantId);

    const [newAttachment] = await db
      .insert(ticketAttachments)
      .values({
        ticket_id: ticketId,
        filename: attachment.filename,
        original_filename: attachment.original_filename,
        file_size: attachment.file_size,
        mime_type: attachment.mime_type,
        file_path: attachment.file_path,
        uploaded_by: userId,
      })
      .returning();

    return newAttachment;
  }

  /**
   * Get attachments for a ticket
   */
  static async getAttachments(tenantId: string, ticketId: string): Promise<TicketAttachment[]> {
    const db = await getTenantDatabase(tenantId);

    const attachments = await db
      .select()
      .from(ticketAttachments)
      .where(eq(ticketAttachments.ticket_id, ticketId))
      .orderBy(asc(ticketAttachments.created_at));

    return attachments;
  }

  /**
   * Get tickets that are overdue (past SLA deadline)
   */
  static async getOverdueTickets(tenantId: string): Promise<Ticket[]> {
    const db = await getTenantDatabase(tenantId);

    const overdueTickets = await db
      .select()
      .from(tickets)
      .where(
        and(
          eq(tickets.tenant_id, tenantId),
          sql`${tickets.sla_deadline} < NOW()`,
          or(
            eq(tickets.status, TicketStatus.NEW),
            eq(tickets.status, TicketStatus.IN_PROGRESS),
            eq(tickets.status, TicketStatus.AWAITING_RESPONSE)
          )
        )
      )
      .orderBy(asc(tickets.sla_deadline));

    return overdueTickets.map(this.formatTicket);
  }

  /**
   * Get tickets for Security Analysts (security categories only)
   */
  static async getSecurityTickets(
    tenantId: string,
    filters: TicketFilters = {},
    userId?: string
  ): Promise<{ tickets: Ticket[]; total: number }> {
    return this.getTickets(tenantId, filters, UserRole.SECURITY_ANALYST, userId);
  }

  /**
   * Get tickets for IT Helpdesk Analysts (IT support categories only)
   */
  static async getITSupportTickets(
    tenantId: string,
    filters: TicketFilters = {},
    userId?: string
  ): Promise<{ tickets: Ticket[]; total: number }> {
    return this.getTickets(tenantId, filters, UserRole.IT_HELPDESK_ANALYST, userId);
  }

  /**
   * Get tickets assigned to a specific user (personal queue)
   */
  static async getMyTickets(
    tenantId: string,
    userId: string,
    userRole: UserRole,
    filters: TicketFilters = {}
  ): Promise<{ tickets: Ticket[]; total: number }> {
    // Debug logging to help troubleshoot ticket isolation issues
    console.log('=== MY TICKETS DEBUG ===');
    console.log('User ID:', userId);
    console.log('Tenant ID:', tenantId);
    console.log('User Role:', userRole);
    console.log('Original Filters:', filters);

    // Add assignee filter to get only tickets assigned to this user
    const myTicketFilters = {
      ...filters,
      assignee: userId,
    };

    console.log('My Ticket Filters (with assignee):', myTicketFilters);

    const result = await this.getTickets(tenantId, myTicketFilters, userRole, userId);

    console.log('Returned tickets count:', result.total);
    console.log('Returned tickets:', result.tickets.map(t => ({
      id: t.id,
      assignee: t.assignee,
      title: t.title.substring(0, 50) + '...'
    })));
    console.log('=== END MY TICKETS DEBUG ===');

    return result;
  }

  /**
   * Self-assign a ticket to a user with queue positioning
   */
  static async selfAssignTicket(
    tenantId: string,
    ticketId: string,
    userId: string,
    userRole: UserRole
  ): Promise<Ticket | null> {
    // Use mock database in development - force mock mode for now
    const shouldUseMock = !process.env.DATABASE_URL || process.env.BYPASS_AUTH === 'true';

    if (shouldUseMock) {
      const { mockDb } = await import('@/lib/mock-database');

      // Get current ticket
      const currentTicket = await mockDb.getTicketById(tenantId, ticketId);
      if (!currentTicket) return null;

      // Update ticket with assignment and queue position
      const now = new Date();
      const updatedTicket = await mockDb.updateTicket(tenantId, ticketId, {
        assignee: userId,
        status: TicketStatus.IN_PROGRESS, // Change status to in_progress when self-assigned
        queue_position_updated_at: now,
        updated_at: now,
      });

      return updatedTicket;
    }

    const db = await getTenantDatabase(tenantId);

    // Get current ticket to validate it exists
    const currentTicket = await this.getTicketById(tenantId, ticketId);
    if (!currentTicket) return null;

    // Update ticket with assignment and move to bottom of queue
    const now = new Date();
    const updateData: any = {
      assignee: userId,
      status: TicketStatus.IN_PROGRESS, // Change status to in_progress when self-assigned
      queue_position_updated_at: now, // Move to bottom of queue
      updated_at: now,
    };

    const [updatedTicket] = await db
      .update(tickets)
      .set(updateData)
      .where(and(eq(tickets.id, ticketId), eq(tickets.tenant_id, tenantId)))
      .returning();

    if (updatedTicket) {
      // Import StateManagementService dynamically to avoid circular dependency
      const { StateManagementService } = await import('./help-desk/StateManagementService');

      // Validate and process state transition
      const transitionResult = StateManagementService.processStateTransition(
        ticketId,
        currentTicket.status,
        TicketStatus.IN_PROGRESS,
        userRole,
        userId
      );

      if (!transitionResult.valid) {
        throw new Error(`State transition failed: ${transitionResult.error}`);
      }

      // Import WorkflowService dynamically to avoid circular dependency
      const { WorkflowService } = await import('./workflow.service');
      await WorkflowService.handleStatusChange(
        tenantId,
        ticketId,
        currentTicket.status,
        TicketStatus.IN_PROGRESS,
        userId
      );
    }

    return updatedTicket ? this.formatTicket(updatedTicket) : null;
  }

  /**
   * Validate ticket category access for a user role
   */
  static validateCategoryAccess(
    userRole: UserRole,
    category: TicketCategory,
    operation: 'create' | 'read' | 'update' = 'read'
  ): { valid: boolean; error?: string } {
    if (operation === 'create') {
      return TicketAccessControl.validateCategoryForCreation(userRole, category);
    }

    if (!TicketAccessControl.canAccessCategory(userRole, category)) {
      return {
        valid: false,
        error: `Role ${userRole} is not authorized to access tickets in category ${category}`,
      };
    }

    return { valid: true };
  }

  /**
   * Get allowed categories for a user role
   */
  static getAllowedCategories(userRole: UserRole): TicketCategory[] {
    return TicketAccessControl.getAllowedCategories(userRole);
  }

  /**
   * Get ticket statistics for dashboard with role-based filtering
   */
  static async getTicketStats(
    tenantId: string,
    userRole?: UserRole,
    userId?: string
  ): Promise<{
    total: number;
    open: number;
    overdue: number;
    resolved_today: number;
    by_severity: Record<TicketSeverity, number>;
    by_status: Record<TicketStatus, number>;
  }> {
    const db = await getTenantDatabase(tenantId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build base conditions with role-based filtering
    const baseConditions = [eq(tickets.tenant_id, tenantId)];

    if (userRole) {
      const allowedCategories = TicketAccessControl.getCategoryFilter(userRole);
      if (allowedCategories) {
        const categoryConditions = allowedCategories.map(cat => eq(tickets.category, cat));

        // If user ID is provided, also include tickets assigned to them regardless of category
        if (userId) {
          categoryConditions.push(eq(tickets.assignee, userId));
        }

        if (categoryConditions.length > 0) {
          baseConditions.push(or(...categoryConditions)!);
        }
      }

      // Special handling for tenant admins - they can only see their own tickets
      if (userRole === UserRole.TENANT_ADMIN && userId) {
        baseConditions.push(
          or(
            eq(tickets.created_by, userId),
            eq(tickets.assignee, userId)
          )!
        );
      }
    }

    const whereClause = and(...baseConditions);

    // Get counts by status
    const statusCounts = await db
      .select({
        status: tickets.status,
        count: count(),
      })
      .from(tickets)
      .where(whereClause)
      .groupBy(tickets.status);

    // Get counts by severity
    const severityCounts = await db
      .select({
        severity: tickets.severity,
        count: count(),
      })
      .from(tickets)
      .where(whereClause)
      .groupBy(tickets.severity);

    // Get overdue count
    const overdueConditions = [
      ...baseConditions,
      sql`${tickets.sla_deadline} < NOW()`,
      or(
        eq(tickets.status, TicketStatus.NEW),
        eq(tickets.status, TicketStatus.IN_PROGRESS),
        eq(tickets.status, TicketStatus.AWAITING_RESPONSE)
      )
    ];

    const [{ count: overdueCount }] = await db
      .select({ count: count() })
      .from(tickets)
      .where(and(...overdueConditions));

    // Get resolved today count
    const resolvedTodayConditions = [
      ...baseConditions,
      eq(tickets.status, TicketStatus.RESOLVED),
      sql`${tickets.updated_at} >= ${today}`
    ];

    const [{ count: resolvedTodayCount }] = await db
      .select({ count: count() })
      .from(tickets)
      .where(and(...resolvedTodayConditions));

    // Format results
    const by_status = Object.values(TicketStatus).reduce((acc, status) => {
      acc[status] = statusCounts.find((s: any) => s.status === status)?.count || 0;
      return acc;
    }, {} as Record<TicketStatus, number>);

    const by_severity = Object.values(TicketSeverity).reduce((acc, severity) => {
      acc[severity] = severityCounts.find((s: any) => s.severity === severity)?.count || 0;
      return acc;
    }, {} as Record<TicketSeverity, number>);

    const total = Object.values(by_status).reduce((sum, count) => sum + count, 0);
    const open = by_status[TicketStatus.NEW] + by_status[TicketStatus.IN_PROGRESS] + by_status[TicketStatus.AWAITING_RESPONSE];

    return {
      total,
      open,
      overdue: overdueCount,
      resolved_today: resolvedTodayCount,
      by_severity,
      by_status,
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

  /**
   * Get field permissions for a ticket
   */
  static async getTicketFieldPermissions(
    tenantId: string,
    ticketId: string,
    userId: string,
    userRole: UserRole
  ): Promise<Record<string, { canEdit: boolean; reason?: string }> | null> {
    const ticket = await this.getTicketById(tenantId, ticketId);
    if (!ticket) return null;

    const { TicketFieldAccessControl } = await import('@/middleware/ticket-field-access.middleware');
    return TicketFieldAccessControl.getFieldPermissions(userId, ticket.created_by, userRole);
  }

  /**
   * Validate ticket workflow transitions using StateManagementService
   */
  static isValidStatusTransition(currentStatus: TicketStatus, newStatus: TicketStatus): boolean {
    const { StateManagementService } = require('./help-desk/StateManagementService');
    const result = StateManagementService.validateStateTransition(currentStatus, newStatus);
    return result.valid;
  }

  /**
   * Validate state transition with business rules
   */
  static validateStateTransitionWithBusinessRules(
    currentStatus: TicketStatus,
    newStatus: TicketStatus,
    userRole: UserRole,
    isSystemTriggered: boolean = false
  ): { valid: boolean; error?: string } {
    const { StateManagementService } = require('./help-desk/StateManagementService');
    return StateManagementService.validateStateTransitionWithBusinessRules(
      currentStatus,
      newStatus,
      userRole,
      isSystemTriggered
    );
  }
}