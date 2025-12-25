import { lazy, Suspense } from 'react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

// Lazy load expensive chart components for better bundle splitting
export const LazyAlertsTrendGraph = lazy(() =>
    import('./AlertsTrendGraph').then(module => ({ default: module.AlertsTrendGraph }))
);

export const LazyDeviceCoverageChart = lazy(() =>
    import('./DeviceCoverageChart').then(module => ({ default: module.DeviceCoverageChart }))
);

export const LazyTicketBreakdownChart = lazy(() =>
    import('./TicketBreakdownChart').then(module => ({ default: module.TicketBreakdownChart }))
);

// Wrapper components with suspense boundaries
export const AlertsTrendGraphWithSuspense = (props: any) => (
    <Suspense fallback={
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6 h-48 sm:h-64 flex items-center justify-center">
            <LoadingSpinner />
        </div>
    }>
        <LazyAlertsTrendGraph {...props} />
    </Suspense>
);

export const DeviceCoverageChartWithSuspense = (props: any) => (
    <Suspense fallback={
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6" style={{ minHeight: '280px' }}>
            <div className="flex items-center justify-center h-full">
                <LoadingSpinner />
            </div>
        </div>
    }>
        <LazyDeviceCoverageChart {...props} />
    </Suspense>
);

export const TicketBreakdownChartWithSuspense = (props: any) => (
    <Suspense fallback={
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6" style={{ minHeight: '280px' }}>
            <div className="flex items-center justify-center h-full">
                <LoadingSpinner />
            </div>
        </div>
    }>
        <LazyTicketBreakdownChart {...props} />
    </Suspense>
);