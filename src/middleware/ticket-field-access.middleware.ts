import { UserRole } from '@/types';

// Simple mock AuditLogger for development mode
const AuditLogger = {
  logEvent: async (event: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Audit Event (Mock):', event);
      return;
    }
    // In production, this would use the real audit logger
    console.warn('AuditLogger not implemented for production');
  }
};

// Mock audit event types for development
const AuditEventType = {
  TICKET_UPDATED: 'TICKET_UPDATED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  DATA_READ: 'DATA_READ',
  SECURITY_VIOLATION: 'SECURITY_VIOLATION'
};

const AuditResourceType = {
  TICKET: 'TICKET'
};

/**
 * Field-level access control for ticket operations
 */
export class TicketFieldAccessControl {
  /**
   * Check if a user can edit specific ticket fields
   */
  static canEditField(
    field: string,
    userId: string,
    ticketCreatedBy: string,
    userRole: UserRole
  ): boolean {
    // Title and description can only be edited by the ticket creator
    if (field === 'title' || field === 'description') {
      return userId === ticketCreatedBy;
    }

    // Other fields can be edited by authorized users based on role
    // Super Admin and Tenant Admin can edit all fields
    if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.TENANT_ADMIN) {
      return true;
    }

    // Security Analysts and IT Helpdesk Analysts can edit most fields except title/description
    if (userRole === UserRole.SECURITY_ANALYST || userRole === UserRole.IT_HELPDESK_ANALYST) {
      const editableFields = [
        'assignee', 'category', 'severity', 'priority', 'status', 'tags'
      ];
      return editableFields.includes(field);
    }

    // Regular users cannot edit any fields
    return false;
  }

  /**
   * Get list of editable fields for a user
   */
  static getEditableFields(
    userId: string,
    ticketCreatedBy: string,
    userRole: UserRole
  ): string[] {
    const editableFields: string[] = [];

    // Check each field
    const allFields = [
      'title', 'description', 'assignee', 'category',
      'severity', 'priority', 'status', 'tags'
    ];

    for (const field of allFields) {
      if (this.canEditField(field, userId, ticketCreatedBy, userRole)) {
        editableFields.push(field);
      }
    }

    return editableFields;
  }

  /**
   * Validate field modifications and log audit events
   */
  static async validateFieldModifications(
    ticketId: string,
    userId: string,
    ticketCreatedBy: string,
    userRole: UserRole,
    modifications: Record<string, any>,
    tenantId: string
  ): Promise<{
    allowed: Record<string, any>;
    denied: Record<string, any>;
    errors: string[];
  }> {
    const allowed: Record<string, any> = {};
    const denied: Record<string, any> = {};
    const errors: string[] = [];

    for (const [field, value] of Object.entries(modifications)) {
      const canEdit = this.canEditField(field, userId, ticketCreatedBy, userRole);

      if (canEdit) {
        allowed[field] = value;

        // Log successful field modification
        await AuditLogger.logEvent({
          tenantId,
          userId,
          action: AuditEventType.TICKET_UPDATED,
          resourceType: AuditResourceType.TICKET,
          resourceId: ticketId,
          details: {
            field,
            newValue: value,
            authorized: true,
            reason: 'Field modification authorized'
          }
        });
      } else {
        denied[field] = value;
        errors.push(`Access denied: Cannot modify field '${field}'`);

        // Log unauthorized field modification attempt
        await AuditLogger.logEvent({
          tenantId,
          userId,
          action: AuditEventType.ACCESS_DENIED,
          resourceType: AuditResourceType.TICKET,
          resourceId: ticketId,
          details: {
            field,
            attemptedValue: value,
            authorized: false,
            reason: field === 'title' || field === 'description'
              ? 'Only ticket creator can modify title and description'
              : 'Insufficient permissions to modify this field',
            ticketCreatedBy,
            userRole
          }
        });
      }
    }

    return { allowed, denied, errors };
  }

  /**
   * Get field permissions for UI rendering
   */
  static getFieldPermissions(
    userId: string,
    ticketCreatedBy: string,
    userRole: UserRole
  ): Record<string, { canEdit: boolean; reason?: string }> {
    const permissions: Record<string, { canEdit: boolean; reason?: string }> = {};

    const fields = [
      'title', 'description', 'assignee', 'category',
      'severity', 'priority', 'status', 'tags'
    ];

    for (const field of fields) {
      const canEdit = this.canEditField(field, userId, ticketCreatedBy, userRole);

      let reason: string | undefined;
      if (!canEdit) {
        if (field === 'title' || field === 'description') {
          reason = 'Only the ticket creator can edit the title and description';
        } else {
          reason = 'Insufficient permissions to edit this field';
        }
      }

      permissions[field] = { canEdit, reason };
    }

    return permissions;
  }

  /**
   * Check if user is the ticket creator
   */
  static isTicketCreator(userId: string, ticketCreatedBy: string): boolean {
    return userId === ticketCreatedBy;
  }

  /**
   * Log field access attempt for audit purposes
   */
  static async logFieldAccess(
    ticketId: string,
    userId: string,
    field: string,
    accessType: 'read' | 'write',
    authorized: boolean,
    tenantId: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    await AuditLogger.logEvent({
      tenantId,
      userId,
      action: authorized ? AuditEventType.DATA_READ : AuditEventType.ACCESS_DENIED,
      resourceType: AuditResourceType.TICKET,
      resourceId: ticketId,
      details: {
        field,
        accessType,
        authorized,
        ...details
      }
    });
  }
}

/**
 * Middleware function to validate ticket field modifications
 */
export async function validateTicketFieldAccess(
  ticketId: string,
  userId: string,
  ticketCreatedBy: string,
  userRole: UserRole,
  requestBody: any,
  tenantId: string
): Promise<{
  success: boolean;
  allowedModifications: Record<string, any>;
  errors: string[];
}> {
  try {
    const validation = await TicketFieldAccessControl.validateFieldModifications(
      ticketId,
      userId,
      ticketCreatedBy,
      userRole,
      requestBody,
      tenantId
    );

    return {
      success: validation.errors.length === 0,
      allowedModifications: validation.allowed,
      errors: validation.errors
    };
  } catch (error) {
    // Log validation error
    await AuditLogger.logEvent({
      tenantId,
      userId,
      action: AuditEventType.SECURITY_VIOLATION,
      resourceType: AuditResourceType.TICKET,
      resourceId: ticketId,
      details: {
        error: 'Field access validation failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    return {
      success: false,
      allowedModifications: {},
      errors: ['Field access validation failed']
    };
  }
}