'use client';

import { lazy } from 'react';

/**
 * Lazy-loaded chart components for code splitting optimization
 * 
 * These components are loaded on-demand to reduce the initial bundle size
 * and improve dashboard loading performance. Each chart library (Recharts)
 * is only loaded when the specific chart component is needed.
 */

// Lazy load AlertsTrendGraph with Recharts LineChart
export const LazyAlertsTrendGraph = lazy(() =>
    import('./AlertsTrendGraph').then(module => ({
        default: module.AlertsTrendGraph
    }))
);

// Lazy load DeviceCoverageChart with Recharts PieChart
export const LazyDeviceCoverageChart = lazy(() =>
    import('./DeviceCoverageChart').then(module => ({
        default: module.DeviceCoverageChart
    }))
);

// Lazy load TicketBreakdownChart with Recharts PieChart/BarChart
export const LazyTicketBreakdownChart = lazy(() =>
    import('./TicketBreakdownChart').then(module => ({
        default: module.TicketBreakdownChart
    }))
);

// Lazy load IntegrationHealthPanel (lighter component, but still benefits from splitting)
export const LazyIntegrationHealthPanel = lazy(() =>
    import('./IntegrationHealthPanel').then(module => ({
        default: module.IntegrationHealthPanel
    }))
);

// Lazy load RecentActivityFeed (lighter component)
export const LazyRecentActivityFeed = lazy(() =>
    import('./RecentActivityFeed').then(module => ({
        default: module.RecentActivityFeed
    }))
);