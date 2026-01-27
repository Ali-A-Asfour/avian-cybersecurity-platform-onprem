'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { UserRole } from '@/types';
import { api } from '@/lib/api-client';
import { useDemoContext } from '@/contexts/DemoContext';

interface TenantOption {
  id: string;
  name: string;
  key: string;
}

interface TenantSwitcherProps {
  userRole?: UserRole;
}

export function TenantSwitcher({ userRole }: TenantSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentTenant, setCurrentTenant } = useDemoContext();

  // Load tenants from API
  useEffect(() => {
    // Only load tenants for roles that can switch tenants
    const rolesWithDropdown = [UserRole.SUPER_ADMIN, UserRole.SECURITY_ANALYST, UserRole.IT_HELPDESK_ANALYST];
    if (userRole && rolesWithDropdown.includes(userRole)) {
      // Load additional tenants from API, but don't block the UI
      loadTenants();
    } else {
      // For regular users, get their tenant info from auth context
      loadCurrentUserTenant();
    }
  }, [userRole]);

  // Update global tenant ID whenever currentTenant changes
  useEffect(() => {
    if (typeof window !== 'undefined' && currentTenant) {
      (window as any).__SELECTED_TENANT_ID__ = currentTenant.id;
      console.log('TenantSwitcher: Updated global tenant ID:', currentTenant.id);
    }
  }, [currentTenant]);

  const loadCurrentUserTenant = async () => {
    try {
      const authToken = localStorage.getItem('auth-token');
      if (!authToken) {
        console.error('TenantSwitcher: No auth token found');
        setCurrentTenant({ id: 'unknown', name: 'Unknown Tenant', key: 'unknown' });
        return;
      }

      // Get user info to find their tenant
      const userResponse = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        const tenantId = userData.user.tenantId;
        
        // For regular users, don't try to fetch tenant details from API
        // Just use a proper tenant name mapping based on tenant ID
        const tenantNameMap: Record<string, string> = {
          '85cfd918-8558-4baa-9534-25454aea76a8': 'esr',
          '1f9656a9-1d4a-4ebf-94db-45427789ba24': 'Default Organization',
          // Add other known tenant mappings here
        };
        
        const tenantName = tenantNameMap[tenantId] || 'Your Organization';
        
        setCurrentTenant({
          id: tenantId,
          name: tenantName,
          key: tenantId
        });
      }
    } catch (error) {
      console.error('TenantSwitcher: Failed to load user tenant:', error);
      setCurrentTenant({ id: 'error', name: 'Error Loading Tenant', key: 'error' });
    }
  };

  const loadTenants = async () => {
    try {
      setLoading(true);
      console.log('TenantSwitcher: Loading tenants for role:', userRole);
      
      // Double-check permissions before making any API calls
      const rolesWithTenantListAccess = [UserRole.SUPER_ADMIN, UserRole.SECURITY_ANALYST, UserRole.IT_HELPDESK_ANALYST];
      
      if (!userRole || !rolesWithTenantListAccess.includes(userRole)) {
        console.log('TenantSwitcher: User role', userRole, 'does not have tenant list access, aborting API call');
        // For users without permission, just load their own tenant info
        await loadCurrentUserTenant();
        return;
      }
      
      // Get auth token from localStorage
      const authToken = localStorage.getItem('auth-token');
      console.log('TenantSwitcher: Auth token available:', !!authToken);
      
      if (!authToken) {
        console.error('TenantSwitcher: No auth token found, falling back to current user tenant');
        await loadCurrentUserTenant();
        return;
      }
      
      let response;
      
      if (userRole === UserRole.SUPER_ADMIN) {
        console.log('TenantSwitcher: User has super-admin access, trying super-admin endpoint');
        try {
          response = await fetch('/api/super-admin/tenants', {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.log('TenantSwitcher: Super-admin endpoint failed:', error);
        }
      }
      
      // If super-admin endpoint fails or user is analyst, try regular endpoint
      if (!response || !response.ok) {
        console.log('TenantSwitcher: Trying regular tenants endpoint for role:', userRole);
        try {
          response = await fetch('/api/tenants', {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            }
          });
        } catch (error) {
          console.log('TenantSwitcher: Regular tenants endpoint failed:', error);
          // Fall back to loading current user tenant
          await loadCurrentUserTenant();
          return;
        }
      }
      
      console.log('TenantSwitcher: Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('TenantSwitcher: Received data:', data);
        
        // Handle both super-admin format (data.data.tenants) and regular format (data.data)
        const tenantsArray = data.data.tenants || data.data || [];
        const tenantOptions: TenantOption[] = tenantsArray.map((tenant: any) => ({
          id: tenant.id,
          name: tenant.name,
          key: tenant.id // Use ID as key for simplicity
        }));
        
        console.log('TenantSwitcher: Mapped tenant options:', tenantOptions);
        setTenants(tenantOptions);
        
        // Update current tenant if it's not in the new list
        const currentExists = tenantOptions.find(t => t.id === currentTenant?.id);
        if (!currentExists && tenantOptions.length > 0) {
          console.log('TenantSwitcher: Updating current tenant to:', tenantOptions[0]);
          setCurrentTenant(tenantOptions[0]);
        }
      } else {
        console.error('TenantSwitcher: Failed to load tenants, status:', response.status);
        const errorText = await response.text();
        console.error('TenantSwitcher: Error response:', errorText);
        // Fall back to loading current user tenant
        await loadCurrentUserTenant();
      }
    } catch (error) {
      console.error('TenantSwitcher: Failed to load tenants:', error);
      // Fall back to loading current user tenant
      await loadCurrentUserTenant();
    } finally {
      console.log('TenantSwitcher: Loading complete');
      setLoading(false);
    }
  };

  const switchTenant = async (tenant: TenantOption) => {
    try {
      console.log('TenantSwitcher: Switching to tenant:', tenant);
      
      // Update the global tenant context immediately
      setCurrentTenant(tenant);
      setIsOpen(false);
      
      // For cross-tenant users (helpdesk/security analysts), we need to update their effective tenant
      // This is handled by updating the DemoContext which both helpdesk and assets pages use
      console.log('TenantSwitcher: Tenant switched successfully to:', tenant.name);
      
      // No need to reload the page - the context update will trigger re-renders
      // window.location.reload();
    } catch (error) {
      console.error('Failed to switch tenant:', error);
    }
  };

  // Show in both development and production modes
  // In production, this provides tenant switching functionality
  // In development, this provides demo tenant switching

  // Show loading state only if we're actively loading and have no tenants
  if (loading && tenants.length === 0 && !currentTenant) {
    return (
      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
        🏢 Loading...
      </div>
    );
  }

  // Roles that should NOT have a dropdown (User and Tenant Admin)
  const rolesWithoutDropdown = [UserRole.USER, UserRole.TENANT_ADMIN];
  const shouldShowDropdown = !userRole || !rolesWithoutDropdown.includes(userRole);

  // For User and Tenant Admin, just show the current tenant name without dropdown
  if (!shouldShowDropdown) {
    return (
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
        🏢 {currentTenant?.name || 'Loading...'}
      </div>
    );
  }

  // For other roles, show the dropdown
  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs"
      >
        🏢 {currentTenant?.name || 'Select Tenant'}
      </Button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="py-1">
            <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              Switch Tenant (Dev Mode)
            </div>
            {tenants.map((tenant) => (
              <button
                key={tenant.id}
                onClick={() => switchTenant(tenant)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  currentTenant?.id === tenant.id 
                    ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {tenant.name}
                {currentTenant?.id === tenant.id && (
                  <span className="ml-2 text-xs">✓</span>
                )}
              </button>
            ))}
            
            {/* Refresh button */}
            <div className="border-t border-gray-200 dark:border-gray-700 mt-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  loadTenants();
                }}
                className="w-full text-left px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                disabled={loading}
              >
                {loading ? '🔄 Loading...' : '🔄 Refresh Tenants'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}