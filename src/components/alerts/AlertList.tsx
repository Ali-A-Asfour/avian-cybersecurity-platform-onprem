'use client';

import { useState } from 'react';
import { Alert, AlertSeverity, AlertStatus } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';


interface AlertListProps {
  alerts: Alert[];
  loading: boolean;
  onAlertClick: (alert: Alert) => void;
  onStatusUpdate?: (alertId: string, status: string) => void;
  onInvestigate?: (alertId: string) => void;
  showMyAlertsActions?: boolean; // Show escalate/dismiss actions for My Alerts page
}

export function AlertList({ alerts, loading, onAlertClick, onStatusUpdate, onInvestigate, showMyAlertsActions = false }: AlertListProps) {
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');


  // Map alert severity to standard severity levels
  const mapSeverity = (severity: AlertSeverity): 'critical' | 'high' | 'medium' | 'low' | 'info' => {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      case 'info': return 'info';
      default: return 'info';
    }
  };

  // Map alert status to standard status types
  const mapStatus = (status: AlertStatus): 'new' | 'open' | 'investigating' | 'in_progress' | 'awaiting_response' | 'escalated' | 'resolved' | 'closed' | 'canceled' => {
    switch (status) {
      case 'open': return 'open';
      case 'investigating': return 'investigating';
      case 'resolved': return 'resolved';
      case 'false_positive': return 'closed';
      default: return 'new';
    }
  };

  const columns = [
    {
      key: 'severity',
      label: 'Severity',
      sortable: true,
      render: (alert: Alert) => (
        <SeverityBadge
          severity={mapSeverity(alert.severity)}
          size="sm"
        />
      ),
    },
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (alert: Alert) => (
        <div className="max-w-xs">
          <div
            className="font-medium text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 truncate"
            onClick={() => onAlertClick(alert)}
            title={alert.title}
          >
            {alert.title}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 truncate" title={alert.description}>
            {alert.description}
          </div>
        </div>
      ),
    },
    {
      key: 'source',
      label: 'Source',
      sortable: true,
      render: (alert: Alert) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {alert.source}
        </span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (alert: Alert) => (
        <span className="text-sm text-gray-900 dark:text-white capitalize">
          {alert.category.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (alert: Alert) => (
        <StatusBadge
          status={mapStatus(alert.status)}
          size="sm"
        />
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (alert: Alert) => (
        <div className="text-sm text-gray-900 dark:text-white">
          <div>{new Date(alert.created_at).toLocaleDateString()}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(alert.created_at).toLocaleTimeString()}
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (alert: Alert) => (
        <div className="flex space-x-1">
          {/* Triage Queue Actions (Alerts page) */}
          {!showMyAlertsActions && alert.status === 'open' && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                if (onInvestigate) {
                  onInvestigate(alert.id);
                } else if (onStatusUpdate) {
                  onStatusUpdate(alert.id, 'investigating');
                }
              }}
              className="text-xs px-2 py-1"
            >
              Investigate
            </Button>
          )}

          {/* My Alerts Actions */}
          {showMyAlertsActions && alert.status === 'assigned' && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                if (onInvestigate) {
                  onInvestigate(alert.id);
                }
              }}
              className="text-xs px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              Investigate
            </Button>
          )}

          {showMyAlertsActions && alert.status === 'investigating' && (
            <>
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  // This will be handled by the parent component's escalate modal
                  onAlertClick(alert);
                }}
                className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Escalate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  // This will be handled by the parent component
                  onAlertClick(alert);
                }}
                className="text-xs px-2 py-1"
              >
                Dismiss
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  const sortedAlerts = [...alerts].sort((a, b) => {
    const aValue = a[sortBy as keyof Alert];
    const bValue = b[sortBy as keyof Alert];

    if (aValue === bValue) return 0;

    const comparison = aValue < bValue ? -1 : 1;
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex space-x-4">
                <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="flex-1 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="w-20 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="w-24 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-4 text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {showMyAlertsActions ? 'No alerts assigned to you' : 'No alerts found'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {showMyAlertsActions
              ? 'Assign alerts to yourself from the "Alerts" triage queue to start investigating.'
              : 'There are no security alerts matching your current filters.'
            }
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <DataTable
          data={sortedAlerts}
          columns={columns}
          onSort={handleSort}
          sortBy={sortBy}
          sortOrder={sortOrder}
        />
      </div>


    </>
  );
}