'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

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

interface TenantContextType {
  selectedTenant: Tenant | null;
  setSelectedTenant: (tenant: Tenant | null) => void;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load selected tenant from session storage on mount
    try {
      if (typeof window !== 'undefined') {
        const storedTenant = sessionStorage.getItem('selectedTenant');
        if (storedTenant) {
          setSelectedTenant(JSON.parse(storedTenant));
        }
      }
    } catch (error) {
      console.error('Failed to parse stored tenant:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSelectedTenant = (tenant: Tenant | null) => {
    setSelectedTenant(tenant);
    if (typeof window !== 'undefined') {
      if (tenant) {
        sessionStorage.setItem('selectedTenant', JSON.stringify(tenant));
      } else {
        sessionStorage.removeItem('selectedTenant');
      }
    }
  };

  return (
    <TenantContext.Provider value={{
      selectedTenant,
      setSelectedTenant: updateSelectedTenant,
      isLoading
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}