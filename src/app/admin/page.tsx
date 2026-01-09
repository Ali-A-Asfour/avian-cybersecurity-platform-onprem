'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';

import { TenantForm } from '@/components/admin/tenants/TenantForm';
import { TenantMetrics } from '@/components/admin/tenants/TenantMetrics';
import { UserManagement } from '@/components/admin/users/UserManagement';
import { Tenant, User } from '@/types';
import { api } from '@/lib/api-client';

export default function AdminPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'tenants' | 'users'>('tenants');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  if (authLoading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </ClientLayout>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const loadData = async () => {
    try {
      setLoading(true);

      // Load tenants
      const tenantsResponse = await api.get('/api/tenants');
      if (tenantsResponse.ok) {
        const tenantsData = await tenantsResponse.json();
        setTenants(tenantsData.data || []);
      }

      // Load users (cross-tenant for super admin)
      const usersResponse = await api.get('/api/users');
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.data || []);
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

  const handleTenantSaved = async (formData: Record<string, unknown>) => {
    try {
      const url = selectedTenant ? `/api/tenants/${selectedTenant.id}` : '/api/tenants';
      const method = selectedTenant ? 'PUT' : 'POST';

      const response = selectedTenant 
        ? await api.put(url, formData)
        : await api.post(url, formData);

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

  const handleDeleteTenant = async (tenant: Tenant) => {
    // Special handling for ACME Corporation (main demo tenant)
    if (tenant.id === 'acme-corp') {
      const confirmed = window.confirm(
        `⚠️ WARNING: You are about to delete the main demo tenant "${tenant.name}".\n\nThis will remove the primary demo data and may affect the demo experience.\n\nAre you sure you want to proceed?`
      );
      if (!confirmed) return;
    }

    // Confirm deletion
    const confirmed = window.confirm(
      `Are you sure you want to delete "${tenant.name}"?\n\nThis action cannot be undone and will:\n- Remove the tenant permanently\n- Delete all tenant data\n- Remove access for all users in this tenant`
    );

    if (!confirmed) return;

    try {
      const response = await api.delete(`/api/tenants/${tenant.id}`);

      if (response.ok) {
        alert(`Tenant "${tenant.name}" has been successfully deleted.`);
        loadData(); // Refresh the tenant list
      } else {
        const error = await response.json();
        alert(error.error?.message || 'Failed to delete tenant');
      }
    } catch (error) {
      console.error('Failed to delete tenant:', error);
      alert('Failed to delete tenant');
    }
  };

  const tabs = [
    { id: 'tenants', label: 'Tenant Management', icon: '🏢' },
    { id: 'users', label: 'User Management', icon: '👥' },
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
      <div className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditTenant(tenant)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteTenant(tenant)}
                              className={
                                tenant.id === 'acme-corp' 
                                  ? "text-orange-600 hover:text-orange-700 hover:border-orange-300 border-orange-200"
                                  : "text-red-600 hover:text-red-700 hover:border-red-300"
                              }
                            >
                              {tenant.id === 'acme-corp' ? '⚠️ Delete' : 'Delete'}
                            </Button>
                          </div>
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
        </div>
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