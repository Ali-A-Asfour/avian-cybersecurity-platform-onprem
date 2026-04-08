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
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSource, setNewSource] = useState({ name: '', type: 'edr_defender', tenantId: '', clientId: '', clientSecret: '', host: '', port: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchDataSources();
  }, []);

  const fetchDataSources = async () => {
    try {
      setLoading(true);
      const authToken = localStorage.getItem('auth-token');
      const response = await fetch('/api/data-sources', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (!response.ok) throw new Error('Failed to fetch data sources');
      const data = await response.json();
      setDataSources(data.data_sources || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (id: string) => {
    try {
      const authToken = localStorage.getItem('auth-token');
      const response = await fetch(`/api/data-sources/${id}/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        alert('Connection test successful!');
      } else {
        alert('Connection test failed');
      }
    } catch (error) {
      alert('Connection test failed');
    }
  };

  const handleAddDataSource = async () => {
    try {
      setAdding(true);
      const authToken = localStorage.getItem('auth-token');
      const response = await fetch('/api/data-sources', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSource.name,
          type: newSource.type,
          connection_config: newSource.type === 'edr_defender'
            ? { tenant_id: newSource.tenantId, client_id: newSource.clientId, client_secret: newSource.clientSecret }
            : { host: newSource.host, port: parseInt(newSource.port) || 443 },
        }),
      });
      if (!response.ok) throw new Error('Failed to add data source');
      setShowAddModal(false);
      setNewSource({ name: '', type: 'edr_defender', host: '', port: '' });
      fetchDataSources();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add data source');
    } finally {
      setAdding(false);
    }
  }; = (status: string) => {
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
              <Button onClick={() => setShowAddModal(true)}>
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
              <ul className="text-sm space-y-1">
                <li className="text-gray-700">• Microsoft Defender</li>
                <li className="text-gray-400">• CrowdStrike Falcon <span className="text-xs italic">— coming soon</span></li>
                <li className="text-gray-400">• SentinelOne <span className="text-xs italic">— coming soon</span></li>
                <li className="text-gray-400">• Avast EDR <span className="text-xs italic">— coming soon</span></li>
              </ul>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">Firewalls</h4>
              <ul className="text-sm space-y-1">
                <li className="text-gray-700">• SonicWall</li>
                <li className="text-gray-400">• Fortinet FortiGate <span className="text-xs italic">— coming soon</span></li>
                <li className="text-gray-400">• Cisco ASA <span className="text-xs italic">— coming soon</span></li>
                <li className="text-gray-400">• pfSense <span className="text-xs italic">— coming soon</span></li>
              </ul>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">SIEM Systems</h4>
              <ul className="text-sm space-y-1">
                <li className="text-gray-400">• Splunk <span className="text-xs italic">— coming soon</span></li>
                <li className="text-gray-400">• IBM QRadar <span className="text-xs italic">— coming soon</span></li>
                <li className="text-gray-400">• Microsoft Sentinel <span className="text-xs italic">— coming soon</span></li>
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
        <Button onClick={() => setShowAddModal(true)}>
          Add Data Source
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'sources', name: 'Data Sources' },
            { id: 'monitoring', name: 'Monitoring' },
            { id: 'flow', name: 'Data Flow' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {renderTabContent()}

      {/* Add Data Source Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Add Data Source</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={newSource.name}
                  onChange={e => setNewSource({ ...newSource, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-neutral-700 dark:border-neutral-600"
                  placeholder="e.g. Client Defender"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={newSource.type}
                  onChange={e => setNewSource({ ...newSource, type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-neutral-700 dark:border-neutral-600"
                >
                  <option value="edr_defender">Microsoft Defender</option>
                  <option value="firewall_sonicwall">SonicWall Firewall</option>
                </select>
              </div>
              {newSource.type === 'edr_defender' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Azure Tenant ID</label>
                    <input type="text" value={newSource.tenantId} onChange={e => setNewSource({ ...newSource, tenantId: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-neutral-700 dark:border-neutral-600" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Application (Client) ID</label>
                    <input type="text" value={newSource.clientId} onChange={e => setNewSource({ ...newSource, clientId: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-neutral-700 dark:border-neutral-600" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Client Secret</label>
                    <input type="password" value={newSource.clientSecret} onChange={e => setNewSource({ ...newSource, clientSecret: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-neutral-700 dark:border-neutral-600" placeholder="Your app client secret value" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Host / IP Address</label>
                    <input type="text" value={newSource.host} onChange={e => setNewSource({ ...newSource, host: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-neutral-700 dark:border-neutral-600" placeholder="e.g. 192.168.1.1" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Port</label>
                    <input type="number" value={newSource.port} onChange={e => setNewSource({ ...newSource, port: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-neutral-700 dark:border-neutral-600" placeholder="443" />
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleAddDataSource} disabled={adding || !newSource.name} className="flex-1">
                {adding ? 'Adding...' : 'Add Data Source'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}