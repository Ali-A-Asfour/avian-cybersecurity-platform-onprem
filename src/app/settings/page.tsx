'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { NotificationPreferences } from '@/components/notifications/NotificationPreferences';
import { SystemConfiguration } from '@/components/settings/SystemConfiguration';

type SettingsTab = 'profile' | 'notifications' | 'system';

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const tabs = [
    { id: 'profile' as SettingsTab, label: 'Profile', icon: '👤' },
    { id: 'notifications' as SettingsTab, label: 'Notifications', icon: '🔔' },
    { id: 'system' as SettingsTab, label: 'System', icon: '⚙️' },
  ];

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
              <NotificationPreferences />
            </div>
          )}

          {activeTab === 'system' && (
            <div className="p-6">
              <SystemConfiguration />
            </div>
          )}
        </div>
      </div>
    </ClientLayout>
  );
}