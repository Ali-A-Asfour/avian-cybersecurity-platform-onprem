'use client';

import React, { useEffect, useState } from 'react';
import { Tenant, UserRole, ApiResponse } from '../../../types';

interface TenantUser {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  mfa_enabled: boolean;
  last_login: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TenantUsersProps {
  tenant: Tenant;
  onUserSelect?: (user: TenantUser) => void;
}

interface TenantUsersState {
  users: TenantUser[];
  loading: boolean;
  error: string | null;
  page: number;
  limit: number;
  total: number;
  filters: {
    role?: UserRole;
    is_active?: boolean;
  };
}

export default function TenantUsers({ tenant, onUserSelect }: TenantUsersProps) {
  const [state, setState] = useState<TenantUsersState>({
    users: [],
    loading: true,
    error: null,
    page: 1,
    limit: 20,
    total: 0,
    filters: {},
  });

  // Fetch tenant users
  const fetchUsers = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const params = new URLSearchParams({
        page: state.page.toString(),
        limit: state.limit.toString(),
      });

      if (state.filters.role) {
        params.append('role', state.filters.role);
      }

      if (state.filters.is_active !== undefined) {
        params.append('is_active', state.filters.is_active.toString());
      }

      const response = await fetch(`/api/tenants/${tenant.id}/users?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: ApiResponse<TenantUser[]> = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch users');
      }

      setState(prev => ({
        ...prev,
        users: result.data || [],
        total: result.meta?.total || 0,
        loading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch users',
        loading: false,
      }));
    }
  };

  // Load users on component mount and when filters change
  useEffect(() => {
    fetchUsers();
  }, [state.page, state.filters, tenant.id]);

  // Handle filter changes
  const handleFilterChange = (filters: Partial<TenantUsersState['filters']>) => {
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

  // Get role badge color
  const getRoleBadgeColor = (role: UserRole): string => {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case UserRole.TENANT_ADMIN:
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case UserRole.SECURITY_ANALYST:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case UserRole.IT_HELPDESK_ANALYST:
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case UserRole.USER:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // Format role display name
  const formatRole = (role: UserRole): string => {
    return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

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
          onClick={fetchUsers}
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
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Tenant Users
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Manage users and their roles within {tenant.name}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <select
              value={state.filters.role || 'all'}
              onChange={(e) => {
                const value = e.target.value;
                handleFilterChange({
                  role: value === 'all' ? undefined : value as UserRole
                });
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Roles</option>
              <option value={UserRole.TENANT_ADMIN}>Tenant Admin</option>
              <option value={UserRole.SECURITY_ANALYST}>Security Analyst</option>
              <option value={UserRole.IT_HELPDESK_ANALYST}>IT Helpdesk Analyst</option>
              <option value={UserRole.USER}>User</option>
            </select>
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

      {/* Users List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {state.users.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    MFA
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {state.users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => onUserSelect?.(user)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 mr-3 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {user.first_name.charAt(0).toUpperCase()}{user.last_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}
                      >
                        {formatRole(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.last_login 
                        ? new Date(user.last_login).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.mfa_enabled
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}
                      >
                        {user.mfa_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUserSelect?.(user);
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
                Showing {((state.page - 1) * state.limit) + 1} to {Math.min(state.page * state.limit, state.total)} of {state.total} users
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