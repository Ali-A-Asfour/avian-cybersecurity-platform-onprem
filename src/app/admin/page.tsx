'use client';

import { useEffect, useState } from 'react';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';

import { TenantForm, TenantFormData } from '@/components/admin/tenants/TenantForm';
import { TenantMetrics } from '@/components/admin/tenants/TenantMetrics';
import { SystemHealthDashboard } from '@/components/admin/system/SystemHealthDashboard';
import { AuditLogViewer } from '@/components/admin/audit/AuditLogViewer';
import { PlatformMetrics } from '@/components/admin/platform/PlatformMetrics';
import { UserManagement } from '@/components/admin/users/UserManagement';
import { Tenant, User } from '@/types';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'users' | 'audit' | 'system'>('overview');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load tenants
      const tenantsResponse = await fetch('/api/tenants');
      if (tenantsResponse.ok) {
        const tenantsData = await tenantsResponse.json();
        setTenants(tenantsData.data.tenants || []);
      }

      // Load users (cross-tenant for super admin)
      const usersResponse = await fetch('/api/users');
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.data.users || []);
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = () => {
    setSelectedTenant(null);
    setShowTenantModal(true);
  };

  const handleEditTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setShowTenantModal(true);
  };

  const handleTenantSaved = async (formData: TenantFormData) => {
    try {
      const url = selectedTenant ? `/api/tenants/${selectedTenant.id}` : '/api/tenants';
      const method = selectedTenant ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowTenantModal(false);
        setSelectedTenant(null);
        loadData();
      } else {
        const error = await response.json();
        alert(error.error?.message || 'Failed to save tenant');
      }
    } catch (error) {
      console.error('Failed to save tenant:', error);
      alert('Failed to save tenant');
    }
  };

  const tabs = [
    { id: 'overview', label: 'Platform Overview', icon: '📊' },
    { id: 'tenants', label: 'Tenant Management', icon: '🏢' },
    { id: 'users', label: 'User Management', icon: '👥' },
    { id: 'audit', label: 'Audit Logs', icon: '📋' },
    { id: 'system', label: 'System Health', icon: '⚡' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Platform Administration
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage tenants, users, and monitor system health across the AVIAN platform
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <PlatformMetrics tenants={tenants} users={users} />
          )}

          {activeTab === 'tenants' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Tenant Management
                </h2>
                <Button onClick={handleCreateTenant}>
                  Create New Tenant
                </Button>
              </div>

              <TenantMetrics tenants={tenants} />

              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4">All Tenants</h3>
                  <DataTable
                    data={tenants}
                    columns={[
                      { key: 'name', label: 'Name' },
                      { key: 'domain', label: 'Domain' },
                      {
                        key: 'is_active',
                        label: 'Status',
                        render: (value) => (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                            {value ? 'Active' : 'Inactive'}
                          </span>
                        )
                      },
                      {
                        key: 'created_at',
                        label: 'Created',
                        render: (tenant: Tenant) => new Date(tenant.created_at).toLocaleDateString()
                      },
                      {
                        key: 'actions',
                        label: 'Actions',
                        render: (tenant: Tenant) => (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTenant(tenant)}
                          >
                            Edit
                          </Button>
                        )
                      }
                    ]}
                  />
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'users' && (
            <UserManagement users={users} tenants={tenants} onUserUpdated={loadData} />
          )}

          {activeTab === 'audit' && (
            <AuditLogViewer />
          )}

          {activeTab === 'system' && (
            <SystemHealthDashboard />
          )}
        </div>
      </div>

      {/* Tenant Modal */}
      {showTenantModal && (
        <Modal
          isOpen={showTenantModal}
          onClose={() => setShowTenantModal(false)}
          title={selectedTenant ? 'Edit Tenant' : 'Create New Tenant'}
        >
          <TenantForm
            tenant={selectedTenant}
            onSave={handleTenantSaved}
            onCancel={() => setShowTenantModal(false)}
          />
        </Modal>
      )}
    </ClientLayout>
  );
}