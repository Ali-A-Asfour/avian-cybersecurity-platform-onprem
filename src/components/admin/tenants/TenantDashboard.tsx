'use client';

import React, { useState } from 'react';
import { Tenant, UserRole } from '../../../types';
import TenantList from './TenantList';
import { TenantForm } from './TenantForm';
import { TenantMetrics } from './TenantMetrics';
import TenantUsers from './TenantUsers';

interface TenantDashboardProps {
  userRole: UserRole;
  currentTenant?: Tenant;
}

type ViewMode = 'list' | 'create' | 'edit' | 'view';

interface TenantDashboardState {
  mode: ViewMode;
  selectedTenant: Tenant | null;
  activeTab: 'overview' | 'metrics' | 'users' | 'settings';
}

export default function TenantDashboard({ userRole, currentTenant }: TenantDashboardProps) {
  const [state, setState] = useState<TenantDashboardState>({
    mode: 'list',
    selectedTenant: null,
    activeTab: 'overview',
  });

  // Handle tenant selection
  const handleTenantSelect = (tenant: Tenant) => {
    setState(prev => ({
      ...prev,
      mode: 'view',
      selectedTenant: tenant,
      activeTab: 'overview',
    }));
  };

  // Handle tenant creation
  const handleCreateTenant = () => {
    setState(prev => ({
      ...prev,
      mode: 'create',
      selectedTenant: null,
    }));
  };

  // Handle tenant editing
  const handleEditTenant = () => {
    setState(prev => ({
      ...prev,
      mode: 'edit',
    }));
  };

  // Handle form save
  const handleFormSave = (tenant: Tenant) => {
    setState(prev => ({
      ...prev,
      mode: 'view',
      selectedTenant: tenant,
      activeTab: 'overview',
    }));
  };

  // Handle form cancel
  const handleFormCancel = () => {
    setState(prev => ({
      ...prev,
      mode: state.selectedTenant ? 'view' : 'list',
    }));
  };

  // Handle back to list
  const handleBackToList = () => {
    setState(prev => ({
      ...prev,
      mode: 'list',
      selectedTenant: null,
    }));
  };

  // Handle tab change
  const handleTabChange = (tab: TenantDashboardState['activeTab']) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  };

  // Render based on current mode
  const renderContent = () => {
    switch (state.mode) {
      case 'list':
        return (
          <TenantList
            userRole={userRole}
            onTenantSelect={handleTenantSelect}
            onCreateTenant={userRole === UserRole.SUPER_ADMIN ? handleCreateTenant : undefined}
          />
        );

      case 'create':
        return (
          <TenantForm
            mode="create"
            onSave={handleFormSave}
            onCancel={handleFormCancel}
          />
        );

      case 'edit':
        return (
          <TenantForm
            tenant={state.selectedTenant!}
            mode="edit"
            onSave={handleFormSave}
            onCancel={handleFormCancel}
          />
        );

      case 'view':
        return renderTenantView();

      default:
        return null;
    }
  };

  // Render tenant view with tabs
  const renderTenantView = () => {
    if (!state.selectedTenant) return null;

    const tabs = [
      { id: 'overview', label: 'Overview', icon: '📊' },
      { id: 'metrics', label: 'Metrics', icon: '📈' },
      { id: 'users', label: 'Users', icon: '👥' },
      { id: 'settings', label: 'Settings', icon: '⚙️' },
    ] as const;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBackToList}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ← Back to Tenants
            </button>
            <div className="flex items-center space-x-3">
              {state.selectedTenant.logo_url ? (
                <img
                  src={state.selectedTenant.logo_url}
                  alt={`${state.selectedTenant.name} logo`}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {state.selectedTenant.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {state.selectedTenant.name}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {state.selectedTenant.domain}
                </p>
              </div>
            </div>
          </div>
          {userRole === UserRole.SUPER_ADMIN && (
            <button
              onClick={handleEditTenant}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Edit Tenant
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  state.activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div>
          {state.activeTab === 'overview' && renderOverviewTab()}
          {state.activeTab === 'metrics' && (
            <TenantMetrics tenant={state.selectedTenant} />
          )}
          {state.activeTab === 'users' && (
            <TenantUsers tenant={state.selectedTenant} />
          )}
          {state.activeTab === 'settings' && renderSettingsTab()}
        </div>
      </div>
    );
  };  
// Render overview tab
  const renderOverviewTab = () => {
    if (!state.selectedTenant) return null;

    return (
      <div className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Tenant Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Name
              </label>
              <p className="text-gray-900 dark:text-white">{state.selectedTenant.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Domain
              </label>
              <p className="text-gray-900 dark:text-white font-mono">{state.selectedTenant.domain}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Status
              </label>
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  state.selectedTenant.is_active
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}
              >
                {state.selectedTenant.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Created
              </label>
              <p className="text-gray-900 dark:text-white">
                {new Date(state.selectedTenant.created_at).toLocaleDateString()}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Theme Color
              </label>
              <div className="flex items-center space-x-2">
                <div
                  className="w-6 h-6 rounded border border-gray-300"
                  style={{ backgroundColor: state.selectedTenant.theme_color }}
                ></div>
                <span className="text-gray-900 dark:text-white font-mono">
                  {state.selectedTenant.theme_color}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Max Users
              </label>
              <p className="text-gray-900 dark:text-white">
                {state.selectedTenant.settings.max_users || 'Unlimited'}
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Enabled Features
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['tickets', 'alerts', 'compliance', 'reports'].map((feature) => (
              <div
                key={feature}
                className={`p-3 rounded-lg border ${
                  state.selectedTenant!.settings.features_enabled?.includes(feature)
                    ? 'bg-green-50 border-green-200 dark:bg-green-900 dark:border-green-700'
                    : 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      state.selectedTenant!.settings.features_enabled?.includes(feature)
                        ? 'bg-green-500'
                        : 'bg-gray-400'
                    }`}
                  ></div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {feature}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Render settings tab
  const renderSettingsTab = () => {
    if (!state.selectedTenant) return null;

    return (
      <div className="space-y-6">
        {/* SLA Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            SLA Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Response Time
              </label>
              <p className="text-gray-900 dark:text-white">
                {state.selectedTenant.settings.sla_settings?.response_time_hours || 4} hours
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Resolution Time
              </label>
              <p className="text-gray-900 dark:text-white">
                {state.selectedTenant.settings.sla_settings?.resolution_time_hours || 24} hours
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Escalation
              </label>
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  state.selectedTenant.settings.sla_settings?.escalation_enabled
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}
              >
                {state.selectedTenant.settings.sla_settings?.escalation_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Escalation Time
              </label>
              <p className="text-gray-900 dark:text-white">
                {state.selectedTenant.settings.sla_settings?.escalation_time_hours || 8} hours
              </p>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Notification Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Email Notifications
              </label>
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  state.selectedTenant.settings.notification_settings?.email_enabled
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}
              >
                {state.selectedTenant.settings.notification_settings?.email_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Push Notifications
              </label>
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  state.selectedTenant.settings.notification_settings?.push_enabled
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}
              >
                {state.selectedTenant.settings.notification_settings?.push_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Digest Frequency
              </label>
              <p className="text-gray-900 dark:text-white capitalize">
                {state.selectedTenant.settings.notification_settings?.digest_frequency || 'Daily'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {renderContent()}
      </div>
    </div>
  );
}