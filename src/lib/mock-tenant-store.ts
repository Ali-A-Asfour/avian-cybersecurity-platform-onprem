/**
 * Mock Tenant Store
 * Used for demo/development mode tenant management
 */

export interface MockTenant {
  id: string;
  name: string;
  domain: string;
  identifier: string; // Alternative identifier for clients without domains
  industry: string;
  contact: string;
  timezone: string;
  is_active: boolean;
  users_count: number;
  created_at: string;
  last_activity: string;
  sonicwall_devices?: any[];
  microsoft_integration?: {
    tenant_id: string;
    client_id: string;
    configured: boolean;
  } | null;
}

// Use global variable to persist across API calls in development
declare global {
  var mockTenantStore: MockTenant[] | undefined;
}

// Initialize the store if it doesn't exist
if (!global.mockTenantStore) {
  global.mockTenantStore = [
    {
      id: 'acme-corp',
      name: 'ACME Corporation',
      domain: 'acme-corp.com',
      identifier: 'acme-corp',
      industry: 'Manufacturing',
      contact: 'admin@acme-corp.com',
      timezone: 'EST',
      is_active: true,
      users_count: 5,
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      last_activity: new Date().toISOString(),
      sonicwall_devices: [
        {
          managementIp: '192.168.1.1',
          deviceName: 'ACME-HQ-Firewall',
          location: 'New York HQ',
        }
      ],
      microsoft_integration: {
        tenant_id: '12345678-1234-1234-1234-123456789012',
        client_id: '87654321-4321-4321-4321-210987654321',
        configured: true,
      },
    },
    {
      id: 'tech-corp',
      name: 'Tech Corp',
      domain: 'techcorp.com',
      identifier: 'tech-corp',
      industry: 'Technology',
      contact: 'admin@techcorp.com',
      timezone: 'PST',
      is_active: true,
      users_count: 3,
      created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
      last_activity: new Date().toISOString(),
      sonicwall_devices: [
        {
          managementIp: '10.0.1.1',
          deviceName: 'TechCorp-Main-FW',
          location: 'San Francisco Office',
        }
      ],
      microsoft_integration: {
        tenant_id: '11111111-2222-3333-4444-555555555555',
        client_id: '66666666-7777-8888-9999-000000000000',
        configured: true,
      },
    },
    {
      id: 'small-biz-123',
      name: 'Small Business LLC',
      domain: '', // No domain
      identifier: 'small-biz-123',
      industry: 'Retail',
      contact: 'owner@gmail.com',
      timezone: 'CST',
      is_active: true,
      users_count: 2,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      last_activity: new Date().toISOString(),
      sonicwall_devices: [
        {
          managementIp: '192.168.0.1',
          deviceName: 'SmallBiz-Firewall',
          location: 'Main Store',
        }
      ],
      microsoft_integration: null,
    },
  ];
}

export function getMockTenants(): MockTenant[] {
  return global.mockTenantStore || [];
}

export function addMockTenant(tenant: MockTenant): MockTenant {
  if (!global.mockTenantStore) {
    global.mockTenantStore = [];
  }
  global.mockTenantStore.push(tenant);
  return tenant;
}

export function findMockTenantById(id: string): MockTenant | undefined {
  return global.mockTenantStore?.find(tenant => tenant.id === id);
}

export function findMockTenantByDomain(domain: string): MockTenant | undefined {
  return global.mockTenantStore?.find(tenant => tenant.domain === domain);
}

export function findMockTenantByIdentifier(identifier: string): MockTenant | undefined {
  return global.mockTenantStore?.find(tenant => tenant.identifier === identifier);
}

export function updateMockTenant(id: string, updates: Partial<MockTenant>): MockTenant | null {
  if (!global.mockTenantStore) return null;
  
  const tenantIndex = global.mockTenantStore.findIndex(tenant => tenant.id === id);
  if (tenantIndex === -1) return null;
  
  global.mockTenantStore[tenantIndex] = { ...global.mockTenantStore[tenantIndex], ...updates };
  return global.mockTenantStore[tenantIndex];
}

export function deleteMockTenant(id: string): boolean {
  if (!global.mockTenantStore) return false;
  
  const tenantIndex = global.mockTenantStore.findIndex(tenant => tenant.id === id);
  if (tenantIndex === -1) return false;
  
  global.mockTenantStore.splice(tenantIndex, 1);
  return true;
}

export function tenantExists(domain: string, identifier: string): boolean {
  return !!global.mockTenantStore?.find(tenant => 
    (domain && tenant.domain === domain) || 
    (identifier && tenant.identifier === identifier)
  );
}