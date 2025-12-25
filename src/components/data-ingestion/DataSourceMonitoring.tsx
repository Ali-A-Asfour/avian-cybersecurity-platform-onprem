'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface DataSource {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'error' | 'connecting';
  last_heartbeat: string;
  events_processed: number;
  created_at: string;
}

interface MonitoringMetrics {
  events_per_second: number;
  total_events_today: number;
  error_rate: number;
  latency_ms: number;
  uptime_percentage: number;
}

interface DataSourceMonitoringProps {
  dataSources: DataSource[];
}

export function DataSourceMonitoring({ dataSources }: DataSourceMonitoringProps) {
  const [metrics, setMetrics] = useState<Record<string, MonitoringMetrics>>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [dataSources]);

  const fetchMonitoringData = async () => {
    try {
      setLoading(true);
      
      // Fetch metrics for each data source
      const metricsPromises = dataSources.map(async (source) => {
        const response = await fetch(`/api/data-sources/${source.id}/metrics`);
        if (response.ok) {
          const data = await response.json();
          return { [source.id]: data.metrics };
        }
        return { [source.id]: null };
      });

      const metricsResults = await Promise.all(metricsPromises);
      const metricsData = metricsResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});
      setMetrics(metricsData);

      // Fetch alerts
      const alertsResponse = await fetch('/api/data-sources/alerts');
      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        setAlerts(alertsData.alerts || []);
      }
    } catch {
      console.error('Failed to fetch monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthStatus = (source: DataSource) => {
    const sourceMetrics = metrics[source.id];
    if (!sourceMetrics) return 'unknown';
    
    if (source.status === 'error' || sourceMetrics.error_rate > 10) return 'critical';
    if (sourceMetrics.error_rate > 5 || sourceMetrics.uptime_percentage < 95) return 'warning';
    if (source.status === 'active' && sourceMetrics.uptime_percentage >= 99) return 'healthy';
    return 'degraded';
  };

  const getHealthBadge = (status: string) => {
    const statusConfig = {
      healthy: { variant: 'secondary' as const, label: 'Healthy', className: 'bg-green-100 text-green-800' },
      degraded: { variant: 'outline' as const, label: 'Degraded', className: 'bg-yellow-100 text-yellow-800' },
      warning: { variant: 'outline' as const, label: 'Warning', className: 'bg-orange-100 text-orange-800' },
      critical: { variant: 'destructive' as const, label: 'Critical', className: '' },
      unknown: { variant: 'secondary' as const, label: 'Unknown', className: '' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.unknown;
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading monitoring data...</div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Health Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600">Total Sources</div>
          <div className="text-2xl font-bold">{dataSources.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Active Sources</div>
          <div className="text-2xl font-bold text-green-600">
            {dataSources.filter(s => s.status === 'active').length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Error Sources</div>
          <div className="text-2xl font-bold text-red-600">
            {dataSources.filter(s => s.status === 'error').length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Events Today</div>
          <div className="text-2xl font-bold">
            {formatNumber(Object.values(metrics).reduce((sum, m) => sum + (m?.total_events_today || 0), 0))}
          </div>
        </Card>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-red-600">Active Alerts</h3>
          <div className="space-y-3">
            {alerts.slice(0, 5).map((alert, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-red-100 border border-red-200 rounded-lg">
                <div>
                  <div className="font-medium text-red-800">{alert.title}</div>
                  <div className="text-sm text-red-600">{alert.description}</div>
                </div>
                <div className="text-xs text-red-500">
                  {new Date(alert.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Data Source Health Details - Grouped by Company */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Data Source Health by Company</h3>
          <Button variant="outline" size="sm" onClick={fetchMonitoringData}>
            Refresh
          </Button>
        </div>
        
        <div className="space-y-6">
          {(() => {
            const companiesMap = new Map();
            
            dataSources.forEach(source => {
              const company = (source as any).company || 'Unknown Company';
              if (!companiesMap.has(company)) {
                companiesMap.set(company, []);
              }
              companiesMap.get(company).push(source);
            });

            return Array.from(companiesMap.entries()).map(([company, sources]) => (
              <div key={company} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-gray-900">{company}</h4>
                    <div className="text-sm text-gray-600">
                      {sources.length} data source{sources.length !== 1 ? 's' : ''} • 
                      {sources.filter((s: any) => s.status === 'active').length} active • 
                      {sources.filter((s: any) => s.status === 'error').length} errors
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {formatNumber(sources.reduce((sum: number, s: any) => sum + s.events_processed, 0))}
                    </div>
                    <div className="text-xs text-gray-500">total events</div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {sources.map((source: any) => {
                    const sourceMetrics = metrics[source.id];
                    const healthStatus = getHealthStatus(source);
                    
                    return (
                      <div key={source.id} className="bg-white border rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-medium">{source.name}</div>
                            <div className="text-sm text-gray-500">{source.location} • {source.type}</div>
                          </div>
                          {getHealthBadge(healthStatus)}
                        </div>
                        
                        {sourceMetrics && (
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                            <div>
                              <div className="text-gray-600">Events/sec</div>
                              <div className="font-mono">{sourceMetrics.events_per_second.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-gray-600">Events Today</div>
                              <div className="font-mono">{formatNumber(sourceMetrics.total_events_today)}</div>
                            </div>
                            <div>
                              <div className="text-gray-600">Error Rate</div>
                              <div className={`font-mono ${sourceMetrics.error_rate > 5 ? 'text-red-600' : 'text-green-600'}`}>
                                {sourceMetrics.error_rate.toFixed(2)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-600">Latency</div>
                              <div className="font-mono">{sourceMetrics.latency_ms}ms</div>
                            </div>
                            <div>
                              <div className="text-gray-600">Uptime</div>
                              <div className={`font-mono ${sourceMetrics.uptime_percentage < 95 ? 'text-red-600' : 'text-green-600'}`}>
                                {sourceMetrics.uptime_percentage.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {!sourceMetrics && (
                          <div className="text-sm text-gray-500">No metrics available</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      </Card>

      {/* Performance Trends */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Performance Trends (Last 24 Hours)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">Event Volume</h4>
            <div className="h-32 bg-gray-50 rounded-lg flex items-center justify-center">
              <div className="text-gray-500">Chart placeholder - Event volume over time</div>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-2">Error Rates</h4>
            <div className="h-32 bg-gray-50 rounded-lg flex items-center justify-center">
              <div className="text-gray-500">Chart placeholder - Error rates over time</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

