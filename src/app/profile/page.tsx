'use client';

import { useState } from 'react';
import { useRequireAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { api } from '@/lib/api-client';

/**
 * User Profile Page
 * Allows users to view and edit their profile
 * Part of production authentication system (Task 8.1)
 */

export default function ProfilePage() {
    return (
        <ProtectedRoute>
            <ClientLayout>
                <ProfileContent />
            </ClientLayout>
        </ProtectedRoute>
    );
}

function ProfileContent() {
    const { user, loading } = useRequireAuth();
    const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'sessions'>('profile');

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Manage your account settings and preferences
                </p>
            </div>

                {/* Tabs */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                    <div className="border-b border-gray-200 dark:border-gray-700">
                        <nav className="flex -mb-px">
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`px-6 py-4 text-sm font-medium border-b-2 ${activeTab === 'profile'
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                    }`}
                            >
                                Profile
                            </button>
                            <button
                                onClick={() => setActiveTab('password')}
                                className={`px-6 py-4 text-sm font-medium border-b-2 ${activeTab === 'password'
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                    }`}
                            >
                                Password
                            </button>
                            <button
                                onClick={() => setActiveTab('sessions')}
                                className={`px-6 py-4 text-sm font-medium border-b-2 ${activeTab === 'sessions'
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                    }`}
                            >
                                Sessions
                            </button>
                        </nav>
                    </div>

                    <div className="p-6">
                        {activeTab === 'profile' && <ProfileTab user={user} />}
                        {activeTab === 'password' && <PasswordTab />}
                        {activeTab === 'sessions' && <SessionsTab />}
                    </div>
                </div>
            </div>
        );
    }

function ProfileTab({ user }: { user: any }) {
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({
        firstName: user?.name.split(' ')[0] || '',
        lastName: user?.name.split(' ')[1] || '',
        email: user?.email || '',
    });

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Personal Information
                </h3>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                First Name
                            </label>
                            <input
                                type="text"
                                value={formData.firstName}
                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                disabled={!editing}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Last Name
                            </label>
                            <input
                                type="text"
                                value={formData.lastName}
                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                disabled={!editing}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            disabled
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white cursor-not-allowed"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Email cannot be changed. Contact support if you need to update it.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Role
                        </label>
                        <input
                            type="text"
                            value={user?.role || ''}
                            disabled
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white cursor-not-allowed"
                        />
                    </div>
                </div>

                <div className="mt-6 flex space-x-3">
                    {!editing ? (
                        <button
                            onClick={() => setEditing(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            Edit Profile
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => {
                                    // TODO: Save changes
                                    setEditing(false);
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                Save Changes
                            </button>
                            <button
                                onClick={() => setEditing(false)}
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                            >
                                Cancel
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function PasswordTab() {
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (_e: unknown) => {
        e.preventDefault();
        setError('');
        setSuccess(false);
        setLoading(true);

        if (formData.newPassword !== formData.confirmPassword) {
            setError('New passwords do not match');
            setLoading(false);
            return;
        }

        try {
            const response = await api.post('/api/auth/change-password', {
                currentPassword: formData.currentPassword,
                newPassword: formData.newPassword,
                confirmPassword: formData.confirmPassword,
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Failed to change password');
                setLoading(false);
                return;
            }

            setSuccess(true);
            setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Change Password
                </h3>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                        <p className="text-sm text-green-800 dark:text-green-200">
                            Password changed successfully!
                        </p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Current Password
                        </label>
                        <input
                            type="password"
                            value={formData.currentPassword}
                            onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                            required
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            New Password
                        </label>
                        <input
                            type="password"
                            value={formData.newPassword}
                            onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                            required
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Must be at least 12 characters with uppercase, lowercase, number, and special character
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Confirm New Password
                        </label>
                        <input
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            required
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Changing Password...' : 'Change Password'}
                    </button>
                </form>
            </div>
        </div>
    );
}

function SessionsTab() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Active Sessions
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Manage your active sessions across different devices
                </p>

                <div className="space-y-3">
                    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0">
                                    <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        Current Session
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Last active: Just now
                                    </p>
                                </div>
                            </div>
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                                Active
                            </span>
                        </div>
                    </div>

                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        No other active sessions
                    </p>
                </div>
            </div>
        </div>
    );
}
