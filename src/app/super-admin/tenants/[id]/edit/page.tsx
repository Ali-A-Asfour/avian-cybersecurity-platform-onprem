'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { api } from '@/lib/api-client';
import { Tenant, TenantSettings } from '@/types';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Save, X } from 'lucide-react';

export default function EditTenantPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    logo_url: '',
    theme_color: '#3B82F6',
    is_active: true,
    settings: {
      max_users: 100,
      features_enabled: [] as string[],
      notification_settings: {
        email_enabled: true,
        sms_enabled: false,
        push_enabled: true,
        digest_frequency: 'daily' as const
      },
      sla_settings: {
        response_time_hours: 24,
        resolution_time_hours: 72,
        escalation_enabled: true,
        escalation_time_hours: 48
      },
      branding: {
        primary_color: '#3B82F6',
        secondary_color: '#64748B',
        logo_url: '',
        custom_css: ''
      }
    } as TenantSettings
  });

  const tenantId = params?.id as string;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    // Check if user has permission to edit tenants (super admin only)
    if (!authLoading && isAuthenticated && user) {
      if (user.role !== 'super_admin') {
        router.push('/dashboard');
        return;
      }
    }
  }, [authLoading, isAuthenticated, user, router]);

  useEffect(() => {
    if (tenantId && isAuthenticated && user?.role === 'super_admin') {
      fetchTenant();
    }
  }, [tenantId, isAuthenticated, user]);

  const fetchTenant = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(`/api/tenants/${tenantId}`);
      const result = await response.json();
      
      if (result.success) {
        const tenantData = result.data;
        setTenant(tenantData);
        
        // Populate form with tenant data
        setFormData({
          name: tenantData.name || '',
          domain: tenantData.domain || '',
          logo_url: tenantData.logo_url || '',
          theme_color: tenantData.theme_color || '#3B82F6',
          is_active: tenantData.is_active ?? true,
          settings: {
            max_users: tenantData.settings?.max_users || 100,
            features_enabled: tenantData.settings?.features_enabled || [],
            notification_settings: {
              email_enabled: tenantData.settings?.notification_settings?.email_enabled ?? true,
              sms_enabled: tenantData.settings?.notification_settings?.sms_enabled ?? false,
              push_enabled: tenantData.settings?.notification_settings?.push_enabled ?? true,
              digest_frequency: tenantData.settings?.notification_settings?.digest_frequency || 'daily'
            },
            sla_settings: {
              response_time_hours: tenantData.settings?.sla_settings?.response_time_hours || 24,
              resolution_time_hours: tenantData.settings?.sla_settings?.resolution_time_hours || 72,
              escalation_enabled: tenantData.settings?.sla_settings?.escalation_enabled ?? true,
              escalation_time_hours: tenantData.settings?.sla_settings?.escalation_time_hours || 48
            },
            branding: {
              primary_color: tenantData.settings?.branding?.primary_color || '#3B82F6',
              secondary_color: tenantData.settings?.branding?.secondary_color || '#64748B',
              logo_url: tenantData.settings?.branding?.logo_url || '',
              custom_css: tenantData.settings?.branding?.custom_css || ''
            }
          }
        });
      } else {
        setError(result.error?.message || 'Failed to load tenant');
      }
    } catch (err) {
      setError('Network error while loading tenant');
      console.error('Error fetching tenant:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      const response = await api.put(`/api/tenants/${tenantId}`, {
        name: formData.name,
        domain: formData.domain,
        logo_url: formData.logo_url,
        theme_color: formData.theme_color,
        is_active: formData.is_active,
        settings: formData.settings
      });
      
      const result = await response.json();
      
      if (result.success) {
        router.push('/super-admin/tenants?updated=true');
      } else {
        setError(result.error?.message || 'Failed to update tenant');
      }
    } catch (err) {
      setError('Network error while updating tenant');
      console.error('Error updating tenant:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push('/super-admin/tenants');
  };

  const handleFeatureToggle = (feature: string) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        features_enabled: prev.settings.features_enabled.includes(feature)
          ? prev.settings.features_enabled.filter(f => f !== feature)
          : [...prev.settings.features_enabled, feature]
      }
    }));
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-neutral-400">Loading tenant...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'super_admin') {
    return null;
  }

  return (
    <ClientLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Tenants
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                Edit Tenant
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 mt-1">
                {tenant?.name || 'Loading...'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.name.trim()}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 dark:bg-red-800 border-2 border-red-300 dark:border-red-600 rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-red-800 dark:text-red-100 font-medium">{error}</div>
            </div>
          </div>
        )}

        {/* Form Content */}
        <div className="space-y-8">
          {/* Basic Information */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-6">
              Basic Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Organization Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="ACME Corporation"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Domain
                </label>
                <input
                  type="text"
                  value={formData.domain}
                  onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="acme-corp.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Logo URL
                </label>
                <input
                  type="url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://example.com/logo.png"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Theme Color
                </label>
                <input
                  type="color"
                  value={formData.theme_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, theme_color: e.target.value }))}
                  className="w-full h-10 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Active Tenant
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-6">
              Settings
            </h2>
            
            <div className="space-y-6">
              {/* User Limits */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Maximum Users
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.settings.max_users}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      max_users: parseInt(e.target.value) || 100
                    }
                  }))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Features */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                  Enabled Features
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    'advanced_analytics',
                    'custom_reports',
                    'api_access',
                    'sso_integration',
                    'audit_logs',
                    'custom_branding'
                  ].map(feature => (
                    <label key={feature} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.settings.features_enabled.includes(feature)}
                        onChange={() => handleFeatureToggle(feature)}
                        className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-neutral-700 dark:text-neutral-300 capitalize">
                        {feature.replace('_', ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notification Settings */}
              <div>
                <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-3">
                  Notification Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.settings.notification_settings.email_enabled}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          notification_settings: {
                            ...prev.settings.notification_settings,
                            email_enabled: e.target.checked
                          }
                        }
                      }))}
                      className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      Email Notifications
                    </span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.settings.notification_settings.sms_enabled}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          notification_settings: {
                            ...prev.settings.notification_settings,
                            sms_enabled: e.target.checked
                          }
                        }
                      }))}
                      className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      SMS Notifications
                    </span>
                  </label>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.settings.notification_settings.push_enabled}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          notification_settings: {
                            ...prev.settings.notification_settings,
                            push_enabled: e.target.checked
                          }
                        }
                      }))}
                      className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      Push Notifications
                    </span>
                  </label>
                  
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Digest Frequency
                    </label>
                    <select
                      value={formData.settings.notification_settings.digest_frequency}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          notification_settings: {
                            ...prev.settings.notification_settings,
                            digest_frequency: e.target.value as 'immediate' | 'hourly' | 'daily' | 'weekly'
                          }
                        }
                      }))}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="immediate">Immediate</option>
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SLA Settings */}
              <div>
                <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-3">
                  SLA Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Response Time (hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.settings.sla_settings.response_time_hours}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          sla_settings: {
                            ...prev.settings.sla_settings,
                            response_time_hours: parseInt(e.target.value) || 24
                          }
                        }
                      }))}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Resolution Time (hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.settings.sla_settings.resolution_time_hours}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          sla_settings: {
                            ...prev.settings.sla_settings,
                            resolution_time_hours: parseInt(e.target.value) || 72
                          }
                        }
                      }))}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.settings.sla_settings.escalation_enabled}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          sla_settings: {
                            ...prev.settings.sla_settings,
                            escalation_enabled: e.target.checked
                          }
                        }
                      }))}
                      className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      Enable Escalation
                    </span>
                  </label>
                  
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Escalation Time (hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.settings.sla_settings.escalation_time_hours}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          sla_settings: {
                            ...prev.settings.sla_settings,
                            escalation_time_hours: parseInt(e.target.value) || 48
                          }
                        }
                      }))}
                      disabled={!formData.settings.sla_settings.escalation_enabled}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}