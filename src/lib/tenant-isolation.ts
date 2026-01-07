/**
 * Tenant Isolation Utilities
 * 
 * Provides utilities for enforcing tenant isolation at the database query level.
 * **Validates: Requirements 16.1, 16.2, 16.3**
 */

import { eq, and, SQL } from 'drizzle-orm';
import { logger } from './logger';
import { UserRole } from '../types';

/**
 * Add tenant filtering to database queries
 * 
 * This function ensures that all database queries are filtered by tenant_id
 * unless the user is a super_admin.
 * 
 * **Validates: Requirement 16.1 - Tenant filtering on all database queries**
 * 
 * @param tenantIdColumn - The tenant_id column from the table schema
 * @param userTenantId - The tenant ID of the authenticated user
 * @param userRole - The role of the authenticated user
 * @returns SQL condition to add to WHERE clause, or null if super_admin
 */
export function addTenantFilter(
  tenantIdColumn: any,
  userTenantId: string,
  userRole: UserRole
): SQL | null {
  // Super admins can access all tenants
  if (userRole === UserRole.SUPER_ADMIN) {
    logger.debug('Tenant filter bypassed for super_admin', {
      userTenantId,
      userRole,
    });
    return null;
  }

  // All other users must be filtered by their tenant
  logger.debug('Tenant filter applied', {
    userTenantId,
    userRole,
  });

  return eq(tenantIdColumn, userTenantId);
}

/**
 * Verify tenant ownership of a resource
 * 
 * This function checks if a resource belongs to the user's tenant before
 * allowing access. Super admins can access resources from any tenant.
 * 
 * **Validates: Requirement 16.2 - Tenant ownership verification before data access**
 * 
 * @param resourceTenantId - The tenant ID of the resource being accessed
 * @param userTenantId - The tenant ID of the authenticated user
 * @param userRole - The role of the authenticated user
 * @param resourceType - Type of resource (for logging)
 * @param resourceId - ID of resource (for logging)
 * @returns true if access is allowed, false otherwise
 */
export function verifyTenantOwnership(
  resourceTenantId: string,
  userTenantId: string,
  userRole: UserRole,
  resourceType?: string,
  resourceId?: string
): boolean {
  // Super admins can access any tenant's resources
  if (userRole === UserRole.SUPER_ADMIN) {
    logger.debug('Tenant ownership check bypassed for super_admin', {
      resourceTenantId,
      userTenantId,
      userRole,
      resourceType,
      resourceId,
    });
    return true;
  }

  // Check if resource belongs to user's tenant
  const hasAccess = resourceTenantId === userTenantId;

  if (!hasAccess) {
    logger.warn('Tenant ownership verification failed', {
      resourceTenantId,
      userTenantId,
      userRole,
      resourceType,
      resourceId,
    });
  } else {
    logger.debug('Tenant ownership verified', {
      resourceTenantId,
      userTenantId,
      userRole,
      resourceType,
      resourceId,
    });
  }

  return hasAccess;
}

/**
 * Validate tenant ID in JWT token matches requested resource
 * 
 * This function ensures that the tenant_id in the JWT token matches
 * the tenant being accessed in the request.
 * 
 * **Validates: Requirement 16.4 - Tenant ID validation in JWT tokens**
 * 
 * @param jwtTenantId - The tenant ID from the JWT token
 * @param requestedTenantId - The tenant ID being accessed in the request
 * @param userRole - The role of the authenticated user
 * @returns true if validation passes, false otherwise
 */
export function validateJWTTenant(
  jwtTenantId: string,
  requestedTenantId: string,
  userRole: UserRole
): boolean {
  // Super admins can access any tenant
  if (userRole === UserRole.SUPER_ADMIN) {
    logger.debug('JWT tenant validation bypassed for super_admin', {
      jwtTenantId,
      requestedTenantId,
      userRole,
    });
    return true;
  }

  // For other users, JWT tenant must match requested tenant
  const isValid = jwtTenantId === requestedTenantId;

  if (!isValid) {
    logger.warn('JWT tenant validation failed', {
      jwtTenantId,
      requestedTenantId,
      userRole,
    });
  } else {
    logger.debug('JWT tenant validated', {
      jwtTenantId,
      requestedTenantId,
      userRole,
    });
  }

  return isValid;
}

/**
 * Combine multiple SQL conditions with AND
 * 
 * Helper function to combine tenant filter with other query conditions.
 * 
 * @param conditions - Array of SQL conditions (can include null values)
 * @returns Combined SQL condition, or undefined if no conditions
 */
export function combineConditions(...conditions: (SQL | null | undefined)[]): SQL | undefined {
  const validConditions = conditions.filter((c): c is SQL => c !== null && c !== undefined);

  if (validConditions.length === 0) {
    return undefined;
  }

  if (validConditions.length === 1) {
    return validConditions[0];
  }

  return and(...validConditions);
}

/**
 * Example usage in a service:
 * 
 * ```typescript
 * import { addTenantFilter, verifyTenantOwnership, combineConditions } from '../lib/tenant-isolation';
 * import { users } from '../../database/schemas/main';
 * import { eq } from 'drizzle-orm';
 * 
 * // In a query
 * const conditions = combineConditions(
 *   addTenantFilter(users.tenant_id, userTenantId, userRole),
 *   eq(users.is_active, true)
 * );
 * 
 * const results = await db.select().from(users).where(conditions);
 * 
 * // Before returning a single resource
 * const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
 * 
 * if (!user || !verifyTenantOwnership(user.tenant_id, userTenantId, userRole, 'user', userId)) {
 *   throw new Error('Access denied');
 * }
 * ```
 */
