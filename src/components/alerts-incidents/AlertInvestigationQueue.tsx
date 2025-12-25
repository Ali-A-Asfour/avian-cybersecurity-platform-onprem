'use client';

import { SecurityAlert } from '@/types/alerts-incidents';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';

interface AlertInvestigationQueueProps {
    alerts: SecurityAlert[];
    loading: boolean;
    onViewAlert: (alert: SecurityAlert) => void;
    pagination: {
        page: number;
        limit: number;
        total: number;
    };
    onPageChange: (page: number) => void;
}

/**
 * Alert Investigation Queue Component
 * 
 * Displays assigned alerts with simplified workflow:
 * - Assignment time ordering (newest at bottom)
 * - Single "View" action that opens detail modal with 3 resolution options
 * - All resolution actions remove alert from My Alerts
 * - Escalation creates security incident in My Tickets
 * 
 * Requirements: 3.1, 3.2, 3.3, 4.1, 4.2
 */
export function AlertInvestigationQueue({
    alerts,
    loading,
    onViewAlert,
    pagination,
    onPageChange,
}: AlertInvestigationQueueProps) {
    /**
     * Handle alert view
     * Requirements: 4.1
     */
    const handleViewAlert = (alert: SecurityAlert) => {
        onViewAlert(alert);
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

    /**
     * Check if alert can be viewed for resolution
     * Requirements: 3.3, 4.1
     */
    const canViewAlert = (alert: SecurityAlert): boolean => {
        return alert.status === 'assigned';
    };

    /**
     * Get workflow status message for alert
     * Requirements: 3.3, 4.1
     */
    const getWorkflowStatusMessage = (alert: SecurityAlert): string => {
        switch (alert.status) {
            case 'assigned':
                return 'Click "View" to see alert details and choose resolution action';
            case 'investigating':
                return 'Investigation in progress - Security Incident created';
            case 'escalated':
                return 'Alert escalated to Security Incident';
            case 'closed_benign':
                return 'Alert resolved as benign';
            case 'closed_false_positive':
                return 'Alert resolved as false positive';
            default:
                return 'Alert status unknown';
        }
    };

    /**
     * Get workflow progress indicator
     * Requirements: 3.3, 4.1
     */
    const getWorkflowProgress = (alert: SecurityAlert): { step: number; total: number; stepName: string } => {
        switch (alert.status) {
            case 'assigned':
                return { step: 1, total: 3, stepName: 'Assigned - Ready for Review' };
            case 'investigating':
                return { step: 2, total: 3, stepName: 'Investigation Started' };
            case 'escalated':
            case 'closed_benign':
            case 'closed_false_positive':
                return { step: 3, total: 3, stepName: 'Resolved' };
            default:
                return { step: 0, total: 3, stepName: 'Unknown' };
        }
    };

    // Define table columns with proper ordering
    // Requirements: 3.2, 3.3
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
                            <a
                                href={`https://security.microsoft.com/incidents/${alert.defenderIncidentId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                            >
                                View in Microsoft Defender ↗
                            </a>
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
            key: 'assignedAt',
            label: 'Assigned',
            sortable: true,
            render: (alert: SecurityAlert) => (
                <div className="text-sm text-gray-900 dark:text-white">
                    <div>{alert.assignedAt ? new Date(alert.assignedAt).toLocaleDateString() : 'N/A'}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        {alert.assignedAt ? formatTimeAgo(new Date(alert.assignedAt)) : ''}
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
            key: 'workflow',
            label: 'Workflow Progress',
            sortable: false,
            render: (alert: SecurityAlert) => {
                const progress = getWorkflowProgress(alert);
                return (
                    <div className="min-w-0 flex-1">
                        {/* Workflow Progress Bar */}
                        <div className="flex items-center space-x-2 mb-2">
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${(progress.step / progress.total) * 100}%` }}
                                />
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                {progress.step}/{progress.total}
                            </span>
                        </div>

                        {/* Current Step */}
                        <div className="text-xs font-medium text-gray-900 dark:text-white">
                            Step {progress.step}: {progress.stepName}
                        </div>

                        {/* Workflow Status Message */}
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {getWorkflowStatusMessage(alert)}
                        </div>
                    </div>
                );
            },
        },
        {
            key: 'actions',
            label: 'Actions',
            sortable: false,
            render: (alert: SecurityAlert) => (
                <div className="flex flex-col space-y-2">
                    {/* View button - opens detail modal with resolution actions */}
                    {/* Requirements: 3.3, 4.1 */}
                    {canViewAlert(alert) && (
                        <div className="flex flex-col space-y-1">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewAlert(alert);
                                }}
                                className="text-xs px-3 py-1 text-blue-600 border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900"
                            >
                                View
                            </Button>
                            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                ↑ View details & resolve
                            </div>
                        </div>
                    )}

                    {/* Status indicators for completed alerts */}
                    {(alert.status === 'escalated' || alert.status === 'closed_benign' || alert.status === 'closed_false_positive') && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                            {alert.status === 'escalated' ? '✓ Moved to Security Incidents' : '✓ Alert resolved'}
                        </div>
                    )}
                </div>
            ),
        },
    ];

    // Sort alerts by assignment time (newest at bottom)
    // Requirements: 3.2
    const sortedAlerts = [...alerts].sort((a, b) => {
        const aAssignedAt = a.assignedAt ? new Date(a.assignedAt).getTime() : 0;
        const bAssignedAt = b.assignedAt ? new Date(b.assignedAt).getTime() : 0;
        return aAssignedAt - bAssignedAt; // Oldest first (newest at bottom)
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
                                <div className="w-32 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
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
                                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                            />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No assigned alerts
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                        You don't have any alerts assigned for investigation. Check the All Alerts tab to claim new alerts.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Alert count and sorting info */}
            <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing {sortedAlerts.length} assigned alerts, sorted by assignment time (oldest first, newest at bottom)
            </div>

            {/* Data table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <DataTable
                    data={sortedAlerts}
                    columns={columns}
                    onSort={() => { }} // Sorting is handled by our custom logic
                    sortBy="assignedAt"
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