'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { NormalizedCompliance } from '@/types/edr';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

interface ComplianceDashboardProps {
    className?: string;
}

interface ComplianceResponse {
    success: boolean;
    data: NormalizedCompliance[];
    error?: {
        code: string;
        message: string;
    };
}

interface ComplianceSummaryResponse {
    success: boolean;
    data: {
        compliant: number;
        nonCompliant: number;
        unknown: number;
        total: number;
    };
    error?: {
        code: string;
        message: string;
    };
}

export function ComplianceDashboard({ className = '' }: ComplianceDashboardProps) {
    const router = useRouter();
    const [complianceRecords, setComplianceRecords] = useState<NormalizedCompliance[]>([]);
    const [summary, setSummary] = useState({ compliant: 0, nonCompliant: 0, unknown: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [stateFilter, setStateFilter] = useState<string>('');

    // Fetch compliance summary
    const fetchSummary = useCallback(async () => {
        try {
            const response = await fetch('/api/edr/compliance/summary');
            const result: ComplianceSummaryResponse = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    router.push('/login');
                    return;
                }
                throw new Error(result.error?.message || 'Failed to fetch compliance summary');
            }

            if (result.success && result.data) {
                setSummary(result.data);
            }
        } catch (err) {
            console.error('Error fetching compliance summary:', err);
            setError(err instanceof Error ? err.message : 'Failed to load compliance summary');
        }
    }, [router]);

    // Fetch compliance records
    const fetchCompliance = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (stateFilter) {
                params.append('state', stateFilter);
            }

            const response = await fetch(`/api/edr/compliance?${params.toString()}`);
            const result: ComplianceResponse = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    router.push('/login');
                    return;
                }
                throw new Error(result.error?.message || 'Failed to fetch compliance records');
            }

            if (result.success && result.data) {
                setComplianceRecords(result.data);
            } else {
                throw new Error('Invalid response format');
            }
        } catch (err) {
            console.error('Error fetching compliance:', err);
            setError(err instanceof Error ? err.message : 'Failed to load compliance records');
        } finally {
            setLoading(false);
        }
    }, [stateFilter, router]);

    // Fetch both summary and records
    const fetchAll = useCallback(async () => {
        await Promise.all([fetchSummary(), fetchCompliance()]);
    }, [fetchSummary, fetchCompliance]);

    // Initial fetch
    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    // Auto-refresh every 30 seconds
    useAutoRefresh({
        onRefresh: fetchAll,
        interval: 30000,
        enabled: true,
    });

    // Get compliance status mapping
    const getComplianceStatus = (state: string): 'resolved' | 'escalated' | 'closed' => {
        switch (state.toLowerCase()) {
            case 'compliant':
                return 'resolved';
            case 'noncompliant':
                return 'escalated';
            default:
                return 'closed';
        }
    };

    // Handle filter change
    const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setStateFilter(e.target.value);
    };

    // Calculate compliance percentage
    const compliancePercentage = summary.total > 0
        ? Math.round((summary.compliant / summary.total) * 100)
        : 0;

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
                        Error Loading Compliance Data
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
                </div>
            </Card>
        );
    }

    return (
        <div className={className}>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <Card>
                    <div className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Total Devices
                                </p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                    {summary.total}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Compliant
                                </p>
                                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                                    {summary.compliant}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {compliancePercentage}% of total
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Non-Compliant
                                </p>
                                <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">
                                    {summary.nonCompliant}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {summary.total > 0 ? Math.round((summary.nonCompliant / summary.total) * 100) : 0}% of total
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Unknown
                                </p>
                                <p className="text-3xl font-bold text-gray-600 dark:text-gray-400 mt-2">
                                    {summary.unknown}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {summary.total > 0 ? Math.round((summary.unknown / summary.total) * 100) : 0}% of total
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filter */}
            <Card className="mb-6">
                <div className="p-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            Compliance Records
                        </h3>
                        <div className="w-64">
                            <select
                                value={stateFilter}
                                onChange={handleStateChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="">All States</option>
                                <option value="compliant">Compliant</option>
                                <option value="noncompliant">Non-Compliant</option>
                                <option value="unknown">Unknown</option>
                            </select>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Compliance Records */}
            <Card>
                {loading ? (
                    <div className="p-6">
                        <div className="animate-pulse space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex space-x-4">
                                    <div className="flex-1 h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : complianceRecords.length === 0 ? (
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
                            No compliance records found
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                            There are no compliance records matching your current filter.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {complianceRecords.map((record) => (
                            <div
                                key={record.id}
                                className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                                onClick={() => router.push(`/edr/devices/${record.deviceId}`)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-2">
                                            <StatusBadge status={getComplianceStatus(record.complianceState)} size="sm" />
                                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                                Device ID: {record.deviceId.substring(0, 8)}...
                                            </span>
                                        </div>

                                        {record.complianceState === 'noncompliant' && record.failedRules && Array.isArray(record.failedRules) && record.failedRules.length > 0 && (
                                            <div className="mt-3">
                                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    Failed Rules:
                                                </p>
                                                <ul className="space-y-1">
                                                    {record.failedRules.map((rule: any, idx: number) => (
                                                        <li key={idx} className="text-sm text-red-600 dark:text-red-400 flex items-center">
                                                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                            </svg>
                                                            {rule.ruleName || 'Unknown rule'}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {record.securityBaselineStatus && (
                                            <div className="mt-2">
                                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                                    Security Baseline: <span className="font-medium">{record.securityBaselineStatus}</span>
                                                </span>
                                            </div>
                                        )}

                                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                            Last checked: {new Date(record.checkedAt).toLocaleString()}
                                        </div>
                                    </div>

                                    <div>
                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
