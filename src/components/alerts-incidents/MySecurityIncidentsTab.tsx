'use client';

import { useState, useEffect } from 'react';
import { SecurityIncident, IncidentFilters, ResolveIncidentInput, StartWorkInput } from '@/types/alerts-incidents';
import { IncidentQueue } from './IncidentQueue';
import { IncidentFiltersPanel } from './IncidentFiltersPanel';
import { IncidentResolutionModal } from './IncidentResolutionModal';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api-client';

interface MySecurityIncidentsTabProps {
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
 * My Security Incidents Tab Component
 * 
 * Displays tenant-scoped incidents list for current analyst (owner) with:
 * - "Start Work" button for SLA tracking and status management
 * - Incident resolution form with summary/justification validation
 * - SLA timers and breach indicators
 * - Linked alerts and playbook guidance
 * 
 * Requirements: 7.1, 7.3, 7.4, 7.5, 10.1
 */
export function MySecurityIncidentsTab({ tenantId, className, demoMode = false }: MySecurityIncidentsTabProps) {
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
    });

    // Modal states
    const [resolutionModal, setResolutionModal] = useState<{
        isOpen: boolean;
        incident: SecurityIncident | null;
        outcome: 'resolved' | 'dismissed' | null;
    }>({ isOpen: false, incident: null, outcome: null });

    /**
     * Fetch incidents from API with tenant-scoped filtering
     * Requirements: 7.1
     */
    const fetchIncidents = async () => {
        try {
            setLoading(true);
            setError(null);

            // Build query parameters
            const params = new URLSearchParams({
                queue: 'my', // My Security Incidents tab - owned incidents only
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
            });

            // Add current user ID for proper incident ownership filtering
            // In demo mode, create a unique user session ID per browser tab/window
            if (demoMode) {
                // Use consistent session ID that persists across browser sessions
                let sessionId;
                try {
                    // Try sessionStorage first (per-tab isolation)
                    sessionId = sessionStorage.getItem('demoUserId');
                    if (sessionId) {
                        console.log(`🔄 MySecurityIncidentsTab: Using existing session ID from sessionStorage: ${sessionId}`);
                    } else {
                        // Try localStorage as fallback (per-browser persistence)
                        sessionId = localStorage.getItem('demoUserId');
                        if (sessionId) {
                            console.log(`🔄 MySecurityIncidentsTab: Using existing session ID from localStorage: ${sessionId}`);
                            // Store in sessionStorage for this tab
                            sessionStorage.setItem('demoUserId', sessionId);
                        } else {
                            // Create new session ID
                            sessionId = `user-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`;
                            
                            // Store in both storages
                            sessionStorage.setItem('demoUserId', sessionId);
                            localStorage.setItem('demoUserId', sessionId);
                            
                            console.log(`🆕 MySecurityIncidentsTab: Created new session ID: ${sessionId}`);
                        }
                    }
                    
                    params.append('ownerId', sessionId);
                    console.log(`🔍 MySecurityIncidentsTab: Fetching incidents for owner: ${sessionId}`);
                    console.log(`🔍 MySecurityIncidentsTab: Full API URL: ${demoMode ? '/api/alerts-incidents/demo/incidents' : '/api/alerts-incidents/incidents'}?${params.toString()}`);
                } catch (error) {
                    console.error('Storage error:', error);
                    // Fallback to a simple unique ID
                    sessionId = `user-fallback-${Date.now()}`;
                    params.append('ownerId', sessionId);
                    console.log(`🔄 MySecurityIncidentsTab: Using fallback session ID: ${sessionId}`);
                }
            }

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

            const response = await api.get(`${apiEndpoint}?${params.toString()}`);

            const result: IncidentsResponse = await response.json();
            console.log(`📥 MySecurityIncidentsTab: API response:`, result);

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
                });
                
                console.log(`📊 MySecurityIncidentsTab: Received ${result.data.incidents.length} incidents`);
                if (result.data.incidents.length > 0) {
                    console.log(`📋 Incident titles:`, result.data.incidents.map(i => `${i.id}: ${i.title} (owner: ${i.ownerId})`));
                }
            }

            logger.debug('My incidents fetched successfully', {
                tenantId,
                incidentCount: result.data?.incidents.length || 0,
                openCount: result.data?.metadata.openCount || 0,
                inProgressCount: result.data?.metadata.inProgressCount || 0,
            });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
            logger.error('Failed to fetch my incidents', err instanceof Error ? err : new Error(String(err)), {
                tenantId,
                filters,
            });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handle start work on incident
     * Requirements: 7.1, 10.1
     */
    const handleStartWork = async (incidentId: string) => {
        try {
            const apiEndpoint = demoMode
                ? `/api/alerts-incidents/demo/incidents/${incidentId}/start-work`
                : `/api/alerts-incidents/incidents/${incidentId}/start-work`;

            const response = await api.post(apiEndpoint, {});

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error?.message || 'Failed to start work on incident');
            }

            // Update incident status in local state
            setIncidents(prevIncidents =>
                prevIncidents.map(incident =>
                    incident.id === incidentId
                        ? {
                            ...incident,
                            status: 'in_progress' as const,
                            acknowledgedAt: new Date(),
                            investigationStartedAt: new Date(),
                        }
                        : incident
                )
            );

            // Update metadata counts
            setMetadata(prev => ({
                ...prev,
                openCount: Math.max(0, prev.openCount - 1),
                inProgressCount: prev.inProgressCount + 1,
            }));

            logger.info('Work started on incident successfully', {
                incidentId,
                tenantId,
            });

            // Show success message
            alert('Work started successfully! SLA timers are now active.');

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            logger.error('Failed to start work on incident', err instanceof Error ? err : new Error(String(err)), {
                incidentId,
                tenantId,
            });

            // Show error message
            alert(`Failed to start work: ${errorMessage}`);
        }
    };

    /**
     * Handle incident resolution
     * Requirements: 7.4, 7.5
     */
    const handleResolveIncident = async (input: ResolveIncidentInput) => {
        try {
            const endpoint = input.outcome === 'resolved' ? 'resolve' : 'dismiss';
            const body = input.outcome === 'resolved'
                ? { summary: input.summary }
                : { justification: input.justification };

            // Use demo endpoint if in demo mode
            const apiEndpoint = demoMode
                ? `/api/alerts-incidents/demo/incidents/${input.incidentId}/${endpoint}`
                : `/api/alerts-incidents/incidents/${input.incidentId}/${endpoint}`;

            const response = await api.post(apiEndpoint, body);

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error?.message || `Failed to ${input.outcome} incident`);
            }

            // Remove resolved/dismissed incident from the list
            setIncidents(prevIncidents => prevIncidents.filter(incident => incident.id !== input.incidentId));

            // Update metadata counts
            setMetadata(prev => ({
                ...prev,
                total: Math.max(0, prev.total - 1),
                inProgressCount: Math.max(0, prev.inProgressCount - 1),
            }));

            logger.info('Incident resolved successfully', {
                incidentId: input.incidentId,
                outcome: input.outcome,
                tenantId,
            });

            // Close modal and show success message
            setResolutionModal({ isOpen: false, incident: null, outcome: null });
            alert(`Incident ${input.outcome} successfully!`);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            logger.error('Failed to resolve incident', err instanceof Error ? err : new Error(String(err)), {
                incidentId: input.incidentId,
                tenantId,
            });

            // Show error message
            alert(`Failed to ${input.outcome} incident: ${errorMessage}`);
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

    /**
     * Open resolution modal
     */
    const openResolutionModal = (incident: SecurityIncident, outcome: 'resolved' | 'dismissed') => {
        setResolutionModal({ isOpen: true, incident, outcome });
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

    // Auto-refresh when component becomes visible (for tab switching)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && tenantId) {
                console.log('🔄 MySecurityIncidentsTab: Tab became visible, refreshing incidents...');
                fetchIncidents();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [tenantId]);

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
            {/* Header with counts */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        My Security Incidents
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {metadata.total} incidents owned by you • {metadata.openCount} open • {metadata.inProgressCount} in progress
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
            <IncidentFiltersPanel
                filters={filters}
                onFiltersChange={handleFiltersChange}
            />

            {/* Incident Queue */}
            <IncidentQueue
                incidents={incidents}
                loading={loading}
                onStartWork={handleStartWork}
                onResolveIncident={openResolutionModal}
                pagination={pagination}
                onPageChange={handlePageChange}
                readOnly={false} // My Incidents allows actions
            />

            {/* Resolution Modal */}
            {resolutionModal.isOpen && resolutionModal.incident && resolutionModal.outcome && (
                <IncidentResolutionModal
                    incident={resolutionModal.incident}
                    outcome={resolutionModal.outcome}
                    isOpen={resolutionModal.isOpen}
                    onClose={() => setResolutionModal({ isOpen: false, incident: null, outcome: null })}
                    onResolve={handleResolveIncident}
                />
            )}
        </div>
    );
}