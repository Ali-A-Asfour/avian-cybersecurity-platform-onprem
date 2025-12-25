'use client';

import React, { useState } from 'react';
import { SecurityAlert } from '@/types/alerts-incidents';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
// Removed date-fns dependency - using custom time formatting

interface AlertTriageQueueProps {
    alerts: SecurityAlert[];
    loading: boolean;
    onInvestigateAlert: (alertId: string) => Promise<void>;
    pagination: {
        page: number;
        limit: number;
        total: number;
    };
    onPageChange: (page: number) => void;
}

/**
 * Alert Triage Queue Component
 * 
 * Displays unassigned alerts with:
 * - Severity-based sorting (Critical→Low) then created time (oldest first)
 * - Required metadata: severity, title, classification, source, created time, status
 * - "Investigate" action that moves alert to My Alerts with ownership locking
 * - No investigation or resolution actions available
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5, 2.1
 */
export function AlertTriageQueue({
    alerts,
    loading,
    onInvestigateAlert,
    pagination,
    onPageChange,
}: AlertTriageQueueProps) {
    const [assigningAlerts, setAssigningAlerts] = useState<Set<string>>(new Set());

    /**
     * Handle alert investigation (move to My Alerts) with loading state
     * Requirements: 2.1, 2.2, 2.3
     */
    const handleInvestigateAlert = async (alertId: string) => {
        if (assigningAlerts.has(alertId)) return;

        setAssigningAlerts(prev => new Set(prev).add(alertId));

        try {
            await onInvestigateAlert(alertId);
        } catch (error) {
            // Error handling is done in parent component
            console.error('Investigation failed:', error);
        } finally {
            setAssigningAlerts(prev => {
                const newSet = new Set(prev);
                newSet.delete(alertId);
                return newSet;
            });
        }
    };

    /**
     * Map severity to SeverityBadge format
     */
    const mapSeverityToBadge = (severity: string): 'critical' | 'high' | 'medium' | 'low' | 'info' => {
        switch (severity.toLowerCase()) {
            case 'critical': return 'critical';
            case 'high': return 'high';
            case 'medium': return 'medium';
            case 'low': return 'low';
            default: return 'info';
        }
    };

    /**
     * Map status to StatusBadge format
     */
    const mapStatusToBadge = (status: string): 'new' | 'open' | 'investigating' | 'in_progress' | 'awaiting_response' | 'escalated' | 'resolved' | 'closed' | 'canceled' => {
        switch (status.toLowerCase()) {
            case 'open': return 'open';
            case 'assigned': return 'in_progress';
            case 'investigating': return 'investigating';
            case 'escalated': return 'escalated';
            case 'closed_benign':
            case 'closed_false_positive': return 'closed';
            default: return 'new';
        }
    };

    /**
     * Format source system for display
     */
    const formatSourceSystem = (sourceSystem: string): string => {
        switch (sourceSystem.toLowerCase()) {
            case 'edr': return 'Microsoft Defender';
            case 'firewall': return 'SonicWall Firewall';
            case 'email': return 'Email Alert';
            default: return sourceSystem.toUpperCase();
        }
    };

    /**
     * Format classification for display
     */
    const formatClassification = (classification: string): string => {
        return classification
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    /**
     * Format time ago without external dependencies
     */
    const formatTimeAgo = (date: Date): string => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    // Define table columns with proper ordering
    // Requirements: 1.2, 1.3
    const columns = [
        {
            key: 'severity',
            label: 'Severity',
            sortable: true,
            render: (alert: SecurityAlert) => (
                <SeverityBadge
                    severity={mapSeverityToBadge(alert.severity)}
                    size="sm"
                />
            ),
        },
        {
            key: 'title',
            label: 'Alert Details',
            sortable: true,
            render: (alert: SecurityAlert) => (
                <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 dark:text-white truncate" title={alert.title}>
                        {alert.title}
                    </div>
                    {alert.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1" title={alert.description}>
                            {alert.description}
                        </div>
                    )}
                    {/* Show Microsoft Defender context if available */}
                    {alert.defenderIncidentId && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            Defender Incident: {alert.defenderIncidentId}
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: 'classification',
            label: 'Classification',
            sortable: true,
            render: (alert: SecurityAlert) => (
                <span className="text-sm text-gray-900 dark:text-white">
                    {formatClassification(alert.classification)}
                </span>
            ),
        },
        {
            key: 'sourceSystem',
            label: 'Source',
            sortable: true,
            render: (alert: SecurityAlert) => (
                <span className="text-sm text-gray-900 dark:text-white">
                    {formatSourceSystem(alert.sourceSystem)}
                </span>
            ),
        },
        {
            key: 'createdAt',
            label: 'Created',
            sortable: true,
            render: (alert: SecurityAlert) => (
                <div className="text-sm text-gray-900 dark:text-white">
                    <div>{new Date(alert.createdAt).toLocaleDateString()}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTimeAgo(new Date(alert.createdAt))}
                    </div>
                </div>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (alert: SecurityAlert) => (
                <StatusBadge
                    status={mapStatusToBadge(alert.status)}
                    size="sm"
                />
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            sortable: false,
            render: (alert: SecurityAlert) => (
                <div className="flex items-center space-x-2">
                    {/* Investigate button - moves alert to My Alerts */}
                    {/* Requirements: 1.5, 2.1 */}
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleInvestigateAlert(alert.id);
                        }}
                        disabled={assigningAlerts.has(alert.id)}
                        className="text-xs px-3 py-1 text-blue-600 border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 disabled:opacity-50"
                    >
                        {assigningAlerts.has(alert.id) ? (
                            <>
                                <svg className="w-3 h-3 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Investigating...
                            </>
                        ) : (
                            'Investigate'
                        )}
                    </Button>
                </div>
            ),
        },
    ];

    // Sort alerts by severity (Critical→Low) then by created time (oldest first)
    // Requirements: 1.2
    const sortedAlerts = [...alerts].sort((a, b) => {
        // Define severity order (Critical = 0, High = 1, Medium = 2, Low = 3)
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const aSeverity = severityOrder[a.severity as keyof typeof severityOrder] ?? 4;
        const bSeverity = severityOrder[b.severity as keyof typeof severityOrder] ?? 4;

        // First sort by severity (Critical first)
        if (aSeverity !== bSeverity) {
            return aSeverity - bSeverity;
        }

        // Then sort by created time (oldest first)
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    if (loading && alerts.length === 0) {
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
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No unassigned alerts
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                        All alerts have been assigned or there are no new alerts to triage.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Alert count and sorting info */}
            <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing {sortedAlerts.length} alerts, sorted by severity (Critical → Low) then by age (oldest first)
            </div>

            {/* Data table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <DataTable
                    data={sortedAlerts}
                    columns={columns}
                    onSort={() => { }} // Sorting is handled by our custom logic
                    sortBy="severity"
                    sortOrder="asc"
                />
            </div>

            {/* Pagination */}
            {pagination.total > pagination.limit && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                        {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                        {pagination.total} alerts
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onPageChange(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                        >
                            Previous
                        </Button>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            Page {pagination.page}
                        </span>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onPageChange(pagination.page + 1)}
                            disabled={pagination.page * pagination.limit >= pagination.total}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}