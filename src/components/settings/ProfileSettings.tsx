'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileData {
  name: string;
  email: string;
  phone: string;
  timezone: string;
  language: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ProfileSettingsProps {
  className?: string;
}

export function ProfileSettings({ className }: ProfileSettingsProps) {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    email: '',
    phone: '',
    timezone: 'America/New_York',
    language: 'en',
  });

  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    try {
      const response = await api.get('/api/settings/profile');
      const data = await response.json();
      
      if (data.success) {
        setProfile(data.data.profile);
        setMfaEnabled(data.data.mfaEnabled);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile settings');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (field: keyof ProfileData, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handlePasswordChange = (field: keyof PasswordData, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
    setPasswordError(null);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError(null);
    
    try {
      const response = await api.put('/api/settings/profile', profile);
      const data = await response.json();

      if (data.success) {
        setSaved(true);
        await refreshUser();
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error?.message || 'Failed to save profile');
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('Failed to save profile settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    try {
      const response = await api.post('/api/settings/profile/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      const data = await response.json();

      if (data.success) {
        setPasswordSuccess(true);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setTimeout(() => setPasswordSuccess(false), 3000);
      } else {
        setPasswordError(data.error?.message || 'Failed to change password');
      }
    } catch (err) {
      console.error('Error changing password:', err);
      setPasswordError('Failed to change password');
    }
  };

  const handleToggleMFA = async () => {
    try {
      const response = await api.post('/api/settings/profile/mfa', {
        enabled: !mfaEnabled,
      });
      const data = await response.json();

      if (data.success) {
        setMfaEnabled(!mfaEnabled);
      } else {
        setError(data.error?.message || 'Failed to update MFA settings');
      }
    } catch (err) {
      console.error('Error toggling MFA:', err);
      setError('Failed to update MFA settings');
    }
  };

  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          <span className="ml-3 text-neutral-600 dark:text-neutral-400">Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Profile Settings
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Update your profile information and account preferences.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Profile Information */}
      <Card className="p-6">
        <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100 mb-4">
          Profile Information
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => handleProfileChange('name', e.target.value)}
              className="block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => handleProfileChange('email', e.target.value)}
              className="block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => handleProfileChange('phone', e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Timezone
              </label>
              <select
                value={profile.timezone}
                onChange={(e) => handleProfileChange('timezone', e.target.value)}
                className="block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-100"
              >
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="UTC">UTC</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Language
              </label>
              <select
                value={profile.language}
                onChange={(e) => handleProfileChange('language', e.target.value)}
                className="block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-100"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleSaveProfile}
            disabled={saving}
            className={cn(
              'min-w-[120px]',
              saved && 'bg-success-600 hover:bg-success-700'
            )}
          >
            {saving ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </div>
            ) : saved ? (
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </div>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </Card>

      {/* Password Change */}
      <Card className="p-6">
        <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100 mb-4">
          Change Password
        </h3>

        {passwordError && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{passwordError}</p>
          </div>
        )}

        {passwordSuccess && (
          <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
            <p className="text-sm text-green-800 dark:text-green-200">Password changed successfully</p>
          </div>
        )}
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Current Password
            </label>
            <input
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
              className="block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              New Password
            </label>
            <input
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
              className="block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
              className="block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-100"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleChangePassword}>
            Change Password
          </Button>
        </div>
      </Card>

      {/* Multi-Factor Authentication */}
      <Card className="p-6">
        <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100 mb-4">
          Multi-Factor Authentication
        </h3>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Enable MFA
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Add an extra layer of security to your account
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleMFA}
            className={cn(
              'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              mfaEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
            )}
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                mfaEnabled ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
        </div>
      </Card>
    </div>
  );
}
