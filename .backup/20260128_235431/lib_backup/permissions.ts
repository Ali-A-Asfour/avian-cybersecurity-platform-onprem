/**
 * Permission Definitions and Role-Based Access Control
 * Defines permissions for each role in the MSSP platform
 * Part of production authentication system (Task 5.1)
 */

/**
 * User roles in the system
 */
export enum UserRole {
    SUPER_ADMIN = 'super_admin',
    TENANT_ADMIN = 'tenant_admin',
    SECURITY_ANALYST = 'security_analyst',
    IT_HELPDESK_ANALYST = 'it_helpdesk_analyst',
    USER = 'user',
}

/**
 * Resource types in the system
 */
export enum Resource {
    TICKETS = 'tickets',
    ALERTS = 'alerts',
    USERS = 'users',
    TENANTS = 'tenants',
    SETTINGS = 'settings',
    AUDIT_LOGS = 'audit_logs',
    REPORTS = 'reports',
    DATA_SOURCES = 'data_sources',
    INTEGRATIONS = 'integrations',
}

/**
 * Actions that can be performed on resources
 */
export enum Action {
    CREATE = 'create',
    READ = 'read',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    MANAGE = 'manage',
}

/**
 * Ticket categories
 */
export enum TicketCategory {
    // Security categories
    SECURITY_INCIDENT = 'security_incident',
    VULNERABILITY = 'vulnerability',
    MALWARE_DETECTION = 'malware_detection',
    PHISHING_ATTEMPT = 'phishing_attempt',
    DATA_BREACH = 'data_breach',
    POLICY_VIOLATION = 'policy_violation',
    COMPLIANCE = 'compliance',

    // IT categories
    IT_SUPPORT = 'it_support',
    HARDWARE_ISSUE = 'hardware_issue',
    SOFTWARE_ISSUE = 'software_issue',
    NETWORK_ISSUE = 'network_issue',
    ACCESS_REQUEST = 'access_request',
    ACCOUNT_SETUP = 'account_setup',
    GENERAL_REQUEST = 'general_request',
    OTHER = 'other',
}

/**
 * Security ticket categories
 */
export const SECURITY_CATEGORIES = [
    TicketCategory.SECURITY_INCIDENT,
    TicketCategory.VULNERABILITY,
    TicketCategory.MALWARE_DETECTION,
    TicketCategory.PHISHING_ATTEMPT,
    TicketCategory.DATA_BREACH,
    TicketCategory.POLICY_VIOLATION,
    TicketCategory.COMPLIANCE,
];

/**
 * IT ticket categories
 */
export const IT_CATEGORIES = [
    TicketCategory.IT_SUPPORT,
    TicketCategory.HARDWARE_ISSUE,
    TicketCategory.SOFTWARE_ISSUE,
    TicketCategory.NETWORK_ISSUE,
    TicketCategory.ACCESS_REQUEST,
    TicketCategory.ACCOUNT_SETUP,
    TicketCategory.GENERAL_REQUEST,
    TicketCategory.OTHER,
];

/**
 * Permission definition
 */
interface Permission {
    resource: Resource;
    action: Action;
    scope?: 'own' | 'tenant' | 'all';
    conditions?: string[];
}

