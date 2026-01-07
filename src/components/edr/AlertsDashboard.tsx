'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { NormalizedAlert } from '@/types/edr';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';

import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card } from '@/components/ui/Card';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { api } from '@/lib/api-client';

interface AlertsDashboardProps {
    className?: string;
}

interface AlertsResponse {
    success: boolean;
    data: NormalizedAlert[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
    error?: {
        code: string;
        message: string;
    };
}

export function AlertsDashboard({ className = '' }: AlertsDashboardProps) {
    const router = useRouter();
    const [alerts, setAlerts] = useState<NormalizedAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [severityFilter, setSeverityFilter] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [deviceIdFilter, setDeviceIdFilter] = useState<string>('');

    // Pagination
    const [page, setPage] = useState(1);
    const [limit] = useState(50);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    // Selected alert for details
    const [selectedAlert, setSelectedAlert] = useState<NormalizedAlert | null>(null);

    // Fetch alerts
    const fetchAlerts = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
            });

            if (severityFilter) {
                params.append('severity', severityFilter);
            }

            if (statusFilter) {
                params.append('status', statusFilter);
            }

            if (deviceIdFilter) {
                params.append('deviceId', deviceIdFilter);
            }

            const response = await api.get(`/api/edr/alerts?${params.toString()}`);
            const result: AlertsResponse = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    router.push('/login');
                    return;
                }
                throw new Error(result.error?.message || 'Failed to fetch alerts');
            }

            if (result.success && result.data) {
                setAlerts(result.data);
                setTotal(result.meta.total);
                setTotalPages(result.meta.totalPages);
            } else {
                throw new Error('Invalid response format');
            }
        } catch (err) {
            console.error('Error fetching alerts:', err);
            setError(err instanceof Error ? err.message : 'Failed to load alerts');
        } finally {
            setLoading(false);
        }
    }, [page, limit, severityFilter, statusFilter, deviceIdFilter, router]);

    // Initial fetch
    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    // Auto-refresh every 30 seconds
    useAutoRefresh({
        onRefresh: fetchAlerts,
        interval: 30000,
        enabled: true,
    });

    // Get severity badge
    const getSeverityBadge = (severity: string) => {
        // Map to standard severity levels
        const mapSeverity = (sev: string): 'critical' | 'high' | 'medium' | 'low' | 'info' => {
            switch (sev.toLowerCase()) {
                case 'high': return 'high';
                case 'medium': return 'medium';
                case 'low': return 'low';
                case 'informational': return 'info';
                default: return 'info';
            }
        };

        return <SeverityBadge severity={mapSeverity(severity)} size="sm" />;
    };

    // Get status badge
    const getStatusBadge = (status: string) => {
        // Map to standard status types
        const mapStatus = (stat: string): 'new' | 'open' | 'investigating' | 'in_progress' | 'awaiting_response' | 'escalated' | 'resolved' | 'closed' | 'canceled' => {
            switch (stat.toLowerCase()) {
                case 'resolved': return 'resolved';
                case 'in_progress': return 'in_progress';
                case 'new': return 'new';
                case 'dismissed': return 'closed';
                default: return 'new';
            }
        };

        return <StatusBadge status={mapStatus(status)} size="sm" />;
    };

    // Format timestamp
    const formatTimestamp = (date: Date | string): string => {
        const d = new Date(date);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString();
    };

    // Handle filter changes
    const handleSeverityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSeverityFilter(e.target.value);
        setPage(1);
    };

    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setStatusFilter(e.target.value);
        setPage(1);
    };

    // Handle pagination
    const handlePreviousPage = () => {
        if (page > 1) {
            setPage(page - 1);
        }
    };

    const handleNextPage = () => {
        if (page < totalPages) {
            setPage(page + 1);
        }
    };

    // Handle alert click
    const handleAlertClick = (alert: NormalizedAlert) => {
        setSelectedAlert(alert);
    };

    if (error) {
        return (
            <Card className={className}>
                <div className="p-12 text-center">
                    <div className="w-12 h-12 mx-auto mb-4 text-red-500">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        Error Loading Alerts
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
                    <Button onClick={fetchAlerts}>Retry</Button>
                </div>
            </Card>
        );
    }

    return (
        <div className={className}>
            {/* Filters */}
            <Card className="mb-6">
                <div className="p-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                        Filters
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label
                                htmlFor="severity"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                            >
                                Severity
                            </label>
                            <select
                                id="severity"
                                value={severityFilter}
                                onChange={handleSeverityChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="">All Severities</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                                <option value="informational">Informational</option>
                            </select>
                        </div>
                        <div>
                            <label
                                htmlFor="status"
                                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                            >
                                Status
                            </label>
                            <select
                                id="status"
                                value={statusFilter}
                                onChange={handleStatusChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="">All Statuses</option>
                                <option value="new">New</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="dismissed">Dismissed</option>
                            </select>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Alerts Table */}
            <Card>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                            Security Alerts
                        </h2>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            Total: {total} alerts
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="p-6">
                        <div className="animate-pulse space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex space-x-4">
                                    <div className="w-20 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                    <div className="flex-1 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                    <div className="w-24 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                    <div className="w-32 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : alerts.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-12 h-12 mx-auto mb-4 text-gray-400">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            No alerts found
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                            There are no security alerts matching your current filters.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Severity</TableHead>
                                        <TableHead>Threat Name</TableHead>
                                        <TableHead>Threat Type</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Detected</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {alerts.map((alert) => (
                                        <TableRow
                                            key={alert.id}
                                            onClick={() => handleAlertClick(alert)}
                                            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                                        >
                                            <TableCell>
                                                {getSeverityBadge(alert.severity)}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {alert.threatName}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                                {alert.threatType}
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(alert.status)}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                                {formatTimestamp(alert.detectedAt)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                    Showing page {page} of {totalPages} ({total} total)
                                </div>
                                <div className="flex space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handlePreviousPage}
                                        disabled={page === 1}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleNextPage}
                                        disabled={page === totalPages}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </Card>

            {/* Alert Details Modal */}
            {selectedAlert && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                    onClick={() => setSelectedAlert(null)}
                >
                    <div
                        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="flex items-start justify-between mb-4">
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                    Alert Details
                                </h3>
                                <button
                                    onClick={() => setSelectedAlert(null)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        Threat Name
                                    </label>
                                    <p className="text-gray-900 dark:text-white font-medium">
                                        {selectedAlert.threatName}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                            Severity
                                        </label>
                                        <div className="mt-1">
                                            {getSeverityBadge(selectedAlert.severity)}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                            Status
                                        </label>
                                        <div className="mt-1">
                                            {getStatusBadge(selectedAlert.status)}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        Threat Type
                                    </label>
                                    <p className="text-gray-900 dark:text-white">
                                        {selectedAlert.threatType}
                                    </p>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        Description
                                    </label>
                                    <p className="text-gray-900 dark:text-white">
                                        {selectedAlert.description}
                                    </p>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        Detected At
                                    </label>
                                    <p className="text-gray-900 dark:text-white">
                                        {new Date(selectedAlert.detectedAt).toLocaleString()}
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                    <Button
                                        onClick={() => {
                                            if (selectedAlert.deviceId) {
                                                router.push(`/edr/devices/${selectedAlert.deviceId}`);
                                            }
                                        }}
                                        className="w-full"
                                    >
                                        View Device Details
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
