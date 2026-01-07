'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { DataTable } from '../../ui/DataTable';
import { Modal } from '../../ui/Modal';
import { User, UserRole } from '../../../types';
import { api } from '@/lib/api-client';

interface TenantUserManagementProps {
  tenantId: string;
  tenantName: string;
}

interface UserFormData {
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  password?: string;
  is_active: boolean;
  mfa_enabled: boolean;
}

export function TenantUserManagement({ tenantId, tenantName }: TenantUserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    is_active: '',
  });

  useEffect(() => {
    loadUsers();
  }, [tenantId]);

  useEffect(() => {
    let filtered = users;

    if (filters.search) {
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(filters.search.toLowerCase()) ||
        user.first_name.toLowerCase().includes(filters.search.toLowerCase()) ||
        user.last_name.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    if (filters.role) {
      filtered = filtered.filter(user => user.role === filters.role);
    }

    if (filters.is_active !== '') {
      filtered = filtered.filter(user => user.is_active === (filters.is_active === 'true'));
    }

    setFilteredUsers(filtered);
  }, [users, filters]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/tenants/${tenantId}/users`);
      if (response.ok) {
        const result = await response.json();
        setUsers(result.data || []);
      } else {
        console.error('Failed to load users:', response.status, response.statusText);
        // Set empty array on error to prevent crashes
        setUsers([]);
      }
    } catch {
      console.error('Error loading users:', error);
      // Set empty array on error to prevent crashes
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setSelectedUser(null);
    setShowUserModal(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const handleSaveUser = async (formData: UserFormData) => {
    try {
      setSaving(true);

      const userData = {
        ...formData,
        tenant_id: tenantId, // Ensure user is created in the current tenant
      };

      const url = selectedUser ? `/api/users/${selectedUser.id}` : '/api/users';
      const method = selectedUser ? 'PUT' : 'POST';

      const response = await api[method === 'PUT' ? 'put' : 'post'](url, userData);

      if (response.ok) {
        setShowUserModal(false);
        setSelectedUser(null);
        loadUsers(); // Reload users
      } else {
        const error = await response.json();
        alert(error.error?.message || 'Failed to save user');
      }
    } catch {
      console.error('Failed to save user:', error);
      alert('Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this user?')) {
      return;
    }

    try {
      const response = await api.put(`/api/users/${userId}`, { is_active: false });

      if (response.ok) {
        loadUsers();
      } else {
        const error = await response.json();
        alert(error.error?.message || 'Failed to deactivate user');
      }
    } catch {
      console.error('Failed to deactivate user:', error);
      alert('Failed to deactivate user');
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!confirm('Are you sure you want to reset this user\'s password?')) {
      return;
    }

    try {
      const response = await api.put(`/api/users/${userId}/password`, { 
        new_password: 'TempPassword123!',
        reset_required: true 
      });

      if (response.ok) {
        alert('Password reset successfully. Temporary password: TempPassword123!');
      } else {
        const error = await response.json();
        alert(error.error?.message || 'Failed to reset password');
      }
    } catch {
      console.error('Failed to reset password:', error);
      alert('Failed to reset password');
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case UserRole.TENANT_ADMIN: return 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-200';
      case UserRole.SECURITY_ANALYST: return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-200';
      case UserRole.IT_HELPDESK_ANALYST: return 'text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-200';
      case UserRole.USER: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getRoleDisplayName = (role: UserRole) => {
    switch (role) {
      case UserRole.TENANT_ADMIN: return 'Admin';
      case UserRole.SECURITY_ANALYST: return 'Security Analyst';
      case UserRole.IT_HELPDESK_ANALYST: return 'IT Support';
      case UserRole.USER: return 'User';
      default: return role;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600 dark:text-gray-400">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Team Members
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage users in {tenantName}
          </p>
        </div>
        <Button onClick={handleCreateUser}>
          Add User
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Search"
              placeholder="Search users..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={filters.role}
                onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
              >
                <option value="">All Roles</option>
                <option value={UserRole.TENANT_ADMIN}>Admin</option>
                <option value={UserRole.SECURITY_ANALYST}>Security Analyst</option>
                <option value={UserRole.IT_HELPDESK_ANALYST}>IT Support</option>
                <option value={UserRole.USER}>User</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={filters.is_active}
                onChange={(e) => setFilters(prev => ({ ...prev, is_active: e.target.value }))}
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Users ({filteredUsers.length} of {users.length})
          </h3>
          
          <DataTable
            data={filteredUsers}
            columns={[
              { key: 'email', label: 'Email' },
              { 
                key: 'name', 
                label: 'Name',
                render: (user: User) => `${user.first_name} ${user.last_name}`
              },
              {
                key: 'role',
                label: 'Role',
                render: (user: User) => (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                    {getRoleDisplayName(user.role)}
                  </span>
                )
              },
              {
                key: 'is_active',
                label: 'Status',
                render: (user: User) => (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user.is_active 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                )
              },
              {
                key: 'mfa_enabled',
                label: 'MFA',
                render: (user: User) => user.mfa_enabled ? '✅' : '❌'
              },
              {
                key: 'last_login',
                label: 'Last Login',
                render: (user: User) => user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (user: User) => (
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditUser(user)}
                    >
                      Edit
                    </Button>
                    {user.is_active && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeactivateUser(user.id)}
                      >
                        Deactivate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResetPassword(user.id)}
                    >
                      Reset Password
                    </Button>
                  </div>
                )
              }
            ]}
          />
        </div>
      </Card>

      {/* User Modal */}
      {showUserModal && (
        <Modal
          isOpen={showUserModal}
          onClose={() => setShowUserModal(false)}
          title={selectedUser ? 'Edit User' : 'Add New User'}
        >
          <TenantUserForm
            user={selectedUser}
            onSave={handleSaveUser}
            onCancel={() => setShowUserModal(false)}
            loading={saving}
          />
        </Modal>
      )}
    </div>
  );
}

interface TenantUserFormProps {
  user: User | null;
  onSave: (data: UserFormData) => void;
  onCancel: () => void;
  loading: boolean;
}

function TenantUserForm({ user, onSave, onCancel, loading }: TenantUserFormProps) {
  const [formData, setFormData] = useState<UserFormData>({
    email: user?.email || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    role: user?.role || UserRole.USER,
    is_active: user?.is_active ?? true,
    mfa_enabled: user?.mfa_enabled || false,
  });

  const handleSubmit = (e: unknown) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          required
        />
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Role
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            value={formData.role}
            onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
            required
          >
            <option value={UserRole.USER}>User</option>
            <option value={UserRole.IT_HELPDESK_ANALYST}>IT Support</option>
            <option value={UserRole.SECURITY_ANALYST}>Security Analyst</option>
            <option value={UserRole.TENANT_ADMIN}>Admin</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="First Name"
          value={formData.first_name}
          onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
          required
        />
        
        <Input
          label="Last Name"
          value={formData.last_name}
          onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
          required
        />
      </div>

      {!user && (
        <Input
          label="Password"
          type="password"
          value={formData.password || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
          required={!user}
          placeholder="Minimum 8 characters"
        />
      )}

      <div className="flex items-center space-x-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
            className="mr-2"
          />
          <span className="text-gray-700 dark:text-gray-300">Active</span>
        </label>
        
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.mfa_enabled}
            onChange={(e) => setFormData(prev => ({ ...prev, mfa_enabled: e.target.checked }))}
            className="mr-2"
          />
          <span className="text-gray-700 dark:text-gray-300">MFA Enabled</span>
        </label>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : (user ? 'Update User' : 'Add User')}
        </Button>
      </div>
    </form>
  );
}