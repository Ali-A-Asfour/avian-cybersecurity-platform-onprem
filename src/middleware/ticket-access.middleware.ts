/**
 * Ticket Access Control Middleware
 * Implements role-based access control for help desk tickets
 */

import { UserRole, TicketCategory } from '../types';

export class TicketAccessControl {
  /**
   * Security-related categories (Security Analysts only)
   */
  private static readonly SECURITY_CATEGORIES = [
    TicketCategory.SECURITY_INCIDENT,
    TicketCategory.VULNERABILITY,
    TicketCategory.MALWARE_DETECTION,
    TicketCategory.PHISHING_ATTEMPT,
    TicketCategory.DATA_BREACH,
    TicketCategory.POLICY_VIOLATION,
    TicketCategory.COMPLIANCE,
  ];

  /**
   * IT Support categories (IT Helpdesk Analysts only)
   */
  private static readonly IT_CATEGORIES = [
    TicketCategory.IT_SUPPORT,
    TicketCategory.HARDWARE_ISSUE,
    TicketCategory.SOFTWARE_ISSUE,
    TicketCategory.NETWORK_ISSUE,
    TicketCategory.ACCESS_REQUEST,
    TicketCategory.ACCOUNT_SETUP,
  ];

  /**
   * General categories (all roles can access)
   */
  private static readonly GENERAL_CATEGORIES = [
    TicketCategory.GENERAL_REQUEST,
    TicketCategory.OTHER,
  ];

  /**
   * Check if a user role can access a specific ticket category
   */
  static canAccessCategory(userRole: UserRole, category: TicketCategory): boolean {
    // Super admins can access all categories
    if (userRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Security analysts can access security and general categories
    if (userRole === UserRole.SECURITY_ANALYST) {
      return this.SECURITY_CATEGORIES.includes(category) ||
        this.GENERAL_CATEGORIES.includes(category);
    }

    // IT Helpdesk analysts can access IT and general categories
    if (userRole === UserRole.IT_HELPDESK_ANALYST) {
      return this.IT_CATEGORIES.includes(category) ||
        this.GENERAL_CATEGORIES.includes(category);
    }

    // Tenant admins and users can only access general categories
    if (userRole === UserRole.TENANT_ADMIN || userRole === UserRole.USER) {
      return this.GENERAL_CATEGORIES.includes(category);
    }

    return false;
  }

  /**
   * Check if a user role can create tickets in a specific category
   */
  static canCreateInCategory(userRole: UserRole, category: TicketCategory): boolean {
    // Users can create IT support tickets (help desk functionality)
    if (userRole === UserRole.USER) {
      return category === TicketCategory.IT_SUPPORT;
    }

    // For other roles, creation permission matches access permission
    return this.canAccessCategory(userRole, category);
  }

  /**
   * Check if a user can access an assigned ticket regardless of category restrictions
   */
  static canAccessAssignedTicket(
    userRole: UserRole,
    category: TicketCategory,
    assigneeId: string,
    userId: string
  ): boolean {
    // If the user is assigned to the ticket, they can access it regardless of category
    if (assigneeId === userId) {
      return true;
    }

    // Otherwise, follow normal category access rules
    return this.canAccessCategory(userRole, category);
  }

  /**
   * Get all categories that a user role can access
   */
  static getAllowedCategories(userRole: UserRole): TicketCategory[] {
    const categories: TicketCategory[] = [];

    // Super admins can access all categories
    if (userRole === UserRole.SUPER_ADMIN) {
      return Object.values(TicketCategory);
    }

    // Security analysts can access security and general categories
    if (userRole === UserRole.SECURITY_ANALYST) {
      categories.push(...this.SECURITY_CATEGORIES, ...this.GENERAL_CATEGORIES);
    }

    // IT Helpdesk analysts can access IT and general categories
    if (userRole === UserRole.IT_HELPDESK_ANALYST) {
      categories.push(...this.IT_CATEGORIES, ...this.GENERAL_CATEGORIES);
    }

    // Tenant admins and users can access general categories
    if (userRole === UserRole.TENANT_ADMIN || userRole === UserRole.USER) {
      categories.push(...this.GENERAL_CATEGORIES);
    }

    return categories;
  }

  /**
   * Get categories that a user role can create tickets in
   */
  static getCreatableCategories(userRole: UserRole): TicketCategory[] {
    // Users cannot create tickets
    if (userRole === UserRole.USER) {
      return [];
    }

    // For other roles, creatable categories match accessible categories
    return this.getAllowedCategories(userRole);
  }

  /**
   * Validate ticket access for a specific operation
   */
  static validateTicketAccess(
    userRole: UserRole,
    userId: string,
    ticketCategory: TicketCategory,
    ticketAssignee?: string,
    operation: 'read' | 'write' | 'assign' = 'read'
  ): { allowed: boolean; reason?: string } {
    // Check if user can access this category
    const canAccessCategory = this.canAccessCategory(userRole, ticketCategory);

    // Check if user is assigned to the ticket
    const isAssigned = ticketAssignee === userId;

    // For read operations
    if (operation === 'read') {
      if (canAccessCategory || isAssigned) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'User does not have access to this ticket category'
      };
    }

    // For write operations
    if (operation === 'write') {
      // Users cannot write to any tickets
      if (userRole === UserRole.USER) {
        return {
          allowed: false,
          reason: 'Users do not have write permissions'
        };
      }

      // Assigned users can write regardless of category
      if (isAssigned) {
        return { allowed: true };
      }

      // Otherwise, check category access
      if (canAccessCategory) {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: 'User does not have write access to this ticket category'
      };
    }

    // For assign operations
    if (operation === 'assign') {
      // Only analysts and above can assign tickets
      if (userRole === UserRole.USER) {
        return {
          allowed: false,
          reason: 'Users cannot assign tickets'
        };
      }

      // Must have access to the category to assign
      if (canAccessCategory) {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: 'User does not have access to assign tickets in this category'
      };
    }

    return { allowed: false, reason: 'Invalid operation' };
  }

