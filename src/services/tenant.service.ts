import { eq, and, desc, count, sql } from 'drizzle-orm';
import { db } from '../lib/database';
import { tenants, users, auditLogs } from '../../database/schemas/main';
import { TenantSchemaManager } from '../lib/tenant-schema';
import { Tenant, TenantSettings, UserRole, AuditLog, PaginationParams } from '../types';
import { demoTenantStore } from '../lib/demo-tenant-store';

export interface CreateTenantRequest {
  name: string;
  domain: string;
  logo_url?: string;
  theme_color?: string;
  settings?: Partial<TenantSettings>;
}

export interface UpdateTenantRequest {
  name?: string;
  domain?: string;
  logo_url?: string;
  theme_color?: string;
  settings?: Partial<TenantSettings>;
  is_active?: boolean;
}

export interface TenantFilters extends PaginationParams {
  is_active?: boolean;
  search?: string;
}

export interface TenantMetrics {
  total_users: number;
  active_users: number;
  total_tickets: number;
  open_tickets: number;
  total_alerts: number;
  unresolved_alerts: number;
  storage_used_mb: number;
  last_activity: Date | null;
}

export class TenantService {
  /**
   * Create a new tenant
   */
  static async createTenant(
    data: CreateTenantRequest,
    createdBy: string,
    creatorRole: UserRole
  ): Promise<Tenant> {
    // Only super admins can create tenants
    if (creatorRole !== UserRole.SUPER_ADMIN) {
      throw new Error('Insufficient permissions to create tenant');
    }

    // Use demo mode in development with bypass mode
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      // Check if domain already exists in demo store
      if (demoTenantStore.tenantExists(data.domain)) {
        throw new Error('Tenant with this domain already exists');
      }

      // Generate a new tenant ID
      const newTenantId = `tenant-${Date.now()}`;
      
      // Default tenant settings
      const defaultSettings: TenantSettings = {
        max_users: data.settings?.max_users || 100,
        features_enabled: data.settings?.features_enabled || ['tickets', 'alerts', 'compliance', 'reports'],
        notification_settings: {
          email_enabled: data.settings?.notification_settings?.email_enabled ?? true,
          sms_enabled: data.settings?.notification_settings?.sms_enabled ?? false,
          push_enabled: data.settings?.notification_settings?.push_enabled ?? true,
          digest_frequency: data.settings?.notification_settings?.digest_frequency || 'daily',
        },
        sla_settings: {
          response_time_hours: data.settings?.sla_settings?.response_time_hours || 4,
          resolution_time_hours: data.settings?.sla_settings?.resolution_time_hours || 24,
          escalation_enabled: data.settings?.sla_settings?.escalation_enabled ?? true,
          escalation_time_hours: data.settings?.sla_settings?.escalation_time_hours || 8,
        },
        branding: {
          primary_color: data.settings?.branding?.primary_color || '#00D4FF',
          secondary_color: data.settings?.branding?.secondary_color || '#0A1628',
          logo_url: data.logo_url,
          favicon_url: data.settings?.branding?.favicon_url,
        },
      };

      // Create new tenant object
      const newTenant: Tenant = {
        id: newTenantId,
        name: data.name,
        domain: data.domain,
        logo_url: data.logo_url || null,
        theme_color: data.theme_color || '#00D4FF',
        settings: defaultSettings,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Add to demo store
      demoTenantStore.addTenant(newTenant);
      
      return newTenant;
    }

    // Check if domain already exists
    const existingTenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.domain, data.domain))
      .limit(1);

    if (existingTenant.length > 0) {
      throw new Error('Tenant with this domain already exists');
    }    
