'use client';

import React, { useEffect, useState } from 'react';
import { Agent, AlertSeverity } from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';

interface AgentDataAnalyticsProps {
  agentId: string;
}

interface TelemetryData {
  agent_id: string;
  time_range: string;
  metrics: {
    system_performance: {
      avg_cpu_usage: number;
      avg_memory_usage: number;
      avg_disk_usage: number;
      peak_cpu_usage: number;
      peak_memory_usage: number;
    };
    security_events: {
      total_events: number;
      critical_events: number;
      high_events: number;
      medium_events: number;
      low_events: number;
    };
    network_activity: {
      total_connections: number;
      suspicious_connections: number;
      blocked_connections: number;
      data_transferred_mb: number;
    };
    file_activity: {
      files_created: number;
      files_modified: number;
      files_deleted: number;
      suspicious_file_changes: number;
    };
  };
  alerts_generated: number;
  correlations_found: number;
  last_updated: Date;
}

interface CorrelationData {
  agent_id: string;
  total_correlations: number;
  correlations: Array<{
    id: string;
    timestamp: Date;
    event_type: string;
    correlation_type: string;
    risk_score: number;
    threat_matches: any[];
    siem_correlations: any[];
    status: string;
  }>;
  summary: {
    high_risk_correlations: number;
    medium_risk_correlations: number;
    low_risk_correlations: number;
    pending_investigations: number;
    false_positives: number;
  };
}

interface AlertData {
  agent_id: string;
  total_alerts: number;
  alerts: Array<{
    id: string;
    title: string;
    description: string;
    severity: AlertSeverity;
    status: string;
    category: string;
    metadata: any;
    created_at: Date;
  }>;
  summary: {
    critical_alerts: number;
    high_alerts: number;
    medium_alerts: number;
    low_alerts: number;
    open_alerts: number;
    investigating_alerts: number;
    resolved_alerts: number;
  };
}

