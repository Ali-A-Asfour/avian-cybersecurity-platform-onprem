/**
 * Shared Mock Users Store
 * Used by both the users API and authentication endpoints in development mode
 */

export interface MockUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLogin: string | null;
  password?: string; // For authentication
}

// Use global variable to persist across API calls in development
declare global {
  var mockUsersStore: MockUser[] | undefined;
}

// Initialize the store if it doesn't exist
if (!global.mockUsersStore) {
  global.mockUsersStore = [
    {
      id: '1',
      email: 'admin@demo.com',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'super_admin',
      tenantId: 'acme-corp',
      isActive: true,
      emailVerified: true,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      password: 'admin123',
    },
    {
      id: '2',
      email: 'tenant.admin@demo.com',
      firstName: 'Tenant',
      lastName: 'Admin',
      role: 'tenant_admin',
      tenantId: 'acme-corp',
      isActive: true,
      emailVerified: true,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      password: 'admin123',
    },
    {
      id: '3',
      email: 'analyst@demo.com',
      firstName: 'Security',
      lastName: 'Analyst',
      role: 'security_analyst',
      tenantId: 'acme-corp',
      isActive: true,
      emailVerified: true,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      password: 'analyst123',
    },
    {
      id: '4',
      email: 'helpdesk@demo.com',
      firstName: 'IT',
      lastName: 'Helpdesk',
      role: 'it_helpdesk_analyst',
      tenantId: 'acme-corp',
      isActive: true,
      emailVerified: true,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      password: 'helpdesk123',
    },
    {
      id: '5',
      email: 'user@demo.com',
      firstName: 'Demo',
      lastName: 'User',
      role: 'user',
      tenantId: 'acme-corp',
      isActive: true,
      emailVerified: true,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      password: 'user123',
    },
  ];
}

export function getMockUsers(): MockUser[] {
  return global.mockUsersStore || [];
}

export function addMockUser(user: MockUser): MockUser {
  if (!global.mockUsersStore) {
    global.mockUsersStore = [];
  }
  global.mockUsersStore.push(user);
  return user;
}

export function findMockUserByEmail(email: string): MockUser | undefined {
  return global.mockUsersStore?.find(user => user.email === email);
}

export function findMockUserById(id: string): MockUser | undefined {
  return global.mockUsersStore?.find(user => user.id === id);
}

export function updateMockUser(id: string, updates: Partial<MockUser>): MockUser | null {
  if (!global.mockUsersStore) return null;
  
  const userIndex = global.mockUsersStore.findIndex(user => user.id === id);
  if (userIndex === -1) return null;
  
  global.mockUsersStore[userIndex] = { ...global.mockUsersStore[userIndex], ...updates };
  return global.mockUsersStore[userIndex];
}

export function deleteMockUser(id: string): boolean {
  if (!global.mockUsersStore) return false;
  
  const userIndex = global.mockUsersStore.findIndex(user => user.id === id);
  if (userIndex === -1) return false;
  
  global.mockUsersStore.splice(userIndex, 1);
  return true;
}

export function getNextMockUserId(): string {
  if (!global.mockUsersStore || global.mockUsersStore.length === 0) return '1';
  
  const maxId = Math.max(...global.mockUsersStore.map(user => parseInt(user.id)));
  return String(maxId + 1);
}