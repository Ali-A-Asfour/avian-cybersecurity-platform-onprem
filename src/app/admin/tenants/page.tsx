'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable } from '@/components/ui/DataTable';

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

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tenants/demo');
      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants || []);
      }
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    // Map tenant status to standard status types
    const mapStatus = (stat: string): 'new' | 'open' | 'investigating' | 'in_progress' | 'awaiting_response' | 'escalated' | 'resolved' | 'closed' | 'canceled' => {
      switch (stat.toLowerCase()) {
        case 'active': return 'resolved';
        case 'inactive': return 'closed';
        case 'suspended': return 'escalated';
        default: return 'new';
      }
    };

    return <StatusBadge status={mapStatus(status)} size="sm" />;
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
      <Label
        variant="secondary"
        className={tierColors[tier as keyof typeof tierColors] || 'bg-gray-100 text-gray-800'}
      >
        {tier}
      </Label>
    );
  };

  const handleManageTenant = (tenant: Tenant) => {
    // Store selected tenant and redirect to super admin
    sessionStorage.setItem('selectedTenant', JSON.stringify(tenant));
    window.location.href = '/super-admin';
  };

  const columns = [
    {
      key: 'name',
      label: 'Tenant',
      render: (tenant: Tenant) => (
        <div>
          <div className="font-medium">{tenant.name}</div>
          <div className="text-sm text-gray-500">{tenant.industry}</div>
        </div>
      )
    },
    {
      key: 'location',
      label: 'Location',
      render: (tenant: Tenant) => (
        <div className="text-sm">{tenant.location}</div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (tenant: Tenant) => getStatusBadge(tenant.status)
    },
    {
      key: 'subscription_tier',
      label: 'Plan',
      render: (tenant: Tenant) => getTierBadge(tenant.subscription_tier)
    },
    {
      key: 'users_count',
      label: 'Users',
      render: (tenant: Tenant) => (
        <span className="font-mono">{tenant.users_count}</span>
      )
    },
    {
      key: 'data_sources_count',
      label: 'Sources',
      render: (tenant: Tenant) => (
        <span className="font-mono">{tenant.data_sources_count}</span>
      )
    },
    {
      key: 'events_today',
      label: 'Events Today',
      render: (tenant: Tenant) => (
        <span className="font-mono">
          {tenant.events_today > 1000
            ? `${(tenant.events_today / 1000).toFixed(0)}K`
            : tenant.events_today}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (tenant: Tenant) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleManageTenant(tenant)}
          >
            Manage
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedTenant(tenant)}
          >
            Details
          </Button>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-500">Loading tenants...</div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tenant Management</h1>
            <p className="text-gray-600 mt-2">
              Manage all client tenants and their configurations
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.href = '/super-admin'}>
              Client Dashboard
            </Button>
            <Button variant="primary">
              Add New Tenant
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <div className="text-sm text-gray-600">Total Tenants</div>
          <div className="text-3xl font-bold text-blue-600">{tenants.length}</div>
          <div className="text-sm text-gray-500">Active clients</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-gray-600">Active Tenants</div>
          <div className="text-3xl font-bold text-green-600">
            {tenants.filter(t => t.status === 'active').length}
          </div>
          <div className="text-sm text-gray-500">Currently active</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-gray-600">Total Users</div>
          <div className="text-3xl font-bold text-purple-600">
            {tenants.reduce((sum, t) => sum + t.users_count, 0)}
          </div>
          <div className="text-sm text-gray-500">Across all tenants</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-gray-600">Events Today</div>
          <div className="text-3xl font-bold text-orange-600">
            {(tenants.reduce((sum, t) => sum + t.events_today, 0) / 1000).toFixed(0)}K
          </div>
          <div className="text-sm text-gray-500">Security events</div>
        </Card>
      </div>

      {/* Tenants Table */}
      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">All Tenants</h3>
          <p className="text-sm text-gray-600">
            Manage and monitor all client tenants
          </p>
        </div>

        <DataTable
          data={tenants}
          columns={columns}
        />
      </Card>

      {/* Tenant Details Modal */}
      {selectedTenant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-2xl max-h-[80vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold">{selectedTenant.name}</h3>
                  <p className="text-gray-600">{selectedTenant.industry} • {selectedTenant.location}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedTenant(null)}
                >
                  Close
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Tenant Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">ID:</span>
                      <span className="font-mono">{selectedTenant.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Size:</span>
                      <span>{selectedTenant.size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      {getStatusBadge(selectedTenant.status)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Plan:</span>
                      {getTierBadge(selectedTenant.subscription_tier)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Created:</span>
                      <span>{new Date(selectedTenant.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Usage Statistics</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Users:</span>
                      <span className="font-mono">{selectedTenant.users_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Data Sources:</span>
                      <span className="font-mono">{selectedTenant.data_sources_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Events Today:</span>
                      <span className="font-mono">{selectedTenant.events_today.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6 pt-4 border-t">
                <Button
                  size="sm"
                  onClick={() => handleManageTenant(selectedTenant)}
                >
                  Manage Tenant
                </Button>
                <Button variant="outline" size="sm">
                  Edit Settings
                </Button>
                <Button variant="outline" size="sm">
                  View Audit Log
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Backdrop to close modal */}
      {selectedTenant && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setSelectedTenant(null)}
        />
      )}
    </div>
  );
}