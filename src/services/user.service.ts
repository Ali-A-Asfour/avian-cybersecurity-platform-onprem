import { eq, and, desc, count } from 'drizzle-orm';
// import { db } from '../lib/database';
import { users, tenants, auditLogs } from '../../database/schemas/main';
import { AuthService, RBACService } from '../lib/auth';
import { SessionService } from '../lib/redis';
import { User, UserRole, AuditLog, PaginationParams } from '../types';

export interface CreateUserRequest {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  role: UserRole;
  tenant_id: string;
  mfa_enabled?: boolean;
}

export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
  role?: UserRole;
  is_active?: boolean;
  mfa_enabled?: boolean;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface UserFilters extends PaginationParams {
  tenant_id?: string;
  role?: UserRole;
  is_active?: boolean;
  search?: string;
}

export class UserService {
  /**
   * Create a new user
   */
  static async createUser(
    data: CreateUserRequest,
    createdBy: string,
    creatorRole: UserRole,
    creatorTenantId: string
  ): Promise<Omit<User, 'password_hash' | 'mfa_secret'>> {
    // Validate permissions
    if (!RBACService.canAccessTenant(creatorTenantId, data.tenant_id, creatorRole)) {
      throw new Error('Insufficient permissions to create user in this tenant');
    }

    if (!RBACService.canManageUser(creatorRole, data.role, creatorTenantId === data.tenant_id)) {
      throw new Error('Insufficient permissions to create user with this role');
    }

    // Check if email already exists in tenant
    const existingUser = await db
      .select()
      .from(users)
      .where(and(eq(users.email, data.email), eq(users.tenant_id, data.tenant_id)))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error('User with this email already exists in the tenant');
    }

