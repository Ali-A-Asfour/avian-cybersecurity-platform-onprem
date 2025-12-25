'use client';

import { useEffect, useState } from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { DataTable } from '../../ui/DataTable';
import { AuditLog } from '../../../types';

interface AuditLogFilters {
  search?: string;
  action?: string;
  resource_type?: string;
  user_id?: string;
  tenant_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    limit: 50,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    loadAuditLogs();
  }, [filters]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(`/api/admin/audit/logs?${queryParams}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.data.logs || []);
        setTotalCount(data.data.total || 0);
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof AuditLogFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to first page when filtering
    }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 50,
    });
  };

  const exportLogs = async () => {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '' && key !== 'page' && key !== 'limit') {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(`/api/admin/audit/logs/export?${queryParams}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export audit logs:', error);
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('created')) return 'text-green-600 bg-green-100';
    if (action.includes('updated')) return 'text-blue-600 bg-blue-100';
    if (action.includes('deleted')) return 'text-red-600 bg-red-100';
    if (action.includes('login')) return 'text-purple-600 bg-purple-100';
    return 'text-gray-600 bg-gray-100';
  };

  const formatDetails = (details: Record<string, any>) => {
    return JSON.stringify(details, null, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Audit Log Viewer
        </h2>
        <div className="flex space-x-2">
          <Button onClick={exportLogs} variant="outline">
            Export CSV
          </Button>
          <Button onClick={loadAuditLogs} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="Search"
              placeholder="Search logs..."
              value={filters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Action
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.action || ''}
                onChange={(e) => handleFilterChange('action', e.target.value)}
              >
                <option value="">All Actions</option>
                <option value="user.created">User Created</option>
                <option value="user.updated">User Updated</option>
                <option value="user.deleted">User Deleted</option>
                <option value="user.login">User Login</option>
                <option value="tenant.created">Tenant Created</option>
                <option value="tenant.updated">Tenant Updated</option>
                <option value="ticket.created">Ticket Created</option>
                <option value="ticket.updated">Ticket Updated</option>
                <option value="alert.created">Alert Created</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Resource Type
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.resource_type || ''}
                onChange={(e) => handleFilterChange('resource_type', e.target.value)}
              >
                <option value="">All Resources</option>
                <option value="user">User</option>
                <option value="tenant">Tenant</option>
                <option value="ticket">Ticket</option>
                <option value="alert">Alert</option>
                <option value="compliance">Compliance</option>
              </select>
            </div>

            <Input
              label="Date From"
              type="date"
              value={filters.date_from || ''}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
            />
          </div>
          
          <div className="mt-4 flex justify-end">
            <Button onClick={clearFilters} variant="outline">
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              Audit Logs ({totalCount} total)
            </h3>
            <div className="text-sm text-gray-500">
              Page {filters.page} of {Math.ceil(totalCount / (filters.limit || 50))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <DataTable
              data={logs}
              columns={[
                {
                  key: 'created_at',
                  label: 'Timestamp',
                  render: (log: AuditLog) => new Date(log.created_at).toLocaleString()
                },
                {
                  key: 'action',
                  label: 'Action',
                  render: (log: AuditLog) => (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  )
                },
                { key: 'resource_type', label: 'Resource' },
                { key: 'user_id', label: 'User ID', render: (log: AuditLog) => log.user_id?.substring(0, 8) || 'System' },
                { key: 'tenant_id', label: 'Tenant ID', render: (log: AuditLog) => log.tenant_id?.substring(0, 8) || 'Platform' },
                { key: 'ip_address', label: 'IP Address' },
                {
                  key: 'details',
                  label: 'Actions',
                  render: (log: AuditLog) => (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedLog(log)}
                    >
                      View Details
                    </Button>
                  )
                }
              ]}
            />
          )}

          {/* Pagination */}
          {totalCount > (filters.limit || 50) && (
            <div className="mt-6 flex justify-between items-center">
              <Button
                onClick={() => handlePageChange((filters.page || 1) - 1)}
                disabled={filters.page === 1}
                variant="outline"
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Showing {((filters.page || 1) - 1) * (filters.limit || 50) + 1} to{' '}
                {Math.min((filters.page || 1) * (filters.limit || 50), totalCount)} of {totalCount}
              </span>
              <Button
                onClick={() => handlePageChange((filters.page || 1) + 1)}
                disabled={(filters.page || 1) >= Math.ceil(totalCount / (filters.limit || 50))}
                variant="outline"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Audit Log Details</h3>
              <Button
                onClick={() => setSelectedLog(null)}
                variant="outline"
                size="sm"
              >
                Close
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Timestamp</label>
                  <div className="text-sm">{new Date(selectedLog.created_at).toLocaleString()}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Action</label>
                  <div className="text-sm">{selectedLog.action}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Resource Type</label>
                  <div className="text-sm">{selectedLog.resource_type}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Resource ID</label>
                  <div className="text-sm">{selectedLog.resource_id || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">User ID</label>
                  <div className="text-sm">{selectedLog.user_id || 'System'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Tenant ID</label>
                  <div className="text-sm">{selectedLog.tenant_id || 'Platform'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">IP Address</label>
                  <div className="text-sm">{selectedLog.ip_address || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">User Agent</label>
                  <div className="text-sm truncate">{selectedLog.user_agent || 'N/A'}</div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Details</label>
                <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded text-xs overflow-x-auto">
                  {formatDetails(selectedLog.details)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}