'use client';

import React, { useState, useEffect } from 'react';
import { SecurityAlert, AlertFilters } from '@/types/alerts-incidents';
import { AlertTriageQueue } from './AlertTriageQueue';
import { AlertFiltersPanel } from './AlertFiltersPanel';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api-client';
import { useDemoContext } from '@/contexts/DemoContext';

interface AllAlertsTabProps {
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
 * All Alerts Tab Component (Triage Queue)
 * 
 * Displays tenant-scoped unassigned alerts with:
 * - Severity-based sorting (Critical→Low) then created time (oldest first)
 * - Required metadata: severity, title, classification, source, created time, status
 * - "Investigate" action that moves alert to My Alerts with ownership locking
 * - No resolution actions available (handled in My Alerts tab)
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5, 2.1
 */
export function AllAlertsTab({ tenantId, className, demoMode = false }: AllAlertsTabProps) {
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
    
    // Get current tenant from DemoContext to trigger refresh on tenant change
    const { currentTenant } = useDemoContext();

    /**
     * Fetch alerts from API with tenant-scoped filtering
     * Requirements: 1.1
     */
    const fetchAlerts = async () => {
        try {
            setLoading(true);
            setError(null);

            // Build query parameters
            const params = new URLSearchParams({
                queue: 'all', // All Alerts tab - unassigned alerts only
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

            const apiEndpoint = (demoMode === true)
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
                    unassignedCount: result.data.metadata.unassignedCount,
                    assignedCount: result.data.metadata.assignedCount,
                });
            }

            logger.debug('Alerts fetched successfully', {
                tenantId,
                alertCount: result.data?.alerts.length || 0,
                unassignedCount: result.data?.metadata.unassignedCount || 0,
            });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
            logger.error('Failed to fetch alerts', err instanceof Error ? err : new Error(String(err)), {
                tenantId,
                filters,
            });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handle alert investigation (assign to current user and move to My Alerts)
     * Requirements: 2.1, 2.2, 2.3
     */
    const handleInvestigateAlert = async (alertId: string) => {
        try {
            const apiEndpoint = (demoMode === true)
                ? `/api/alerts-incidents/demo/alerts/${alertId}/investigate`
                : `/api/alerts-incidents/alerts/${alertId}/assign`;

            // Generate unique user ID for this session/tenant
            let sessionId;
            if (demoMode) {
                sessionId = sessionStorage.getItem('demoUserId');
                if (!sessionId) {
                    sessionId = `user-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`;
                    sessionStorage.setItem('demoUserId', sessionId);
                    console.log(`🆕 AllAlertsTab: Created new session ID: ${sessionId}`);
                } else {
                    console.log(`🔄 AllAlertsTab: Using existing session ID: ${sessionId}`);
                }
            } else {
                sessionId = 'current-user';
            }
            
            console.log(`🔍 AllAlertsTab: Investigating alert ${alertId} for user: ${sessionId}`);

            const response = await api.post(apiEndpoint, {
                userId: sessionId,
                assignedTo: sessionId
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error?.message || 'Failed to move alert to investigation');
            }

            // Remove alert from All Alerts (it moves to My Alerts)
            setAlerts(prevAlerts => prevAlerts.filter(alert => alert.id !== alertId));

            // Update metadata counts
            setMetadata(prev => ({
                ...prev,
                unassignedCount: Math.max(0, prev.unassignedCount - 1),
                assignedCount: prev.assignedCount + 1,
            }));

            logger.info('Alert moved to investigation successfully', {
                alertId,
                tenantId,
                userId,
            });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            logger.error('Failed to move alert to investigation', err instanceof Error ? err : new Error(String(err)), {
                alertId,
                tenantId,
            });

            // Show error message
            console.error(`Failed to move alert to investigation: ${errorMessage}`);
        }
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
    
    // Refetch when tenant changes (for cross-tenant users)
    useEffect(() => {
        if (currentTenant) {
            console.log('🔄 AllAlertsTab: Tenant changed to', currentTenant.id, '- refetching alerts');
            fetchAlerts();
        }
    }, [currentTenant?.id]);

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
                        All Alerts (Triage Queue)
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {metadata.unassignedCount} unassigned alerts awaiting triage
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

            {/* Filters Panel */}
            <AlertFiltersPanel
                filters={filters}
                onFiltersChange={handleFiltersChange}
                showAssignmentFilters={false} // All Alerts tab only shows unassigned
            />

            {/* Alert Triage Queue */}
            <AlertTriageQueue
                alerts={alerts}
                loading={loading}
                onInvestigateAlert={handleInvestigateAlert}
                pagination={pagination}
                onPageChange={handlePageChange}
            />
        </div>
    );
}