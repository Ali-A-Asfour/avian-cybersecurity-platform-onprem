'use client';

import { useState, useEffect } from 'react';
import { SecurityAlert, AlertFilters } from '@/types/alerts-incidents';
import { AlertInvestigationQueue } from './AlertInvestigationQueue';
import { AlertFiltersPanel } from './AlertFiltersPanel';
import { AlertDetailModal } from './AlertDetailModal';
import { WorkflowGuidance } from './WorkflowGuidance';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api-client';

interface MyAlertsTabProps {
    tenantId: string;
    className?: string;
    demoMode?: boolean;
}

interface AlertsResponse {
    success: boolean;
    data?: {
        alerts: SecurityAlert[];
        pagination: {
            page: number;
            limit: number;
            total: number;
        };
        metadata: {
            unassignedCount: number;
            assignedCount: number;
            queue: string;
        };
    };
    error?: {
        code: string;
        message: string;
    };
}

/**
 * My Alerts Tab Component (Investigation Queue)
 * 
 * Displays tenant-scoped assigned alerts for current analyst with:
 * - Assignment time ordering (newest at bottom)
 * - "View" action that opens detail modal with 3 resolution options
 * - SOC workflow: Alert → View → Escalate/Resolve as Benign/Resolve as False Positive
 * - All resolution actions remove alert from My Alerts
 * 
 * Requirements: 3.1, 3.2, 3.3, 4.1, 4.2
 */
