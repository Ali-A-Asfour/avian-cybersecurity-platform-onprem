'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import type { NormalizedDevice } from '@/types/edr';
import { api } from '@/lib/api-client';

interface DevicesResponse {
    devices: NormalizedDevice[];
    total: number;
}

interface DeviceFilters {
    search?: string;
    os?: string;
    riskLevel?: string;
    complianceState?: string;
    lastSeenAfter?: string;
    page?: number;
    limit?: number;
}

export function DevicesDashboard() {
    const router = useRouter();
    const [devices, setDevices] = useState<NormalizedDevice[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<DeviceFilters>({
        page: 1,
        limit: 20,
    });

    // Fetch devices from API
    const fetchDevices = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (filters.search) params.append('search', filters.search);
            if (filters.os) params.append('os', filters.os);
            if (filters.riskLevel) params.append('riskLevel', filters.riskLevel);
            if (filters.complianceState) params.append('complianceState', filters.complianceState);
            if (filters.lastSeenAfter) params.append('lastSeenAfter', filters.lastSeenAfter);
            if (filters.page) params.append('page', filters.page.toString());
            if (filters.limit) params.append('limit', filters.limit.toString());

            const response = await api.get(`/api/edr/devices?${params}`);

            if (!response.ok) {
                if (response.status === 401) {
                    router.push('/login');
                    return;
                }
                if (response.status === 403) {
                    throw new Error('Access denied');
                }
                throw new Error(`Failed to fetch devices: ${response.statusText}`);
            }

            const data: DevicesResponse = await response.json();
            setDevices(data.devices);
            setTotal(data.total);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load devices';
            setError(errorMessage);
            console.error('Error fetching devices:', err);
        } finally {
            setLoading(false);
        }
    }, [filters, router]);

    // Initial fetch
    useEffect(() => {
        fetchDevices();
    }, [fetchDevices]);

    // Auto-refresh every 30 seconds
    useAutoRefresh({
        onRefresh: fetchDevices,
        interval: 30000,
        enabled: true,
    });

    // Handle search input
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }));
    };

    // Handle filter changes
    const handleFilterChange = (key: keyof DeviceFilters, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value || undefined, page: 1 }));
    };

    // Handle pagination
    const handlePageChange = (newPage: number) => {
        setFilters(prev => ({ ...prev, page: newPage }));
    };

    // Handle device row click
    const handleDeviceClick = (deviceId: string) => {
        router.push(`/edr/devices/${deviceId}`);
    };

    // Map risk score to severity level
    const mapRiskToSeverity = (riskScore: number): 'critical' | 'high' | 'medium' | 'low' | 'info' => {
        if (riskScore >= 75) return 'critical';
        if (riskScore >= 50) return 'high';
        if (riskScore >= 25) return 'medium';
        return 'low';
    };

    // Map compliance state to status
    const mapComplianceToStatus = (state: string): 'new' | 'open' | 'investigating' | 'in_progress' | 'awaiting_response' | 'escalated' | 'resolved' | 'closed' | 'canceled' => {
        if (state === 'compliant') return 'resolved';
        if (state === 'noncompliant') return 'escalated';
        return 'new';
    };

    // Format last seen date
    const formatLastSeen = (date: Date | string): string => {
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

    const totalPages = Math.ceil(total / (filters.limit || 20));
    const currentPage = filters.page || 1;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    EDR Devices
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Monitor and manage endpoints from Microsoft Defender and Intune
                </p>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Search */}
                    <div className="lg:col-span-2">
                        <Input
                            type="text"
                            placeholder="Search by hostname or user..."
                            value={filters.search || ''}
                            onChange={handleSearchChange}
                        />
                    </div>

                    {/* OS Filter */}
                    <div>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                            value={filters.os || ''}
                            onChange={(e) => handleFilterChange('os', e.target.value)}
                        >
                            <option value="">All OS</option>
                            <option value="Windows">Windows</option>
                            <option value="macOS">macOS</option>
                            <option value="Linux">Linux</option>
                            <option value="iOS">iOS</option>
                            <option value="Android">Android</option>
                        </select>
                    </div>

                    {/* Risk Level Filter */}
                    <div>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                            value={filters.riskLevel || ''}
                            onChange={(e) => handleFilterChange('riskLevel', e.target.value)}
                        >
                            <option value="">All Risk Levels</option>
                            <option value="high">High (75-100)</option>
                            <option value="medium">Medium (50-74)</option>
                            <option value="low">Low (0-49)</option>
                        </select>
                    </div>

                    {/* Compliance Filter */}
                    <div>
                        <select
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                            value={filters.complianceState || ''}
                            onChange={(e) => handleFilterChange('complianceState', e.target.value)}
                        >
                            <option value="">All Compliance States</option>
                            <option value="compliant">Compliant</option>
                            <option value="noncompliant">Non-Compliant</option>
                            <option value="unknown">Unknown</option>
                        </select>
                    </div>
                </div>

                {/* Results count */}
                <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                    Showing {devices.length} of {total} devices
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-center">
                        <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="text-red-800 dark:text-red-200">{error}</span>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {loading && devices.length === 0 && (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">Loading devices...</p>
                    </div>
                </div>
            )}

            {/* Devices Table */}
            {!loading || devices.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Hostname</TableHead>
                                <TableHead>OS</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Compliance</TableHead>
                                <TableHead>Risk Score</TableHead>
                                <TableHead>Last Seen</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {devices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-gray-500 dark:text-gray-400">
                                        No devices found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                devices.map((device) => (
                                    <TableRow
                                        key={device.id}
                                        onClick={() => handleDeviceClick(device.id)}
                                        className="cursor-pointer"
                                    >
                                        <TableCell className="font-medium">
                                            {device.deviceName}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center">
                                                <span className="text-sm">{device.operatingSystem}</span>
                                                {device.osVersion && (
                                                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                                                        {device.osVersion}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{device.primaryUser || '-'}</TableCell>
                                        <TableCell>
                                            <StatusBadge
                                                status={mapComplianceToStatus(device.intuneComplianceState)}
                                                size="sm"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center space-x-2">
                                                <SeverityBadge
                                                    severity={mapRiskToSeverity(device.riskScore)}
                                                    size="sm"
                                                />
                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    {device.exposureLevel}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                            {formatLastSeen(device.lastSeenAt)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            ) : null}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
