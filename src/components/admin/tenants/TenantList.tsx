'use client';

import React, { useEffect, useState } from 'react';
import { Tenant, ApiResponse, UserRole } from '../../../types';

interface TenantListProps {
  userRole: UserRole;
  onTenantSelect?: (tenant: Tenant) => void;
  onCreateTenant?: () => void;
}

interface TenantListState {
  tenants: Tenant[];
  loading: boolean;
  error: string | null;
  page: number;
  limit: number;
  total: number;
  filters: {
    is_active?: boolean;
    search?: string;
  };
}

export default function TenantList({ userRole, onTenantSelect, onCreateTenant }: TenantListProps) {
  const [state, setState] = useState<TenantListState>({
    tenants: [],
    loading: true,
    error: null,
    page: 1,
    limit: 20,
    total: 0,
    filters: {},
  });

  // Fetch tenants
  const fetchTenants = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const params = new URLSearchParams({
        page: state.page.toString(),
        limit: state.limit.toString(),
      });

      if (state.filters.is_active !== undefined) {
        params.append('is_active', state.filters.is_active.toString());
      }

      if (state.filters.search) {
        params.append('search', state.filters.search);
      }

      const response = await fetch(`/api/tenants?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: ApiResponse<Tenant[]> = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch tenants');
      }

      setState(prev => ({
        ...prev,
        tenants: result.data || [],
        total: result.meta?.total || 0,
        loading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch tenants',
        loading: false,
      }));
    }
  };

  // Load tenants on component mount and when filters change
  useEffect(() => {
    if (userRole === UserRole.SUPER_ADMIN) {
      fetchTenants();
    }
  }, [state.page, state.filters, userRole]);

  // Handle filter changes
  const handleFilterChange = (filters: Partial<TenantListState['filters']>) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...filters },
      page: 1, // Reset to first page when filters change
    }));
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    setState(prev => ({ ...prev, page: newPage }));
  };

  // Only super admins can see tenant list
  if (userRole !== UserRole.SUPER_ADMIN) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Access denied. Only Super Admins can manage tenants.</p>
      </div>
    );
  }

  if (state.loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{state.error}</p>
        <button
          onClick={fetchTenants}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Tenant Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage tenant organizations and their configurations
          </p>
        </div>
        {onCreateTenant && (
          <button
            onClick={onCreateTenant}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Tenant
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-64">
            <input
              type="text"
              placeholder="Search tenants..."
              value={state.filters.search || ''}
              onChange={(e) => handleFilterChange({ search: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <select
              value={state.filters.is_active === undefined ? 'all' : state.filters.is_active.toString()}
              onChange={(e) => {
                const value = e.target.value;
                handleFilterChange({
                  is_active: value === 'all' ? undefined : value === 'true'
                });
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tenant List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {state.tenants.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">No tenants found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Tenant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Domain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {state.tenants.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => onTenantSelect?.(tenant)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {tenant.logo_url ? (
                          <img
                            src={tenant.logo_url}
                            alt={`${tenant.name} logo`}
                            className="h-8 w-8 rounded-full mr-3"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 mr-3 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {tenant.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {tenant.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            ID: {tenant.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 dark:text-white font-mono">
                        {tenant.domain}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          tenant.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}
                      >
                        {tenant.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(tenant.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTenantSelect?.(tenant);
                        }}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {state.total > state.limit && (
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing {((state.page - 1) * state.limit) + 1} to {Math.min(state.page * state.limit, state.total)} of {state.total} tenants
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange(state.page - 1)}
                  disabled={state.page <= 1}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded 
                           disabled:opacity-50 disabled:cursor-not-allowed
                           hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(state.page + 1)}
                  disabled={state.page >= Math.ceil(state.total / state.limit)}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded 
                           disabled:opacity-50 disabled:cursor-not-allowed
                           hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}