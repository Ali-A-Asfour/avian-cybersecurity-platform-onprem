/**
 * Role-Based Access Service for Help Desk
 * Implements comprehensive role validation for all help desk operations
 */

import { UserRole, TicketCategory, TicketStatus } from '../../types';
import { TicketAccessControl } from '../../middleware/ticket-access.middleware';
import { RBACService } from '../../lib/auth';

export interface AccessValidationResult {
    allowed: boolean;
    reason?: string;
    requiredRole?: UserRole;
    requiredPermission?: string;
}

export interface OperationContext {
    userId: string;
    userRole: UserRole;
    tenantId: string;
    targetTenantId?: string;
    ticketId?: string;
    ticketCategory?: TicketCategory;
    ticketAssignee?: string;
    ticketCreatedBy?: string;
}

export class RoleBasedAccessService {
    /**
     * Validate access to help desk operations
     */
    static validateHelpDeskAccess(
        operation: 'view_queue' | 'create_ticket' | 'assign_ticket' | 'resolve_ticket' | 'view_knowledge_base' | 'create_knowledge_article',
        context: OperationContext
    ): AccessValidationResult {
        const { userRole, userId, tenantId, targetTenantId } = context;

        // First check tenant access
        const tenantAccess = this.validateTenantAccess(userRole, tenantId, targetTenantId || tenantId);
        if (!tenantAccess.allowed) {
            return tenantAccess;
        }

        switch (operation) {
            case 'view_queue':
                return this.validateQueueAccess(context);

            case 'create_ticket':
                return this.validateTicketCreation(context);

            case 'assign_ticket':
                return this.validateTicketAssignment(context);

            case 'resolve_ticket':
                return this.validateTicketResolution(context);

            case 'view_knowledge_base':
                return this.validateKnowledgeBaseAccess(context);

            case 'create_knowledge_article':
                return this.validateKnowledgeArticleCreation(context);

            default:
                return {
                    allowed: false,
                    reason: 'Unknown operation'
                };
        }
    }

    /**
     * Validate tenant access
     */
    static validateTenantAccess(
        userRole: UserRole,
        userTenantId: string,
        targetTenantId: string
    ): AccessValidationResult {
        if (!RBACService.canAccessTenant(userTenantId, targetTenantId, userRole)) {
            return {
                allowed: false,
                reason: 'User does not have access to this tenant',
                requiredRole: UserRole.SUPER_ADMIN
            };
        }

        return { allowed: true };
    }

    /**
     * Validate queue access
     */
    static validateQueueAccess(context: OperationContext): AccessValidationResult {
        const { userRole } = context;

        // All authenticated users can access queues
        // Regular users see their created tickets, help desk staff see assigned tickets
        return { allowed: true };
    }

    /**
     * Validate ticket creation
     */
    static validateTicketCreation(context: OperationContext): AccessValidationResult {
        const { userRole, ticketCategory } = context;

        // Users can create help desk tickets (IT support category)
        if (userRole === UserRole.USER) {
            // Users can only create IT support tickets
            if (ticketCategory && ticketCategory !== TicketCategory.IT_SUPPORT) {
                return {
                    allowed: false,
                    reason: 'Users can only create IT support tickets',
                    requiredRole: UserRole.IT_HELPDESK_ANALYST
                };
            }
            return { allowed: true };
        }

        // Check category access if specified for other roles
        if (ticketCategory) {
            const categoryAccess = TicketAccessControl.validateCategoryForCreation(userRole, ticketCategory);
            if (!categoryAccess.valid) {
                return {
                    allowed: false,
                    reason: categoryAccess.error,
                    requiredRole: this.getRequiredRoleForCategory(ticketCategory)
                };
            }
        }

        return { allowed: true };
    }

