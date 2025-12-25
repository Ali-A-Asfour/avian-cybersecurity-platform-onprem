'use client';

import { ClientLayout } from '@/components/layout/ClientLayout';
import { useDemoContext } from '@/contexts/DemoContext';
import { useState } from 'react';

export default function SettingsPage() {
  const { isDemo, setIsDemo } = useDemoContext();

  const handleDemoToggle = (enabled: boolean) => {
    setIsDemo(enabled);
  };

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

        {/* Demo Mode Setting */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Demo Mode
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Enable Demo Mode
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Show role switcher and demo features for testing different user roles
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isDemo}
                onChange={(e) => handleDemoToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Coming Soon Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Additional Settings Coming Soon
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            More user settings and system configuration options are currently in development.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Profile Settings</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Update your profile information, password, and MFA settings
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Notification Preferences</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Configure how and when you receive notifications
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h3 className="font-semibent text-gray-900 dark:text-white mb-2">System Configuration</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage integrations, API keys, and system-wide settings
              </p>
            </div>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}