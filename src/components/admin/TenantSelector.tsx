'use client';

import React, { useEffect, useState } from 'react';
import { Card, Button, Badge } from '@/components/ui';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useTenant } from '@/contexts/TenantContext';

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

interface TenantSelectorProps {
  onTenantSelect: (tenant: Tenant) => void;
  selectedTenant?: Tenant | null;
}

export function TenantSelector({ onTenantSelect, selectedTenant }: TenantSelectorProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { setSelectedTenant } = useTenant();

  const handleTenantSelect = (tenant: Tenant) => {
    // Update the tenant context
    setSelectedTenant(tenant);
    // Call the original callback
    onTenantSelect(tenant);
  };

  useEffect(() => {
    // Delay the data loading to avoid SSR issues
    const timer = setTimeout(() => {
      fetchTenants();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      // Load tenants from API
      const response = await fetch('/api/tenants');
      
      if (response.ok) {
        const data = await response.json();
        const apiTenants = data.data.map((tenant: any) => ({
          id: tenant.id,
          name: tenant.name,
          industry: 'Technology', // Default values for display
          size: 'Enterprise',
          status: tenant.is_active ? 'active' : 'inactive',
          created_at: tenant.created_at,
          data_sources_count: Math.floor(Math.random() * 10) + 1, // Mock data
          users_count: Math.floor(Math.random() * 100) + 10, // Mock data
          events_today: Math.floor(Math.random() * 500000) + 50000, // Mock data
          location: 'Various Locations',
          subscription_tier: 'Enterprise'
        }));
        
        setTenants(apiTenants);
      } else {
        // Fallback to ACME Corporation if API fails
        const fallbackTenants: Tenant[] = [
          {
            id: 'acme-corp',
            name: 'ACME Corporation',
            industry: 'Technology',
            size: 'Large Enterprise',
            status: 'active',
            created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            data_sources_count: 6,
            users_count: 45,
            events_today: 263000,
            location: 'San Francisco, CA',
            subscription_tier: 'Enterprise'
          }
        ];
        setTenants(fallbackTenants);
      }
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
      setTenants([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    // Map tenant status to our standard status types
    const statusMapping = {
      active: 'resolved' as const,     // Green - active/healthy
      inactive: 'closed' as const,     // Gray - inactive/dormant  
      suspended: 'escalated' as const  // Red - requires attention
    };

    const mappedStatus = statusMapping[status as keyof typeof statusMapping] || 'closed';
    return <StatusBadge status={mappedStatus} size="sm" />;
  };

  const getTierBadge = (tier: string) => {
    const tierColors = {
      'Starter': 'bg-blue-100 text-blue-800',
      'Professional': 'bg-purple-100 text-purple-800',
      'Enterprise': 'bg-orange-100 text-orange-800',
      'Enterprise Plus': 'bg-red-100 text-red-800',
      'Education': 'bg-green-100 text-green-800'
    };

    return (
      <Badge
        variant="secondary"
        className={tierColors[tier as keyof typeof tierColors] || 'bg-gray-100 text-gray-800'}
      >
        {tier}
      </Badge>
    );
  };

  const filteredTenants = tenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.industry.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading tenants...</div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Select Client Tenant</h2>
          <p className="text-gray-600">Choose a client to manage their security infrastructure</p>
        </div>
        {selectedTenant && (
          <div className="text-right">
            <div className="text-sm text-gray-500">Currently Managing:</div>
            <div className="font-semibold text-blue-600">{selectedTenant.name}</div>
          </div>
        )}
      </div>

      {/* Search */}
      <Card className="p-4">
        <input
          type="text"
          placeholder="Search tenants by name, industry, or location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Card>

      {/* Tenant Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTenants.map((tenant) => (
          <Card
            key={tenant.id}
            className={`p-6 cursor-pointer transition-all hover:shadow-lg ${selectedTenant?.id === tenant.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              }`}
            onClick={() => handleTenantSelect(tenant)}
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{tenant.name}</h3>
                  <p className="text-sm text-gray-600">{tenant.industry}</p>
                </div>
                {getStatusBadge(tenant.status)}
              </div>

              {/* Details */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Size:</span>
                  <span className="font-medium">{tenant.size}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Location:</span>
                  <span className="font-medium">{tenant.location}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Plan:</span>
                  {getTierBadge(tenant.subscription_tier)}
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{tenant.data_sources_count}</div>
                  <div className="text-xs text-gray-500">Sources</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{tenant.users_count}</div>
                  <div className="text-xs text-gray-500">Users</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">
                    {tenant.events_today > 1000
                      ? `${(tenant.events_today / 1000).toFixed(0)}K`
                      : tenant.events_today}
                  </div>
                  <div className="text-xs text-gray-500">Events</div>
                </div>
              </div>

              {/* Action */}
              <div className="pt-2">
                <Button
                  variant={selectedTenant?.id === tenant.id ? 'primary' : 'outline'}
                  size="sm"
                  className="w-full"
                  disabled={tenant.status === 'suspended'}
                >
                  {selectedTenant?.id === tenant.id ? 'Currently Selected' : 'Select Tenant'}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredTenants.length === 0 && (
        <Card className="p-8">
          <div className="text-center text-gray-500">
            No tenants found matching your search criteria
          </div>
        </Card>
      )}
    </div>
  );
}