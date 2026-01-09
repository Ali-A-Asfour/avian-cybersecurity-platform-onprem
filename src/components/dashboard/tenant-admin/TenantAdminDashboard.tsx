'use client';

import React, { useCallback, useMemo, memo, Suspense } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { EnhancedErrorBoundary } from './EnhancedErrorBoundary';

import { PartialDataIndicator } from './PartialDataIndicator';
import { ErrorRecoveryPanel } from './ErrorRecoveryPanel';
import { KPICardsRow } from './KPICardsRow';
import {
    LazyAlertsTrendGraph,
    LazyDeviceCoverageChart,
    LazyTicketBreakdownChart,
    LazyIntegrationHealthPanel,
    LazyRecentActivityFeed
} from './LazyChartComponents';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { navigationService } from '@/services/navigationService';
import { ActivityItem } from '@/types/dashboard';

/**
 * TenantAdminDashboard Main Component
 * 
 * Assembles all dashboard components into the specified grid layout
 * with integrated data fetching, auto-refresh, and navigation functionality.
 * 
 * Performance optimizations:
 * - Memoized navigation handlers to prevent unnecessary re-renders
 * - Stable data references using useMemo
 * - Optimized component structure for minimal re-renders
 * 
 * Requirements: 7.1, 7.3, layout diagram, performance requirements
 */