/**
 * Role permissions mapping
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    // Super Admin - Full platform access
    [UserRole.SUPER_ADMIN]: [
        { resource: Resource.TICKETS, action: Action.MANAGE, scope: 'all' },
        { resource: Resource.ALERTS, action: Action.MANAGE, scope: 'all' },
        { resource: Resource.USERS, action: Action.MANAGE, scope: 'all' },
        { resource: Resource.TENANTS, action: Action.MANAGE, scope: 'all' },
        { resource: Resource.SETTINGS, action: Action.MANAGE, scope: 'all' },
        { resource: Resource.AUDIT_LOGS, action: Action.READ, scope: 'all' },
        { resource: Resource.REPORTS, action: Action.MANAGE, scope: 'all' },
        { resource: Resource.DATA_SOURCES, action: Action.MANAGE, scope: 'all' },
        { resource: Resource.INTEGRATIONS, action: Action.MANAGE, scope: 'all' },
    ],

    // Security Analyst - Security tickets and alerts across all clients
    [UserRole.SECURITY_ANALYST]: [
        { resource: Resource.TICKETS, action: Action.READ, scope: 'all', conditions: ['security_only'] },
        { resource: Resource.TICKETS, action: Action.UPDATE, scope: 'all', conditions: ['security_only'] },
        { resource: Resource.ALERTS, action: Action.READ, scope: 'all' },
        { resource: Resource.ALERTS, action: Action.UPDATE, scope: 'all' },
        { resource: Resource.REPORTS, action: Action.READ, scope: 'all', conditions: ['security_only'] },
        { resource: Resource.DATA_SOURCES, action: Action.READ, scope: 'all' },
    ],

    // IT Helpdesk Analyst - IT tickets across all clients
    [UserRole.IT_HELPDESK_ANALYST]: [
        { resource: Resource.TICKETS, action: Action.READ, scope: 'all', conditions: ['it_only'] },
        { resource: Resource.TICKETS, action: Action.UPDATE, scope: 'all', conditions: ['it_only'] },
        { resource: Resource.REPORTS, action: Action.READ, scope: 'all', conditions: ['it_only'] },
    ],

    // Tenant Admin - Full access to their tenant
    [UserRole.TENANT_ADMIN]: [
        { resource: Resource.TICKETS, action: Action.MANAGE, scope: 'tenant' },
        { resource: Resource.ALERTS, action: Action.READ, scope: 'tenant' },
        { resource: Resource.USERS, action: Action.MANAGE, scope: 'tenant' },
        { resource: Resource.SETTINGS, action: Action.UPDATE, scope: 'tenant' },
        { resource: Resource.REPORTS, action: Action.READ, scope: 'tenant' },
        { resource: Resource.DATA_SOURCES, action: Action.READ, scope: 'tenant' },
    ],

    // Regular User - Own tickets only
    [UserRole.USER]: [
        { resource: Resource.TICKETS, action: Action.CREATE, scope: 'own' },
        { resource: Resource.TICKETS, action: Action.READ, scope: 'own' },
        { resource: Resource.TICKETS, action: Action.UPDATE, scope: 'own' },
    ],
};

/**
 * Check if a role has permission for an action on a resource
 */
export function hasPermission(
    role: UserRole,
    resource: Resource,
    action: Action
): boolean {
    const permissions = ROLE_PERMISSIONS[role] || [];

    return permissions.some((perm) => {
        if (perm.resource !== resource) return false;

        // Check if action matches
        if (perm.action === Action.MANAGE) {
            // MANAGE includes all actions
            return true;
        }

        return perm.action === action;
    });
}

/**
 * Get permission scope for a role and resource
 */
export function getPermissionScope(
    role: UserRole,
    resource: Resource,
    action: Action
): 'own' | 'tenant' | 'all' | undefined {
    const permissions = ROLE_PERMISSIONS[role] || [];

    const permission = permissions.find((perm) => {
        if (perm.resource !== resource) return false;
        if (perm.action === Action.MANAGE) return true;
        return perm.action === action;
    });

    return permission?.scope;
}

/**
 * Get permission conditions for a role and resource
 */
export function getPermissionConditions(
    role: UserRole,
    resource: Resource,
    action: Action
): string[] {
    const permissions = ROLE_PERMISSIONS[role] || [];

    const permission = permissions.find((perm) => {
        if (perm.resource !== resource) return false;
        if (perm.action === Action.MANAGE) return true;
        return perm.action === action;
    });

    return permission?.conditions || [];
}

/**
 * Check if user can access a specific tenant
 */
export function canAccessTenant(
    role: UserRole,
    userTenantId: string,
    targetTenantId: string
): boolean {
    // Super admin can access all tenants
    if (role === UserRole.SUPER_ADMIN) {
        return true;
    }

    // Security and IT analysts can access all tenants
    if (
        role === UserRole.SECURITY_ANALYST ||
        role === UserRole.IT_HELPDESK_ANALYST
    ) {
        return true;
    }

    // Others can only access their own tenant
    return userTenantId === targetTenantId;
}

/**
 * Check if user can view a specific ticket category
 */
