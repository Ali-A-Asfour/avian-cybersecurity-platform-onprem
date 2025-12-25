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
      // Mock tenant data for demonstration
      const mockTenants: Tenant[] = [
        {
          id: 'tenant-techcorp',
          name: 'TechCorp Inc.',
          industry: 'Technology',
          size: 'Large Enterprise',
          status: 'active',
          created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          data_sources_count: 3,
          users_count: 45,
          events_today: 263000,
          location: 'New York, NY',
          subscription_tier: 'Enterprise'
        },
        {
          id: 'tenant-medhealth',
          name: 'MedHealth Systems',
          industry: 'Healthcare',
          size: 'Medium Enterprise',
          status: 'active',
          created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          data_sources_count: 2,
          users_count: 28,
          events_today: 91070,
          location: 'Chicago, IL',
          subscription_tier: 'Professional'
        },
        {
          id: 'tenant-startupco',
          name: 'StartupCo Ltd.',
          industry: 'Technology',
          size: 'Small Business',
          status: 'active',
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          data_sources_count: 2,
          users_count: 8,
          events_today: 17760,
          location: 'Austin, TX',
          subscription_tier: 'Starter'
        },
        {
          id: 'tenant-globalbank',
          name: 'GlobalBank Corp.',
          industry: 'Financial Services',
          size: 'Large Enterprise',
          status: 'active',
          created_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
          data_sources_count: 3,
          users_count: 156,
          events_today: 836570,
          location: 'London, UK',
          subscription_tier: 'Enterprise Plus'
        },
        {
          id: 'tenant-retailchain',
          name: 'RetailChain Stores',
          industry: 'Retail',
          size: 'Medium Enterprise',
          status: 'active',
          created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          data_sources_count: 2,
          users_count: 34,
          events_today: 78920,
          location: 'Phoenix, AZ',
          subscription_tier: 'Professional'
        },
        {
          id: 'tenant-manufacturing',
          name: 'ManufacturingCorp',
          industry: 'Manufacturing',
          size: 'Large Enterprise',
          status: 'active',
          created_at: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString(),
          data_sources_count: 2,
          users_count: 67,
          events_today: 53310,
          location: 'Detroit, MI',
          subscription_tier: 'Enterprise'
        },
        {
          id: 'tenant-edutech',
          name: 'EduTech University',
          industry: 'Education',
          size: 'Large Organization',
          status: 'active',
          created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
          data_sources_count: 2,
          users_count: 23,
          events_today: 58560,
          location: 'Boston, MA',
          subscription_tier: 'Education'
        },
        {
          id: 'tenant-suspended',
          name: 'SuspendedCorp',
          industry: 'Technology',
          size: 'Medium Enterprise',
          status: 'suspended',
          created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
          data_sources_count: 0,
          users_count: 12,
          events_today: 0,
          location: 'San Francisco, CA',
          subscription_tier: 'Professional'
        }
      ];

      setTenants(mockTenants);
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