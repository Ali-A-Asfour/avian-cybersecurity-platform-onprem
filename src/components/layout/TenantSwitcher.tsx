'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useTenant } from '@/contexts/TenantContext';

export function TenantSwitcher() {
  const { selectedTenant, setSelectedTenant } = useTenant();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSwitchTenant = () => {
    // Clear current tenant and redirect to super admin
    setSelectedTenant(null);
    window.location.href = '/super-admin';
  };

  const handleViewAllTenants = () => {
    window.location.href = '/super-admin';
  };

  if (!selectedTenant) {
    return (
      <Button variant="outline" size="sm" onClick={handleViewAllTenants}>
        Select Client
      </Button>
    );
  }

  return (
    <div className="relative">
      <div
        className="flex items-center space-x-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <div>
            <div className="text-sm font-medium text-blue-900">{selectedTenant.name}</div>
            <div className="text-xs text-blue-600">{selectedTenant.industry}</div>
          </div>
        </div>
        <span className="text-blue-600">▼</span>
      </div>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4 border-b">
            <div className="font-medium text-gray-900">{selectedTenant.name}</div>
            <div className="text-sm text-gray-600">{selectedTenant.location}</div>
            <div className="flex items-center space-x-2 mt-2">
              <Label variant="secondary" className="bg-blue-100 text-blue-800">
                {selectedTenant.subscription_tier}
              </Label>
              <StatusBadge
                status={selectedTenant.status === 'active' ? 'resolved' : 'closed'}
                size="sm"
              />
            </div>
          </div>

          <div className="p-2">
            <button
              onClick={handleSwitchTenant}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
            >
              🔄 Switch Client
            </button>
            <button
              onClick={handleViewAllTenants}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
            >
              👥 View All Clients
            </button>
            <button
              onClick={() => window.location.href = `/admin/tenants/${selectedTenant.id}`}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
            >
              ⚙️ Tenant Settings
            </button>
          </div>
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}