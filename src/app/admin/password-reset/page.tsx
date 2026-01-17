'use client';

/**
 * Admin Password Reset Page
 * Allows tenant admins and super admins to reset user passwords
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Shield, Key, User, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface User {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    tenant_id: string;
    is_active: boolean;
}

export default function AdminPasswordResetPage() {
    const router = useRouter();
    const { user, isAuthenticated, loading: authLoading } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
            return;
        }

        if (user && !['super_admin', 'tenant_admin'].includes(user.role)) {
            router.push('/dashboard');
            return;
        }

        if (user) {
            loadUsers();
        }
    }, [authLoading, isAuthenticated, user, router]);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/users', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth-token')}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
            } else {
                setError('Failed to load users');
            }
        } catch (err) {
            setError('Failed to load users');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const generateRandomPassword = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setNewPassword(password);
        setConfirmPassword(password);
    };

    const handleResetPassword = async () => {
        if (!selectedUser) return;

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters long');
            return;
        }

        try {
            setResetting(true);
            setError(null);

            const response = await fetch('/api/admin/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth-token')}`,
                },
                body: JSON.stringify({
                    userId: selectedUser.id,
                    newPassword,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(`Password reset successfully for ${selectedUser.email}`);
                setSelectedUser(null);
                setNewPassword('');
                setConfirmPassword('');
                setTimeout(() => setSuccess(null), 5000);
            } else {
                setError(data.error || 'Failed to reset password');
            }
        } catch (err) {
            setError('Failed to reset password');
            console.error(err);
        } finally {
            setResetting(false);
        }
    };

    if (authLoading || loading) {
        return (
            <ClientLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
                    </div>
                </div>
            </ClientLayout>
        );
    }

    if (!isAuthenticated || !user || !['super_admin', 'tenant_admin'].includes(user.role)) {
        return null;
    }

    return (
        <ClientLayout>
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Shield className="w-8 h-8 text-blue-600" />
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Admin Password Reset
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Reset user passwords for your {user.role === 'super_admin' ? 'platform' : 'organization'}
                        </p>
                    </div>
                </div>

                {/* Success Message */}
                {success && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="text-green-800 dark:text-green-200">{success}</p>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <p className="text-red-800 dark:text-red-200">{error}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* User Selection */}
                    <Card className="p-6">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <User className="w-5 h-5" />
                            Select User
                        </h2>

                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {users.map((u) => (
                                <button
                                    key={u.id}
                                    onClick={() => setSelectedUser(u)}
                                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                        selectedUser?.id === u.id
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {u.first_name} {u.last_name}
                                            </p>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                {u.email}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-500">
                                                {u.role.replace('_', ' ').toUpperCase()}
                                            </p>
                                        </div>
                                        {!u.is_active && (
                                            <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                                                Inactive
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>

                        {users.length === 0 && (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                                No users found
                            </p>
                        )}
                    </Card>

                    {/* Password Reset Form */}
                    <Card className="p-6">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <Key className="w-5 h-5" />
                            Reset Password
                        </h2>

                        {selectedUser ? (
                            <div className="space-y-4">
                                {/* Selected User Info */}
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                    <p className="font-medium text-blue-900 dark:text-blue-100">
                                        {selectedUser.first_name} {selectedUser.last_name}
                                    </p>
                                    <p className="text-sm text-blue-700 dark:text-blue-300">
                                        {selectedUser.email}
                                    </p>
                                </div>

                                {/* New Password */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        New Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            placeholder="Enter new password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Confirm Password */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Confirm Password
                                    </label>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        placeholder="Confirm new password"
                                    />
                                </div>

                                {/* Generate Random Password */}
                                <Button
                                    variant="outline"
                                    onClick={generateRandomPassword}
                                    className="w-full"
                                >
                                    Generate Random Password
                                </Button>

                                {/* Reset Button */}
                                <Button
                                    onClick={handleResetPassword}
                                    disabled={resetting || !newPassword || !confirmPassword}
                                    className="w-full"
                                >
                                    {resetting ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Resetting Password...
                                        </>
                                    ) : (
                                        'Reset Password'
                                    )}
                                </Button>

                                {/* Password Requirements */}
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    <p>Password requirements:</p>
                                    <ul className="list-disc list-inside mt-1 space-y-1">
                                        <li>At least 8 characters long</li>
                                        <li>Mix of letters, numbers, and symbols recommended</li>
                                    </ul>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-500 dark:text-gray-400">
                                    Select a user to reset their password
                                </p>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Info Card */}
                <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                            <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                                Admin Password Reset
                            </h3>
                            <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                                <p>• This bypasses the normal email-based password reset process</p>
                                <p>• The user will be able to log in immediately with the new password</p>
                                <p>• Any account lockouts will be cleared automatically</p>
                                <p>• {user.role === 'super_admin' 
                                    ? 'As a super admin, you can reset passwords for all users across all organizations' 
                                    : 'As a tenant admin, you can reset passwords for regular users in your organization'
                                }</p>
                                <p>• Make sure to communicate the new password to the user securely</p>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </ClientLayout>
    );
}