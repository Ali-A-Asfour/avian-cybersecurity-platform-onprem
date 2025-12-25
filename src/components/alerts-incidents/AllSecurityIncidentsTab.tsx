'use client';

import { useState, useEffect } from 'react';
import { SecurityIncident, IncidentFilters } from '@/types/alerts-incidents';
import { IncidentQueue } from './IncidentQueue';
import { IncidentFiltersPanel } from './IncidentFiltersPanel';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { logger } from '@/lib/logger';

interface AllSecurityIncidentsTabProps {
    tenantId: string;
    className?: string;
    demoMode?: boolean;
}

interface IncidentsResponse {
    success: boolean;
    data?: {
        incidents: SecurityIncident[];
        pagination: {
            page: number;
            limit: number;
            total: number;
        };
        metadata: {
            total: number;
            openCount: number;
            inProgressCount: number;
            resolvedCount: number;
            dismissedCount: number;
            queue: string;
            readOnly: boolean;
        };
    };
    error?: {
        code: string;
        message: string;
    };
}

/**
 * All Security Incidents Tab Component
 * 
 * Displays tenant-scoped incidents list with read-only access for:
 * - Incident visibility and awareness across the organization
 * - Status and outcome information for reporting purposes
 * - No pickup, reassignment, or ownership-restricted actions
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
export function AllSecurityIncidentsTab({ tenantId, className, demoMode = false }: AllSecurityIncidentsTabProps) {
    const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<Partial<IncidentFilters>>({});
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 50,
        total: 0,
    });
    const [metadata, setMetadata] = useState({
        total: 0,
        openCount: 0,
        inProgressCount: 0,
        resolvedCount: 0,
        dismissedCount: 0,
    });

    /**
     * Fetch all incidents from API with tenant-scoped filtering
     * Requirements: 8.1, 8.3
     */
    const fetchIncidents = async () => {
        try {
            setLoading(true);
            setError(null);

            // Build query parameters
            const params = new URLSearchParams({
                queue: 'all', // All Security Incidents tab - all incidents in tenant (read-only)
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

            if (filters.status) {
                if (Array.isArray(filters.status)) {
                    filters.status.forEach(s => params.append('status', s));
                } else {
                    params.append('status', filters.status);
                }
            }

            if (filters.startDate) {
                params.append('startDate', filters.startDate.toISOString());
            }

            if (filters.endDate) {
                params.append('endDate', filters.endDate.toISOString());
            }

            const apiEndpoint = demoMode
                ? '/api/alerts-incidents/demo/incidents'
                : '/api/alerts-incidents/incidents';

            const response = await fetch(`${apiEndpoint}?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const result: IncidentsResponse = await response.json();

            if (!result.success) {
                throw new Error(result.error?.message || 'Failed to fetch incidents');
            }

            if (result.data) {
                setIncidents(result.data.incidents);
                setPagination(result.data.pagination);
                setMetadata({
                    total: result.data.metadata.total,
                    openCount: result.data.metadata.openCount,
                    inProgressCount: result.data.metadata.inProgressCount,
                    resolvedCount: result.data.metadata.resolvedCount || 0,
                    dismissedCount: result.data.metadata.dismissedCount || 0,
                });
            }

            logger.debug('All incidents fetched successfully', {
                tenantId,
                incidentCount: result.data?.incidents.length || 0,
                total: result.data?.metadata.total || 0,
                openCount: result.data?.metadata.openCount || 0,
                inProgressCount: result.data?.metadata.inProgressCount || 0,
            });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
            logger.error('Failed to fetch all incidents', err instanceof Error ? err : new Error(String(err)), {
                tenantId,
                filters,
            });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handle filter changes
     */
    const handleFiltersChange = (newFilters: Partial<IncidentFilters>) => {
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
        fetchIncidents();
    };

    // Initial load
    useEffect(() => {
        if (tenantId) {
            fetchIncidents();
        }
    }, [tenantId]);

    // Refetch when pagination or filters change
    useEffect(() => {
        if (tenantId && (pagination?.page > 1 || Object.keys(filters).length > 0)) {
            fetchIncidents();
        }
    }, [pagination?.page, pagination?.limit, filters]);

    if (loading && incidents.length === 0) {
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
            {/* Header with counts and read-only indicator */}
            {/* Requirements: 8.1, 8.3, 8.5 */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center space-x-3">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            All Security Incidents
                        </h2>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            Read Only
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {metadata.total} total incidents • {metadata.openCount} open • {metadata.inProgressCount} in progress • {metadata.resolvedCount} resolved • {metadata.dismissedCount} dismissed
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

            {/* Information banner about read-only access */}
            {/* Requirements: 8.2, 8.4 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            Read-Only View
                        </h3>
                        <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                            <p>
                                This view provides visibility into all security incidents within your organization for awareness and reporting purposes.
                                You cannot pick up, reassign, or perform ownership-restricted actions from this view.
                                To work on incidents, they must be assigned to you through the escalation process.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters Panel */}
            <IncidentFiltersPanel
                filters={filters}
                onFiltersChange={handleFiltersChange}
            />

            {/* Incident Queue in read-only mode */}
            {/* Requirements: 8.1, 8.2, 8.3, 8.4, 8.5 */}
            <IncidentQueue
                incidents={incidents}
                loading={loading}
                pagination={pagination}
                onPageChange={handlePageChange}
                readOnly={true} // All Incidents view is read-only
            />
        </div>
    );
}