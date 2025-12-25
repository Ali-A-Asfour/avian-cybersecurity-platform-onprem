'use client';

import { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface PerformanceData {
  cache: {
    stats: {
      hits: number;
      misses: number;
      sets: number;
      deletes: number;
      hitRate: number;
    };
    info: {
      keyCount: number;
      memoryUsage: string;
    };
  };
  database: {
    stats: {
      totalQueries: number;
      avgDuration: number;
      cacheHitRate: number;
      slowQueries: number;
      queries: Array<{
        key: string;
        count: number;
        avgDuration: number;
        cacheHitRate: number;
        slowCount: number;
      }>;
    };
    connectionPool: {
      active: number;
      idle: number;
      total: number;
      waiting: number;
    };
  };
  system: {
    performance: {
      isRunning: boolean;
      totalRequests: number;
      activeRequests: number;
      avgResponseTime: number;
      errorRate: number;
      requestsPerMinute: number;
    };
  };
  recommendations: Array<{
    category: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    action?: string;
  }>;
}

export function PerformanceDashboard() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState<string | null>(null);

  useEffect(() => {
    fetchPerformanceData();

    const interval = setInterval(fetchPerformanceData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchPerformanceData = async () => {
    try {
      setError(null);

      // Use mock data for development
      const { delay } = await import('@/lib/dev-mode');
      await delay(500); // Simulate loading

      // Mock performance data
      const mockData: PerformanceData = {
        cache: {
          stats: {
            hits: 8500,
            misses: 1200,
            sets: 2400,
            deletes: 350,
            hitRate: 0.876
          },
          info: {
            keyCount: 15420,
            memoryUsage: '245MB'
          }
        },
        database: {
          stats: {
            totalQueries: 45230,
            avgDuration: 125,
            cacheHitRate: 0.82,
            slowQueries: 23,
            queries: [
              { key: 'SELECT * FROM alerts WHERE...', count: 1250, avgDuration: 85, cacheHitRate: 0.95, slowCount: 2 },
              { key: 'SELECT * FROM tickets WHERE...', count: 980, avgDuration: 120, cacheHitRate: 0.88, slowCount: 5 },
              { key: 'SELECT * FROM assets WHERE...', count: 750, avgDuration: 95, cacheHitRate: 0.92, slowCount: 1 },
              { key: 'UPDATE alerts SET status...', count: 450, avgDuration: 180, cacheHitRate: 0.65, slowCount: 8 },
              { key: 'INSERT INTO audit_logs...', count: 2100, avgDuration: 45, cacheHitRate: 0.0, slowCount: 0 }
            ]
          },
          connectionPool: {
            active: 8,
            idle: 12,
            total: 20,
            waiting: 0
          }
        },
        system: {
          performance: {
            isRunning: true,
            totalRequests: 125000,
            activeRequests: 12,
            avgResponseTime: 245,
            errorRate: 0.002,
            requestsPerMinute: 85
          }
        },
        recommendations: [
          {
            category: 'cache',
            priority: 'medium',
            title: 'Increase Cache TTL for Static Data',
            description: 'User profile and configuration data could benefit from longer cache expiration times.',
            action: 'Update cache configuration to extend TTL for user-related data from 1 hour to 4 hours.'
          },
          {
            category: 'database',
            priority: 'high',
            title: 'Optimize Slow Alert Queries',
            description: 'Several alert-related queries are taking longer than expected.',
            action: 'Add composite index on (tenant_id, status, created_at) for alerts table.'
          },
          {
            category: 'system',
            priority: 'low',
            title: 'Monitor Memory Usage',
            description: 'Memory usage is within normal range but trending upward.',
            action: 'Set up alerts for memory usage above 80% threshold.'
          }
        ]
      };

      setData(mockData);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch performance data');
      setLoading(false);
    }
  };

  const executeOptimization = async (action: string, options: any = {}) => {
    try {
      setOptimizing(action);
      setError(null);

      // Use mock data for development
      const { delay } = await import('@/lib/dev-mode');
      await delay(2000); // Simulate optimization time

      // Simulate successful optimization
      console.log(`Mock optimization executed: ${action}`, options);

      // Refresh data after optimization
      await fetchPerformanceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Optimization failed');
    } finally {
      setOptimizing(null);
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
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
          <h3 className="text-red-800 font-medium">Error Loading Performance Data</h3>
          <p className="text-red-600 mt-1">{error}</p>
          <button
            onClick={fetchPerformanceData}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Performance Dashboard</h1>
        <div className="flex space-x-2">
          <Button
            onClick={() => executeOptimization('clear_cache')}
            disabled={optimizing === 'clear_cache'}
            variant="outline"
            size="sm"
          >
            {optimizing === 'clear_cache' ? 'Clearing...' : 'Clear Cache'}
          </Button>
          <Button
            onClick={() => executeOptimization('optimize_database')}
            disabled={optimizing === 'optimize_database'}
            variant="outline"
            size="sm"
          >
            {optimizing === 'optimize_database' ? 'Optimizing...' : 'Optimize DB'}
          </Button>
          <Button
            onClick={fetchPerformanceData}
            variant="primary"
            size="sm"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div>
            <p className="text-sm font-medium text-gray-600">Cache Hit Rate</p>
            <p className="text-2xl font-bold text-gray-900">
              {(data.cache.stats.hitRate * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500">
              {data.cache.stats.hits} hits, {data.cache.stats.misses} misses
            </p>
          </div>
        </Card>

        <Card className="p-6">
          <div>
            <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
            <p className="text-2xl font-bold text-gray-900">
              {data.system.performance.avgResponseTime.toFixed(0)}ms
            </p>
            <p className="text-xs text-gray-500">
              {data.system.performance.totalRequests.toLocaleString()} total requests
            </p>
          </div>
        </Card>

        <Card className="p-6">
          <div>
            <p className="text-sm font-medium text-gray-600">Error Rate</p>
            <p className="text-2xl font-bold text-gray-900">
              {(data.system.performance.errorRate * 100).toFixed(2)}%
            </p>
            <p className="text-xs text-gray-500">
              {data.system.performance.requestsPerMinute} req/min
            </p>
          </div>
        </Card>

        <Card className="p-6">
          <div>
            <p className="text-sm font-medium text-gray-600">DB Queries</p>
            <p className="text-2xl font-bold text-gray-900">
              {data.database.stats.totalQueries}
            </p>
            <p className="text-xs text-gray-500">
              {data.database.stats.slowQueries} slow queries
            </p>
          </div>
        </Card>
      </div>

      {/* Cache Statistics */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cache Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm font-medium text-gray-600">Memory Usage</p>
            <p className="text-xl font-bold text-gray-900">{data.cache.info.memoryUsage}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Cached Keys</p>
            <p className="text-xl font-bold text-gray-900">{data.cache.info.keyCount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Operations</p>
            <p className="text-xl font-bold text-gray-900">
              {(data.cache.stats.sets + data.cache.stats.deletes).toLocaleString()}
            </p>
          </div>
        </div>
      </Card>

      {/* Database Performance */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Database Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-md font-medium text-gray-700 mb-3">Connection Pool</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Active:</span>
                <span className="text-sm font-medium">{data.database.connectionPool.active}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Idle:</span>
                <span className="text-sm font-medium">{data.database.connectionPool.idle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total:</span>
                <span className="text-sm font-medium">{data.database.connectionPool.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Waiting:</span>
                <span className="text-sm font-medium">{data.database.connectionPool.waiting}</span>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-md font-medium text-gray-700 mb-3">Query Statistics</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Avg Duration:</span>
                <span className="text-sm font-medium">{data.database.stats.avgDuration.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Cache Hit Rate:</span>
                <span className="text-sm font-medium">{(data.database.stats.cacheHitRate * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Slow Queries:</span>
                <span className="text-sm font-medium">{data.database.stats.slowQueries}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Performance Recommendations */}
      {data.recommendations.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Recommendations</h2>
          <div className="space-y-4">
            {data.recommendations.map((rec, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(rec.priority)}`}>
                        {rec.priority.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500 uppercase">{rec.category}</span>
                    </div>
                    <h3 className="font-medium text-gray-900">{rec.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                    {rec.action && (
                      <p className="text-sm text-blue-600 mt-2">
                        <strong>Action:</strong> {rec.action}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Top Slow Queries */}
      {data.database.stats.queries.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Query Performance</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Query
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cache Hit Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Slow Count
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.database.stats.queries.slice(0, 10).map((query, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {query.key.length > 50 ? `${query.key.substring(0, 50)}...` : query.key}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {query.count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {query.avgDuration.toFixed(0)}ms
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(query.cacheHitRate * 100).toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${query.slowCount > 0 ? 'text-red-600 bg-red-100' : 'text-green-600 bg-green-100'
                        }`}>
                        {query.slowCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}