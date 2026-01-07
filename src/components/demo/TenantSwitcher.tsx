'use client';

import React, { useState } from 'react';
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

const tenants: TenantOption[] = [
  { id: 'dev-tenant-123', name: 'Demo Corporation', key: 'demo' },
  { id: 'acme-corp-456', name: 'ACME Corporation', key: 'acme' },
  { id: 'techstart-789', name: 'TechStart Inc', key: 'techstart' },
  { id: 'global-finance-101', name: 'Global Finance Ltd', key: 'finance' },
];

export function TenantSwitcher({ userRole }: TenantSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTenant, setCurrentTenant] = useState(tenants[0]);

  const switchTenant = async (tenant: TenantOption) => {
    try {
      // Call auth status with tenant switch parameter to update session
      await api.get(`/api/auth/status?switch_tenant=${tenant.key}`);
      
      setCurrentTenant(tenant);
      setIsOpen(false);
      
      // Reload the page to reflect changes
      window.location.reload();
    } catch {
      console.error('Failed to switch tenant:', error);
    }
  };

  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
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
          </div>
        </div>
      )}
    </div>
  );
}