    // Verify tenant exists
    const _tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, data.tenant_id))
      .limit(1);

    if (tenant.length === 0) {
      throw new Error('Tenant not found');
    }

    // Hash password
    const passwordHash = await AuthService.hashPassword(data.password);

    // Generate MFA secret if enabled
    let mfaSecret: string | undefined;
    if (data.mfa_enabled) {
      mfaSecret = AuthService.generateMFASecret();
    }

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        role: data.role,
        tenant_id: data.tenant_id,
        password_hash: passwordHash,
        mfa_enabled: data.mfa_enabled || false,
        mfa_secret: mfaSecret,
        is_active: true,
      })
      .returning();

    // Log audit event
    await this.logAuditEvent({
      tenant_id: data.tenant_id,
      user_id: createdBy,
      action: 'user.created',
      resource_type: 'user',
      resource_id: newUser.id,
      details: {
        email: data.email,
        role: data.role,
        tenant_id: data.tenant_id,
      },
    });

    // Return user without sensitive fields
    const { password_hash, mfa_secret, ...userResponse } = newUser;
    return {
      ...userResponse,
      role: userResponse.role as UserRole,
      last_login: userResponse.last_login || undefined,
    };
  }

  /**
   * Get user by ID
   */
  static async getUserById(
    userId: string,
    requesterId: string,
    requesterRole: UserRole,
    requesterTenantId: string
  ): Promise<Omit<User, 'password_hash' | 'mfa_secret'> | null> {
    const _user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return null;
    }

    const foundUser = user[0];

    // Check permissions
    if (!RBACService.canAccessTenant(requesterTenantId, foundUser.tenant_id, requesterRole)) {
      throw new Error('Insufficient permissions to access this user');
    }

    // Return user without sensitive fields
    const { password_hash, mfa_secret, ...userResponse } = foundUser;
    return {
      ...userResponse,
      role: userResponse.role as UserRole,
      last_login: userResponse.last_login || undefined,
    };
  }

  /**
   * Get user by email and tenant
   */
  static async getUserByEmail(email: string, tenantId: string): Promise<User | null> {
    const _user = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.tenant_id, tenantId)))
      .limit(1);

    return user.length > 0 ? {
      ...user[0],
      role: user[0].role as UserRole,
      last_login: user[0].last_login || undefined,
    } as User : null;
  }

  /**
   * List users with filters and pagination
   */
  static async listUsers(
    filters: UserFilters,
    requesterId: string,
    requesterRole: UserRole,
    requesterTenantId: string
  ): Promise<{
    users: Omit<User, 'password_hash' | 'mfa_secret'>[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];

    // Tenant access control
    if (requesterRole === UserRole.SUPER_ADMIN) {
      // Super admins can see users from all tenants
      if (filters.tenant_id) {
        conditions.push(eq(users.tenant_id, filters.tenant_id));
      }
    } else {
      // Other roles can only see users from their tenant
      conditions.push(eq(users.tenant_id, requesterTenantId));
    }

    if (filters.role) {
      conditions.push(eq(users.role, filters.role));
    }

    if (filters.is_active !== undefined) {
      conditions.push(eq(users.is_active, filters.is_active));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(users)
      .where(whereClause);

    // Get users
    const userList = await db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.created_at))
      .limit(limit)
      .offset(offset);

    // Remove sensitive fields
    const sanitizedUsers = userList.map(({ password_hash, mfa_secret, ...user }) => ({
      ...user,
      role: user.role as UserRole,
      last_login: user.last_login || undefined,
    }));

    return {
      users: sanitizedUsers,
      total: totalCount,
      page,
      limit,
    };
  }

  /**
   * Update user
   */
  static async updateUser(
    userId: string,
    data: UpdateUserRequest,
    updatedBy: string,
    updaterRole: UserRole,
    updaterTenantId: string
  ): Promise<Omit<User, 'password_hash' | 'mfa_secret'>> {
    // Get existing user
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      throw new Error('User not found');
    }

    const _user = existingUser[0];

    // Check permissions
    if (!RBACService.canAccessTenant(updaterTenantId, user.tenant_id, updaterRole)) {
      throw new Error('Insufficient permissions to update this user');
    }

    if (data.role && !RBACService.canManageUser(updaterRole, data.role, updaterTenantId === user.tenant_id)) {
      throw new Error('Insufficient permissions to assign this role');
    }

    // Update user
    const [updatedUser] = await db
      .update(users)
      .set({
        ...data,
        updated_at: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    // Log audit event
    await this.logAuditEvent({
      tenant_id: user.tenant_id,
      user_id: updatedBy,
      action: 'user.updated',
      resource_type: 'user',
      resource_id: userId,
      details: {
        changes: data,
        previous: {
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          is_active: user.is_active,
          mfa_enabled: user.mfa_enabled,
        },
      },
    });

    // Return user without sensitive fields
    const { password_hash, mfa_secret, ...userResponse } = updatedUser;
    return {
      ...userResponse,
      role: userResponse.role as UserRole,
      last_login: userResponse.last_login || undefined,
    };
  }

  /**
   * Change user password
   */
  static async changePassword(
    userId: string,
    data: ChangePasswordRequest,
    requesterId: string,
    requesterRole: UserRole,
    requesterTenantId: string
  ): Promise<void> {
    // Get existing user
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      throw new Error('User not found');
    }

    const _user = existingUser[0];

    // Check permissions (users can change their own password, or admins can change others)
    const canChange = 
      userId === requesterId || 
      RBACService.canManageUser(requesterRole, user.role as UserRole, requesterTenantId === user.tenant_id);

    if (!canChange) {
      throw new Error('Insufficient permissions to change password');
    }

    // Verify current password (only if user is changing their own password)
    if (userId === requesterId) {
      const isValidPassword = await AuthService.verifyPassword(data.current_password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }
    }

    // Hash new password
    const newPasswordHash = await AuthService.hashPassword(data.new_password);

    // Update password
    await db
      .update(users)
      .set({
        password_hash: newPasswordHash,
        updated_at: new Date(),
      })
      .where(eq(users.id, userId));

    // Invalidate all sessions for this user
    await SessionService.deleteSession(userId);
    await SessionService.deleteRefreshToken(userId);

    // Log audit event
    await this.logAuditEvent({
      tenant_id: user.tenant_id,
      user_id: requesterId,
      action: 'user.password_changed',
      resource_type: 'user',
      resource_id: userId,
      details: {
        changed_by_self: userId === requesterId,
      },
    });
  }

  /**
   * Delete user (soft delete by deactivating)
   */
  static async deleteUser(
    userId: string,
    deletedBy: string,
    deleterRole: UserRole,
    deleterTenantId: string
  ): Promise<void> {
    // Get existing user
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (existingUser.length === 0) {
      throw new Error('User not found');
    }

    const _user = existingUser[0];

    // Check permissions
    if (!RBACService.canManageUser(deleterRole, user.role as UserRole, deleterTenantId === user.tenant_id)) {
      throw new Error('Insufficient permissions to delete this user');
    }

    // Prevent self-deletion
    if (userId === deletedBy) {
      throw new Error('Cannot delete your own account');
    }

    // Deactivate user instead of hard delete
    await db
      .update(users)
      .set({
        is_active: false,
        updated_at: new Date(),
      })
      .where(eq(users.id, userId));

    // Invalidate all sessions for this user
    await SessionService.deleteSession(userId);
    await SessionService.deleteRefreshToken(userId);

    // Log audit event
    await this.logAuditEvent({
      tenant_id: user.tenant_id,
      user_id: deletedBy,
      action: 'user.deleted',
      resource_type: 'user',
      resource_id: userId,
      details: {
        email: user.email,
        role: user.role,
      },
    });
  }

  /**
   * Setup MFA for user
   */
  static async setupMFA(_userId: string): Promise<{ secret: string; qr_code_url: string }> {
    const _user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      throw new Error('User not found');
    }

    const mfaSecret = AuthService.generateMFASecret();

    // Update user with MFA secret (but don't enable MFA yet)
    await db
      .update(users)
      .set({
        mfa_secret: mfaSecret,
        updated_at: new Date(),
      })
      .where(eq(users.id, userId));

    // Generate QR code URL for authenticator apps
    const qrCodeUrl = `otpauth://totp/AVIAN:${user[0].email}?secret=${mfaSecret}&issuer=AVIAN`;

    return {
      secret: mfaSecret,
      qr_code_url: qrCodeUrl,
    };
  }

  /**
   * Enable MFA for user (after verification)
   */
  static async enableMFA(userId: string, verificationCode: string): Promise<void> {
    const _user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      throw new Error('User not found');
    }

    if (!user[0].mfa_secret) {
      throw new Error('MFA not set up for this user');
    }

    // Verify the code (simplified - in production, use proper TOTP library)
    // For now, we'll just check if the code is provided
    if (!verificationCode || verificationCode.length !== 6) {
      throw new Error('Invalid verification code');
    }

    // Enable MFA
    await db
      .update(users)
      .set({
        mfa_enabled: true,
        updated_at: new Date(),
      })
      .where(eq(users.id, userId));

    // Log audit event
    await this.logAuditEvent({
      tenant_id: user[0].tenant_id,
      user_id: userId,
      action: 'user.mfa_enabled',
      resource_type: 'user',
      resource_id: userId,
      details: {},
    });
  }

  /**
   * Disable MFA for user
   */
  static async disableMFA(_userId: string): Promise<void> {
    const _user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Disable MFA and clear secret
    await db
      .update(users)
      .set({
        mfa_enabled: false,
        mfa_secret: null,
        updated_at: new Date(),
      })
      .where(eq(users.id, userId));

    // Log audit event
    await this.logAuditEvent({
      tenant_id: user[0].tenant_id,
      user_id: userId,
      action: 'user.mfa_disabled',
      resource_type: 'user',
      resource_id: userId,
      details: {},
    });
  }

  /**
   * Get users by roles (for workflow service)
   */
  static async getUsersByRoles(tenantId: string, roles: UserRole[]): Promise<User[]> {
    const userList = await db
      .select()
      .from(users)
      .where(and(
        eq(users.tenant_id, tenantId),
        eq(users.is_active, true)
      ));

    // Filter by roles in memory since drizzle doesn't have a direct "in" for enums
    const filteredUsers = userList.filter(user => roles.includes(user.role as UserRole));

    return filteredUsers.map(user => ({
      ...user,
      role: user.role as UserRole,
      last_login: user.last_login || undefined,
    })) as User[];
  }

  /**
   * Get user by email (simplified version for workflow service)
   */
  static async getUserByEmailSimple(tenantId: string, email: string): Promise<User | null> {
    const _user = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.tenant_id, tenantId)))
      .limit(1);

    return user.length > 0 ? {
      ...user[0],
      role: user[0].role as UserRole,
      last_login: user[0].last_login || undefined,
    } as User : null;
  }

  /**
   * Get user by ID (simplified version for workflow service)
   */
  static async getUserByIdSimple(tenantId: string, userId: string): Promise<User | null> {
    const _user = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenant_id, tenantId)))
      .limit(1);

    return user.length > 0 ? {
      ...user[0],
      role: user[0].role as UserRole,
      last_login: user[0].last_login || undefined,
    } as User : null;
  }

  /**
   * Log audit event
   */
  private static async logAuditEvent(event: Omit<AuditLog, 'id' | 'created_at'>): Promise<void> {
    await db.insert(auditLogs).values({
      ...event,
      created_at: new Date(),
    });
  }
}