/**
 * Tenant Context and Multi-Tenancy Utilities
 * Provides tenant isolation and context management
 * Part of production authentication system (Task 5.2)
 */

import { SQL, and, eq, inArray } from 'drizzle-orm';
import { UserRole, canAccessTenant, canSwitchTenants } from './permissions';
import { AuthContext } from './auth-middleware';

/**
 * Tenant context for queries
 */
export interface TenantContext {
    tenantId: string | null; // null means "all tenants" for MSSP staff
    userRole: UserRole;
    userId: string;
}

/**
 * Create tenant context from auth context
 */
export function createTenantContext(
    authContext: AuthContext,
    selectedTenantId?: string | null
): TenantContext {
    const { user } = authContext;

    // Super admin, security analyst, and IT helpdesk can select tenant
    if (canSwitchTenants(user.role)) {
        return {
            tenantId: selectedTenantId || null, // null = all tenants
            userRole: user.role,
            userId: user.id,
        };
    }

    // Others are locked to their tenant
    return {
        tenantId: user.tenantId,
        userRole: user.role,
        userId: user.id,
    };
}

/**
 * Apply tenant isolation to a query
 * Returns SQL condition to filter by tenant
 */
export function applyTenantIsolation<T extends { tenant_id: any }>(
    table: T,
    context: TenantContext
): SQL | undefined {
    // If tenantId is null, don't filter (show all tenants)
    // This is for MSSP staff viewing all clients
    if (context.tenantId === null) {
        return undefined;
    }

    // Filter by specific tenant
    return eq(table.tenant_id, context.tenantId);
}

/**
 * Apply tenant isolation with additional conditions
 */
export function applyTenantIsolationWithConditions<T extends { tenant_id: any }>(
    table: T,
    context: TenantContext,
    additionalConditions: SQL[]
): SQL | undefined {
    const tenantCondition = applyTenantIsolation(table, context);

    if (!tenantCondition && additionalConditions.length === 0) {
        return undefined;
    }

    const allConditions = tenantCondition
        ? [tenantCondition, ...additionalConditions]
        : additionalConditions;

    return allConditions.length > 0 ? and(...allConditions) : undefined;
}

/**
 * Check if user can access a specific tenant
 */
export function validateTenantAccess(
    context: TenantContext,
    targetTenantId: string
): { allowed: boolean; reason?: string } {
    // If viewing all tenants (null), check if role allows it
    if (context.tenantId === null) {
        if (canSwitchTenants(context.userRole)) {
            return { allowed: true };
        }
        return {
            allowed: false,
            reason: 'Your role cannot access multiple tenants',
        };
    }

    // Check if user can access the target tenant
    const userTenantId = context.tenantId;
    const allowed = canAccessTenant(context.userRole, userTenantId, targetTenantId);

    if (!allowed) {
        return {
            allowed: false,
            reason: 'You do not have access to this tenant',
        };
    }

    return { allowed: true };
}

/**
 * Get tenant IDs that user can access
 */
export function getAccessibleTenantIds(
    context: TenantContext,
    allTenantIds?: string[]
): string[] | 'all' {
    // MSSP staff can access all tenants
    if (canSwitchTenants(context.userRole)) {
        return 'all';
    }

    // Others can only access their own tenant
    return context.tenantId ? [context.tenantId] : [];
}

/**
 * Filter results by tenant access
 * Useful for in-memory filtering after query
 */
export function filterByTenantAccess<T extends { tenant_id?: string | null }>(
    items: T[],
    context: TenantContext
): T[] {
    // If viewing all tenants, return all items
    if (context.tenantId === null && canSwitchTenants(context.userRole)) {
        return items;
    }

    // Filter by user's tenant
    return items.filter((item) => item.tenant_id === context.tenantId);
}

/**
 * Validate tenant ID from request
 */
export function validateTenantIdFromRequest(
    tenantId: string | null | undefined,
    context: TenantContext
): { valid: boolean; tenantId: string | null; error?: string } {
    // If no tenant ID provided, use context tenant
    if (!tenantId) {
        return {
            valid: true,
            tenantId: context.tenantId,
        };
    }

    // Special case: "all" means all tenants (for MSSP staff)
    if (tenantId === 'all') {
        if (canSwitchTenants(context.userRole)) {
            return {
                valid: true,
                tenantId: null, // null = all tenants
            };
        }
        return {
            valid: false,
            tenantId: null,
            error: 'You cannot access all tenants',
        };
    }

    // Validate access to specific tenant
    const validation = validateTenantAccess(context, tenantId);
    if (!validation.allowed) {
        return {
            valid: false,
            tenantId: null,
            error: validation.reason,
        };
    }

    return {
        valid: true,
        tenantId,
    };
}

