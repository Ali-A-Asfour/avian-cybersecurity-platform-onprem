import { sign, verify, SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from './config';
import { JWTPayload, UserRole } from '../types';

// JWT token utilities
export class AuthService {
  /**
   * Generate access token
   */
  static generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    const options: SignOptions = {
      expiresIn: config.jwt.expiresIn as any,
    };
    return sign(payload as object, config.jwt.secret, options);
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    const options: SignOptions = {
      expiresIn: config.jwt.refreshExpiresIn as any,
    };
    return sign(payload as object, config.jwt.refreshSecret, options);
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      return verify(token, config.jwt.secret) as JWTPayload;
    } catch {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): JWTPayload {
    try {
      return verify(token, config.jwt.refreshSecret) as JWTPayload;
    } catch {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Hash password
   */
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate secure random string for MFA secret
   */
  static generateMFASecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Authenticate request and extract user info
   */
  static async authenticateRequest(request: Request): Promise<{
    success: boolean;
    user?: JWTPayload & { tenant_id: string; role: UserRole };
    error?: string;
  }> {
    try {
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { success: false, error: 'No authorization header' };
      }

      const token = authHeader.substring(7);
      const payload = this.verifyAccessToken(token);

      return {
        success: true,
        user: payload as JWTPayload & { tenant_id: string; role: UserRole },
      };
    } catch {
      return { success: false, error: 'Invalid token' };
    }
  }
}

// Role-based access control utilities
export class RBACService {
  private static roleHierarchy: Record<UserRole, number> = {
    [UserRole.SUPER_ADMIN]: 4,
    [UserRole.TENANT_ADMIN]: 3,
    [UserRole.SECURITY_ANALYST]: 2,
    [UserRole.IT_HELPDESK_ANALYST]: 2,
    [UserRole.USER]: 1,
  };

  /**
   * Check if user has required role or higher
   */
  static hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
    return this.roleHierarchy[userRole] >= this.roleHierarchy[requiredRole];
  }

  /**
   * Check if user can access tenant
   */
  static canAccessTenant(userTenantId: string, targetTenantId: string, userRole: UserRole): boolean {
    // Super admins can access any tenant
    if (userRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Other roles can only access their own tenant
    return userTenantId === targetTenantId;
  }

  /**
   * Check if user can manage other users
   */
  static canManageUser(managerRole: UserRole, targetRole: UserRole, sameTenant: boolean): boolean {
    // Super admins can manage anyone
    if (managerRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Tenant admins can manage users in their tenant (except super admins)
    if (managerRole === UserRole.TENANT_ADMIN && sameTenant) {
      return targetRole !== UserRole.SUPER_ADMIN;
    }

    return false;
  }

  /**
   * Get permissions for role
   */
  static getPermissions(role: UserRole): string[] {
    const permissions: Record<UserRole, string[]> = {
      [UserRole.SUPER_ADMIN]: [
        'platform:manage',
        'tenants:create',
        'tenants:read',
        'tenants:update',
        'tenants:delete',
        'users:create',
        'users:read',
        'users:update',
        'users:delete',
        'audit:read',
        'system:configure',
      ],
      [UserRole.TENANT_ADMIN]: [
        'tenant:manage',
        'users:create',
        'users:read',
        'users:update',
        'users:delete',
        'tickets:create',
        'tickets:read',
        'tickets:update',
        'tickets:delete',
        'alerts:read',
        'alerts:update',
        'compliance:read',
        'compliance:update',
        'reports:generate',
      ],
      [UserRole.SECURITY_ANALYST]: [
        'tickets:create',
        'tickets:read',
        'tickets:update',
        'alerts:read',
        'alerts:update',
        'compliance:read',
        'reports:read',
      ],
      [UserRole.IT_HELPDESK_ANALYST]: [
        'tickets:create',
        'tickets:read',
        'tickets:update',
        'reports:read',
      ],
      [UserRole.USER]: [
        'tickets:read',
        'alerts:read',
        'compliance:read',
        'reports:read',
      ],
    };

    return permissions[role] || [];
  }

  /**
   * Check if user has specific permission
   */
  static hasPermission(role: UserRole, permission: string): boolean {
    const permissions = this.getPermissions(role);
    return permissions.includes(permission);
  }
}

/**
 * Get current user from request context
 * This is a simplified version for the knowledge base implementation
 */
export async function getCurrentUser(): Promise<{
  id: string;
  tenant_id: string;
  role: string;
  email?: string;
} | null> {
  // In a real implementation, this would extract the user from the request context
  // For now, we'll return a mock user for development/testing
  // This should be replaced with actual authentication logic

  try {
    // Mock user for development - replace with actual auth logic
    return {
      id: 'user-123',
      tenant_id: 'tenant-123',
      role: 'help_desk_analyst',
      email: 'analyst@example.com',
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}