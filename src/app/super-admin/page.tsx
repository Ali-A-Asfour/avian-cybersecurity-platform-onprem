'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth as useAuthContext } from '@/contexts/AuthContext';
import { TenantSelector } from '@/components/admin/TenantSelector';
import { Card, Button, Badge } from '@/components/ui';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/hooks/useAuth';

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
  const router = useRouter();
  const { isAuthenticated, loading: authContextLoading } = useAuthContext();
  const { user, loading: authLoading } = useAuth(true);
  const { selectedTenant, setSelectedTenant } = useTenant();
  
  // All useState hooks must be at the top, before any conditional returns
  const [showTenantSelector, setShowTenantSelector] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Authentication check
  useEffect(() => {
    if (!authContextLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authContextLoading, isAuthenticated, router]);

  // Handle hydration
  useEffect(() => {
    try {
      setMounted(true);
      // Update showTenantSelector based on selectedTenant
      setShowTenantSelector(!selectedTenant);
    } catch (error) {
      console.error('Error during component mount:', error);
      setError('Failed to initialize component');
    }
  }, [selectedTenant]);

  // Early return after all hooks
  if (authContextLoading || !isAuthenticated) {
    return null;
  }

  const handleTenantSelect = (tenant: Tenant) => {
    try {
      setSelectedTenant(tenant);
      setShowTenantSelector(false);
    } catch (error) {
      console.error('Error selecting tenant:', error);
      setError('Failed to select tenant');
    }
  };

  const handleSwitchTenant = () => {
    try {
      setSelectedTenant(null);
      setShowTenantSelector(true);
    } catch (error) {
      console.error('Error switching tenant:', error);
      setError('Failed to switch tenant');
    }
  };

  const navigateToTenantSection = (section: string) => {
    if (!selectedTenant || !mounted) return;

    // Store selected tenant in session storage for other pages to use
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('selectedTenant', JSON.stringify(selectedTenant));
      // Navigate to the section with tenant context
      window.location.href = `/${section}?tenant=${selectedTenant.id}`;
    }
  };

  // Show error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-red-500">Error: {error}</div>
        </div>
      </div>
    );
  }

  // Prevent hydration mismatch and wait for auth
  if (!mounted || authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (showTenantSelector) {
    return (
      <div className="container mx-auto px-4 py-8">
        <TenantSelector
          onTenantSelect={handleTenantSelect}
          selectedTenant={selectedTenant}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header with tenant info and switch button */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
            <p className="text-gray-600">Managing security infrastructure for {selectedTenant?.name}</p>
          </div>
          <Button variant="outline" onClick={handleSwitchTenant}>
            Switch Client
          </Button>
        </div>

        {/* Selected Tenant Info Card */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <h2 className="text-xl font-semibold text-blue-900">{selectedTenant?.name}</h2>
                <p className="text-blue-700">{selectedTenant?.industry} • {selectedTenant?.location}</p>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {selectedTenant?.subscription_tier}
              </Badge>
            </div>
            <div className="text-right">
              <div className="text-sm text-blue-600">Tenant ID</div>
              <div className="font-mono text-blue-900">{selectedTenant?.id}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <div className="text-sm text-gray-600">Data Sources</div>
          <div className="text-3xl font-bold text-blue-600">{selectedTenant?.data_sources_count}</div>
          <div className="text-sm text-gray-500">Active connections</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-gray-600">Users</div>
          <div className="text-3xl font-bold text-green-600">{selectedTenant?.users_count}</div>
          <div className="text-sm text-gray-500">Licensed users</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-gray-600">Events Today</div>
          <div className="text-3xl font-bold text-purple-600">
            {selectedTenant?.events_today && selectedTenant.events_today > 1000
              ? `${(selectedTenant.events_today / 1000).toFixed(0)}K`
              : selectedTenant?.events_today}
          </div>
          <div className="text-sm text-gray-500">Security events</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-gray-600">Status</div>
          <div className="text-3xl font-bold text-green-600">
            {selectedTenant?.status === 'active' ? '✓' : '⚠'}
          </div>
          <div className="text-sm text-gray-500 capitalize">{selectedTenant?.status}</div>
        </Card>
      </div>

      {/* Primary Action - Go to Dashboard */}
      <div className="mb-8">
        <Card className="p-8 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-xl transition-shadow cursor-pointer" onClick={() => navigateToTenantSection('dashboard')}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold mb-2">View Client Dashboard</h3>
              <p className="text-blue-100">Access the full security operations dashboard for {selectedTenant?.name}</p>
            </div>
            <div className="text-6xl">📊</div>
          </div>
          <div className="mt-6">
            <Button variant="secondary" size="lg" className="bg-white text-blue-600 hover:bg-blue-50">
              Go to Dashboard →
            </Button>
          </div>
        </Card>
      </div>

      {/* Management Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Data Sources */}
        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigateToTenantSection('data-sources')}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Data Sources</h3>
            <span className="text-2xl">📡</span>
          </div>
          <p className="text-gray-600 mb-4">Manage security data connections and integrations</p>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">{selectedTenant?.data_sources_count} sources</span>
            <Button variant="outline" size="sm">Manage →</Button>
          </div>
        </Card>

        {/* Threat Lake */}
        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigateToTenantSection('threat-lake')}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Threat Lake</h3>
            <span className="text-2xl">🗄️</span>
          </div>
          <p className="text-gray-600 mb-4">Security event analysis and threat hunting</p>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Event analytics</span>
            <Button variant="outline" size="sm">Analyze →</Button>
          </div>
        </Card>

        {/* Assets */}
        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigateToTenantSection('assets')}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Asset Management</h3>
            <span className="text-2xl">💻</span>
          </div>
          <p className="text-gray-600 mb-4">Monitor and secure client assets</p>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Asset inventory</span>
            <Button variant="outline" size="sm">View →</Button>
          </div>
        </Card>

        {/* Alerts */}
        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigateToTenantSection('alerts')}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Security Alerts</h3>
            <span className="text-2xl">🚨</span>
          </div>
          <p className="text-gray-600 mb-4">Monitor and respond to security incidents</p>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Active monitoring</span>
            <Button variant="outline" size="sm">Monitor →</Button>
          </div>
        </Card>

        {/* Compliance */}
        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigateToTenantSection('compliance')}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Compliance</h3>
            <span className="text-2xl">📋</span>
          </div>
          <p className="text-gray-600 mb-4">Compliance monitoring and reporting</p>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Compliance status</span>
            <Button variant="outline" size="sm">Review →</Button>
          </div>
        </Card>

        {/* Users */}
        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigateToTenantSection('admin')}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">User Management</h3>
            <span className="text-2xl">👥</span>
          </div>
          <p className="text-gray-600 mb-4">Manage client users and permissions</p>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">{selectedTenant?.users_count} users</span>
            <Button variant="outline" size="sm">Manage →</Button>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="mt-8 p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity for {selectedTenant?.name}</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div>
              <div className="font-medium">New data source connected</div>
              <div className="text-sm text-gray-600">Security monitoring endpoint added</div>
            </div>
            <div className="text-sm text-gray-500">2 hours ago</div>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div>
              <div className="font-medium">Security alert resolved</div>
              <div className="text-sm text-gray-600">Malware detection on workstation-045</div>
            </div>
            <div className="text-sm text-gray-500">4 hours ago</div>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div>
              <div className="font-medium">Compliance report generated</div>
              <div className="text-sm text-gray-600">Monthly SOC 2 compliance report</div>
            </div>
            <div className="text-sm text-gray-500">1 day ago</div>
          </div>
        </div>
      </Card>
    </div>
  );
}