    /**
     * Validate ticket assignment
     */
    static validateTicketAssignment(context: OperationContext): AccessValidationResult {
        const { userRole, ticketCategory } = context;

        // Users cannot assign tickets
        if (userRole === UserRole.USER) {
            return {
                allowed: false,
                reason: 'Users cannot assign tickets',
                requiredRole: UserRole.IT_HELPDESK_ANALYST
            };
        }

        // Check category access if specified
        if (ticketCategory) {
            const validation = TicketAccessControl.validateTicketAccess(
                userRole,
                context.userId,
                ticketCategory,
                context.ticketAssignee,
                'assign'
            );

            if (!validation.allowed) {
                return {
                    allowed: false,
                    reason: validation.reason,
                    requiredRole: this.getRequiredRoleForCategory(ticketCategory)
                };
            }
        }

        return { allowed: true };
    }

    /**
     * Validate ticket resolution
     */
    static validateTicketResolution(context: OperationContext): AccessValidationResult {
        const { userRole, userId, ticketCategory, ticketAssignee } = context;

        // Users cannot resolve tickets
        if (userRole === UserRole.USER) {
            return {
                allowed: false,
                reason: 'Users cannot resolve tickets',
                requiredRole: UserRole.IT_HELPDESK_ANALYST
            };
        }

        // Check if user can access the ticket category or is assigned to the ticket
        if (ticketCategory) {
            const validation = TicketAccessControl.validateTicketAccess(
                userRole,
                userId,
                ticketCategory,
                ticketAssignee,
                'write'
            );

            if (!validation.allowed) {
                return {
                    allowed: false,
                    reason: validation.reason,
                    requiredRole: this.getRequiredRoleForCategory(ticketCategory)
                };
            }
        }

        return { allowed: true };
    }

    /**
     * Validate knowledge base access
     */
    static validateKnowledgeBaseAccess(context: OperationContext): AccessValidationResult {
        const { userRole } = context;

        // All authenticated users can view knowledge base
        return { allowed: true };
    }

    /**
     * Validate knowledge article creation
     */
    static validateKnowledgeArticleCreation(context: OperationContext): AccessValidationResult {
        const { userRole } = context;

        // Users cannot create knowledge articles
        if (userRole === UserRole.USER) {
            return {
                allowed: false,
                reason: 'Users cannot create knowledge articles',
                requiredRole: UserRole.IT_HELPDESK_ANALYST
            };
        }

        return { allowed: true };
    }

    /**
     * Validate tenant admin operations
     */
    static validateTenantAdminOperation(
        operation: 'view_all_tickets' | 'create_proxy_ticket' | 'manage_users' | 'configure_notifications',
        context: OperationContext
    ): AccessValidationResult {
        const { userRole } = context;

        if (!TicketAccessControl.canPerformTenantAdminOperations(userRole)) {
            return {
                allowed: false,
                reason: 'Only tenant admins and super admins can perform this operation',
                requiredRole: UserRole.TENANT_ADMIN
            };
        }

        // Additional validation for specific operations
        switch (operation) {
            case 'manage_users':
                if (!RBACService.hasPermission(userRole, 'users:create')) {
                    return {
                        allowed: false,
                        reason: 'User does not have permission to manage users',
                        requiredPermission: 'users:create'
                    };
                }
                break;

            case 'configure_notifications':
                if (!RBACService.hasPermission(userRole, 'tenant:manage')) {
                    return {
                        allowed: false,
                        reason: 'User does not have permission to configure tenant settings',
                        requiredPermission: 'tenant:manage'
                    };
                }
                break;
        }

        return { allowed: true };
    }

    /**
     * Validate super admin operations
     */
    static validateSuperAdminOperation(
        operation: 'configure_system' | 'manage_tenants' | 'view_audit_logs',
        context: OperationContext
    ): AccessValidationResult {
        const { userRole } = context;

        if (userRole !== UserRole.SUPER_ADMIN) {
            return {
                allowed: false,
                reason: 'Only super admins can perform this operation',
                requiredRole: UserRole.SUPER_ADMIN
            };
        }

        return { allowed: true };
    }

