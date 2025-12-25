'use client';

import { useEffect, useState } from 'react';
import { TenantSelector } from '@/components/admin/TenantSelector';

interface Tenant {
  id: string;
  name: string;
  industry: string;
  size: string;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  data_sources_count: number;
  users_count: number;
  events_today: number;
  location: string;
  subscription_tier: string;
}

export default function SuperAdminPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleTenantSelect = (tenant: Tenant) => {
    setSelectedTenant(tenant);
  };

  if (!mounted) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
      <p>Testing TenantSelector component...</p>
      
      <div className="mt-8">
        <TenantSelector 
          onTenantSelect={handleTenantSelect}
          selectedTenant={selectedTenant}
        />
      </div>
      
      {selectedTenant && (
        <div className="mt-4 p-4 bg-green-100 rounded">
          <p>Selected: {selectedTenant.name}</p>
        </div>
      )}
    </div>
  );
}