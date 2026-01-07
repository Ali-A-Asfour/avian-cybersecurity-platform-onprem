'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ThreatLakeDashboard from '@/components/threat-lake/ThreatLakeDashboard';
import ThreatHuntingTools from '@/components/threat-lake/ThreatHuntingTools';
import CorrelationManagement from '@/components/threat-lake/CorrelationManagement';
import { TenantAwareLayout } from '@/components/layout/TenantAwareLayout';
import { useTenant } from '@/contexts/TenantContext';
import { UserRole } from '@/types';
// Simple text-based icons for compatibility
const SimpleIcon = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-block w-5 h-5 text-center">{children}</span>
);

type TabType = 'dashboard' | 'hunting' | 'correlation' | 'intelligence' | 'settings';

export default function ThreatLakePage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const { selectedTenant } = useTenant();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    // Use demo context instead of API calls
    setUserRole(UserRole.SECURITY_ANALYST); // Default to security analyst for demo
    setLoading(false);
  }, []);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <TenantAwareLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      </TenantAwareLayout>
    );
  }

  if (userRole !== UserRole.SECURITY_ANALYST && userRole !== UserRole.SUPER_ADMIN) {
    return null; // Will redirect
  }

  const tabs = [
    {
      id: 'dashboard' as TabType,
      name: 'Dashboard',
      icon: '🗄️',
      description: 'Overview and analytics'
    },
    {
      id: 'hunting' as TabType,
      name: 'Threat Hunting',
      icon: '🔍',
      description: 'Advanced search and investigation'
    },
    {
      id: 'correlation' as TabType,
      name: 'Correlation',
      icon: '🎯',
      description: 'Event correlation rules and results'
    },
    {
      id: 'intelligence' as TabType,
      name: 'Threat Intel',
      icon: '🛡️',
      description: 'Threat intelligence feeds'
    },
    {
      id: 'settings' as TabType,
      name: 'Settings',
      icon: '⚙️',
      description: 'Configuration and policies'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <ThreatLakeDashboard />;
      case 'hunting':
        return <ThreatHuntingTools />;
      case 'correlation':
        return <CorrelationManagement />;
      case 'intelligence':
        return <ThreatIntelligenceManagement />;
      case 'settings':
        return <ThreatLakeSettings />;
      default:
        return <ThreatLakeDashboard />;
    }
  };

  return (
    <TenantAwareLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Navigation Tabs */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                    group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                    ${isActive
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }
                  `}
                  >
                    <SimpleIcon>{tab.icon}</SimpleIcon>
                    <span className="ml-2">{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {renderTabContent()}
        </div>
      </div>
    </TenantAwareLayout>
  );
}

// Placeholder components for remaining tabs
function ThreatIntelligenceManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Threat Intelligence Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage threat intelligence feeds and indicators
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-center">
          <div className="text-4xl mb-4">🛡️</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Threat Intelligence Feeds
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Configure and manage external threat intelligence data sources
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">IOC Feeds</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Indicators of Compromise from threat intelligence providers
              </p>
            </div>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">YARA Rules</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Malware detection and classification rules
              </p>
            </div>
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">MITRE ATT&CK</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Tactics, techniques, and procedures mapping
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThreatLakeSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Threat Lake Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configure data retention, performance, and system settings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Data Retention */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Data Retention Policies
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Critical Events</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">High priority security events</div>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">365 days</div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Standard Events</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Regular security events</div>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">90 days</div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Low Priority Events</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Informational events</div>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">30 days</div>
            </div>
          </div>
        </div>

        {/* Performance Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Performance Settings
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Indexing</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Real-time event indexing</div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-600">Active</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Correlation Engine</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Event correlation processing</div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-600">Active</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">ML Processing</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Machine learning analysis</div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-sm text-yellow-600">Training</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}