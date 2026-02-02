'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { api } from '@/lib/api-client';

/**
 * Admin User Management Page
 * Allows admins to manage users
 * Part of production authentication system (Task 8.2)
 */

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLogin: string | null;
}

export default function AdminUsersPage() {
  const { user, loading, isAuthenticated } = useAuth();

  // Show loading while auth is being checked
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }

  // Check role authorization
  if (!user || !['super_admin', 'tenant_admin'].includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <UsersContent />;
}

function UsersContent() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Safety check - ensure user has proper role
  if (!currentUser || !['super_admin', 'tenant_admin'].includes(currentUser.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  // Get allowed roles for filtering based on current user's role
  const getAllowedFilterRoles = () => {
    if (currentUser.role === 'super_admin') {
      return [
        { value: 'all', label: 'All Roles' },
        { value: 'super_admin', label: 'Super Admin' },
        { value: 'tenant_admin', label: 'Tenant Admin' },
        { value: 'security_analyst', label: 'Security Analyst' },
        { value: 'it_helpdesk_analyst', label: 'IT Helpdesk' },
        { value: 'user', label: 'User' },
      ];
    } else if (currentUser.role === 'tenant_admin') {
      return [
        { value: 'all', label: 'All Roles' },
        { value: 'tenant_admin', label: 'Tenant Admin' },
        { value: 'user', label: 'User' },
      ];
    }
    return [{ value: 'all', label: 'All Roles' }];
  };

  const allowedFilterRoles = getAllowedFilterRoles();

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/users');
      
      if (response.ok) {
        const data = await response.json();
        // Map API response (snake_case) to frontend format (camelCase)
        const mappedUsers = (data.data || []).map((user: any) => ({
          id: user.id,
          email: user.email,
          firstName: user.first_name || '',
          lastName: user.last_name || '',
          role: user.role,
          tenantId: user.tenant_id,
          isActive: user.is_active,
          emailVerified: user.email_verified,
          createdAt: user.created_at,
          lastLogin: user.last_login,
        }));
        setUsers(mappedUsers);
      } else {
        console.error('Failed to load users');
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <ClientLayout>
      <div className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Manage users and their permissions
          </p>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex-1 flex space-x-4">
              {/* Search */}
              <div className="flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Role Filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {allowedFilterRoles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Create Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            >
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create User
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <UserRow key={user.id} user={user} currentUser={currentUser} onUserUpdated={loadUsers} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Create User Modal */}
        {showCreateModal && (
          <CreateUserModal 
            onClose={() => setShowCreateModal(false)} 
            onUserCreated={loadUsers}
          />
        )}
        </div>
      </div>
    </ClientLayout>
  );
}

