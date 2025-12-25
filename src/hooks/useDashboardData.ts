import { useMemo, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import {
    DashboardData,
    LoadingState,
    DashboardError,
    KPIResponse,
    AlertsTrendResponse,
    DeviceCoverageResponse,
    TicketBreakdownResponse,
    IntegrationsResponse,
    RecentActivityResponse
} from '@/types/dashboard';
import { dashboardApi, DashboardApiError, DashboardDataTransformer } from '@/services/dashboardApi';
import { performanceMonitor } from '@/lib/performance';

interface UseDashboardDataReturn {
    data: DashboardData | null;
    loading: LoadingState;
    errors: Record<string, DashboardError | null>;
    lastRefresh: string | null;
    refresh: () => Promise<void>;
    refreshComponent: (component: keyof LoadingState) => Promise<void>;
    isValidating: boolean;
    healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
}

/**
 * SWR configuration for dashboard data
 */
const swrConfig = {
    refreshInterval: 60000, // 60 seconds auto-refresh
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000, // Dedupe requests within 5 seconds
    errorRetryCount: 3,
    errorRetryInterval: 2000,
    shouldRetryOnError: (error: any) => {
        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (error instanceof DashboardApiError) {
            return error.retryable;
        }
        return true;
    },
    onError: (error: any, key: string) => {
        console.error(`SWR error for ${key}:`, error);
    },
};

/**
 * Individual data fetchers for SWR with performance monitoring
 */
const fetchers = {
    kpis: () => performanceMonitor.measureAsync('api-kpis', () => dashboardApi.getKPIs()),
    alertsTrend: () => performanceMonitor.measureAsync('api-alerts-trend', () => dashboardApi.getAlertsTrend()),
    deviceCoverage: () => performanceMonitor.measureAsync('api-device-coverage', () => dashboardApi.getDeviceCoverage()),
    ticketBreakdown: () => performanceMonitor.measureAsync('api-ticket-breakdown', () => dashboardApi.getTicketBreakdown()),
    integrations: () => performanceMonitor.measureAsync('api-integrations', () => dashboardApi.getIntegrations()),
    recentActivity: () => performanceMonitor.measureAsync('api-recent-activity', () => dashboardApi.getRecentActivity()),
};

/**
 * Enhanced dashboard data hook with SWR caching and parallel API calls
 */
export const useDashboardData = (): UseDashboardDataReturn => {
    // Individual SWR hooks for each dashboard component
    const {
        data: kpisData,
        error: kpisError,
        isLoading: kpisLoading,
        isValidating: kpisValidating,
        mutate: mutateKpis,
    } = useSWR<KPIResponse>('dashboard/kpis', fetchers.kpis, swrConfig);

    const {
        data: alertsTrendData,
        error: alertsTrendError,
        isLoading: alertsTrendLoading,
        isValidating: alertsTrendValidating,
        mutate: mutateAlertsTrend,
    } = useSWR<AlertsTrendResponse>('dashboard/alerts-trend', fetchers.alertsTrend, swrConfig);

    const {
        data: deviceCoverageData,
        error: deviceCoverageError,
        isLoading: deviceCoverageLoading,
        isValidating: deviceCoverageValidating,
        mutate: mutateDeviceCoverage,
    } = useSWR<DeviceCoverageResponse>('dashboard/device-coverage', fetchers.deviceCoverage, swrConfig);

    const {
        data: ticketBreakdownData,
        error: ticketBreakdownError,
        isLoading: ticketBreakdownLoading,
        isValidating: ticketBreakdownValidating,
        mutate: mutateTicketBreakdown,
    } = useSWR<TicketBreakdownResponse>('dashboard/tickets', fetchers.ticketBreakdown, swrConfig);

    const {
        data: integrationsData,
        error: integrationsError,
        isLoading: integrationsLoading,
        isValidating: integrationsValidating,
        mutate: mutateIntegrations,
    } = useSWR<IntegrationsResponse>('dashboard/integrations', fetchers.integrations, swrConfig);

    const {
        data: recentActivityData,
        error: recentActivityError,
        isLoading: recentActivityLoading,
        isValidating: recentActivityValidating,
        mutate: mutateRecentActivity,
    } = useSWR<RecentActivityResponse>('dashboard/activity-feed', fetchers.recentActivity, swrConfig);

    // Transform errors to DashboardError format
    const createDashboardError = useCallback((component: string, error: any): DashboardError => {
        const message = error instanceof DashboardApiError
            ? error.message
            : error instanceof Error
                ? error.message
                : `Failed to fetch ${component}`;

        const retryable = error instanceof DashboardApiError
            ? error.retryable
            : true;

        return {
            component,
            message,
            timestamp: new Date().toISOString(),
            retryable,
        };
    }, []);

    // Compute loading state
    const loading: LoadingState = useMemo(() => ({
        kpis: kpisLoading,
        alertsTrend: alertsTrendLoading,
        deviceCoverage: deviceCoverageLoading,
        ticketBreakdown: ticketBreakdownLoading,
        integrations: integrationsLoading,
        recentActivity: recentActivityLoading,
    }), [
        kpisLoading,
        alertsTrendLoading,
        deviceCoverageLoading,
        ticketBreakdownLoading,
        integrationsLoading,
        recentActivityLoading,
    ]);

    // Compute error state
    const errors: Record<string, DashboardError | null> = useMemo(() => ({
        kpis: kpisError ? createDashboardError('kpis', kpisError) : null,
        alertsTrend: alertsTrendError ? createDashboardError('alertsTrend', alertsTrendError) : null,
        deviceCoverage: deviceCoverageError ? createDashboardError('deviceCoverage', deviceCoverageError) : null,
        ticketBreakdown: ticketBreakdownError ? createDashboardError('ticketBreakdown', ticketBreakdownError) : null,
        integrations: integrationsError ? createDashboardError('integrations', integrationsError) : null,
        recentActivity: recentActivityError ? createDashboardError('recentActivity', recentActivityError) : null,
    }), [
        kpisError,
        alertsTrendError,
        deviceCoverageError,
        ticketBreakdownError,
        integrationsError,
        recentActivityError,
        createDashboardError,
    ]);

    // Compute validation state
    const isValidating = useMemo(() => (
        kpisValidating ||
        alertsTrendValidating ||
        deviceCoverageValidating ||
        ticketBreakdownValidating ||
        integrationsValidating ||
        recentActivityValidating
    ), [
        kpisValidating,
        alertsTrendValidating,
        deviceCoverageValidating,
        ticketBreakdownValidating,
        integrationsValidating,
        recentActivityValidating,
    ]);

    // Compute health status based on errors
    const healthStatus = useMemo(() => {
        const errorCount = Object.values(errors).filter(error => error !== null).length;
        const totalComponents = Object.keys(errors).length;

        if (errorCount === 0) return 'healthy';
        if (errorCount < totalComponents / 2) return 'degraded';
        if (errorCount < totalComponents) return 'unhealthy';
        return 'unknown';
    }, [errors]);

    // Transform and combine data
    const data: DashboardData | null = useMemo(() => {
        // Only return combined data if we have at least some successful responses
        const hasAnyData = kpisData || alertsTrendData || deviceCoverageData ||
            ticketBreakdownData || integrationsData || recentActivityData;

        if (!hasAnyData) return null;

        return {
            kpis: kpisData ? DashboardDataTransformer.transformKPIData(kpisData) : {
                criticalAlerts: 0,
                securityTicketsOpen: 0,
                helpdeskTicketsOpen: 0,
                complianceScore: 0,
            },
            alertsTrend: alertsTrendData ? DashboardDataTransformer.transformAlertsTrendData(alertsTrendData) : [],
            deviceCoverage: deviceCoverageData ? DashboardDataTransformer.transformDeviceCoverageData(deviceCoverageData) : {
                protected: 0,
                missingAgent: 0,
                withAlerts: 0,
                total: 0,
            },
            ticketBreakdown: ticketBreakdownData ? DashboardDataTransformer.transformTicketBreakdownData(ticketBreakdownData) : {
                securityTickets: { created: 0, resolved: 0 },
                helpdeskTickets: { created: 0, resolved: 0 },
            },
            integrations: integrationsData ? DashboardDataTransformer.transformIntegrationHealthData(integrationsData) : [],
            recentActivity: recentActivityData ? DashboardDataTransformer.transformActivityData(recentActivityData) : [],
            lastUpdated: new Date().toISOString(),
        };
    }, [
        kpisData,
        alertsTrendData,
        deviceCoverageData,
        ticketBreakdownData,
        integrationsData,
        recentActivityData,
    ]);

    // Get the most recent timestamp from successful responses
    const lastRefresh = useMemo(() => {
        const timestamps = [
            kpisData?.timestamp,
            alertsTrendData?.timestamp,
            deviceCoverageData?.timestamp,
            ticketBreakdownData?.timestamp,
            integrationsData?.timestamp,
            recentActivityData?.timestamp,
        ].filter(Boolean);

        if (timestamps.length === 0) return null;

        // Return the most recent timestamp
        return timestamps.sort().reverse()[0] || null;
    }, [
        kpisData?.timestamp,
        alertsTrendData?.timestamp,
        deviceCoverageData?.timestamp,
        ticketBreakdownData?.timestamp,
        integrationsData?.timestamp,
        recentActivityData?.timestamp,
    ]);

    // Refresh all data with performance monitoring
    const refresh = useCallback(async () => {
        try {
            await performanceMonitor.measureAsync('dashboard-refresh-all', async () => {
                await Promise.all([
                    mutateKpis(),
                    mutateAlertsTrend(),
                    mutateDeviceCoverage(),
                    mutateTicketBreakdown(),
                    mutateIntegrations(),
                    mutateRecentActivity(),
                ]);
            });
        } catch (error) {
            console.error('Failed to refresh dashboard data:', error);
        }
    }, [
        mutateKpis,
        mutateAlertsTrend,
        mutateDeviceCoverage,
        mutateTicketBreakdown,
        mutateIntegrations,
        mutateRecentActivity,
    ]);

    // Refresh individual component with performance monitoring
    const refreshComponent = useCallback(async (component: keyof LoadingState) => {
        try {
            await performanceMonitor.measureAsync(`dashboard-refresh-${component}`, async () => {
                switch (component) {
                    case 'kpis':
                        await mutateKpis();
                        break;
                    case 'alertsTrend':
                        await mutateAlertsTrend();
                        break;
                    case 'deviceCoverage':
                        await mutateDeviceCoverage();
                        break;
                    case 'ticketBreakdown':
                        await mutateTicketBreakdown();
                        break;
                    case 'integrations':
                        await mutateIntegrations();
                        break;
                    case 'recentActivity':
                        await mutateRecentActivity();
                        break;
                    default:
                        console.warn(`Unknown component: ${component}`);
                }
            });
        } catch (error) {
            console.error(`Failed to refresh ${component}:`, error);
        }
    }, [
        mutateKpis,
        mutateAlertsTrend,
        mutateDeviceCoverage,
        mutateTicketBreakdown,
        mutateIntegrations,
        mutateRecentActivity,
    ]);

    // Log performance metrics in development
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            const timer = setTimeout(() => {
                const summary = performanceMonitor.getSummary();
                if (Object.keys(summary).length > 0) {
                    console.log('Dashboard Performance Summary:', summary);
                }
            }, 5000); // Log after 5 seconds

            return () => clearTimeout(timer);
        }
    }, []);

    return {
        data,
        loading,
        errors,
        lastRefresh,
        refresh,
        refreshComponent,
        isValidating,
        healthStatus,
    };
};