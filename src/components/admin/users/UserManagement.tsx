'use client';

import React, { useState } from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { DataTable } from '../../ui/DataTable';
import { Modal } from '../../ui/Modal';
import { User, Tenant, UserRole } from '../../../types';
import { api } from '@/lib/api-client';

interface UserManagementProps {
  users: User[];
  tenants: Tenant[];
  onUserUpdated: () => void;
}

interface UserFormData {
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  tenant_id: string;
  password?: string;
  is_active: boolean;
  mfa_enabled: boolean;
}

export function UserManagement({ users, tenants, onUserUpdated }: UserManagementProps) {
  const [filteredUsers, setFilteredUsers] = useState(users);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    tenant_id: '',
    role: '',
    is_active: '',
  });

  // Update filtered users when users prop changes
  React.useEffect(() => {
    let filtered = users;

    if (filters.search) {
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(filters.search.toLowerCase()) ||
        user.first_name.toLowerCase().includes(filters.search.toLowerCase()) ||
        user.last_name.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    if (filters.tenant_id) {
      filtered = filtered.filter(user => user.tenant_id === filters.tenant_id);
    }

    if (filters.role) {
      filtered = filtered.filter(user => user.role === filters.role);
    }

    if (filters.is_active !== '') {
      filtered = filtered.filter(user => user.is_active === (filters.is_active === 'true'));
    }

    setFilteredUsers(filtered);
  }, [users, filters]);

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
      setLoading(true);

      const url = selectedUser ? `/api/users/${selectedUser.id}` : '/api/users';
      const method = selectedUser ? 'PUT' : 'POST';

      const response = await api[method === 'PUT' ? 'put' : 'post'](url, formData);

      if (response.ok) {
        setShowUserModal(false);
        setSelectedUser(null);
        onUserUpdated();
      } else {
        const error = await response.json();
        alert(error.error?.message || 'Failed to save user');
      }
    } catch {
      console.error('Failed to save user:', error);
      alert('Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this user?')) {
      return;
    }

    try {
      const response = await api.put(`/api/users/${userId}`, { is_active: false });

      if (response.ok) {
        onUserUpdated();
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
      case UserRole.SUPER_ADMIN: return 'text-purple-600 bg-purple-100';
      case UserRole.TENANT_ADMIN: return 'text-blue-600 bg-blue-100';
      case UserRole.SECURITY_ANALYST: return 'text-green-600 bg-green-100';
      case UserRole.IT_HELPDESK_ANALYST: return 'text-orange-600 bg-orange-100';
      case UserRole.USER: return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTenantName = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    return tenant?.name || 'Unknown';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          User Management
        </h2>
        <Button onClick={handleCreateUser}>
          Create New User
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="Search"
              placeholder="Search users..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tenant
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.tenant_id}
                onChange={(e) => setFilters(prev => ({ ...prev, tenant_id: e.target.value }))}
              >
                <option value="">All Tenants</option>
                {tenants.map(tenant => (
                  <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.role}
                onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
              >
                <option value="">All Roles</option>
                <option value={UserRole.SUPER_ADMIN}>Super Admin</option>
                <option value={UserRole.TENANT_ADMIN}>Tenant Admin</option>
                <option value={UserRole.SECURITY_ANALYST}>Security Analyst</option>
                <option value={UserRole.IT_HELPDESK_ANALYST}>IT Helpdesk Analyst</option>
                <option value={UserRole.USER}>User</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <h3 className="text-lg font-semibold mb-4">
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
                    {user.role.replace('_', ' ').toUpperCase()}
                  </span>
                )
              },
              {
                key: 'tenant_id',
                label: 'Tenant',
                render: (user: User) => getTenantName(user.tenant_id)
              },
              {
                key: 'is_active',
                label: 'Status',
                render: (user: User) => (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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
          title={selectedUser ? 'Edit User' : 'Create New User'}
        >
          <UserForm
            user={selectedUser}
            tenants={tenants}
            onSave={handleSaveUser}
            onCancel={() => setShowUserModal(false)}
            loading={loading}
          />
        </Modal>
      )}
    </div>
  );
}

interface UserFormProps {
  user: User | null;
  tenants: Tenant[];
  onSave: (data: UserFormData) => void;
  onCancel: () => void;
  loading: boolean;
}

function UserForm({ user, tenants, onSave, onCancel, loading }: UserFormProps) {
  const [formData, setFormData] = useState<UserFormData>({
    email: user?.email || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    role: user?.role || UserRole.USER,
    tenant_id: user?.tenant_id || '',
    is_active: user?.is_active ?? true,
    mfa_enabled: user?.mfa_enabled || false,
  });

  const handleSubmit = (e: unknown) => {
    e.preventDefault();
    onSave(formData);
  };

  // Check if the selected role requires tenant selection
  const requiresTenant = formData.role === UserRole.TENANT_ADMIN || formData.role === UserRole.USER;

  // Clear tenant_id if role doesn't require it
  React.useEffect(() => {
    if (!requiresTenant) {
      setFormData(prev => ({ ...prev, tenant_id: '' }));
    }
  }, [requiresTenant]);

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
        
        {requiresTenant && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tenant
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.tenant_id}
              onChange={(e) => setFormData(prev => ({ ...prev, tenant_id: e.target.value }))}
              required
            >
              <option value="">Select Tenant</option>
              {tenants.map(tenant => (
                <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
              ))}
            </select>
          </div>
        )}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Role
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.role}
            onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
            required
          >
            <option value={UserRole.USER}>User</option>
            <option value={UserRole.IT_HELPDESK_ANALYST}>IT Helpdesk Analyst</option>
            <option value={UserRole.SECURITY_ANALYST}>Security Analyst</option>
            <option value={UserRole.TENANT_ADMIN}>Tenant Admin</option>
            <option value={UserRole.SUPER_ADMIN}>Super Admin</option>
          </select>
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
      </div>

      <div className="flex items-center space-x-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
            className="mr-2"
          />
          Active
        </label>
        
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.mfa_enabled}
            onChange={(e) => setFormData(prev => ({ ...prev, mfa_enabled: e.target.checked }))}
            className="mr-2"
          />
          MFA Enabled
        </label>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : (user ? 'Update User' : 'Create User')}
        </Button>
      </div>
    </form>
  );
}