'use client';

import { useEffect, useState } from 'react';
import { Card } from '../ui/Card';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: Array<{
    name: string;
    status: 'pass' | 'fail';
    message?: string;
  }>;
  metrics: {
    avgResponseTime: number;
    errorRate: number;
    throughput: number;
    memoryUsage: number;
    totalRequests: number;
    activeRequests: number;
    requestsPerMinute: number;
  };
  performance: {
    isRunning: boolean;
    totalRequests: number;
    activeRequests: number;
    avgResponseTime: number;
    errorRate: number;
    requestsPerMinute: number;
  };
}

interface MetricsSummary {
  summary: {
    totalMetrics: number;
    performance: {
      isRunning: boolean;
      totalRequests: number;
      activeRequests: number;
      avgResponseTime: number;
      errorRate: number;
      requestsPerMinute: number;
    };
    recentPerformance: Array<{
      requestCount: number;
      responseTime: number;
      errorRate: number;
      throughput: number;
      memoryUsage: number;
      cpuUsage: number;
    }>;
  };
  availableMetrics: string[];
}

export function MonitoringDashboard() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds

  useEffect(() => {
    fetchMonitoringData();

    const interval = setInterval(fetchMonitoringData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const fetchMonitoringData = async () => {
    try {
      setError(null);

      // Use mock data for development
      const { delay } = await import('@/lib/mock-data');
      await delay(500); // Simulate loading

      // Mock health status
      const mockHealthStatus: HealthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: 86400 * 7 + 3600 * 4 + 60 * 23, // 7 days, 4 hours, 23 minutes
        version: '1.2.3',
        environment: 'production',
        checks: [
          { name: 'database', status: 'pass', message: 'Connection healthy' },
          { name: 'redis', status: 'pass', message: 'Cache operational' },
          { name: 'external_api', status: 'pass', message: 'All APIs responding' },
          { name: 'disk_space', status: 'pass', message: '75% available' },
          { name: 'memory', status: 'pass', message: '60% utilized' },
          { name: 'cpu', status: 'pass', message: '45% load average' }
        ],
        metrics: {
          avgResponseTime: 245,
          errorRate: 0.002,
          throughput: 1250,
          memoryUsage: 60,
          totalRequests: 125000,
          activeRequests: 12,
          requestsPerMinute: 85
        },
        performance: {
          isRunning: true,
          totalRequests: 125000,
          activeRequests: 12,
          avgResponseTime: 245,
          errorRate: 0.002,
          requestsPerMinute: 85
        }
      };

      // Mock metrics summary
      const mockMetrics: MetricsSummary = {
        summary: {
          totalMetrics: 24,
          performance: mockHealthStatus.performance,
          recentPerformance: Array.from({ length: 10 }, (_, i) => ({
            requestCount: 80 + Math.floor(Math.random() * 20),
            responseTime: 200 + Math.floor(Math.random() * 100),
            errorRate: Math.random() * 0.01,
            throughput: 1200 + Math.floor(Math.random() * 100),
            memoryUsage: 55 + Math.floor(Math.random() * 15),
            cpuUsage: 40 + Math.floor(Math.random() * 20)
          }))
        },
        availableMetrics: [
          'response_time', 'error_rate', 'throughput', 'memory_usage',
          'cpu_usage', 'disk_io', 'network_io', 'active_connections'
        ]
      };

      setHealthStatus(mockHealthStatus);
      setMetrics(mockMetrics);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch monitoring data');
      setLoading(false);
    }
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy':
      case 'pass':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy':
      case 'fail':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error Loading Monitoring Data</h3>
          <p className="text-red-600 mt-1">{error}</p>
          <button
            onClick={fetchMonitoringData}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">System Monitoring</h1>
        <div className="flex items-center space-x-4">
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
            <option value={60000}>1m</option>
            <option value={300000}>5m</option>
          </select>
          <button
            onClick={fetchMonitoringData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* System Status Overview */}
      {healthStatus && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Status</p>
                <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(healthStatus.status)}`}>
                  {healthStatus.status.toUpperCase()}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Uptime</p>
                <p className="text-sm font-medium">{formatUptime(healthStatus.uptime)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Response Time</p>
              <p className="text-2xl font-bold text-gray-900">
                {healthStatus.metrics.avgResponseTime.toFixed(0)}ms
              </p>
              <p className="text-xs text-gray-500">Average response time</p>
            </div>
          </Card>

          <Card className="p-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Error Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {(healthStatus.metrics.errorRate * 100).toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500">Request error rate</p>
            </div>
          </Card>

          <Card className="p-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Throughput</p>
              <p className="text-2xl font-bold text-gray-900">
                {healthStatus.metrics.requestsPerMinute}
              </p>
              <p className="text-xs text-gray-500">Requests per minute</p>
            </div>
          </Card>
        </div>
      )}

      {/* Health Checks */}
      {healthStatus && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Health Checks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {healthStatus.checks.map((check, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 capitalize">
                    {check.name.replace(/_/g, ' ')}
                  </p>
                  {check.message && (
                    <p className="text-sm text-gray-600">{check.message}</p>
                  )}
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(check.status)}`}>
                  {check.status.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Performance Metrics */}
      {metrics && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">
                {metrics.summary.performance.totalRequests.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">Total Requests</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                {metrics.summary.performance.activeRequests}
              </p>
              <p className="text-sm text-gray-600">Active Requests</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">
                {metrics.summary.totalMetrics}
              </p>
              <p className="text-sm text-gray-600">Tracked Metrics</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-600">
                {metrics.summary.performance.isRunning ? 'ON' : 'OFF'}
              </p>
              <p className="text-sm text-gray-600">Monitoring Status</p>
            </div>
          </div>
        </Card>
      )}

      {/* Recent Performance Trends */}
      {metrics && metrics.summary.recentPerformance.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Performance Trends</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Metric
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Average
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Response Time
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {metrics.summary.performance.avgResponseTime.toFixed(0)}ms
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(metrics.summary.recentPerformance.reduce((sum, p) => sum + p.responseTime, 0) / metrics.summary.recentPerformance.length).toFixed(0)}ms
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${metrics.summary.performance.avgResponseTime < 500 ? 'text-green-600 bg-green-100' :
                      metrics.summary.performance.avgResponseTime < 1000 ? 'text-yellow-600 bg-yellow-100' :
                        'text-red-600 bg-red-100'
                      }`}>
                      {metrics.summary.performance.avgResponseTime < 500 ? 'Good' :
                        metrics.summary.performance.avgResponseTime < 1000 ? 'Fair' : 'Poor'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Error Rate
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(metrics.summary.performance.errorRate).toFixed(2)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(metrics.summary.recentPerformance.reduce((sum, p) => sum + p.errorRate, 0) / metrics.summary.recentPerformance.length * 100).toFixed(2)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${metrics.summary.performance.errorRate < 0.01 ? 'text-green-600 bg-green-100' :
                      metrics.summary.performance.errorRate < 0.05 ? 'text-yellow-600 bg-yellow-100' :
                        'text-red-600 bg-red-100'
                      }`}>
                      {metrics.summary.performance.errorRate < 0.01 ? 'Excellent' :
                        metrics.summary.performance.errorRate < 0.05 ? 'Good' : 'Poor'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* System Information */}
      {healthStatus && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Version</p>
              <p className="text-lg font-mono text-gray-900">{healthStatus.version}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Environment</p>
              <p className="text-lg font-mono text-gray-900 capitalize">{healthStatus.environment}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Last Updated</p>
              <p className="text-lg text-gray-900">
                {new Date(healthStatus.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}