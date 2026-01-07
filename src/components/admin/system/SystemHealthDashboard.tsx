'use client';

import { useEffect, useState } from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { api } from '@/lib/api-client';

interface SystemMetrics {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_io: {
    bytes_in: number;
    bytes_out: number;
  };
  database: {
    connections: number;
    max_connections: number;
    query_time_avg: number;
  };
  redis: {
    memory_used: number;
    memory_max: number;
    connected_clients: number;
  };
  api: {
    requests_per_minute: number;
    avg_response_time: number;
    error_rate: number;
  };
  uptime: number;
  last_updated: string;
}

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  last_check: string;
}

export function SystemHealthDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSystemHealth();
    const interval = setInterval(loadSystemHealth, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadSystemHealth = async () => {
    try {
      setRefreshing(true);

      // Load system metrics
      const metricsResponse = await api.get('/api/admin/system/metrics');
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setMetrics(metricsData.data);
      }

      // Load service status
      const servicesResponse = await api.get('/api/admin/system/services');
      if (servicesResponse.ok) {
        const servicesData = await servicesResponse.json();
        setServices(servicesData.data);
      }
    } catch {
      console.error('Failed to load system health:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getUsageColor = (percentage: number) => {
    if (percentage > 90) return 'bg-red-500';
    if (percentage > 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <div className="p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          System Health Dashboard
        </h2>
        <Button
          onClick={loadSystemHealth}
          disabled={refreshing}
          variant="outline"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* System Overview */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <div className="p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">CPU Usage</h3>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold">{metrics.cpu_usage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getUsageColor(metrics.cpu_usage)}`}
                  style={{ width: `${metrics.cpu_usage}%` }}
                ></div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Memory Usage</h3>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold">{metrics.memory_usage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getUsageColor(metrics.memory_usage)}`}
                  style={{ width: `${metrics.memory_usage}%` }}
                ></div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Disk Usage</h3>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold">{metrics.disk_usage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getUsageColor(metrics.disk_usage)}`}
                  style={{ width: `${metrics.disk_usage}%` }}
                ></div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">System Uptime</h3>
              <div className="text-2xl font-bold mb-2">{formatUptime(metrics.uptime)}</div>
              <div className="text-sm text-gray-500">
                Since last restart
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Service Status */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Service Status</h3>
          <div className="space-y-3">
            {services.map((service, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(service.status)}`}>
                    {service.status.toUpperCase()}
                  </div>
                  <span className="font-medium">{service.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">{service.message}</div>
                  <div className="text-xs text-gray-400">
                    Last check: {new Date(service.last_check).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Database & Redis Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Database Performance</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Active Connections</span>
                  <span className="font-medium">
                    {metrics.database.connections}/{metrics.database.max_connections}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Query Time</span>
                  <span className="font-medium">{metrics.database.query_time_avg}ms</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getUsageColor((metrics.database.connections / metrics.database.max_connections) * 100)}`}
                    style={{ width: `${(metrics.database.connections / metrics.database.max_connections) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Redis Cache</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Memory Used</span>
                  <span className="font-medium">
                    {formatBytes(metrics.redis.memory_used)}/{formatBytes(metrics.redis.memory_max)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Connected Clients</span>
                  <span className="font-medium">{metrics.redis.connected_clients}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getUsageColor((metrics.redis.memory_used / metrics.redis.memory_max) * 100)}`}
                    style={{ width: `${(metrics.redis.memory_used / metrics.redis.memory_max) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* API Performance */}
      {metrics && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">API Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {metrics.api.requests_per_minute}
                </div>
                <div className="text-sm text-gray-500">Requests/min</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {metrics.api.avg_response_time}ms
                </div>
                <div className="text-sm text-gray-500">Avg Response Time</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${metrics.api.error_rate > 5 ? 'text-red-600' : 'text-green-600'}`}>
                  {metrics.api.error_rate.toFixed(2)}%
                </div>
                <div className="text-sm text-gray-500">Error Rate</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Network I/O */}
      {metrics && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Network I/O</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-center">
                <div className="text-xl font-bold text-blue-600">
                  {formatBytes(metrics.network_io.bytes_in)}
                </div>
                <div className="text-sm text-gray-500">Bytes In</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-600">
                  {formatBytes(metrics.network_io.bytes_out)}
                </div>
                <div className="text-sm text-gray-500">Bytes Out</div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}