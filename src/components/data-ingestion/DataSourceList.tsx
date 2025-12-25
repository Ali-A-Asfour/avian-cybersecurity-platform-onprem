'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable } from '@/components/ui/DataTable';
import { DataSourceMonitoring } from '@/components/data-ingestion/DataSourceMonitoring';
import { DataFlowVisualization } from '@/components/data-ingestion/DataFlowVisualization';

interface DataSource {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'error' | 'connecting';
  last_heartbeat: string;
  events_processed: number;
  created_at: string;
}

export function DataSourceList() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sources' | 'monitoring' | 'flow'>('sources');

  useEffect(() => {
    fetchDataSources();
  }, []);

  const fetchDataSources = async () => {
    try {
      setLoading(true);

      // Use mock data for development
      const { mockDataSources } = await import('@/lib/dev-mode');
      const { delay } = await import('@/lib/mock-data');
      await delay(500); // Simulate loading

      // Convert mock data to expected format with company info
      const mockDataSourcesWithCompany = mockDataSources.map((ds, index) => ({
        id: ds.id,
        name: ds.name,
        type: ds.type.toLowerCase(),
        status: ds.status === 'connected' ? 'active' : ds.status === 'warning' ? 'error' : 'inactive',
        last_heartbeat: ds.lastSync,
        events_processed: ds.eventsToday,
        created_at: new Date().toISOString(),
        company: ['Acme Corp', 'TechStart Inc', 'Global Solutions'][index % 3],
        location: ['New York, NY', 'San Francisco, CA', 'Austin, TX'][index % 3]
      }));

      setDataSources(mockDataSourcesWithCompany);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (id: string) => {
    try {
      // Use mock data for development
      const { delay } = await import('@/lib/mock-data');
      await delay(1000); // Simulate connection test

      // Simulate random success/failure
      const success = Math.random() > 0.2; // 80% success rate

      if (success) {
        alert('Connection test successful!');
      } else {
        alert('Connection test failed: Timeout connecting to data source');
      }
    } catch (error) {
      alert('Connection test failed');
    }
  };

  const getStatusBadge = (status: string) => {
    // Map data source status to standard status types
    const statusMapping = {
      active: 'resolved' as const,      // Green - working properly
      inactive: 'closed' as const,      // Gray - not active
      error: 'escalated' as const,      // Red - needs attention
      connecting: 'in_progress' as const, // Amber - in process
      warning: 'investigating' as const   // Amber - needs monitoring
    };

    const mappedStatus = statusMapping[status as keyof typeof statusMapping] || 'closed';
    return <StatusBadge status={mappedStatus} size="sm" />;
  };

  const getTypeLabel = (type: string) => {
    const typeLabels: Record<string, string> = {
      edr_avast: 'Avast EDR',
      edr_crowdstrike: 'CrowdStrike EDR',
      edr_sentinelone: 'SentinelOne EDR',
      edr_generic: 'Generic EDR',
      firewall_pfsense: 'pfSense Firewall',
      firewall_fortinet: 'Fortinet Firewall',
      firewall_cisco: 'Cisco Firewall',
      siem_splunk: 'Splunk SIEM',
      siem_qradar: 'IBM QRadar',
      syslog: 'Syslog Server'
    };

    return typeLabels[type] || type;
  };

  const columns = [
    {
      key: 'name',
      label: 'Data Source',
      render: (dataSource: DataSource) => (
        <div>
          <div className="font-medium">{dataSource.name}</div>
          <div className="text-sm text-gray-500">{getTypeLabel(dataSource.type)}</div>
        </div>
      )
    },
    {
      key: 'company',
      label: 'Company & Location',
      render: (dataSource: DataSource) => (
        <div>
          <div className="font-medium text-blue-600">{(dataSource as any).company}</div>
          <div className="text-sm text-gray-500">{(dataSource as any).location}</div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (dataSource: DataSource) => getStatusBadge(dataSource.status)
    },
    {
      key: 'events_processed',
      label: 'Events Processed',
      render: (dataSource: DataSource) => (
        <div className="text-right">
          <span className="font-mono text-lg">{dataSource.events_processed.toLocaleString()}</span>
          <div className="text-xs text-gray-500">events</div>
        </div>
      )
    },
    {
      key: 'last_heartbeat',
      label: 'Last Heartbeat',
      render: (dataSource: DataSource) => (
        <span className="text-sm">
          {new Date(dataSource.last_heartbeat).toLocaleString()}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (dataSource: DataSource) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => testConnection(dataSource.id)}
          >
            Test Connection
          </Button>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading data sources...</div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="text-red-600 mb-4">Error: {error}</div>
          <Button onClick={fetchDataSources}>Retry</Button>
        </div>
      </Card>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'sources':
        return renderDataSourcesTab();
      case 'monitoring':
        return <DataSourceMonitoring dataSources={dataSources} />;
      case 'flow':
        return <DataFlowVisualization dataSources={dataSources} />;
      default:
        return renderDataSourcesTab();
    }
  };

  const renderDataSourcesTab = () => (
    <div className="space-y-6">
      {/* Company Overview */}
      {dataSources.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Companies</div>
            <div className="text-2xl font-bold text-blue-600">
              {new Set(dataSources.map((ds: any) => ds.company)).size}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Active Sources</div>
            <div className="text-2xl font-bold text-green-600">
              {dataSources.filter(ds => ds.status === 'active').length}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Events</div>
            <div className="text-2xl font-bold text-purple-600">
              {dataSources.reduce((sum, ds) => sum + ds.events_processed, 0).toLocaleString()}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Issues</div>
            <div className="text-2xl font-bold text-red-600">
              {dataSources.filter(ds => ds.status === 'error' || (ds as any).status === 'warning').length}
            </div>
          </Card>
        </div>
      )}

      <Card>
        <div className="p-6">
          {dataSources.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-4">No data sources configured</div>
              <Button onClick={() => window.location.href = '/data-sources/new'}>
                Add Your First Data Source
              </Button>
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search data sources, companies, or locations..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => {
                    const searchTerm = e.target.value.toLowerCase();
                    // Simple client-side filtering - in production this would be server-side
                    const filtered = searchTerm ?
                      dataSources.filter(ds =>
                        ds.name.toLowerCase().includes(searchTerm) ||
                        (ds as any).company?.toLowerCase().includes(searchTerm) ||
                        (ds as any).location?.toLowerCase().includes(searchTerm) ||
                        ds.type.toLowerCase().includes(searchTerm)
                      ) : dataSources;
                    // For demo purposes, we'll just show all data
                  }}
                />
              </div>
              <DataTable
                data={dataSources}
                columns={columns}
              />
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Supported Data Sources</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">EDR Systems</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Avast EDR</li>
                <li>• CrowdStrike Falcon</li>
                <li>• SentinelOne</li>
                <li>• Generic EDR (API)</li>
              </ul>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">Firewalls</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• pfSense</li>
                <li>• Fortinet FortiGate</li>
                <li>• Cisco ASA</li>
                <li>• Syslog (Generic)</li>
              </ul>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">SIEM Systems</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Splunk</li>
                <li>• IBM QRadar</li>
                <li>• Generic SIEM (API)</li>
                <li>• Custom Integrations</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Data Ingestion Management</h2>
          <p className="text-gray-600">Manage security data sources, monitoring, and flow visualization</p>
        </div>
        <Button onClick={() => window.location.href = '/data-sources/new'}>
          Add Data Source
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'sources', name: 'Data Sources', description: 'Manage connections' },
            { id: 'monitoring', name: 'Monitoring', description: 'Real-time status' },
            { id: 'flow', name: 'Data Flow', description: 'Visualization & troubleshooting' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading data sources...</div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="text-red-600 mb-4">Error: {error}</div>
          <Button onClick={fetchDataSources}>Retry</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Data Ingestion Management</h2>
          <p className="text-gray-600">Manage security data sources, monitoring, and flow visualization</p>
        </div>
        <Button onClick={() => window.location.href = '/data-sources/new'}>
          Add Data Source
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'sources', name: 'Data Sources', description: 'Manage connections' },
            { id: 'monitoring', name: 'Monitoring', description: 'Real-time status' },
            { id: 'flow', name: 'Data Flow', description: 'Visualization & troubleshooting' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
}