function UserRow({ user, currentUser, onUserUpdated }: { user: User; currentUser: any; onUserUpdated?: () => void }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMenu) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showMenu]);

  const handleEditUser = () => {
    setShowMenu(false);
    setShowEditModal(true);
  };

  const handleChangeRole = () => {
    setShowMenu(false);
    setShowEditModal(true); // Use the edit modal for role changes too
  };

  const handleResetPassword = async () => {
    setShowMenu(false);
    setLoading(true);
    
    // Generate a temporary password
    const tempPassword = 'TempPass' + Math.random().toString(36).substring(2, 8);
    
    try {
      const response = await api.post('/api/users/reset-password', {
        userId: user.id,
        newPassword: tempPassword,
      });
      
      if (response.ok) {
        alert(`Password reset successfully!\n\nTemporary password: ${tempPassword}\n\nThe user will need to change this password on their next login.`);
      } else {
        const errorData = await response.json();
        alert(`Failed to reset password: ${errorData.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    setShowMenu(false);
    setLoading(true);
    
    try {
      const response = await api.put(`/api/users?id=${user.id}`, {
        is_active: !user.isActive,
      });
      
      if (response.ok) {
        alert(`User ${user.isActive ? 'deactivated' : 'activated'} successfully!`);
        if (onUserUpdated) {
          onUserUpdated();
        }
      } else {
        const errorData = await response.json();
        alert(`Failed to ${user.isActive ? 'deactivate' : 'activate'} user: ${errorData.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
      alert(`Failed to ${user.isActive ? 'deactivate' : 'activate'} user. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = () => {
    setShowMenu(false);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteUser = async () => {
    setLoading(true);
    
    try {
      const response = await api.delete(`/api/users?id=${user.id}`);
      
      if (response.ok) {
        setShowDeleteConfirm(false);
        if (onUserUpdated) {
          onUserUpdated();
        }
      } else {
        const errorData = await response.json();
        alert(`Failed to delete user: ${errorData.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      tenant_admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      security_analyst: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      it_helpdesk_analyst: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      user: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    };
    return colors[role] || colors.user;
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: 'Super Admin',
      tenant_admin: 'Tenant Admin',
      security_analyst: 'Security Analyst',
      it_helpdesk_analyst: 'IT Helpdesk',
      user: 'User',
    };
    return labels[role] || role;
  };

  return (
    <>
      <tr>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <div className="flex-shrink-0 h-10 w-10">
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                {(user.firstName || '').charAt(0)}{(user.lastName || '').charAt(0)}
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {(user.firstName || '')} {(user.lastName || '')}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
            </div>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadge(user.role)}`}>
            {getRoleLabel(user.role)}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex flex-col space-y-1">
            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isActive
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}>
              {user.isActive ? 'Active' : 'Inactive'}
            </span>
            {!user.emailVerified && (
              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                Unverified
              </span>
            )}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
          {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div className="relative inline-block text-left">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-xl bg-white dark:bg-gray-700 ring-1 ring-black ring-opacity-5 z-[9999]">
                <div className="py-1">
                  <button 
                    onClick={handleEditUser}
                    disabled={loading}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    Edit User
                  </button>
                  <button 
                    onClick={handleChangeRole}
                    disabled={loading}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    Change Role
                  </button>
                  <button 
                    onClick={handleResetPassword}
                    disabled={loading}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                  <button 
                    onClick={handleToggleActive}
                    disabled={loading}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : (user.isActive ? 'Deactivate' : 'Activate')}
                  </button>
                  {user.id !== currentUser?.id && (
                    <button 
                      onClick={handleDeleteUser}
                      disabled={loading}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
                    >
                      Delete User
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </td>
      </tr>

      {/* Edit User Modal */}
      {showEditModal && (
        <EditUserModal 
          user={user}
          onClose={() => setShowEditModal(false)}
          onUserUpdated={onUserUpdated}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Delete User
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete {(user.firstName || '')} {(user.lastName || '')}? This action cannot be undone.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={confirmDeleteUser}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function EditUserModal({ user, onClose, onUserUpdated }: { user: User; onClose: () => void; onUserUpdated?: () => void }) {
  const { user: currentUser } = useAuth();
  const [formData, setFormData] = useState({
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Safety check
  if (!currentUser || !['super_admin', 'tenant_admin'].includes(currentUser.role)) {
    return null;
  }

  // Get allowed roles based on current user's role
  const getAllowedRoles = () => {
    if (currentUser.role === 'super_admin') {
      return [
        { value: 'user', label: 'User' },
        { value: 'tenant_admin', label: 'Tenant Admin' },
        { value: 'security_analyst', label: 'Security Analyst' },
        { value: 'it_helpdesk_analyst', label: 'IT Helpdesk' },
        { value: 'super_admin', label: 'Super Admin' },
      ];
    } else if (currentUser.role === 'tenant_admin') {
      return [
        { value: 'user', label: 'User' },
        { value: 'tenant_admin', label: 'Tenant Admin' },
      ];
    }
    return [{ value: 'user', label: 'User' }];
  };

  const allowedRoles = getAllowedRoles();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.put(`/api/users?id=${user.id}`, {
        email: formData.email,
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: formData.role,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to update user');
      }
      
      alert('User updated successfully!');
      onClose();
      if (onUserUpdated) {
        onUserUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Edit User</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {allowedRoles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update User'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onUserCreated }: { onClose: () => void; onUserCreated?: () => void }) {
  const { user: currentUser } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'user',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Safety check
  if (!currentUser || !['super_admin', 'tenant_admin'].includes(currentUser.role)) {
    return null;
  }

  // Get allowed roles based on current user's role
  const getAllowedRoles = () => {
    if (currentUser.role === 'super_admin') {
      return [
        { value: 'user', label: 'User' },
        { value: 'tenant_admin', label: 'Tenant Admin' },
        { value: 'security_analyst', label: 'Security Analyst' },
        { value: 'it_helpdesk_analyst', label: 'IT Helpdesk' },
        { value: 'super_admin', label: 'Super Admin' },
      ];
    } else if (currentUser.role === 'tenant_admin') {
      return [
        { value: 'user', label: 'User' },
        { value: 'tenant_admin', label: 'Tenant Admin' },
      ];
    }
    return [{ value: 'user', label: 'User' }];
  };

  const allowedRoles = getAllowedRoles();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Prepare the data for the API
      const userData = {
        email: formData.email,
        first_name: formData.firstName,
        last_name: formData.lastName,
        password: formData.password,
        role: formData.role,
        tenant_id: currentUser.tenantId, // Use current user's tenant
      };

      const response = await api.post('/api/users', userData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to create user');
      }

      // Success - close modal and refresh users list
      onClose();
      if (onUserCreated) {
        onUserCreated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Create New User</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {allowedRoles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Temporary Password
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                User will be required to change this on first login
              </p>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
