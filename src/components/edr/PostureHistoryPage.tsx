'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api-client';

interface PostureHistoryPageProps {
    className?: string;
}

interface PostureScore {
    id: string;
    score: number;
    deviceCount: number;
    highRiskDeviceCount: number;
    activeAlertCount: number;
    criticalVulnerabilityCount: number;
    nonCompliantDeviceCount: number;
    calculatedAt: Date;
}

interface PostureHistoryResponse {
    success: boolean;
    data: PostureScore[];
    meta: {
        total: number;
        startDate: string | null;
        endDate: string | null;
    };
    error?: {
        code: string;
        message: string;
    };
}

export function PostureHistoryPage({ className = '' }: PostureHistoryPageProps) {
    const router = useRouter();
    const [scores, setScores] = useState<PostureScore[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Date range filters (default to last 30 days)
    const [startDate, setStartDate] = useState<string>(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(() => {
        return new Date().toISOString().split('T')[0];
    });

    // Fetch posture history
    const fetchHistory = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (startDate) {
                params.append('startDate', new Date(startDate).toISOString());
            }
            if (endDate) {
                const endDateTime = new Date(endDate);
                endDateTime.setHours(23, 59, 59, 999);
                params.append('endDate', endDateTime.toISOString());
            }

            const response = await api.get(`/api/edr/posture/history?${params.toString()}`);
            const result: PostureHistoryResponse = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    router.push('/login');
                    return;
                }
                throw new Error(result.error?.message || 'Failed to fetch posture history');
            }

            if (result.success && result.data) {
                setScores(result.data);
            } else {
                throw new Error('Invalid response format');
            }
        } catch (err) {
            console.error('Error fetching posture history:', err);
            setError(err instanceof Error ? err.message : 'Failed to load posture history');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, router]);

    // Initial fetch
    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    // Get score color
    const getScoreColor = (score: number): string => {
        if (score >= 80) return 'text-green-600 dark:text-green-400';
        if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
        if (score >= 40) return 'text-orange-600 dark:text-orange-400';
        return 'text-red-600 dark:text-red-400';
    };

    // Calculate statistics
    const stats = scores.length > 0 ? {
        average: Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length),
        highest: Math.max(...scores.map(s => s.score)),
        lowest: Math.min(...scores.map(s => s.score)),
        latest: scores[0]?.score || 0,
    } : null;

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
                        Error Loading History
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
                    <Button onClick={fetchHistory}>Retry</Button>
                </div>
            </Card>
        );
    }

    return (
        <div className={className}>
            {/* Date Range Filter */}
            <Card className="mb-6">
                <div className="p-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                        Date Range
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                End Date
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button onClick={fetchHistory} className="w-full">
                                Apply Filter
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Statistics Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    <Card>
                        <div className="p-6">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                Latest Score
                            </p>
                            <p className={`text-3xl font-bold mt-2 ${getScoreColor(stats.latest)}`}>
                                {stats.latest}
                            </p>
                        </div>
                    </Card>
                    <Card>
                        <div className="p-6">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                Average Score
                            </p>
                            <p className={`text-3xl font-bold mt-2 ${getScoreColor(stats.average)}`}>
                                {stats.average}
                            </p>
                        </div>
                    </Card>
                    <Card>
                        <div className="p-6">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                Highest Score
                            </p>
                            <p className={`text-3xl font-bold mt-2 ${getScoreColor(stats.highest)}`}>
                                {stats.highest}
                            </p>
                        </div>
                    </Card>
                    <Card>
                        <div className="p-6">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                Lowest Score
                            </p>
                            <p className={`text-3xl font-bold mt-2 ${getScoreColor(stats.lowest)}`}>
                                {stats.lowest}
                            </p>
                        </div>
                    </Card>
                </div>
            )}

            {/* Score Chart (Simple Line Chart) */}
            <Card className="mb-6">
                <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Score Trend
                    </h3>
                    {loading ? (
                        <div className="h-64 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : scores.length === 0 ? (
                        <div className="h-64 flex items-center justify-center">
                            <div className="text-center">
                                <p className="text-gray-500 dark:text-gray-400">
                                    No data available for the selected date range
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="h-64 relative">
                            {/* Simple SVG line chart */}
                            <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
                                {/* Grid lines */}
                                {[0, 25, 50, 75, 100].map((y) => (
                                    <line
                                        key={y}
                                        x1="0"
                                        y1={200 - (y * 2)}
                                        x2="800"
                                        y2={200 - (y * 2)}
                                        stroke="currentColor"
                                        strokeWidth="1"
                                        className="text-gray-200 dark:text-gray-700"
                                        strokeDasharray="5,5"
                                    />
                                ))}

                                {/* Line chart */}
                                <polyline
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    className="text-blue-600 dark:text-blue-400"
                                    points={scores
                                        .slice()
                                        .reverse()
                                        .map((score, index) => {
                                            const x = (index / (scores.length - 1)) * 800;
                                            const y = 200 - (score.score * 2);
                                            return `${x},${y}`;
                                        })
                                        .join(' ')}
                                />

                                {/* Data points */}
                                {scores
                                    .slice()
                                    .reverse()
                                    .map((score, index) => {
                                        const x = (index / (scores.length - 1)) * 800;
                                        const y = 200 - (score.score * 2);
                                        return (
                                            <circle
                                                key={score.id}
                                                cx={x}
                                                cy={y}
                                                r="4"
                                                fill="currentColor"
                                                className="text-blue-600 dark:text-blue-400"
                                            />
                                        );
                                    })}
                            </svg>

                            {/* Y-axis labels */}
                            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 dark:text-gray-400 -ml-8">
                                <span>100</span>
                                <span>75</span>
                                <span>50</span>
                                <span>25</span>
                                <span>0</span>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Contributing Factors Over Time */}
            <Card>
                <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Historical Data
                    </h3>
                    {loading ? (
                        <div className="animate-pulse space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            ))}
                        </div>
                    ) : scores.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-gray-500 dark:text-gray-400">
                                No historical data available
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Date
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Score
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Devices
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            High Risk
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Alerts
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Vulnerabilities
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Non-Compliant
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {scores.map((score) => (
                                        <tr key={score.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {new Date(score.calculatedAt).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`text-sm font-medium ${getScoreColor(score.score)}`}>
                                                    {score.score}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {score.deviceCount}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {score.highRiskDeviceCount}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {score.activeAlertCount}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {score.criticalVulnerabilityCount}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {score.nonCompliantDeviceCount}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
