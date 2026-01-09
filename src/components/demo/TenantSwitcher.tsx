'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { UserRole } from '@/types';
import { api } from '@/lib/api-client';

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
  const [tenants, setTenants] = useState<TenantOption[]>([
    // Start with ACME Corporation as fallback
    { id: 'acme-corp', name: 'ACME Corporation', key: 'acme' }
  ]);
  const [currentTenant, setCurrentTenant] = useState<TenantOption>({
    id: 'acme-corp', 
    name: 'ACME Corporation', 
    key: 'acme'
  });
  const [loading, setLoading] = useState(false); // Start as false since we have fallback data

  // Load tenants from API
  useEffect(() => {
    // Load additional tenants from API, but don't block the UI
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      console.log('TenantSwitcher: Loading tenants...');
      
      // Use demo tenants endpoint which doesn't require auth
      const response = await fetch('/api/tenants/demo');
      console.log('TenantSwitcher: Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('TenantSwitcher: Received data:', data);
        
        const tenantOptions: TenantOption[] = data.tenants.map((tenant: any) => ({
          id: tenant.id,
          name: tenant.name,
          key: tenant.id // Use ID as key for simplicity
        }));
        
        console.log('TenantSwitcher: Mapped tenant options:', tenantOptions);
        setTenants(tenantOptions);
        
        // Update current tenant if it's not in the new list
        const currentExists = tenantOptions.find(t => t.id === currentTenant.id);
        if (!currentExists && tenantOptions.length > 0) {
          console.log('TenantSwitcher: Updating current tenant to:', tenantOptions[0]);
          setCurrentTenant(tenantOptions[0]);
        }
      } else {
        console.error('TenantSwitcher: Failed to load tenants, status:', response.status);
      }
    } catch (error) {
      console.error('TenantSwitcher: Failed to load tenants:', error);
    } finally {
      console.log('TenantSwitcher: Loading complete');
      setLoading(false);
    }
  };

  const switchTenant = async (tenant: TenantOption) => {
    try {
      // Call auth status with tenant switch parameter to update session
      await api.get(`/api/auth/status?switch_tenant=${tenant.key}`);
      
      setCurrentTenant(tenant);
      setIsOpen(false);
      
      // Reload the page to reflect changes
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch tenant:', error);
    }
  };

  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // Show loading state only if we're actively loading and have no tenants
  if (loading && tenants.length === 0) {
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
        🏢 {currentTenant.name}
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
        🏢 {currentTenant.name}
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
                  currentTenant.id === tenant.id 
                    ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {tenant.name}
                {currentTenant.id === tenant.id && (
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