export function AgentDataAnalytics({ agentId }: AgentDataAnalyticsProps) {
  const [telemetryData, setTelemetryData] = useState<TelemetryData | null>(null);
  const [correlationData, setCorrelationData] = useState<CorrelationData | null>(null);
  const [alertData, setAlertData] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'telemetry' | 'correlations' | 'alerts'>('telemetry');
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    fetchAgentData();
  }, [agentId, timeRange]);

  const fetchAgentData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch telemetry data
      const telemetryResponse = await fetch(`/api/agents/${agentId}/telemetry?time_range=${timeRange}`);
      const telemetryResult = await telemetryResponse.json();

      if (telemetryResult.success) {
        setTelemetryData(telemetryResult.data);
      }

      // Fetch correlation data
      const correlationResponse = await fetch(`/api/agents/${agentId}/correlate?time_range=${timeRange}`);
      const correlationResult = await correlationResponse.json();

      if (correlationResult.success) {
        setCorrelationData(correlationResult.data);
      }

      // Fetch alert data
      const alertResponse = await fetch(`/api/agents/${agentId}/alerts?time_range=${timeRange}`);
      const alertResult = await alertResponse.json();

      if (alertResult.success) {
        setAlertData(alertResult.data);
      }

    } catch (error) {
      setError('Failed to fetch agent data');
    } finally {
      setLoading(false);
    }
  };

  const triggerCorrelation = async () => {
    try {
      const response = await fetch(`/api/agents/${agentId}/correlate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_data: {
            time_range: timeRange,
            include_all_events: true,
          },
          generate_insights: true,
        }),
      });

      const _result = await response.json();

      if (result.success) {
        alert('Correlation analysis completed successfully');
        fetchAgentData(); // Refresh data
      } else {
        alert(`Correlation failed: ${result.error?.message}`);
      }
    } catch (error) {
      alert('Failed to trigger correlation analysis');
    }
  };

  const getSeverityBadge = (severity: AlertSeverity) => {
    // Map AlertSeverity enum to standard severity levels
    const mapSeverity = (sev: AlertSeverity): 'critical' | 'high' | 'medium' | 'low' | 'info' => {
      switch (sev) {
        case AlertSeverity.CRITICAL: return 'critical';
        case AlertSeverity.HIGH: return 'high';
        case AlertSeverity.MEDIUM: return 'medium';
        case AlertSeverity.LOW: return 'low';
        case AlertSeverity.INFO: return 'info';
        default: return 'info';
      }
    };

    return <SeverityBadge severity={mapSeverity(severity)} size="sm" />;
  };

  const getStatusBadge = (status: string) => {
    // Map to standard status types
    const mapStatus = (stat: string): 'new' | 'open' | 'investigating' | 'in_progress' | 'awaiting_response' | 'escalated' | 'resolved' | 'closed' | 'canceled' => {
      switch (stat.toLowerCase()) {
        case 'open': return 'open';
        case 'investigating': return 'investigating';
        case 'resolved': return 'resolved';
        case 'escalated': return 'escalated';
        case 'pending_review': return 'awaiting_response';
        case 'false_positive': return 'closed';
        default: return 'new';
      }
    };

    return <StatusBadge status={mapStatus(status)} size="sm" />;
  };

  const getRiskScoreBadge = (score: number) => {
    let color: 'green' | 'yellow' | 'orange' | 'red' = 'green';
    let label = 'Low Risk';

    if (score >= 75) {
      color = 'red';
      label = 'High Risk';
    } else if (score >= 50) {
      color = 'orange';
      label = 'Medium Risk';
    } else if (score >= 25) {
      color = 'yellow';
      label = 'Low-Medium Risk';
    }

    return <Badge color={color}>{label} ({score})</Badge>;
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString();
  };

  const correlationColumns = [
    {
      key: 'timestamp',
      label: 'Time',
      render: (correlation: any) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {formatDate(correlation.timestamp)}
        </span>
      ),
    },
    {
      key: 'event_type',
      label: 'Event Type',
      render: (correlation: any) => (
        <Badge color="blue">{correlation.event_type}</Badge>
      ),
    },
    {
      key: 'correlation_type',
      label: 'Correlation Type',
      render: (correlation: any) => (
        <Badge color="purple">{correlation.correlation_type}</Badge>
      ),
    },
    {
      key: 'risk_score',
      label: 'Risk Score',
      render: (correlation: any) => getRiskScoreBadge(correlation.risk_score),
    },
    {
      key: 'threat_matches',
      label: 'Threat Matches',
      render: (correlation: any) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {correlation.threat_matches.length}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (correlation: any) => getStatusBadge(correlation.status),
    },
  ];

  const alertColumns = [
    {
      key: 'created_at',
      label: 'Time',
      render: (alert: any) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {formatDate(alert.created_at)}
        </span>
      ),
    },
    {
      key: 'title',
      label: 'Alert',
      render: (alert: any) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{alert.title}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{alert.description}</div>
        </div>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (alert: any) => getSeverityBadge(alert.severity),
    },
    {
      key: 'category',
      label: 'Category',
      render: (alert: any) => (
        <Badge color="indigo">{alert.category}</Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (alert: any) => getStatusBadge(alert.status),
    },
  ];

  if (loading) {
    return (
      <Card>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="p-6">
          <div className="text-center">
            <div className="text-red-600 dark:text-red-400 mb-2">Error</div>
            <div className="text-gray-600 dark:text-gray-400 mb-4">{error}</div>
            <Button onClick={fetchAgentData}>Retry</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Agent Data Analytics
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Telemetry data, correlations, and alerts from agent {agentId}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <Button onClick={triggerCorrelation}>
            Run Correlation
          </Button>
          <Button variant="outline" onClick={fetchAgentData}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {[
            { key: 'telemetry', label: 'Telemetry Data' },
            { key: 'correlations', label: 'Correlations' },
            { key: 'alerts', label: 'Alerts' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.key
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'telemetry' && telemetryData && (
        <div className="space-y-6">
          {/* System Performance Metrics */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                System Performance
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {telemetryData.metrics.system_performance.avg_cpu_usage}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Avg CPU Usage</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {telemetryData.metrics.system_performance.avg_memory_usage}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Avg Memory Usage</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {telemetryData.metrics.system_performance.avg_disk_usage}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Avg Disk Usage</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {telemetryData.metrics.system_performance.peak_cpu_usage}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Peak CPU Usage</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {telemetryData.metrics.system_performance.peak_memory_usage}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Peak Memory Usage</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Security Events */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Security Events
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {telemetryData.metrics.security_events.total_events}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Events</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {telemetryData.metrics.security_events.critical_events}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Critical</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {telemetryData.metrics.security_events.high_events}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">High</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {telemetryData.metrics.security_events.medium_events}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Medium</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {telemetryData.metrics.security_events.low_events}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Low</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Network and File Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Network Activity
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Connections:</span>
                    <span className="text-gray-900 dark:text-white">
                      {telemetryData.metrics.network_activity.total_connections}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Suspicious Connections:</span>
                    <span className="text-red-600 dark:text-red-400">
                      {telemetryData.metrics.network_activity.suspicious_connections}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Blocked Connections:</span>
                    <span className="text-orange-600 dark:text-orange-400">
                      {telemetryData.metrics.network_activity.blocked_connections}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Data Transferred:</span>
                    <span className="text-gray-900 dark:text-white">
                      {telemetryData.metrics.network_activity.data_transferred_mb} MB
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  File Activity
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Files Created:</span>
                    <span className="text-green-600 dark:text-green-400">
                      {telemetryData.metrics.file_activity.files_created}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Files Modified:</span>
                    <span className="text-blue-600 dark:text-blue-400">
                      {telemetryData.metrics.file_activity.files_modified}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Files Deleted:</span>
                    <span className="text-yellow-600 dark:text-yellow-400">
                      {telemetryData.metrics.file_activity.files_deleted}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Suspicious Changes:</span>
                    <span className="text-red-600 dark:text-red-400">
                      {telemetryData.metrics.file_activity.suspicious_file_changes}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'correlations' && correlationData && (
        <div className="space-y-6">
          {/* Correlation Summary */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <div className="p-4 text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {correlationData.total_correlations}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Correlations</div>
              </div>
            </Card>
            <Card>
              <div className="p-4 text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {correlationData.summary.high_risk_correlations}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">High Risk</div>
              </div>
            </Card>
            <Card>
              <div className="p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {correlationData.summary.medium_risk_correlations}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Medium Risk</div>
              </div>
            </Card>
            <Card>
              <div className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {correlationData.summary.pending_investigations}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Pending Review</div>
              </div>
            </Card>
            <Card>
              <div className="p-4 text-center">
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                  {correlationData.summary.false_positives}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">False Positives</div>
              </div>
            </Card>
          </div>

          {/* Correlations Table */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Recent Correlations
              </h3>
              <DataTable
                data={correlationData.correlations}
                columns={correlationColumns}
              />
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'alerts' && alertData && (
        <div className="space-y-6">
          {/* Alert Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <div className="p-4 text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {alertData.summary.critical_alerts}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Critical Alerts</div>
              </div>
            </Card>
            <Card>
              <div className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {alertData.summary.high_alerts}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">High Alerts</div>
              </div>
            </Card>
            <Card>
              <div className="p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {alertData.summary.medium_alerts}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Medium Alerts</div>
              </div>
            </Card>
            <Card>
              <div className="p-4 text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {alertData.summary.open_alerts}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Open Alerts</div>
              </div>
            </Card>
          </div>

          {/* Alerts Table */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Recent Alerts ({alertData.total_alerts} total)
              </h3>
              <DataTable
                data={alertData.alerts}
                columns={alertColumns}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}