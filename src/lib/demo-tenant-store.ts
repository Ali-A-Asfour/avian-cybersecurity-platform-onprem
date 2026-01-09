import { Tenant } from '../types';

// Global tenant storage
const globalTenantStorage = new Map<string, Tenant>();

// Initialize with ACME Corporation if not already initialized
if (globalTenantStorage.size === 0) {
  const acmeTenant: Tenant = {
    id: 'acme-corp',
    name: 'ACME Corporation',
    domain: 'acme-corp.com',
    logo_url: null,
    theme_color: '#00D4FF',
    settings: {
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
        logo_url: null,
        favicon_url: null,
      },
    },
    is_active: true,
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  };

  globalTenantStorage.set(acmeTenant.id, acmeTenant);
}

// In-memory store for demo tenants
export class DemoTenantStore {
  addTenant(tenant: Tenant): void {
    globalTenantStorage.set(tenant.id, tenant);
  }

  getTenant(id: string): Tenant | undefined {
    return globalTenantStorage.get(id);
  }

  getAllTenants(): Tenant[] {
    return Array.from(globalTenantStorage.values());
  }

  updateTenant(id: string, updates: Partial<Tenant>): Tenant | null {
    const existing = globalTenantStorage.get(id);
    if (!existing) return null;

    const updated = { ...existing, ...updates, updated_at: new Date() };
    globalTenantStorage.set(id, updated);
    return updated;
  }

  deleteTenant(id: string): boolean {
    return globalTenantStorage.delete(id);
  }

  tenantExists(domain: string): boolean {
    return Array.from(globalTenantStorage.values()).some(t => t.domain === domain);
  }

  getTotalStorage(): number {
    // Mock storage calculation - in real app this would query actual storage
    return globalTenantStorage.size * 1024 * 1024 * 500; // 500MB per tenant average
  }

  getAverageUsers(): number {
    const tenants = this.getAllTenants();
    if (tenants.length === 0) return 0;
    
    // Mock user count - in real app this would query actual user counts
    const totalUsers = tenants.reduce((sum, tenant) => {
      return sum + Math.floor(Math.random() * (tenant.settings?.max_users || 100) * 0.8);
    }, 0);
    
    return totalUsers / tenants.length;
  }
}

// Global instance
export const demoTenantStore = new DemoTenantStore();