  /**
   * Filter tickets based on user role and access permissions
   */
  static filterTicketsByAccess<T extends { category: TicketCategory; assignee?: string }>(
    tickets: T[],
    userRole: UserRole,
    userId: string
  ): T[] {
    return tickets.filter(ticket => {
      const validation = this.validateTicketAccess(
        userRole,
        userId,
        ticket.category,
        ticket.assignee,
        'read'
      );
      return validation.allowed;
    });
  }

  /**
   * Check if user can perform tenant admin operations
   */
  static canPerformTenantAdminOperations(userRole: UserRole): boolean {
    return userRole === UserRole.SUPER_ADMIN || userRole === UserRole.TENANT_ADMIN;
  }

  /**
   * Check if user can create tickets on behalf of other users
   */
  static canCreateTicketOnBehalfOf(userRole: UserRole): boolean {
    return this.canPerformTenantAdminOperations(userRole);
  }

  /**
   * Check if user can view all tenant tickets
   */
  static canViewAllTenantTickets(userRole: UserRole): boolean {
    return this.canPerformTenantAdminOperations(userRole);
  }

  /**
   * Check if user can configure system settings
   */
  static canConfigureSystem(userRole: UserRole): boolean {
    return userRole === UserRole.SUPER_ADMIN;
  }

  /**
   * Get category filter for database queries based on user role
   * Returns null if user can access all categories (super admin)
   */
  static getCategoryFilter(userRole: UserRole): TicketCategory[] | null {
    // Super admins can access all categories - no filter needed
    if (userRole === UserRole.SUPER_ADMIN) {
      return null;
    }

    // Return allowed categories for other roles
    return this.getAllowedCategories(userRole);
  }

  /**
   * Validate category for ticket creation
   */
  static validateCategoryForCreation(userRole: UserRole, category: TicketCategory): { valid: boolean; error?: string } {
    if (!this.canCreateInCategory(userRole, category)) {
      return {
        valid: false,
        error: `Role ${userRole} is not authorized to create tickets in category ${category}`
      };
    }
    return { valid: true };
  }
}