export function MyAlertsTab({ tenantId, className, demoMode = false }: MyAlertsTabProps) {
    const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<Partial<AlertFilters>>({});
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 50,
        total: 0,
    });
    const [metadata, setMetadata] = useState({
        unassignedCount: 0,
        assignedCount: 0,
    });

    // No modal states needed - simplified workflow

    /**
     * Fetch alerts from API with tenant-scoped filtering
     * Requirements: 3.1
     */
    const fetchAlerts = async () => {
        try {
            setLoading(true);
            setError(null);

            // Build query parameters
            const params = new URLSearchParams({
                queue: 'my', // My Alerts tab - assigned alerts only
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
            });

            // Add filter parameters
            if (filters.severity) {
                if (Array.isArray(filters.severity)) {
                    filters.severity.forEach(s => params.append('severity', s));
                } else {
                    params.append('severity', filters.severity);
                }
            }

            if (filters.classification) {
                params.append('classification', filters.classification);
            }

            if (filters.sourceSystem) {
                params.append('sourceSystem', filters.sourceSystem);
            }

            if (filters.startDate) {
                params.append('startDate', filters.startDate.toISOString());
            }

            if (filters.endDate) {
                params.append('endDate', filters.endDate.toISOString());
            }

            const apiEndpoint = demoMode
                ? '/api/alerts-incidents/demo/alerts'
                : '/api/alerts-incidents/alerts';

            const response = await api.get(`${apiEndpoint}?${params.toString()}`);

            const result: AlertsResponse = await response.json();

            if (!result.success) {
                throw new Error(result.error?.message || 'Failed to fetch alerts');
            }

            if (result.data) {
                setAlerts(result.data.alerts);
                setPagination(result.data.pagination);
                setMetadata({
                    unassignedCount: result.data.metadata?.unassignedCount || 0,
                    assignedCount: result.data.metadata?.assignedCount || 0,
                });
            }

            logger.debug('My alerts fetched successfully', {
                tenantId,
                alertCount: result.data?.alerts?.length || 0,
                assignedCount: result.data?.metadata?.assignedCount || 0,
            });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
            logger.error('Failed to fetch my alerts', err instanceof Error ? err : new Error(String(err)), {
                tenantId,
                filters,
            });
        } finally {
            setLoading(false);
        }
    };

    const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    /**
     * Handle alert view - opens detail modal
     * Requirements: 4.1
     */
    const handleViewAlert = (alert: SecurityAlert) => {
        setSelectedAlert(alert);
        setShowDetailModal(true);
    };

    /**
     * Handle escalate to security incident
     * Requirements: 6.2, 6.3
     */
    const handleEscalateToIncident = async (alertId: string) => {
        try {
            console.log('🚀 Starting escalation for alert:', alertId, 'demoMode:', demoMode);

            const apiEndpoint = demoMode
                ? `/api/alerts-incidents/demo/alerts/${alertId}/escalate`
                : `/api/alerts-incidents/alerts/${alertId}/escalate`;

            console.log('📡 Calling API endpoint:', apiEndpoint);

            const response = await api.post(apiEndpoint, {
                incidentTitle: `Security Incident from Alert ${alertId}`,
                incidentDescription: `Escalated from alert ${alertId} for further investigation`
            });

            console.log('📥 API response status:', response.status);
            const result = await response.json();
            console.log('📥 API response data:', result);

            if (!result.success) {
                throw new Error(result.error?.message || 'Failed to escalate to security incident');
            }

            console.log('✅ Escalation successful, updating UI...');

            // Remove alert from My Alerts (it's now moved to My Security Incidents)
            setAlerts(prevAlerts => {
                const newAlerts = prevAlerts.filter(alert => alert.id !== alertId);
                console.log('📝 Updated alerts count:', newAlerts.length);
                return newAlerts;
            });

            // Update metadata counts
            setMetadata(prev => ({
                ...prev,
                assignedCount: Math.max(0, prev.assignedCount - 1),
            }));

            logger.info('Alert escalated to security incident successfully', {
                alertId,
                incidentId: result.data?.incidentId,
                tenantId,
                demoMode
            });

            // Close modal
            setShowDetailModal(false);
            setSelectedAlert(null);

            // Show success message (in a real app, this would use a toast notification)
            console.log('🎉 Alert escalated to Security Incident! Check My Security Incidents tab.');

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            console.error('❌ Escalation failed:', errorMessage);

            logger.error('Failed to escalate alert to security incident', err instanceof Error ? err : new Error(String(err)), {
                alertId,
                tenantId,
                demoMode
            });

            // Show error message (in a real app, this would use a toast notification)
            console.error(`Failed to escalate to security incident: ${errorMessage}`);
        }
    };

    /**
     * Handle resolve as benign
     * Requirements: 6.4
     */
    const handleResolveAsBenign = async (alertId: string, notes: string) => {
        try {
            const response = await api.post(`/api/alerts-incidents/alerts/${alertId}/resolve`, {
                outcome: 'benign',
                notes,
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error?.message || 'Failed to resolve alert as benign');
            }

            // Remove alert from My Alerts
            setAlerts(prevAlerts => prevAlerts.filter(alert => alert.id !== alertId));

            // Update metadata counts
            setMetadata(prev => ({
                ...prev,
                assignedCount: Math.max(0, prev.assignedCount - 1),
            }));

            logger.info('Alert resolved as benign successfully', {
                alertId,
                tenantId,
            });

            // Close modal
            setShowDetailModal(false);
            setSelectedAlert(null);

            // Show success message (in a real app, this would use a toast notification)
            console.log('Alert resolved as benign and removed from My Alerts.');

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            logger.error('Failed to resolve alert as benign', err instanceof Error ? err : new Error(String(err)), {
                alertId,
                tenantId,
            });

            // Show error message (in a real app, this would use a toast notification)
            console.error(`Failed to resolve as benign: ${errorMessage}`);
        }
    };

    /**
     * Handle resolve as false positive
     * Requirements: 6.5
     */
    const handleResolveAsFalsePositive = async (alertId: string, notes: string) => {
        try {
            const response = await api.post(`/api/alerts-incidents/alerts/${alertId}/resolve`, {
                outcome: 'false_positive',
                notes,
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error?.message || 'Failed to resolve alert as false positive');
            }

            // Remove alert from My Alerts
            setAlerts(prevAlerts => prevAlerts.filter(alert => alert.id !== alertId));

            // Update metadata counts
            setMetadata(prev => ({
                ...prev,
                assignedCount: Math.max(0, prev.assignedCount - 1),
            }));

            logger.info('Alert resolved as false positive successfully', {
                alertId,
                tenantId,
            });

            // Close modal
            setShowDetailModal(false);
            setSelectedAlert(null);

            // Show success message (in a real app, this would use a toast notification)
            console.log('Alert resolved as false positive and removed from My Alerts.');

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            logger.error('Failed to resolve alert as false positive', err instanceof Error ? err : new Error(String(err)), {
                alertId,
                tenantId,
            });

            // Show error message (in a real app, this would use a toast notification)
            console.error(`Failed to resolve as false positive: ${errorMessage}`);
        }
    };

    /**
     * Handle modal close
     */
    const handleCloseDetailModal = () => {
        setShowDetailModal(false);
        setSelectedAlert(null);
    };

    /**
     * Handle filter changes
     */
    const handleFiltersChange = (newFilters: Partial<AlertFilters>) => {
        setFilters(newFilters);
        setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
    };

    /**
     * Handle pagination changes
     */
    const handlePageChange = (page: number) => {
        setPagination(prev => ({ ...prev, page }));
    };

    /**
     * Handle refresh
     */
    const handleRefresh = () => {
        fetchAlerts();
    };

    // Removed modal handlers - simplified workflow

    // Initial load
    useEffect(() => {
        if (tenantId) {
            fetchAlerts();
        }
    }, [tenantId]);

    // Refetch when pagination or filters change
    useEffect(() => {
        if (tenantId && (pagination.page > 1 || Object.keys(filters).length > 0)) {
            fetchAlerts();
        }
    }, [pagination.page, pagination.limit, filters]);

    if (loading && alerts.length === 0) {
        return (
            <div className={`flex items-center justify-center py-12 ${className || ''}`}>
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    if (error) {
        return (
            <div className={className}>
                <ErrorMessage
                    message={error}
                    onRetry={handleRefresh}
                />
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${className || ''}`}>
            {/* Header with counts */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        My Alerts (Investigation Queue)
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {metadata.assignedCount} alerts assigned to you for investigation
                    </p>
                </div>
                <div className="flex items-center space-x-4">
                    <button
                        onClick={handleRefresh}
                        disabled={loading}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg
                            className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Workflow Guidance - show for alerts that need investigation */}
            {alerts.some(alert => alert.status === 'assigned') && (
                <WorkflowGuidance
                    alert={alerts.find(alert => alert.status === 'assigned')!}
                    className="mb-4"
                />
            )}

            {/* Filters Panel */}
            <AlertFiltersPanel
                filters={filters}
                onFiltersChange={handleFiltersChange}
                showAssignmentFilters={false} // My Alerts tab only shows assigned alerts
            />

            {/* Alert Investigation Queue */}
            <AlertInvestigationQueue
                alerts={alerts}
                loading={loading}
                onViewAlert={handleViewAlert}
                pagination={pagination}
                onPageChange={handlePageChange}
            />

            {/* Alert Detail Modal */}
            {selectedAlert && (
                <AlertDetailModal
                    alert={selectedAlert}
                    isOpen={showDetailModal}
                    onClose={handleCloseDetailModal}
                    onEscalateToIncident={handleEscalateToIncident}
                    onResolveAsBenign={handleResolveAsBenign}
                    onResolveAsFalsePositive={handleResolveAsFalsePositive}
                />
            )}
        </div>
    );
}