const TenantAdminDashboardComponent: React.FC = () => {
    const { data, loading, errors, refresh, refreshComponent, healthStatus } = useDashboardData();

    // Set up auto-refresh with the useAutoRefresh hook
    const {
        isRefreshing,
        lastRefreshTime,
        refreshNow,
        isActive: autoRefreshActive
    } = useAutoRefresh({
        onRefresh: refresh,
        interval: 60000, // 60 seconds
        enabled: true,
    });

    // Memoized navigation handlers to prevent unnecessary re-renders
    const handleActivityClick = useCallback((activity: ActivityItem) => {
        // Extract ID from activity for navigation
        const activityId = activity.id.replace('activity-', '');

        // Navigate based on activity type using navigation service
        const url = navigationService.generateActivityUrl(activity.type, activityId);

        // Navigate while preserving role and tenant context
        navigationService.navigatePreservingContext(url);
    }, []);

    const handleAlertsTrendClick = useCallback((date: string) => {
        const url = navigationService.generateAlertsTrendUrl(date);
        navigationService.navigatePreservingContext(url);
    }, []);

    const handleDeviceCoverageClick = useCallback((segment: 'protected' | 'missing-agent' | 'with-alerts') => {
        const url = navigationService.generateDeviceCoverageUrl(segment);
        navigationService.navigatePreservingContext(url);
    }, []);

    const handleTicketBreakdownClick = useCallback((type: 'security' | 'helpdesk') => {
        const url = navigationService.generateTicketBreakdownUrl(type);
        navigationService.navigatePreservingContext(url);
    }, []);

    const handleIntegrationClick = useCallback((serviceName: string) => {
        const url = navigationService.generateIntegrationUrl(serviceName);
        navigationService.navigatePreservingContext(url);
    }, []);

    // Memoized data objects to prevent unnecessary re-renders
    const kpiData = useMemo(() => data?.kpis || null, [data?.kpis]);
    const alertsTrendData = useMemo(() => data?.alertsTrend || [], [data?.alertsTrend]);
    const deviceCoverageData = useMemo(() =>
        data?.deviceCoverage || { protected: 0, missingAgent: 0, withAlerts: 0, total: 0 },
        [data?.deviceCoverage]
    );
    const ticketBreakdownData = useMemo(() =>
        data?.ticketBreakdown || {
            securityTickets: { created: 0, resolved: 0 },
            helpdeskTickets: { created: 0, resolved: 0 }
        },
        [data?.ticketBreakdown]
    );
    const integrationsData = useMemo(() => data?.integrations || [], [data?.integrations]);
    const recentActivityData = useMemo(() => data?.recentActivity || [], [data?.recentActivity]);

    // Calculate available and failed components for partial data handling
    const { availableComponents, failedComponents } = useMemo(() => {
        const components = ['KPI Cards', 'Alerts Trend', 'Device Coverage', 'Ticket Breakdown', 'Integration Health', 'Recent Activity'];
        const errorKeys = ['kpis', 'alertsTrend', 'deviceCoverage', 'ticketBreakdown', 'integrations', 'recentActivity'];

        const available: string[] = [];
        const failed: string[] = [];

        components.forEach((component, index) => {
            const errorKey = errorKeys[index];
            if (errors[errorKey]) {
                failed.push(component);
            } else {
                available.push(component);
            }
        });

        return { availableComponents: available, failedComponents: failed };
    }, [errors]);

    // Handle individual component retry
    const handleRetryComponent = useCallback(async (componentName: string) => {
        const componentMap: Record<string, keyof typeof loading> = {
            'KPI Cards': 'kpis',
            'Alerts Trend': 'alertsTrend',
            'Device Coverage': 'deviceCoverage',
            'Ticket Breakdown': 'ticketBreakdown',
            'Integration Health': 'integrations',
            'Recent Activity': 'recentActivity'
        };

        const componentKey = componentMap[componentName];
        if (componentKey) {
            await refreshComponent(componentKey);
        }
    }, [refreshComponent]);

    return (
        <DashboardLayout>
            {/* Dashboard Header with Auto-refresh Status */}
            <header className="xl:col-span-4 bg-neutral-900 border-b border-neutral-700 px-4 sm:px-6 py-4 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-neutral-100">
                            Tenant Admin Dashboard
                        </h1>
                        <p className="text-neutral-400 text-sm">
                            Monitor your organization's security posture and IT operations
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                        {/* Auto-refresh Status */}
                        <div className="flex items-center space-x-4">
                            <div
                                className="flex items-center space-x-2 text-sm"
                                role="status"
                                aria-live="polite"
                                aria-label={`Auto-refresh is ${autoRefreshActive ? 'active' : 'paused'}`}
                            >
                                <div
                                    className={`w-2 h-2 rounded-full ${autoRefreshActive ? 'bg-green-500' : 'bg-gray-500'}`}
                                    aria-hidden="true"
                                ></div>
                                <span className="text-neutral-400">
                                    Auto-refresh: {autoRefreshActive ? 'Active' : 'Paused'}
                                </span>
                                {lastRefreshTime && (
                                    <span className="text-neutral-500 hidden sm:inline">
                                        • Last: {new Date(lastRefreshTime).toLocaleTimeString()}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Manual Refresh Button */}
                        <button
                            onClick={refreshNow}
                            disabled={isRefreshing}
                            className="flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
                            aria-label={isRefreshing ? 'Refreshing dashboard data' : 'Refresh dashboard data'}
                        >
                            <svg
                                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span className="hidden sm:inline">
                                {isRefreshing ? 'Refreshing...' : 'Refresh'}
                            </span>
                            <span className="sr-only">
                                {isRefreshing ? 'Refreshing dashboard data' : 'Refresh dashboard data'}
                            </span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Partial Data Indicator - shows when some components fail */}
            <PartialDataIndicator
                availableComponents={availableComponents}
                failedComponents={failedComponents}
                onRetryComponent={handleRetryComponent}
                className="xl:col-span-4"
            />

            {/* Error Recovery Panel - shows when there are errors */}
            {Object.values(errors).some(error => error !== null) && (
                <div className="xl:col-span-4 mb-4">
                    <ErrorRecoveryPanel
                        errors={errors}
                        onRetryComponent={refreshComponent}
                        onRefreshAll={refresh}
                    />
                </div>
            )}

            {/* Health Status Indicator */}
            {healthStatus && healthStatus !== 'healthy' && !Object.values(errors).some(error => error !== null) && (
                <div className="xl:col-span-4 mb-4">
                    <div className={`p-3 rounded-lg border text-sm ${healthStatus === 'degraded'
                        ? 'bg-yellow-900/20 border-yellow-600/50 text-yellow-300'
                        : healthStatus === 'unhealthy'
                            ? 'bg-red-900/20 border-red-600/50 text-red-300'
                            : 'bg-gray-900/20 border-gray-600/50 text-gray-300'
                        }`}>
                        <div className="flex items-center space-x-2">
                            <div className="text-lg">
                                {healthStatus === 'degraded' ? '⚠️' : healthStatus === 'unhealthy' ? '🚨' : '❓'}
                            </div>
                            <span>
                                Dashboard Status: {healthStatus.charAt(0).toUpperCase() + healthStatus.slice(1)}
                                {healthStatus === 'degraded' && ' - Some components may be unavailable'}
                                {healthStatus === 'unhealthy' && ' - Multiple components are experiencing issues'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* KPI Cards Row - spans full width, responsive columns */}
            <section className="xl:col-span-4" aria-labelledby="kpi-section-title">
                <h2 id="kpi-section-title" className="sr-only">Key Performance Indicators</h2>
                <EnhancedErrorBoundary
                    componentName="KPI Cards"
                    onRetry={() => refreshComponent('kpis')}
                >
                    <KPICardsRow
                        data={kpiData}
                        loading={loading.kpis}
                        error={errors.kpis}
                        onRetry={refresh}
                    />
                </EnhancedErrorBoundary>
            </section>

            {/* Alerts Trend Graph - full width */}
            <section className="xl:col-span-4" aria-labelledby="alerts-trend-title">
                <h2 id="alerts-trend-title" className="sr-only">Security Alerts Trend</h2>
                <EnhancedErrorBoundary
                    componentName="Alerts Trend Graph"
                    onRetry={() => refreshComponent('alertsTrend')}
                >
                    <Suspense fallback={
                        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6 h-48 sm:h-64 flex items-center justify-center">
                            <div className="text-neutral-400 text-sm">Loading chart...</div>
                        </div>
                    }>
                        <LazyAlertsTrendGraph
                            data={alertsTrendData}
                            onPointClick={handleAlertsTrendClick}
                            loading={loading.alertsTrend}
                            error={errors.alertsTrend?.message}
                        />
                    </Suspense>
                </EnhancedErrorBoundary>
            </section>

            {/* Middle Charts Row - Enhanced responsive layout for 1280px+ support */}
            <section
                className="col-span-1 md:col-span-1 xl:col-span-1"
                aria-labelledby="device-coverage-title"
            >
                <h2 id="device-coverage-title" className="sr-only">Device Coverage Distribution</h2>
                <EnhancedErrorBoundary
                    componentName="Device Coverage Chart"
                    onRetry={() => refreshComponent('deviceCoverage')}
                >
                    <Suspense fallback={
                        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6" style={{ minHeight: '280px' }}>
                            <div className="animate-pulse">
                                <div className="h-4 bg-neutral-700 rounded w-1/2 mb-4"></div>
                                <div className="h-48 bg-neutral-700 rounded"></div>
                            </div>
                        </div>
                    }>
                        <LazyDeviceCoverageChart
                            data={deviceCoverageData}
                            onSegmentClick={handleDeviceCoverageClick}
                            loading={loading.deviceCoverage}
                        />
                    </Suspense>
                </EnhancedErrorBoundary>
            </section>

            <section
                className="col-span-1 md:col-span-1 xl:col-span-1"
                aria-labelledby="ticket-breakdown-title"
            >
                <h2 id="ticket-breakdown-title" className="sr-only">Ticket Breakdown</h2>
                <EnhancedErrorBoundary
                    componentName="Ticket Breakdown Chart"
                    onRetry={() => refreshComponent('ticketBreakdown')}
                >
                    <Suspense fallback={
                        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6" style={{ minHeight: '280px' }}>
                            <div className="animate-pulse">
                                <div className="h-4 bg-neutral-700 rounded w-1/2 mb-4"></div>
                                <div className="h-48 bg-neutral-700 rounded"></div>
                            </div>
                        </div>
                    }>
                        <LazyTicketBreakdownChart
                            data={ticketBreakdownData}
                            chartType="donut"
                            onSegmentClick={handleTicketBreakdownClick}
                            loading={loading.ticketBreakdown}
                        />
                    </Suspense>
                </EnhancedErrorBoundary>
            </section>

            <section
                className="col-span-1 md:col-span-2 xl:col-span-2"
                aria-labelledby="integration-health-title"
            >
                <h2 id="integration-health-title" className="sr-only">Integration Health Status</h2>
                <EnhancedErrorBoundary
                    componentName="Integration Health Panel"
                    onRetry={() => refreshComponent('integrations')}
                >
                    <Suspense fallback={
                        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6">
                            <div className="animate-pulse">
                                <div className="h-4 bg-neutral-700 rounded w-1/3 mb-4"></div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="h-20 bg-neutral-700 rounded"></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    }>
                        <LazyIntegrationHealthPanel
                            integrations={integrationsData}
                            onIntegrationClick={handleIntegrationClick}
                        />
                    </Suspense>
                </EnhancedErrorBoundary>
            </section>

            {/* Recent Activity Feed - full width */}
            <section className="xl:col-span-4" aria-labelledby="activity-feed-title">
                <h2 id="activity-feed-title" className="sr-only">Recent System Activity</h2>
                <EnhancedErrorBoundary
                    componentName="Recent Activity Feed"
                    onRetry={() => refreshComponent('recentActivity')}
                >
                    <Suspense fallback={
                        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6">
                            <div className="animate-pulse">
                                <div className="h-4 bg-neutral-700 rounded w-1/3 mb-4"></div>
                                <div className="space-y-3">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="flex items-center space-x-3">
                                            <div className="w-8 h-8 bg-neutral-700 rounded-full"></div>
                                            <div className="flex-1">
                                                <div className="h-3 bg-neutral-700 rounded w-3/4 mb-1"></div>
                                                <div className="h-2 bg-neutral-700 rounded w-1/2"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    }>
                        <LazyRecentActivityFeed
                            activities={recentActivityData}
                            onActivityClick={handleActivityClick}
                            loading={loading.recentActivity}
                        />
                    </Suspense>
                </EnhancedErrorBoundary>
            </section>
        </DashboardLayout>
    );
};

// Memoize the main dashboard component to prevent unnecessary re-renders
export const TenantAdminDashboard = memo(TenantAdminDashboardComponent);