/**
 * Create tenant-aware query builder
 */
export class TenantQueryBuilder<T extends { tenant_id: any }> {
    constructor(
        private table: T,
        private context: TenantContext
    ) { }

    /**
     * Get base WHERE condition with tenant isolation
     */
    getWhereCondition(additionalConditions?: SQL[]): SQL | undefined {
        return applyTenantIsolationWithConditions(
            this.table,
            this.context,
            additionalConditions || []
        );
    }

    /**
     * Check if a specific tenant ID is accessible
     */
    canAccessTenant(_tenantId: string): boolean {
        return validateTenantAccess(this.context, tenantId).allowed;
    }

    /**
     * Get tenant ID for creating new resources
     */
    getTenantIdForCreate(): string {
        if (!this.context.tenantId) {
            throw new Error('Cannot create resource without tenant context');
        }
        return this.context.tenantId;
    }
}

/**
 * Tenant switching validation
 */
export interface TenantSwitchRequest {
    fromTenantId: string | null;
    toTenantId: string | null;
    userRole: UserRole;
}

/**
 * Validate tenant switch request
 */
export function validateTenantSwitch(
    request: TenantSwitchRequest
): { allowed: boolean; reason?: string } {
    // Check if user can switch tenants
    if (!canSwitchTenants(request.userRole)) {
        return {
            allowed: false,
            reason: 'Your role does not allow tenant switching',
        };
    }

    // Super admin can switch to any tenant including "all"
    if (request.userRole === UserRole.SUPER_ADMIN) {
        return { allowed: true };
    }

    // Security and IT analysts can switch between tenants and "all"
    if (
        request.userRole === UserRole.SECURITY_ANALYST ||
        request.userRole === UserRole.IT_HELPDESK_ANALYST
    ) {
        return { allowed: true };
    }

    return {
        allowed: false,
        reason: 'Invalid tenant switch request',
    };
}

/**
 * Get tenant display name for UI
 */
export function getTenantDisplayName(
    tenantId: string | null,
    tenantName?: string
): string {
    if (tenantId === null) {
        return 'All Clients';
    }
    return tenantName || 'Unknown Tenant';
}

/**
 * Tenant isolation middleware helper
 */
export function withTenantIsolation<T extends { tenant_id: any }>(
    table: T,
    context: TenantContext
) {
    return {
        table,
        context,
        where: (additionalConditions?: SQL[]) =>
            applyTenantIsolationWithConditions(table, context, additionalConditions || []),
        canAccess: (_tenantId: string) => validateTenantAccess(context, tenantId).allowed,
        getTenantId: () => {
            if (!context.tenantId) {
                throw new Error('No tenant context available');
            }
            return context.tenantId;
        },
    };
}

/**
 * User ownership check
 */
export function isResourceOwner(
    resourceUserId: string,
    contextUserId: string
): boolean {
    return resourceUserId === contextUserId;
}

/**
 * Combined tenant and ownership check
 */
export function canAccessResource(
    context: TenantContext,
    resource: {
        tenant_id?: string | null;
        user_id?: string | null;
    }
): { allowed: boolean; reason?: string } {
    // Check tenant access
    if (resource.tenant_id) {
        const tenantCheck = validateTenantAccess(context, resource.tenant_id);
        if (!tenantCheck.allowed) {
            return tenantCheck;
        }
    }

    // For regular users, also check ownership
    if (context.userRole === UserRole.USER) {
        if (resource.user_id && resource.user_id !== context.userId) {
            return {
                allowed: false,
                reason: 'You can only access your own resources',
            };
        }
    }

    return { allowed: true };
}

/**
 * Apply user ownership filter (for regular users)
 */
export function applyOwnershipFilter<T extends { created_by?: any; user_id?: any }>(
    table: T,
    context: TenantContext,
    userIdColumn: 'created_by' | 'user_id' = 'created_by'
): SQL | undefined {
    // Regular users can only see their own resources
    if (context.userRole === UserRole.USER) {
        return eq(table[userIdColumn], context.userId);
    }

    // Others can see all resources (within tenant)
    return undefined;
}

/**
 * Combined tenant isolation and ownership filter
 */
export function applyFullIsolation<T extends { tenant_id: any; created_by?: any; user_id?: any }>(
    table: T,
    context: TenantContext,
    userIdColumn: 'created_by' | 'user_id' = 'created_by'
): SQL | undefined {
    const tenantCondition = applyTenantIsolation(table, context);
    const ownershipCondition = applyOwnershipFilter(table, context, userIdColumn);

    const conditions = [tenantCondition, ownershipCondition].filter(Boolean) as SQL[];

    return conditions.length > 0 ? and(...conditions) : undefined;
}
