'use client';

import { useState } from 'react';
import { SecurityIncident } from '@/types/alerts-incidents';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';

interface IncidentQueueProps {
    incidents: SecurityIncident[];
    loading: boolean;
    onStartWork?: (incidentId: string) => Promise<void>;
    onResolveIncident?: (incident: SecurityIncident, outcome: 'resolved' | 'dismissed') => void;
    pagination: {
        page: number;
        limit: number;
        total: number;
    };
    onPageChange: (page: number) => void;
    readOnly?: boolean; // For All Incidents view
}

/**
 * Incident Queue Component
 * 
 * Displays security incidents with:
 * - "Start Work" button for SLA tracking and status management
 * - SLA timers and breach indicators
 * - Resolution actions (resolve/dismiss)
 * - Read-only mode for All Incidents view
 * 
 * Requirements: 7.1, 7.3, 7.4, 7.5, 8.1, 8.2, 8.4, 10.1
 */
export function IncidentQueue({
    incidents,
    loading,
    onStartWork,
    onResolveIncident,
    pagination,
    onPageChange,
    readOnly = false,
}: IncidentQueueProps) {
    const [workingIncidents, setWorkingIncidents] = useState<Set<string>>(new Set());

    /**
     * Handle start work with loading state
     * Requirements: 7.1, 10.1
     */
    const handleStartWork = async (incidentId: string) => {
        if (workingIncidents.has(incidentId) || !onStartWork) return;

        setWorkingIncidents(prev => new Set(prev).add(incidentId));

        try {
            await onStartWork(incidentId);
        } catch (error) {
            // Error handling is done in parent component
            console.error('Start work failed:', error);
        } finally {
            setWorkingIncidents(prev => {
                const newSet = new Set(prev);
                newSet.delete(incidentId);
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
            case 'in_progress': return 'in_progress';
            case 'resolved': return 'resolved';
            case 'dismissed': return 'closed';
            default: return 'new';
        }
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

    /**
     * Calculate SLA status and time remaining
     * Requirements: 10.1
     */
    const calculateSLAStatus = (incident: SecurityIncident): {
        status: 'ok' | 'warning' | 'breach';
        timeRemaining: string;
        slaType: 'acknowledge' | 'investigate' | 'resolve';
    } => {
        const now = new Date();

        // Determine which SLA to check based on incident status
        let slaDeadline: Date;
        let slaType: 'acknowledge' | 'investigate' | 'resolve';

        if (incident.status === 'open' && !incident.acknowledgedAt) {
            slaDeadline = new Date(incident.slaAcknowledgeBy);
            slaType = 'acknowledge';
        } else if (incident.status === 'in_progress' && !incident.resolvedAt) {
            // Check if investigate SLA is still active
            const investigateDeadline = new Date(incident.slaInvestigateBy);
            const resolveDeadline = new Date(incident.slaResolveBy);

            if (now < investigateDeadline) {
                slaDeadline = investigateDeadline;
                slaType = 'investigate';
            } else {
                slaDeadline = resolveDeadline;
                slaType = 'resolve';
            }
        } else {
            slaDeadline = new Date(incident.slaResolveBy);
            slaType = 'resolve';
        }

        const timeRemaining = slaDeadline.getTime() - now.getTime();
        const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
        const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

        let status: 'ok' | 'warning' | 'breach';
        let timeRemainingStr: string;

        if (timeRemaining <= 0) {
            status = 'breach';
            timeRemainingStr = 'BREACH';
        } else if (timeRemaining <= 30 * 60 * 1000) { // 30 minutes warning
            status = 'warning';
            timeRemainingStr = `${minutesRemaining}m`;
        } else if (hoursRemaining < 24) {
            status = 'ok';
            timeRemainingStr = `${hoursRemaining}h ${minutesRemaining}m`;
        } else {
            const daysRemaining = Math.floor(hoursRemaining / 24);
            status = 'ok';
            timeRemainingStr = `${daysRemaining}d ${hoursRemaining % 24}h`;
        }

        return { status, timeRemaining: timeRemainingStr, slaType };
    };

    /**
     * Check if incident can start work
     */
    const canStartWork = (incident: SecurityIncident): boolean => {
        return !readOnly && incident.status === 'open';
    };

    /**
     * Check if incident can be resolved or dismissed
     */
    const canResolveOrDismiss = (incident: SecurityIncident): boolean => {
        return !readOnly && incident.status === 'in_progress';
    };

    // Define table columns
    // Requirements: 7.1, 7.3, 8.1, 8.2
    const columns = [
        {
            key: 'severity',
            label: 'Severity',
            sortable: true,
            render: (incident: SecurityIncident) => (
                <SeverityBadge
                    severity={mapSeverityToBadge(incident.severity)}
                    size="sm"
                />
            ),
        },
        {
            key: 'title',
            label: 'Incident Details',
            sortable: true,
            render: (incident: SecurityIncident) => (
                <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 dark:text-white truncate" title={incident.title}>
                        {incident.title}
                    </div>
                    {incident.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1" title={incident.description}>
                            {incident.description}
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: 'status',
            label: 'Status',
            sortable: true,
            render: (incident: SecurityIncident) => (
                <StatusBadge
                    status={mapStatusToBadge(incident.status)}
                    size="sm"
                />
            ),
        },
        {
            key: 'sla',
            label: 'SLA Status',
            sortable: false,
            render: (incident: SecurityIncident) => {
                const sla = calculateSLAStatus(incident);
                const colorClass = sla.status === 'breach'
                    ? 'text-red-600 dark:text-red-400 font-semibold'
                    : sla.status === 'warning'
                        ? 'text-yellow-600 dark:text-yellow-400 font-medium'
                        : 'text-green-600 dark:text-green-400';

                return (
                    <div className="text-sm">
                        <div className={colorClass}>
                            {sla.timeRemaining}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                            {sla.slaType}
                        </div>
                    </div>
                );
            },
        },
        {
            key: 'createdAt',
            label: 'Created',
            sortable: true,
            render: (incident: SecurityIncident) => (
                <div className="text-sm text-gray-900 dark:text-white">
                    <div>{new Date(incident.createdAt).toLocaleDateString()}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTimeAgo(new Date(incident.createdAt))}
                    </div>
                </div>
            ),
        },
        {
            key: 'actions',
            label: 'Actions',
            sortable: false,
            render: (incident: SecurityIncident) => {
                if (readOnly) {
                    // All Incidents view - read-only (Requirements: 8.2, 8.4)
                    return (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            View Only
                        </span>
                    );
                }

                return (
                    <div className="flex items-center space-x-2">
                        {/* Start Work button - only for open incidents */}
                        {/* Requirements: 7.1, 10.1 */}
                        {canStartWork(incident) && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartWork(incident.id);
                                }}
                                disabled={workingIncidents.has(incident.id)}
                                className="text-xs px-3 py-1 text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-900 disabled:opacity-50"
                            >
                                {workingIncidents.has(incident.id) ? (
                                    <>
                                        <svg className="w-3 h-3 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Starting...
                                    </>
                                ) : (
                                    'Start Work'
                                )}
                            </Button>
                        )}

                        {/* Resolution buttons - only for in_progress incidents */}
                        {/* Requirements: 7.4, 7.5 */}
                        {canResolveOrDismiss(incident) && onResolveIncident && (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onResolveIncident(incident, 'resolved');
                                    }}
                                    className="text-xs px-3 py-1 text-blue-600 border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900"
                                >
                                    Resolve
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onResolveIncident(incident, 'dismissed');
                                    }}
                                    className="text-xs px-3 py-1 text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-900"
                                >
                                    Dismiss
                                </Button>
                            </>
                        )}
                    </div>
                );
            },
        },
    ];

    // Sort incidents by created time (newest first)
    const sortedIncidents = [...incidents].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    if (loading && incidents.length === 0) {
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
                                <div className="w-32 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (incidents.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-12 text-center">
                    <div className="w-12 h-12 mx-auto mb-4 text-gray-400">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        {readOnly ? 'No incidents found' : 'No incidents assigned'}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                        {readOnly
                            ? 'There are no security incidents to display.'
                            : 'You don\'t have any security incidents assigned. Escalate alerts from the My Alerts tab to create incidents.'
                        }
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Incident count and sorting info */}
            <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing {sortedIncidents.length} incidents, sorted by creation time (newest first)
            </div>

            {/* Data table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <DataTable
                    data={sortedIncidents}
                    columns={columns}
                    onSort={() => { }} // Sorting is handled by our custom logic
                    sortBy="createdAt"
                    sortOrder="desc"
                />
            </div>

            {/* Pagination */}
            {pagination.total > pagination.limit && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                        {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                        {pagination.total} incidents
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