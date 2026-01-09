'use client';

import { useEffect, useState } from 'react';
import { Card } from '../../ui/Card';
import { MetricCard } from '../../dashboard/MetricCard';
import { Tenant } from '../../../types';
import { api } from '@/lib/api-client';

interface TenantMetricsProps {
  tenants: Tenant[];
}

interface TenantMetricsData {
  totalTenants: number;
  activeTenants: number;
  inactiveTenants: number;
  avgUsersPerTenant: number;
  totalStorageUsed: number;
  avgStoragePerTenant: number;
  tenantsByPlan: Record<string, number>;
  recentActivity: {
    tenant_id: string;
    tenant_name: string;
    last_activity: Date;
    user_count: number;
    storage_used: number;
  }[];
}

export function TenantMetrics({ tenants }: TenantMetricsProps) {
  const [metrics, setMetrics] = useState<TenantMetricsData>({
    totalTenants: 0,
    activeTenants: 0,
    inactiveTenants: 0,
    avgUsersPerTenant: 0,
    totalStorageUsed: 0,
    avgStoragePerTenant: 0,
    tenantsByPlan: {},
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculateMetrics();
  }, [tenants]);

  const calculateMetrics = async () => {
    try {
      setLoading(true);

      // Calculate basic metrics from tenants data
      const totalTenants = tenants.length;
      const activeTenants = tenants.filter(t => t.is_active).length;
      const inactiveTenants = totalTenants - activeTenants;

      // Load additional metrics from API
      const response = await api.get('/api/admin/tenants/metrics');
      let additionalMetrics = {
        avgUsersPerTenant: 0,
        totalStorageUsed: 0,
        avgStoragePerTenant: 0,
        tenantsByPlan: {},
        recentActivity: [],
      };

      if (response.ok) {
        const data = await response.json();
        additionalMetrics = data.data;
      }

      setMetrics({
        totalTenants,
        activeTenants,
        inactiveTenants,
        ...additionalMetrics,
      });
    } catch (error) {
      console.error('Failed to calculate tenant metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <div className="p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Tenants"
          value={metrics.totalTenants}
          subtitle="All registered tenants"
          color="primary"
          icon={<span>🏢</span>}
        />
        
        <MetricCard
          title="Active Tenants"
          value={metrics.activeTenants}
          subtitle={`${Math.round((metrics.activeTenants / metrics.totalTenants) * 100)}% of total`}
          color="success"
          trend={{
            value: metrics.activeTenants - metrics.inactiveTenants,
            label: "vs inactive",
            direction: metrics.activeTenants > metrics.inactiveTenants ? "up" : "down"
          }}
          icon={<span>✅</span>}
        />
        
        <MetricCard
          title="Avg Users/Tenant"
          value={metrics.avgUsersPerTenant.toFixed(1)}
          subtitle="Average user count"
          color="neutral"
          icon={<span>👥</span>}
        />
        
        <MetricCard
          title="Total Storage"
          value={formatBytes(metrics.totalStorageUsed)}
          subtitle={`Avg: ${formatBytes(metrics.avgStoragePerTenant)}/tenant`}
          color="warning"
          icon={<span>💾</span>}
        />
      </div>

      {/* Tenant Status Distribution */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Tenant Status Distribution</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium">Active Tenants</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{metrics.activeTenants}</div>
                <div className="text-sm text-gray-500">
                  {Math.round((metrics.activeTenants / metrics.totalTenants) * 100)}%
                </div>
              </div>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ width: `${(metrics.activeTenants / metrics.totalTenants) * 100}%` }}
              ></div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <span className="text-sm font-medium">Inactive Tenants</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{metrics.inactiveTenants}</div>
                <div className="text-sm text-gray-500">
                  {Math.round((metrics.inactiveTenants / metrics.totalTenants) * 100)}%
                </div>
              </div>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full"
                style={{ width: `${(metrics.inactiveTenants / metrics.totalTenants) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tenant Activity Overview */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Tenant Activity Overview</h3>
          <div className="space-y-3">
            {tenants.slice(0, 5).map((tenant) => {
              const maxUsers = tenant.settings?.max_users || 100;
              // Mock user count for display
              const userCount = Math.floor(Math.random() * maxUsers * 0.8);
              const percentage = (userCount / maxUsers) * 100;
              
              return (
                <div key={tenant.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${tenant.is_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="font-medium">{tenant.name}</span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {userCount}/{maxUsers} users
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          percentage > 80 ? 'bg-red-500' : 
                          percentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Resource Usage Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Storage Usage</h3>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {formatBytes(metrics.totalStorageUsed)}
                </div>
                <div className="text-sm text-gray-500">Total Storage Used</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-gray-700">
                  {formatBytes(metrics.avgStoragePerTenant)}
                </div>
                <div className="text-sm text-gray-500">Average per Tenant</div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">User Distribution</h3>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {metrics.avgUsersPerTenant.toFixed(1)}
                </div>
                <div className="text-sm text-gray-500">Average Users per Tenant</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-semibold text-gray-700">
                  {Math.round(metrics.totalTenants * metrics.avgUsersPerTenant)}
                </div>
                <div className="text-sm text-gray-500">Estimated Total Users</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}