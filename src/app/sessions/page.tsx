'use client';

import { ClientLayout } from '@/components/layout/ClientLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function SessionsPage() {
  return (
    <ProtectedRoute>
      <ClientLayout>
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Active Sessions</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Manage your active sessions across different devices
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="space-y-4">
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
      </ClientLayout>
    </ProtectedRoute>
  );
}
