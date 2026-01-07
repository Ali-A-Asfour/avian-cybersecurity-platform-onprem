'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';

interface CostData {
    totalCost: number;
    monthlyTrend: number;
    services: ServiceCost[];
    regions: RegionCost[];
    dailyCosts: DailyCost[];
    budgetAlerts: BudgetAlert[];
}

interface ServiceCost {
    name: string;
    cost: number;
    percentage: number;
    trend: number;
}

interface RegionCost {
    name: string;
    cost: number;
    percentage: number;
}

interface DailyCost {
    date: string;
    cost: number;
}

interface BudgetAlert {
    id: string;
    service: string;
    threshold: number;
    current: number;
    severity: 'warning' | 'critical';
}

export default function CloudCostPage() {
    const router = useRouter();
    const { isAuthenticated, loading: authLoading } = useAuth();
    const [costData, setCostData] = useState<CostData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [authLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchCostData();
        }
    }, [selectedPeriod, isAuthenticated]);

    if (authLoading || !isAuthenticated) {
        return null;
    }

    const fetchCostData = async () => {
        try {
            // Mock data for demonstration
            const mockData: CostData = {
                totalCost: 12847.32,
                monthlyTrend: -8.5,
                services: [
                    { name: 'EC2 Instances', cost: 4521.45, percentage: 35.2, trend: -12.3 },
                    { name: 'RDS Database', cost: 2834.67, percentage: 22.1, trend: 5.7 },
                    { name: 'S3 Storage', cost: 1923.12, percentage: 15.0, trend: -3.2 },
                    { name: 'CloudWatch', cost: 1456.89, percentage: 11.3, trend: 8.9 },
                    { name: 'Lambda Functions', cost: 987.34, percentage: 7.7, trend: -15.6 },
                    { name: 'ELB Load Balancer', cost: 654.23, percentage: 5.1, trend: 2.1 },
                    { name: 'Other Services', cost: 469.62, percentage: 3.6, trend: -1.8 }
                ],
                regions: [
                    { name: 'us-east-1', cost: 6423.66, percentage: 50.0 },
                    { name: 'us-west-2', cost: 3854.20, percentage: 30.0 },
                    { name: 'eu-west-1', cost: 1927.10, percentage: 15.0 },
                    { name: 'ap-southeast-1', cost: 642.36, percentage: 5.0 }
                ],
                dailyCosts: Array.from({ length: 30 }, (_, i) => ({
                    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    cost: 400 + Math.random() * 200 + Math.sin(i / 7) * 50
                })),
                budgetAlerts: [
                    { id: '1', service: 'EC2 Instances', threshold: 5000, current: 4521.45, severity: 'warning' },
                    { id: '2', service: 'RDS Database', threshold: 2500, current: 2834.67, severity: 'critical' }
                ]
            };

            setCostData(mockData);
        } catch (error) {
            console.error('Error fetching cost data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    };

    const getTrendColor = (trend: number) => {
        if (trend > 0) return 'text-red-600 dark:text-red-400';
        if (trend < 0) return 'text-green-600 dark:text-green-400';
        return 'text-gray-600 dark:text-gray-400';
    };

    const getTrendIcon = (trend: number) => {
        if (trend > 0) {
            return (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7H7" />
                </svg>
            );
        }
        if (trend < 0) {
            return (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-9.2 9.2M7 7v10h10" />
                </svg>
            );
        }
        return (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
        );
    };

    if (loading) {
        return (
            <ClientLayout>
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                </div>
            </ClientLayout>
        );
    }

    if (!costData) {
        return (
            <ClientLayout>
                <div className="max-w-7xl mx-auto">
                    <div className="text-center py-12">
                        <p className="text-gray-500 dark:text-gray-400">Failed to load cost data</p>
                    </div>
                </div>
            </ClientLayout>
        );
    }

    return (
        <ClientLayout>
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                Cloud Cost Management
                            </h1>
                            <p className="mt-2 text-gray-600 dark:text-gray-400">
                                Monitor and optimize your AWS infrastructure costs
                            </p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <select
                                value={selectedPeriod}
                                onChange={(e) => setSelectedPeriod(e.target.value as '7d' | '30d' | '90d')}
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                                <option value="7d">Last 7 days</option>
                                <option value="30d">Last 30 days</option>
                                <option value="90d">Last 90 days</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Budget Alerts */}
                {costData.budgetAlerts.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Budget Alerts</h2>
                        <div className="space-y-3">
                            {costData.budgetAlerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    className={`p-4 rounded-lg border ${alert.severity === 'critical'
                                            ? 'bg-red-100 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                                            : 'bg-orange-100 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div
                                                className={`w-3 h-3 rounded-full ${alert.severity === 'critical' ? 'bg-red-500' : 'bg-blue-600'
                                                    }`}
                                            />
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    {alert.service} Budget Alert
                                                </p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    {formatCurrency(alert.current)} of {formatCurrency(alert.threshold)} budget used
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-medium ${alert.severity === 'critical' ? 'text-red-600 dark:text-red-400' : 'text-orange-700 dark:text-orange-300'
                                                }`}>
                                                {Math.round((alert.current / alert.threshold) * 100)}% used
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Cost Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Cost</p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {formatCurrency(costData.totalCost)}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                            </div>
                        </div>
                        <div className={`flex items-center mt-2 ${getTrendColor(costData.monthlyTrend)}`}>
                            {getTrendIcon(costData.monthlyTrend)}
                            <span className="ml-1 text-sm font-medium">
                                {Math.abs(costData.monthlyTrend)}% vs last month
                            </span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Daily Average</p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {formatCurrency(costData.totalCost / 30)}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            Based on {selectedPeriod} period
                        </p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Top Service</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">
                                    {costData.services[0].name}
                                </p>
                                <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                                    {formatCurrency(costData.services[0].cost)}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                                </svg>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            {costData.services[0].percentage}% of total cost
                        </p>
                    </div>
                </div>

                {/* Cost Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* Services Breakdown */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Cost by Service
                        </h3>
                        <div className="space-y-4">
                            {costData.services.map((service, index) => (
                                <div key={index} className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                {service.name}
                                            </span>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                                    {formatCurrency(service.cost)}
                                                </span>
                                                <div className={`flex items-center ${getTrendColor(service.trend)}`}>
                                                    {getTrendIcon(service.trend)}
                                                    <span className="ml-1 text-xs">
                                                        {Math.abs(service.trend)}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div
                                                className="bg-blue-600 h-2 rounded-full"
                                                style={{ width: `${service.percentage}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between mt-1">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {service.percentage}% of total
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Regions Breakdown */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Cost by Region
                        </h3>
                        <div className="space-y-4">
                            {costData.regions.map((region, index) => (
                                <div key={index} className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                {region.name}
                                            </span>
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                                {formatCurrency(region.cost)}
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div
                                                className="bg-green-600 h-2 rounded-full"
                                                style={{ width: `${region.percentage}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between mt-1">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {region.percentage}% of total
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Cost Optimization Recommendations */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Cost Optimization Recommendations
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-start space-x-3 p-4 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-900 dark:text-white">Right-size EC2 Instances</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    Several EC2 instances are underutilized. Consider downsizing to save approximately $1,200/month.
                                </p>
                                <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-2">
                                    Potential savings: $1,200/month
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3 p-4 bg-green-100 dark:bg-green-900/20 rounded-lg">
                            <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-900 dark:text-white">Use Reserved Instances</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    Purchase Reserved Instances for your consistent workloads to save up to 75% on compute costs.
                                </p>
                                <p className="text-sm font-medium text-green-600 dark:text-green-400 mt-2">
                                    Potential savings: $2,800/month
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3 p-4 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                            <div className="w-6 h-6 bg-yellow-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-900 dark:text-white">Optimize S3 Storage Classes</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    Move infrequently accessed data to cheaper storage classes like S3 IA or Glacier.
                                </p>
                                <p className="text-sm font-medium text-orange-700 dark:text-orange-300 mt-2">
                                    Potential savings: $450/month
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </ClientLayout>
    );
}