// Default tenant settings
    const defaultSettings: TenantSettings = {
      max_users: 100,
      features_enabled: ['tickets', 'alerts', 'compliance', 'reports'],
      notification_settings: {
        email_enabled: true,
        sms_enabled: false,
        push_enabled: true,
        digest_frequency: 'daily',
      },
      sla_settings: {
        response_time_hours: 4,
        resolution_time_hours: 24,
        escalation_enabled: true,
        escalation_time_hours: 8,
      },
      branding: {
        primary_color: '#00D4FF',
        secondary_color: '#0A1628',
        logo_url: data.logo_url,
        favicon_url: undefined,
      },
      ...data.settings,
    };

    // Create tenant
    const [newTenant] = await db
      .insert(tenants)
      .values({
        name: data.name,
        domain: data.domain,
        logo_url: data.logo_url,
        theme_color: data.theme_color || '#00D4FF',
        settings: defaultSettings,
        is_active: true,
      })
      .returning();

    // Create tenant-specific database schema
    try {
      await TenantSchemaManager.createTenantSchema(newTenant.id);
    } catch (error) {
      // Rollback tenant creation if schema creation fails
      await db.delete(tenants).where(eq(tenants.id, newTenant.id));
      throw new Error(`Failed to create tenant schema: ${error}`);
    }

    // Log audit event
    await this.logAuditEvent({
      user_id: createdBy,
      action: 'tenant.created',
      resource_type: 'tenant',
      resource_id: newTenant.id,
      details: {
        name: data.name,
        domain: data.domain,
      },
    });

    return {
      ...newTenant,
      logo_url: newTenant.logo_url || undefined,
    } as Tenant;
  }

  /**
   * Get tenant by ID
   */
  static async getTenantById(
    tenantId: string,
    requesterId: string,
    requesterRole: UserRole,
    requesterTenantId: string
  ): Promise<Tenant | null> {
    // Check permissions
    if (requesterRole !== UserRole.SUPER_ADMIN && requesterTenantId !== tenantId) {
      throw new Error('Insufficient permissions to access this tenant');
    }

    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (tenant.length === 0) {
      return null;
    }

    return {
      ...tenant[0],
      logo_url: tenant[0].logo_url || undefined,
    } as Tenant;
  }

  /**
   * Get tenant by domain
   */
  static async getTenantByDomain(domain: string): Promise<Tenant | null> {
    const tenant = await db
      .select()
      .from(tenants)
      .where(and(eq(tenants.domain, domain), eq(tenants.is_active, true)))
      .limit(1);

    if (tenant.length === 0) {
      return null;
    }

    return {
      ...tenant[0],
      logo_url: tenant[0].logo_url || undefined,
    } as Tenant;
  }  /*
*
   * List tenants with filters and pagination
   */
  static async listTenants(
    filters: TenantFilters,
    requesterId: string,
    requesterRole: UserRole,
    requesterTenantId: string
  ): Promise<{
    tenants: Tenant[];
    total: number;
    page: number;
    limit: number;
  }> {
    // Only super admins can list all tenants
    if (requesterRole !== UserRole.SUPER_ADMIN) {
      throw new Error('Insufficient permissions to list tenants');
    }

    // Use demo data in development with bypass mode
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      // Get all tenants from demo store
      const allTenants = demoTenantStore.getAllTenants();

      // Apply filters
      let filteredTenants = allTenants;

      if (filters.is_active !== undefined) {
        filteredTenants = filteredTenants.filter(tenant => tenant.is_active === filters.is_active);
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredTenants = filteredTenants.filter(tenant => 
          tenant.name.toLowerCase().includes(searchLower) ||
          tenant.domain.toLowerCase().includes(searchLower)
        );
      }

      // Apply pagination
      const page = filters.page || 1;
      const limit = Math.min(filters.limit || 20, 100);
      const offset = (page - 1) * limit;
      const paginatedTenants = filteredTenants.slice(offset, offset + limit);

      return {
        tenants: paginatedTenants,
        total: filteredTenants.length,
        page,
        limit,
      };
    }

    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];

    if (filters.is_active !== undefined) {
      conditions.push(eq(tenants.is_active, filters.is_active));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(tenants)
      .where(whereClause);

    // Get tenants
    const tenantList = await db
      .select()
      .from(tenants)
      .where(whereClause)
      .orderBy(desc(tenants.created_at))
      .limit(limit)
      .offset(offset);

    return {
      tenants: tenantList.map(tenant => ({
        ...tenant,
        logo_url: tenant.logo_url || undefined,
      })) as Tenant[],
      total: totalCount,
      page,
      limit,
    };
  }

  /**
   * Update tenant
   */
  static async updateTenant(
    tenantId: string,
    data: UpdateTenantRequest,
    updatedBy: string,
    updaterRole: UserRole,
    updaterTenantId: string
  ): Promise<Tenant> {
    // Check permissions
    const canUpdate = 
      updaterRole === UserRole.SUPER_ADMIN || 
      (updaterRole === UserRole.TENANT_ADMIN && updaterTenantId === tenantId);

    if (!canUpdate) {
      throw new Error('Insufficient permissions to update this tenant');
    }

    // Get existing tenant
    const existingTenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (existingTenant.length === 0) {
      throw new Error('Tenant not found');
    }

    const tenant = existingTenant[0];

    // Check if domain is being changed and if it already exists
    if (data.domain && data.domain !== tenant.domain) {
      const domainExists = await db
        .select()
        .from(tenants)
        .where(and(eq(tenants.domain, data.domain), eq(tenants.id, tenantId)))
        .limit(1);

      if (domainExists.length > 0) {
        throw new Error('Tenant with this domain already exists');
      }
    }

    // Merge settings if provided
    let updatedSettings = tenant.settings as TenantSettings;
    if (data.settings) {
      updatedSettings = {
        ...(tenant.settings as TenantSettings),
        ...data.settings,
      } as TenantSettings;
    }

    // Update tenant
    const [updatedTenant] = await db
      .update(tenants)
      .set({
        ...data,
        settings: updatedSettings,
        updated_at: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning();

    // Log audit event
    await this.logAuditEvent({
      tenant_id: tenantId,
      user_id: updatedBy,
      action: 'tenant.updated',
      resource_type: 'tenant',
      resource_id: tenantId,
      details: {
        changes: data,
        previous: {
          name: tenant.name,
          domain: tenant.domain,
          is_active: tenant.is_active,
        },
      },
    });

    return {
      ...updatedTenant,
      logo_url: updatedTenant.logo_url || undefined,
    } as Tenant;
  }  
/**
   * Delete tenant (soft delete by deactivating)
   */
  static async deleteTenant(
    tenantId: string,
    deletedBy: string,
    deleterRole: UserRole
  ): Promise<void> {
    // Only super admins can delete tenants
    if (deleterRole !== UserRole.SUPER_ADMIN) {
      throw new Error('Insufficient permissions to delete tenant');
    }

    // Use demo mode in development with bypass mode
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      // Check if tenant exists in demo store
      const tenant = demoTenantStore.getTenant(tenantId);
      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Remove tenant from demo store (hard delete for demo)
      const deleted = demoTenantStore.deleteTenant(tenantId);
      if (!deleted) {
        throw new Error('Failed to delete tenant');
      }

      return;
    }

    // Get existing tenant
    const existingTenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (existingTenant.length === 0) {
      throw new Error('Tenant not found');
    }

    const tenant = existingTenant[0];

    // Deactivate tenant instead of hard delete
    await db
      .update(tenants)
      .set({
        is_active: false,
        updated_at: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    // Deactivate all users in the tenant
    await db
      .update(users)
      .set({
        is_active: false,
        updated_at: new Date(),
      })
      .where(eq(users.tenant_id, tenantId));

    // Log audit event
    await this.logAuditEvent({
      tenant_id: tenantId,
      user_id: deletedBy,
      action: 'tenant.deleted',
      resource_type: 'tenant',
      resource_id: tenantId,
      details: {
        name: tenant.name,
        domain: tenant.domain,
      },
    });
  }

  /**
   * Get tenant metrics and usage statistics
   */
  static async getTenantMetrics(
    tenantId: string,
    requesterId: string,
    requesterRole: UserRole,
    requesterTenantId: string
  ): Promise<TenantMetrics> {
    // Check permissions
    const canView = 
      requesterRole === UserRole.SUPER_ADMIN || 
      (requesterTenantId === tenantId && 
       (requesterRole === UserRole.TENANT_ADMIN || requesterRole === UserRole.SECURITY_ANALYST || requesterRole === UserRole.IT_HELPDESK_ANALYST));

    if (!canView) {
      throw new Error('Insufficient permissions to view tenant metrics');
    }

    // Get user metrics
    const [userMetrics] = await db
      .select({
        total_users: count(),
        active_users: sql<number>`COUNT(CASE WHEN is_active = true THEN 1 END)`,
      })
      .from(users)
      .where(eq(users.tenant_id, tenantId));

    // Get last activity from audit logs
    const [lastActivity] = await db
      .select({
        last_activity: sql<Date>`MAX(created_at)`,
      })
      .from(auditLogs)
      .where(eq(auditLogs.tenant_id, tenantId));

    // For now, return mock data for tenant-specific metrics
    // In a real implementation, these would query the tenant-specific schemas
    return {
      total_users: userMetrics.total_users || 0,
      active_users: userMetrics.active_users || 0,
      total_tickets: 0, // Would query tenant schema
      open_tickets: 0, // Would query tenant schema
      total_alerts: 0, // Would query tenant schema
      unresolved_alerts: 0, // Would query tenant schema
      storage_used_mb: 0, // Would calculate from file storage
      last_activity: lastActivity.last_activity || null,
    };
  }

  /**
   * Generate tenant-specific mock users for development
   */
  private static generateTenantSpecificUsers(tenantId: string) {
    // Only return ACME Corporation users
    const acmeUsers = [
      {
        id: 'acme-1',
        tenant_id: tenantId,
        email: 'admin@acme-corp.com',
        first_name: 'John',
        last_name: 'Smith',
        role: UserRole.TENANT_ADMIN,
        mfa_enabled: true,
        last_login: new Date('2024-01-16T08:00:00Z'),
        is_active: true,
        created_at: new Date('2023-12-01T00:00:00Z'),
        updated_at: new Date('2024-01-16T08:00:00Z'),
      },
      {
        id: 'acme-2',
        tenant_id: tenantId,
        email: 'sarah.connor@acme-corp.com',
        first_name: 'Sarah',
        last_name: 'Connor',
        role: UserRole.SECURITY_ANALYST,
        mfa_enabled: true,
        last_login: new Date('2024-01-15T16:30:00Z'),
        is_active: true,
        created_at: new Date('2023-12-01T00:00:00Z'),
        updated_at: new Date('2024-01-15T16:30:00Z'),
      },
      {
        id: 'acme-3',
        tenant_id: tenantId,
        email: 'mike.tech@acme-corp.com',
        first_name: 'Mike',
        last_name: 'Tech',
        role: UserRole.IT_HELPDESK_ANALYST,
        mfa_enabled: false,
        last_login: new Date('2024-01-16T11:20:00Z'),
        is_active: true,
        created_at: new Date('2023-12-01T00:00:00Z'),
        updated_at: new Date('2024-01-16T11:20:00Z'),
      },
      {
        id: 'acme-4',
        tenant_id: tenantId,
        email: 'alice.wonder@acme-corp.com',
        first_name: 'Alice',
        last_name: 'Wonder',
        role: UserRole.USER,
        mfa_enabled: false,
        last_login: new Date('2024-01-14T09:45:00Z'),
        is_active: true,
        created_at: new Date('2023-12-01T00:00:00Z'),
        updated_at: new Date('2024-01-14T09:45:00Z'),
      },
    ];

    return acmeUsers;
  }

  /**
   * Get tenant users with role management
   */
  static async getTenantUsers(
    tenantId: string,
    filters: PaginationParams & { role?: UserRole; is_active?: boolean },
    requesterId: string,
    requesterRole: UserRole,
    requesterTenantId: string
  ): Promise<{
    users: Omit<any, 'password_hash' | 'mfa_secret'>[];
    total: number;
    page: number;
    limit: number;
  }> {
    // Check permissions
    const canView = 
      requesterRole === UserRole.SUPER_ADMIN || 
      (requesterTenantId === tenantId && 
       (requesterRole === UserRole.TENANT_ADMIN || requesterRole === UserRole.SECURITY_ANALYST || requesterRole === UserRole.IT_HELPDESK_ANALYST));

    if (!canView) {
      throw new Error('Insufficient permissions to view tenant users');
    }

    // Use mock data in development
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      const mockUsers = this.generateTenantSpecificUsers(tenantId);

      // Apply filters
      let filteredUsers = mockUsers;

      if (filters.role) {
        filteredUsers = filteredUsers.filter(user => user.role === filters.role);
      }

      if (filters.is_active !== undefined) {
        filteredUsers = filteredUsers.filter(user => user.is_active === filters.is_active);
      }

      const page = filters.page || 1;
      const limit = Math.min(filters.limit || 20, 100);
      const offset = (page - 1) * limit;
      const paginatedUsers = filteredUsers.slice(offset, offset + limit);

      return {
        users: paginatedUsers,
        total: filteredUsers.length,
        page,
        limit,
      };
    }

    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(users.tenant_id, tenantId)];

    if (filters.role) {
      conditions.push(eq(users.role, filters.role));
    }

    if (filters.is_active !== undefined) {
      conditions.push(eq(users.is_active, filters.is_active));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(users)
      .where(whereClause);

    // Get users
    const userList = await db
      .select({
        id: users.id,
        tenant_id: users.tenant_id,
        email: users.email,
        first_name: users.first_name,
        last_name: users.last_name,
        role: users.role,
        mfa_enabled: users.mfa_enabled,
        last_login: users.last_login,
        is_active: users.is_active,
        created_at: users.created_at,
        updated_at: users.updated_at,
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.created_at))
      .limit(limit)
      .offset(offset);

    return {
      users: userList,
      total: totalCount,
      page,
      limit,
    };
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

  /**
   * Get all tenants (for SLA monitoring)
   */
  static async getAllTenants(): Promise<Tenant[]> {
    const tenantList = await db
      .select()
      .from(tenants)
      .orderBy(desc(tenants.created_at));

    return tenantList.map(tenant => ({
      ...tenant,
      settings: typeof tenant.settings === 'string' 
        ? JSON.parse(tenant.settings) 
        : tenant.settings
    })) as Tenant[];
  }
}