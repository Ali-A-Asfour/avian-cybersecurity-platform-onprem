'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { api } from '@/lib/api-client';
import { Tenant } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { 
  ArrowLeft, 
  Edit, 
  Building2, 
  Globe, 
  Users, 
  Settings, 
  Mail, 
  Smartphone, 
  Bell,
  Clock,
  Shield,
  Palette,
  CheckCircle,
  XCircle,
  Calendar,
  Activity
} from 'lucide-react';

export default function ViewTenantPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  const tenantId = params?.id as string;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    // Check if user has permission to view tenants (super admin only)
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
        setTenant(result.data);
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

  const handleBack = () => {
    router.push('/super-admin/tenants');
  };

  const handleEdit = () => {
    router.push(`/super-admin/tenants/${tenantId}/edit`);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-neutral-400">Loading tenant details...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'super_admin') {
    return null;
  }

  if (error) {
    return (
      <ClientLayout>
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Tenants
            </Button>
          </div>
          
          <div className="bg-red-100 dark:bg-red-800 border-2 border-red-300 dark:border-red-600 rounded-lg p-6 text-center shadow-sm">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-800 dark:text-red-100 mb-2">Error Loading Tenant</h2>
            <p className="text-red-700 dark:text-red-200">{error}</p>
            <Button onClick={fetchTenant} className="mt-4">
              Try Again
            </Button>
          </div>
        </div>
      </ClientLayout>
    );
  }

  if (!tenant) {
    return (
      <ClientLayout>
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Tenants
            </Button>
          </div>
          
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6 text-center">
            <Building2 className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">Tenant Not Found</h2>
            <p className="text-neutral-600">The requested tenant could not be found.</p>
          </div>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Tenants
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                {tenant.name}
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 mt-1">
                Tenant Details & Configuration
              </p>
            </div>
          </div>
          
          <Button
            onClick={handleEdit}
            className="flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit Tenant
          </Button>
        </div>

        {/* Status Badge */}
        <div className="flex items-center space-x-4">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
            tenant.is_active 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {tenant.is_active ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            {tenant.is_active ? 'Active' : 'Inactive'}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  Basic Information
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Organization Name
                  </label>
                  <p className="text-neutral-900 dark:text-neutral-100 font-medium">
                    {tenant.name}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Domain
                  </label>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-neutral-500" />
                    <p className="text-neutral-900 dark:text-neutral-100">
                      {tenant.domain || 'No domain configured'}
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Theme Color
                  </label>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-6 h-6 rounded border border-neutral-300"
                      style={{ backgroundColor: tenant.theme_color }}
                    />
                    <p className="text-neutral-900 dark:text-neutral-100 font-mono">
                      {tenant.theme_color}
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Logo URL
                  </label>
                  <p className="text-neutral-900 dark:text-neutral-100">
                    {tenant.logo_url || 'No logo configured'}
                  </p>
                </div>
              </div>
            </Card>

            {/* Settings */}
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Settings className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                  Configuration
                </h2>
              </div>
              
              <div className="space-y-6">
                {/* User Limits */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-5 h-5 text-neutral-600" />
                    <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                      User Management
                    </h3>
                  </div>
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        Maximum Users
                      </span>
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">
                        {tenant.settings?.max_users || 100}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                    <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                      Enabled Features
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {tenant.settings?.features_enabled?.map(feature => (
                      <div key={feature} className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg">
                        <CheckCircle className="w-5 h-5 flex-shrink-0" />
                        <span className="font-medium capitalize">{feature.replace(/_/g, ' ')}</span>
                      </div>
                    )) || (
                      <p className="text-neutral-500 dark:text-neutral-400 col-span-full">No features configured</p>
                    )}
                  </div>
                </div>

                {/* Notification Settings */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Bell className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                    <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                      Notification Settings
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">Email</span>
                      </div>
                      <div className={`flex items-center gap-2 ${
                        tenant.settings?.notification_settings?.email_enabled 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {tenant.settings?.notification_settings?.email_enabled ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                        <span className="font-medium">
                          {tenant.settings?.notification_settings?.email_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                      <div className="flex items-center gap-3">
                        <Smartphone className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">SMS</span>
                      </div>
                      <div className={`flex items-center gap-2 ${
                        tenant.settings?.notification_settings?.sms_enabled 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {tenant.settings?.notification_settings?.sms_enabled ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                        <span className="font-medium">
                          {tenant.settings?.notification_settings?.sms_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                      <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">Push</span>
                      </div>
                      <div className={`flex items-center gap-2 ${
                        tenant.settings?.notification_settings?.push_enabled 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {tenant.settings?.notification_settings?.push_enabled ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                        <span className="font-medium">
                          {tenant.settings?.notification_settings?.push_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">Digest Frequency</span>
                      </div>
                      <span className="font-medium text-neutral-900 dark:text-neutral-100 capitalize bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full">
                        {tenant.settings?.notification_settings?.digest_frequency || 'Daily'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* SLA Settings */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                    <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
                      SLA Configuration
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                        Response Time
                      </div>
                      <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        {tenant.settings?.sla_settings?.response_time_hours || 24}
                        <span className="text-sm font-normal ml-1">hours</span>
                      </div>
                    </div>
                    
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                      <div className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-1">
                        Resolution Time
                      </div>
                      <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {tenant.settings?.sla_settings?.resolution_time_hours || 72}
                        <span className="text-sm font-normal ml-1">hours</span>
                      </div>
                    </div>
                    
                    <div className={`border rounded-lg p-4 ${
                      tenant.settings?.sla_settings?.escalation_enabled
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    }`}>
                      <div className={`text-sm font-medium mb-2 ${
                        tenant.settings?.sla_settings?.escalation_enabled
                          ? 'text-green-800 dark:text-green-200'
                          : 'text-red-800 dark:text-red-200'
                      }`}>
                        Escalation
                      </div>
                      <div className={`flex items-center gap-2 ${
                        tenant.settings?.sla_settings?.escalation_enabled 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {tenant.settings?.sla_settings?.escalation_enabled ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                        <span className="font-bold">
                          {tenant.settings?.sla_settings?.escalation_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                    
                    {tenant.settings?.sla_settings?.escalation_enabled && (
                      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                        <div className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">
                          Escalation Time
                        </div>
                        <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                          {tenant.settings?.sla_settings?.escalation_time_hours || 48}
                          <span className="text-sm font-normal ml-1">hours</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                  Quick Info
                </h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                    Tenant ID
                  </div>
                  <div className="font-mono text-sm bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
                    {tenant.id}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                    Created
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-neutral-500" />
                    {formatDate(tenant.created_at)}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                    Last Updated
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-neutral-500" />
                    {formatDate(tenant.updated_at)}
                  </div>
                </div>
              </div>
            </Card>

            {/* Branding */}
            {tenant.settings?.branding && (
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Palette className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                    Branding
                  </h3>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                      Color Scheme
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded border border-neutral-300"
                          style={{ backgroundColor: tenant.settings.branding.primary_color }}
                        />
                        <span className="text-xs font-mono">Primary</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded border border-neutral-300"
                          style={{ backgroundColor: tenant.settings.branding.secondary_color }}
                        />
                        <span className="text-xs font-mono">Secondary</span>
                      </div>
                    </div>
                  </div>
                  
                  {tenant.settings.branding.logo_url && (
                    <div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                        Logo
                      </div>
                      <div className="text-xs text-neutral-500 break-all">
                        {tenant.settings.branding.logo_url}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}