'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

interface PostureScoreWidgetProps {
    className?: string;
}

interface PostureData {
    score: number;
    trend: 'up' | 'down' | 'stable';
    factors: {
        deviceRiskAverage: number;
        alertSeverityDistribution: { low: number; medium: number; high: number };
        vulnerabilityExposure: number;
        compliancePercentage: number;
    };
    deviceCount: number;
    highRiskDeviceCount: number;
    activeAlertCount: number;
    criticalVulnerabilityCount: number;
    nonCompliantDeviceCount: number;
    calculatedAt: Date;
}

interface PostureResponse {
    success: boolean;
    data: PostureData | null;
    message?: string;
    error?: {
        code: string;
        message: string;
    };
}

export function PostureScoreWidget({ className = '' }: PostureScoreWidgetProps) {
    const router = useRouter();
    const [postureData, setPostureData] = useState<PostureData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch posture data
    const fetchPosture = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/edr/posture');
            const result: PostureResponse = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    router.push('/login');
                    return;
                }
                throw new Error(result.error?.message || 'Failed to fetch posture score');
            }

            if (result.success) {
                setPostureData(result.data);
            } else {
                throw new Error('Invalid response format');
            }
        } catch (err) {
            console.error('Error fetching posture:', err);
            setError(err instanceof Error ? err.message : 'Failed to load posture score');
        } finally {
            setLoading(false);
        }
    }, [router]);

    // Initial fetch
    useEffect(() => {
        fetchPosture();
    }, [fetchPosture]);

    // Auto-refresh every 30 seconds
    useAutoRefresh({
        onRefresh: fetchPosture,
        interval: 30000,
        enabled: true,
    });

    // Get score color based on value
    const getScoreColor = (score: number): string => {
        if (score >= 80) return 'text-green-600 dark:text-green-400';
        if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
        if (score >= 40) return 'text-orange-600 dark:text-orange-400';
        return 'text-red-600 dark:text-red-400';
    };

    // Get score background color
    const getScoreBgColor = (score: number): string => {
        if (score >= 80) return 'bg-green-100 dark:bg-green-900';
        if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900';
        if (score >= 40) return 'bg-orange-100 dark:bg-orange-900';
        return 'bg-red-100 dark:bg-red-900';
    };

    // Get trend icon
    const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
        switch (trend) {
            case 'up':
                return (
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                );
            case 'down':
                return (
                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    </svg>
                );
            default:
                return (
                    <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
                    </svg>
                );
        }
    };

    if (error) {
        return (
            <Card className={className}>
                <div className="p-6 text-center">
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
                    <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
                </div>
            </Card>
        );
    }

    if (loading) {
        return (
            <Card className={className}>
                <div className="p-6">
                    <div className="animate-pulse">
                        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
                        <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
                        <div className="space-y-2">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        </div>
                    </div>
                </div>
            </Card>
        );
    }

    if (!postureData) {
        return (
            <Card className={className}>
                <div className="p-6 text-center">
                    <div className="w-12 h-12 mx-auto mb-4 text-gray-400">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                            />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        Insufficient Data
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Posture score will be available after the first data collection cycle.
                    </p>
                </div>
            </Card>
        );
    }

    return (
        <Card
            className={`${className} cursor-pointer hover:shadow-lg transition-shadow`}
            onClick={() => router.push('/edr/posture/history')}
        >
            <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Security Posture Score
                    </h3>
                    {getTrendIcon(postureData.trend)}
                </div>

                {/* Score Display */}
                <div className="flex items-center justify-center mb-6">
                    <div className={`relative w-32 h-32 rounded-full ${getScoreBgColor(postureData.score)} flex items-center justify-center`}>
                        <div className="text-center">
                            <div className={`text-4xl font-bold ${getScoreColor(postureData.score)}`}>
                                {postureData.score}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                                out of 100
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contributing Factors */}
                <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Contributing Factors
                    </h4>

                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Device Risk</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                            {postureData.factors.deviceRiskAverage.toFixed(1)}
                        </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Active Alerts</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                            {postureData.activeAlertCount}
                        </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Critical Vulnerabilities</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                            {postureData.criticalVulnerabilityCount}
                        </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Compliance</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                            {postureData.factors.compliancePercentage.toFixed(0)}%
                        </span>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Last updated: {new Date(postureData.calculatedAt).toLocaleTimeString()}</span>
                        <span className="text-blue-600 dark:text-blue-400 hover:underline">
                            View History →
                        </span>
                    </div>
                </div>
            </div>
        </Card>
    );
}
