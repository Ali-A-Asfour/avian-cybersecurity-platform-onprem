'use client';

import React, { useState } from 'react';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Tenant, TenantSettings } from '../../../types';

interface TenantFormProps {
  tenant: Tenant | null;
  onSave: (data: TenantFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

interface TenantFormData {
  name: string;
  domain: string;
  logo_url?: string;
  theme_color?: string;
  settings: Partial<TenantSettings>;
  is_active: boolean;
}

export function TenantForm({ tenant, onSave, onCancel, loading = false }: TenantFormProps) {
  const [formData, setFormData] = useState<TenantFormData>({
    name: tenant?.name || '',
    domain: tenant?.domain || '',
    logo_url: tenant?.logo_url || '',
    theme_color: tenant?.theme_color || '#00D4FF',
    is_active: tenant?.is_active ?? true,
    settings: {
      max_users: tenant?.settings?.max_users || 100,
      features_enabled: tenant?.settings?.features_enabled || ['tickets', 'alerts', 'compliance', 'reports'],
      notification_settings: {
        email_enabled: tenant?.settings?.notification_settings?.email_enabled ?? true,
        sms_enabled: tenant?.settings?.notification_settings?.sms_enabled ?? false,
        push_enabled: tenant?.settings?.notification_settings?.push_enabled ?? true,
        digest_frequency: tenant?.settings?.notification_settings?.digest_frequency || 'daily',
      },
      sla_settings: {
        response_time_hours: tenant?.settings?.sla_settings?.response_time_hours || 4,
        resolution_time_hours: tenant?.settings?.sla_settings?.resolution_time_hours || 24,
        escalation_enabled: tenant?.settings?.sla_settings?.escalation_enabled ?? true,
        escalation_time_hours: tenant?.settings?.sla_settings?.escalation_time_hours || 8,
      },
      branding: {
        primary_color: tenant?.settings?.branding?.primary_color || '#00D4FF',
        secondary_color: tenant?.settings?.branding?.secondary_color || '#0A1628',
        logo_url: tenant?.settings?.branding?.logo_url || '',
        favicon_url: tenant?.settings?.branding?.favicon_url || '',
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleFeatureToggle = (feature: string) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        features_enabled: prev.settings.features_enabled?.includes(feature)
          ? prev.settings.features_enabled.filter(f => f !== feature)
          : [...(prev.settings.features_enabled || []), feature],
      },
    }));
  };

  const availableFeatures = [
    { id: 'tickets', label: 'Ticket Management' },
    { id: 'alerts', label: 'Security Alerts' },
    { id: 'compliance', label: 'Compliance Management' },
    { id: 'reports', label: 'Reporting & Analytics' },
    { id: 'workflows', label: 'Automated Workflows' },
    { id: 'integrations', label: 'Third-party Integrations' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Basic Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Tenant Name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
            placeholder="e.g., Acme Corporation"
          />
          
          <Input
            label="Domain"
            value={formData.domain}
            onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
            required
            placeholder="e.g., acme.com"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Logo URL"
            value={formData.logo_url || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
            placeholder="https://example.com/logo.png"
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Theme Color
            </label>
            <input
              type="color"
              value={formData.theme_color}
              onChange={(e) => setFormData(prev => ({ ...prev, theme_color: e.target.value }))}
              className="w-full h-10 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="is_active"
            checked={formData.is_active}
            onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
            className="mr-2"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Active Tenant
          </label>
        </div>
      </div>

      {/* Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Settings</h3>
        
        <Input
          label="Maximum Users"
          type="number"
          value={formData.settings.max_users?.toString() || '100'}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            settings: {
              ...prev.settings,
              max_users: parseInt(e.target.value) || 100,
            },
          }))}
          min="1"
          max="10000"
        />
      </div>

      {/* Features */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Enabled Features</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {availableFeatures.map((feature) => (
            <div key={feature.id} className="flex items-center">
              <input
                type="checkbox"
                id={feature.id}
                checked={formData.settings.features_enabled?.includes(feature.id) || false}
                onChange={() => handleFeatureToggle(feature.id)}
                className="mr-2"
              />
              <label htmlFor={feature.id} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {feature.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* SLA Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">SLA Settings</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Response Time (hours)"
            type="number"
            value={formData.settings.sla_settings?.response_time_hours?.toString() || '4'}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              settings: {
                ...prev.settings,
                sla_settings: {
                  ...prev.settings.sla_settings!,
                  response_time_hours: parseInt(e.target.value) || 4,
                },
              },
            }))}
            min="1"
            max="168"
          />
          
          <Input
            label="Resolution Time (hours)"
            type="number"
            value={formData.settings.sla_settings?.resolution_time_hours?.toString() || '24'}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              settings: {
                ...prev.settings,
                sla_settings: {
                  ...prev.settings.sla_settings!,
                  resolution_time_hours: parseInt(e.target.value) || 24,
                },
              },
            }))}
            min="1"
            max="720"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="escalation_enabled"
            checked={formData.settings.sla_settings?.escalation_enabled || false}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              settings: {
                ...prev.settings,
                sla_settings: {
                  ...prev.settings.sla_settings!,
                  escalation_enabled: e.target.checked,
                },
              },
            }))}
            className="mr-2"
          />
          <label htmlFor="escalation_enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Enable Escalation
          </label>
        </div>

        {formData.settings.sla_settings?.escalation_enabled && (
          <Input
            label="Escalation Time (hours)"
            type="number"
            value={formData.settings.sla_settings?.escalation_time_hours?.toString() || '8'}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              settings: {
                ...prev.settings,
                sla_settings: {
                  ...prev.settings.sla_settings!,
                  escalation_time_hours: parseInt(e.target.value) || 8,
                },
              },
            }))}
            min="1"
            max="72"
          />
        )}
      </div>

      {/* Notification Settings */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Notification Settings</h3>
        
        <div className="space-y-3">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="email_enabled"
              checked={formData.settings.notification_settings?.email_enabled || false}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  notification_settings: {
                    ...prev.settings.notification_settings!,
                    email_enabled: e.target.checked,
                  },
                },
              }))}
              className="mr-2"
            />
            <label htmlFor="email_enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Email Notifications
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="push_enabled"
              checked={formData.settings.notification_settings?.push_enabled || false}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  notification_settings: {
                    ...prev.settings.notification_settings!,
                    push_enabled: e.target.checked,
                  },
                },
              }))}
              className="mr-2"
            />
            <label htmlFor="push_enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Push Notifications
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Digest Frequency
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.settings.notification_settings?.digest_frequency || 'daily'}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  notification_settings: {
                    ...prev.settings.notification_settings!,
                    digest_frequency: e.target.value as 'immediate' | 'hourly' | 'daily' | 'weekly',
                  },
                },
              }))}
            >
              <option value="immediate">Immediate</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </div>
      </div>

      {/* Branding */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Branding</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Primary Color
            </label>
            <input
              type="color"
              value={formData.settings.branding?.primary_color || '#00D4FF'}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  branding: {
                    ...prev.settings.branding!,
                    primary_color: e.target.value,
                  },
                },
              }))}
              className="w-full h-10 border border-gray-300 rounded-md"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Secondary Color
            </label>
            <input
              type="color"
              value={formData.settings.branding?.secondary_color || '#0A1628'}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  branding: {
                    ...prev.settings.branding!,
                    secondary_color: e.target.value,
                  },
                },
              }))}
              className="w-full h-10 border border-gray-300 rounded-md"
            />
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-2 pt-6 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : (tenant ? 'Update Tenant' : 'Create Tenant')}
        </Button>
      </div>
    </form>
  );
}