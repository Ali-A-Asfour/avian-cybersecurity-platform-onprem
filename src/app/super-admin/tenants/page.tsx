'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Building2, Plus, Users, Settings, Eye, Edit, Trash2 } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  domain: string;
  identifier: string;
  is_active: boolean;
  users_count: number;
  created_at: string;
  last_activity?: string;
}

export default function TenantsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    if (user && user.role !== 'super_admin') {
      router.push('/dashboard');
      return;
    }

    if (user) {
      loadTenants();
    }
  }, [authLoading, isAuthenticated, user, router]);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/super-admin/tenants', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTenants(data.data.tenants || []);
        } else {
          setError('Failed to load tenants');
        }
      } else {
        setError('Failed to load tenants');
      }
    } catch (err) {
      setError('Failed to load tenants');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTenant = async (tenantId: string, tenantName: string) => {
    if (!confirm(`Are you sure you want to delete "${tenantName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingTenant(tenantId);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/tenants/${tenantId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Remove tenant from the list
          setTenants(prev => prev.filter(t => t.id !== tenantId));
          setSuccessMessage(`Tenant "${tenantName}" has been deleted successfully.`);
          
          // Clear success message after 5 seconds
          setTimeout(() => setSuccessMessage(null), 5000);
        } else {
          setError(data.error?.message || 'Failed to delete tenant');
        }
      } else {
        setError('Failed to delete tenant');
      }
    } catch (err) {
      setError('Network error while deleting tenant');
      console.error('Error deleting tenant:', err);
    } finally {
      setDeletingTenant(null);
    }
  };

  if (authLoading || loading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading tenants...</p>
          </div>
        </div>
      </ClientLayout>
    );
  }

  if (!isAuthenticated || !user || user.role !== 'super_admin') {
    return null;
  }

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Tenant Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage organizations and their security monitoring setup
              </p>
            </div>
          </div>
          <Button
            onClick={() => router.push('/super-admin/tenants/create')}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create New Tenant
          </Button>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="p-4 bg-green-100 dark:bg-green-800 border-2 border-green-300 dark:border-green-600 rounded-lg shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-green-800 dark:text-green-100 font-medium">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-100 dark:bg-red-800 border-2 border-red-300 dark:border-red-600 rounded-lg shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-red-800 dark:text-red-100 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Tenants Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants.map((tenant) => (
            <Card key={tenant.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {tenant.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {tenant.domain || tenant.identifier}
                    </p>
                  </div>
                </div>
                <div className={`px-2 py-1 text-xs rounded-full ${
                  tenant.is_active 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                }`}>
                  {tenant.is_active ? 'Active' : 'Inactive'}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Users className="w-4 h-4" />
                  <span>{tenant.users_count} users</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Created: {new Date(tenant.created_at).toLocaleDateString()}
                </div>
                {tenant.last_activity && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Last activity: {new Date(tenant.last_activity).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/super-admin/tenants/${tenant.id}`)}
                  className="flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/super-admin/tenants/${tenant.id}/edit`)}
                  className="flex items-center gap-1"
                >
                  <Edit className="w-3 h-3" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                  disabled={deletingTenant === tenant.id}
                  className="flex items-center gap-1 text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  {deletingTenant === tenant.id ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {tenants.length === 0 && !loading && (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No tenants found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Get started by creating your first tenant organization.
            </p>
            <Button
              onClick={() => router.push('/super-admin/tenants/create')}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create First Tenant
            </Button>
          </div>
        )}
      </div>
    </ClientLayout>
  );
}