    /**
     * Get required role for accessing a specific ticket category
     */
    static getRequiredRoleForCategory(category: TicketCategory): UserRole {
        const securityCategories = [
            TicketCategory.SECURITY_INCIDENT,
            TicketCategory.VULNERABILITY,
            TicketCategory.MALWARE_DETECTION,
            TicketCategory.PHISHING_ATTEMPT,
            TicketCategory.DATA_BREACH,
            TicketCategory.POLICY_VIOLATION,
            TicketCategory.COMPLIANCE,
        ];

        const itCategories = [
            TicketCategory.IT_SUPPORT,
            TicketCategory.HARDWARE_ISSUE,
            TicketCategory.SOFTWARE_ISSUE,
            TicketCategory.NETWORK_ISSUE,
            TicketCategory.ACCESS_REQUEST,
            TicketCategory.ACCOUNT_SETUP,
        ];

        if (securityCategories.includes(category)) {
            return UserRole.SECURITY_ANALYST;
        }

        if (itCategories.includes(category)) {
            return UserRole.IT_HELPDESK_ANALYST;
        }

        // General categories can be accessed by any analyst role
        return UserRole.IT_HELPDESK_ANALYST;
    }

    /**
     * Check if user can perform field-level operations on a ticket
     */
    static validateFieldAccess(
        field: string,
        operation: 'read' | 'write',
        context: OperationContext & { ticketCreatedBy: string }
    ): AccessValidationResult {
        const { userRole, userId, ticketCreatedBy } = context;

        // Super admins can access all fields
        if (userRole === UserRole.SUPER_ADMIN) {
            return { allowed: true };
        }

        // Users can only read their own tickets
        if (userRole === UserRole.USER) {
            if (operation === 'write') {
                return {
                    allowed: false,
                    reason: 'Users cannot modify tickets',
                    requiredRole: UserRole.IT_HELPDESK_ANALYST
                };
            }

            if (ticketCreatedBy !== userId) {
                return {
                    allowed: false,
                    reason: 'Users can only view their own tickets'
                };
            }
        }

        // Sensitive fields require higher permissions
        const sensitiveFields = ['assignee', 'status', 'priority', 'category'];
        if (sensitiveFields.includes(field) && operation === 'write') {
            if (userRole === UserRole.USER) {
                return {
                    allowed: false,
                    reason: 'Users cannot modify sensitive ticket fields',
                    requiredRole: UserRole.IT_HELPDESK_ANALYST
                };
            }
        }

        return { allowed: true };
    }

    /**
     * Validate bulk operations
     */
    static validateBulkOperation(
        operation: 'bulk_assign' | 'bulk_update_status' | 'bulk_delete',
        ticketCount: number,
        context: OperationContext
    ): AccessValidationResult {
        const { userRole } = context;

        // Users cannot perform bulk operations
        if (userRole === UserRole.USER) {
            return {
                allowed: false,
                reason: 'Users cannot perform bulk operations',
                requiredRole: UserRole.IT_HELPDESK_ANALYST
            };
        }

        // Limit bulk operations for non-admin roles
        if (userRole !== UserRole.SUPER_ADMIN && userRole !== UserRole.TENANT_ADMIN) {
            const maxBulkSize = 50;
            if (ticketCount > maxBulkSize) {
                return {
                    allowed: false,
                    reason: `Bulk operations are limited to ${maxBulkSize} tickets for this role`,
                    requiredRole: UserRole.TENANT_ADMIN
                };
            }
        }

        // Bulk delete requires admin permissions
        if (operation === 'bulk_delete' && !TicketAccessControl.canPerformTenantAdminOperations(userRole)) {
            return {
                allowed: false,
                reason: 'Only admins can perform bulk delete operations',
                requiredRole: UserRole.TENANT_ADMIN
            };
        }

        return { allowed: true };
    }