export function canViewTicketCategory(
    role: UserRole,
    category: TicketCategory
): boolean {
    // Super admin can view all categories
    if (role === UserRole.SUPER_ADMIN) {
        return true;
    }

    // Security analyst can only view security categories
    if (role === UserRole.SECURITY_ANALYST) {
        return SECURITY_CATEGORIES.includes(category);
    }

    // IT helpdesk can only view IT categories
    if (role === UserRole.IT_HELPDESK_ANALYST) {
        return IT_CATEGORIES.includes(category);
    }

    // Tenant admin and users can view all categories (within their tenant)
    return true;
}

/**
 * Get allowed ticket categories for a role
 */
export function getAllowedTicketCategories(role: UserRole): TicketCategory[] {
    switch (role) {
        case UserRole.SUPER_ADMIN:
        case UserRole.TENANT_ADMIN:
        case UserRole.USER:
            return Object.values(TicketCategory);

        case UserRole.SECURITY_ANALYST:
            return SECURITY_CATEGORIES;

        case UserRole.IT_HELPDESK_ANALYST:
            return IT_CATEGORIES;

        default:
            return [];
    }
}

/**
 * Check if user can manage other users
 */
export function canManageUsers(role: UserRole): boolean {
    return (
        role === UserRole.SUPER_ADMIN ||
        role === UserRole.TENANT_ADMIN
    );
}

/**
 * Check if user can view audit logs
 */
export function canViewAuditLogs(role: UserRole): boolean {
    return (
        role === UserRole.SUPER_ADMIN ||
        role === UserRole.TENANT_ADMIN
    );
}

/**
 * Check if user can switch tenants
 */
export function canSwitchTenants(role: UserRole): boolean {
    return (
        role === UserRole.SUPER_ADMIN ||
        role === UserRole.SECURITY_ANALYST ||
        role === UserRole.IT_HELPDESK_ANALYST
    );
}

/**
 * Check if user needs tenant selection UI
 */
export function needsTenantSelection(role: UserRole): boolean {
    return role === UserRole.SUPER_ADMIN;
}

/**
 * Check if user needs tenant filter dropdown
 */
export function needsTenantFilter(role: UserRole): boolean {
    return (
        role === UserRole.SECURITY_ANALYST ||
        role === UserRole.IT_HELPDESK_ANALYST
    );
}

/**
 * Get default redirect path after login
 */
export function getDefaultRedirectPath(role: UserRole): string {
    switch (role) {
        case UserRole.SUPER_ADMIN:
            return '/super-admin';
        case UserRole.SECURITY_ANALYST:
        case UserRole.IT_HELPDESK_ANALYST:
        case UserRole.TENANT_ADMIN:
        case UserRole.USER:
            return '/dashboard';
        default:
            return '/dashboard';
    }
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
    allowed: boolean;
    reason?: string;
    scope?: 'own' | 'tenant' | 'all';
    conditions?: string[];
}

/**
 * Comprehensive permission check
 */
export function checkPermission(
    role: UserRole,
    resource: Resource,
    action: Action,
    context?: {
        userTenantId?: string;
        targetTenantId?: string;
        userId?: string;
        targetUserId?: string;
        ticketCategory?: TicketCategory;
    }
): PermissionCheckResult {
    // Check basic permission
    if (!hasPermission(role, resource, action)) {
        return {
            allowed: false,
            reason: 'Insufficient permissions for this action',
        };
    }

    const scope = getPermissionScope(role, resource, action);
    const conditions = getPermissionConditions(role, resource, action);

    // Check tenant access if applicable
    if (context?.userTenantId && context?.targetTenantId) {
        if (!canAccessTenant(role, context.userTenantId, context.targetTenantId)) {
            return {
                allowed: false,
                reason: 'Cannot access resources from other tenants',
            };
        }
    }

    // Check ticket category restrictions
    if (context?.ticketCategory) {
        if (!canViewTicketCategory(role, context.ticketCategory)) {
            return {
                allowed: false,
                reason: 'Cannot access this ticket category',
            };
        }
    }

    // Check own resource access
    if (scope === 'own' && context?.userId && context?.targetUserId) {
        if (context.userId !== context.targetUserId) {
            return {
                allowed: false,
                reason: 'Can only access your own resources',
            };
        }
    }

    return {
        allowed: true,
        scope,
        conditions,
    };
}
