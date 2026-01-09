import { NextRequest } from 'next/server';
import { JWTPayload, UserRole } from '../types';

export interface TenantContext {
  tenant_id: string;
  user_id: string;
  role: UserRole;
  can_access_tenant: (targetTenantId: string) => boolean;
  can_manage_tenant: (targetTenantId: string) => boolean;
}

/**
 * Tenant isolation middleware
 * Ensures users can only access data within their tenant boundaries
 */
export class TenantMiddleware {
  /**
   * Create tenant context from authenticated user
   */
  static createTenantContext(user: JWTPayload): TenantContext {
    return {
      tenant_id: user.tenant_id,
      user_id: user.user_id,
      role: user.role,

      /**
       * Check if user can access a specific tenant
       */
      can_access_tenant: (targetTenantId: string): boolean => {
        // Super admins can access any tenant
        if (user.role === UserRole.SUPER_ADMIN) {
          return true;
        }

        // Other roles can only access their own tenant
        return user.tenant_id === targetTenantId;
      },

      /**
       * Check if user can manage a specific tenant
       */
      can_manage_tenant: (targetTenantId: string): boolean => {
        // Super admins can manage any tenant
        if (user.role === UserRole.SUPER_ADMIN) {
          return true;
        }

        // Tenant admins can manage their own tenant
        if (user.role === UserRole.TENANT_ADMIN && user.tenant_id === targetTenantId) {
          return true;
        }

        return false;
      },
    };
  }

  /**
   * Validate tenant access for API requests
   */
  static validateTenantAccess(
    context: TenantContext,
    targetTenantId: string,
    operation: 'read' | 'write' | 'admin' = 'read'
  ): { allowed: boolean; reason?: string } {
    // Check basic tenant access
    if (!context.can_access_tenant(targetTenantId)) {
      return {
        allowed: false,
        reason: 'User does not have access to this tenant',
      };
    }

    // Check operation-specific permissions
    switch (operation) {
      case 'read':
        // All roles can read within their tenant
        return { allowed: true };

      case 'write':
        // Analysts and above can write within their tenant
        if (context.role === UserRole.USER) {
          return {
            allowed: false,
            reason: 'User role does not have write permissions',
          };
        }
        return { allowed: true };

      case 'admin':
        // Only tenant admins and super admins can perform admin operations
        if (!context.can_manage_tenant(targetTenantId)) {
          return {
            allowed: false,
            reason: 'User does not have admin permissions for this tenant',
          };
        }
        return { allowed: true };

      default:
        return {
          allowed: false,
          reason: 'Invalid operation type',
        };
    }
  }

  /**
   * Extract tenant ID from request path or body
   */
  static extractTenantId(request: NextRequest, pathParam?: string): string | null {
    // Try to get from path parameters first
    if (pathParam) {
      return pathParam;
    }

    // Try to get from URL path
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');

    // Look for tenant ID in common patterns
    const tenantIndex = pathSegments.findIndex(segment => segment === 'tenants');
    if (tenantIndex !== -1 && pathSegments[tenantIndex + 1]) {
      return pathSegments[tenantIndex + 1];
    }

    return null;
  }

  /**
   * Middleware function for tenant isolation
   */
  static async enforceTenantIsolation(
    request: NextRequest,
    context: TenantContext,
    targetTenantId: string,
    operation: 'read' | 'write' | 'admin' = 'read'
  ): Promise<{ success: boolean; error?: string }> {
    const validation = this.validateTenantAccess(context, targetTenantId, operation);

    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason || 'Access denied',
      };
    }

    return { success: true };
  }

  /**
   * Get tenant-specific database schema name
   */
  static getTenantSchemaName(tenantId: string): string {
    return `tenant_${tenantId.replace(/-/g, '_')}`;
  }

  /**
   * Validate that a resource belongs to the correct tenant
   */
  static validateResourceTenant(
    resourceTenantId: string,
    expectedTenantId: string,
    context: TenantContext
  ): { valid: boolean; error?: string } {
    // Super admins can access resources from any tenant
    if (context.role === UserRole.SUPER_ADMIN) {
      return { valid: true };
    }

    // For other roles, resource must belong to their tenant
    if (resourceTenantId !== expectedTenantId) {
      return {
        valid: false,
        error: 'Resource does not belong to the expected tenant',
      };
    }

    // Also validate that the user can access this tenant
    if (!context.can_access_tenant(resourceTenantId)) {
      return {
        valid: false,
        error: 'User does not have access to this tenant',
      };
    }

    return { valid: true };
  }

  /**
   * Filter query results to only include tenant-accessible data
   */
  static filterByTenantAccess<T extends { tenant_id: string }>(
    results: T[],
    context: TenantContext
  ): T[] {
    // Super admins see all data
    if (context.role === UserRole.SUPER_ADMIN) {
      return results;
    }

    // Other roles only see data from their tenant
    return results.filter(item =>
      context.can_access_tenant(item.tenant_id)
    );
  }
}

/**
 * Convenience function for API routes
 */
export async function tenantMiddleware(
  request: NextRequest,
  user: JWTPayload
): Promise<{
  success: boolean;
  tenant?: { id: string };
  error?: { code: string; message: string };
}> {
  try {
    // Development mode bypass
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      return {
        success: true,
        tenant: { id: 'acme-corp' }, // Use the same tenant ID as in mock users
      };
    }

    const context = TenantMiddleware.createTenantContext(user);

    return {
      success: true,
      tenant: { id: context.tenant_id },
    };
  } catch (error) {
    console.error('Tenant middleware error:', error);
    return {
      success: false,
      error: {
        code: 'TENANT_ERROR',
        message: 'Failed to process tenant context',
      },
    };
  }
}