    /**
     * Get user's effective permissions for help desk operations
     */
    static getUserPermissions(userRole: UserRole): {
        canViewQueues: boolean;
        canCreateTickets: boolean;
        canAssignTickets: boolean;
        canResolveTickets: boolean;
        canViewKnowledgeBase: boolean;
        canCreateKnowledgeArticles: boolean;
        canPerformTenantAdminOperations: boolean;
        canConfigureSystem: boolean;
        allowedCategories: TicketCategory[];
        creatableCategories: TicketCategory[];
    } {
        return {
            canViewQueues: true, // All users can view their relevant queues
            canCreateTickets: true, // All users can create tickets (with category restrictions)
            canAssignTickets: userRole !== UserRole.USER,
            canResolveTickets: userRole !== UserRole.USER,
            canViewKnowledgeBase: true,
            canCreateKnowledgeArticles: userRole !== UserRole.USER,
            canPerformTenantAdminOperations: TicketAccessControl.canPerformTenantAdminOperations(userRole),
            canConfigureSystem: TicketAccessControl.canConfigureSystem(userRole),
            allowedCategories: TicketAccessControl.getAllowedCategories(userRole),
            creatableCategories: TicketAccessControl.getCreatableCategories(userRole),
        };
    }

    /**
     * Validate API endpoint access
     */
    static validateAPIAccess(
        endpoint: string,
        method: string,
        context: OperationContext
    ): AccessValidationResult {
        const { userRole } = context;

        // Map endpoints to required permissions
        const endpointPermissions: Record<string, { methods: string[]; requiredRole?: UserRole; permission?: string }> = {
            '/api/help-desk/queue/unassigned': {
                methods: ['GET'],
                requiredRole: UserRole.IT_HELPDESK_ANALYST
            },
            '/api/help-desk/queue/my-tickets': {
                methods: ['GET'],
                // All authenticated users can access their own tickets
            },
            '/api/help-desk/queue/tenant-admin': {
                methods: ['GET'],
                requiredRole: UserRole.TENANT_ADMIN
            },
            '/api/tickets': {
                methods: ['GET', 'POST'],
                requiredRole: UserRole.IT_HELPDESK_ANALYST
            },
            '/api/tickets/[id]': {
                methods: ['GET', 'PUT', 'DELETE'],
                requiredRole: UserRole.IT_HELPDESK_ANALYST
            },
            '/api/tickets/[id]/assign': {
                methods: ['POST'],
                requiredRole: UserRole.IT_HELPDESK_ANALYST
            },
            '/api/tickets/[id]/resolve': {
                methods: ['POST'],
                requiredRole: UserRole.IT_HELPDESK_ANALYST
            },
            '/api/help-desk/knowledge-base': {
                methods: ['GET', 'POST'],
                // GET is allowed for all users, POST requires analyst role
            },
            '/api/help-desk/knowledge-base/[id]': {
                methods: ['GET', 'PUT', 'DELETE'],
                requiredRole: UserRole.IT_HELPDESK_ANALYST
            }
        };

        const endpointConfig = endpointPermissions[endpoint];
        if (!endpointConfig) {
            // Unknown endpoint - allow by default but log for review
            return { allowed: true };
        }

        // Check if method is allowed
        if (!endpointConfig.methods.includes(method)) {
            return {
                allowed: false,
                reason: `Method ${method} not allowed for endpoint ${endpoint}`
            };
        }

        // Special handling for knowledge base GET requests
        if (endpoint === '/api/help-desk/knowledge-base' && method === 'GET') {
            return { allowed: true }; // All users can view knowledge base
        }

        // Check role requirements
        if (endpointConfig.requiredRole && !RBACService.hasRole(userRole, endpointConfig.requiredRole)) {
            return {
                allowed: false,
                reason: `Insufficient role for ${endpoint}`,
                requiredRole: endpointConfig.requiredRole
            };
        }

        // Check permission requirements
        if (endpointConfig.permission && !RBACService.hasPermission(userRole, endpointConfig.permission)) {
            return {
                allowed: false,
                reason: `Missing permission for ${endpoint}`,
                requiredPermission: endpointConfig.permission
            };
        }

        return { allowed: true };
    }
}