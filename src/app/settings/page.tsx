'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { NotificationPreferences } from '@/components/notifications/NotificationPreferences';
import { SystemConfiguration } from '@/components/settings/SystemConfiguration';
import { useDemoContext } from '@/contexts/DemoContext';
import { UserRole } from '@/types';

type SettingsTab = 'profile' | 'notifications' | 'system';

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { currentUser } = useDemoContext();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  // Define tabs based on user role
  const baseTabs = [
    { id: 'profile' as SettingsTab, label: 'Profile', icon: '👤' },
    { id: 'notifications' as SettingsTab, label: 'Notifications', icon: '🔔' },
  ];

  // Only show system tab for admin roles
  const systemTab = { id: 'system' as SettingsTab, label: 'System', icon: '⚙️' };
  const canAccessSystem = [
    UserRole.TENANT_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.IT_HELPDESK_ANALYST,
    UserRole.SECURITY_ANALYST
  ].includes(currentUser.role as UserRole);

  const tabs = canAccessSystem ? [...baseTabs, systemTab] : baseTabs;

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your account settings, preferences, and system configuration
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                  ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {activeTab === 'profile' && (
            <div className="p-6">
              <ProfileSettings />
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="p-6">
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Configure your notification preferences for alerts, tickets, and system events.
                </p>
                <button
                  onClick={() => router.push('/settings/notifications')}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Open Notification Settings
                </button>
              </div>
            </div>
          )}

          {activeTab === 'system' && canAccessSystem && (
            <div className="p-6">
              <SystemConfiguration />
            </div>
          )}

          {activeTab === 'system' && !canAccessSystem && (
            <div className="p-6">
              <div className="text-center">
                <div className="text-red-500 mb-4">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Access Denied</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  You don't have permission to access system settings.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </ClientLayout>
  );
}