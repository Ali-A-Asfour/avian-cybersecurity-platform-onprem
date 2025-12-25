'use client';

import React, { Suspense, lazy } from 'react';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { useDashboardData } from '@/hooks/useDashboardData';

// Lazy load the main dashboard component for code splitting
const TenantAdminDashboard = lazy(() =>
    import('@/components/dashboard/tenant-admin/TenantAdminDashboard').then(module => ({
        default: module.TenantAdminDashboard
    }))
);

export const dynamic = 'force-dynamic';

/**
 * Tenant Admin Dashboard Page
 * 
 * Main dashboard interface for client organization administrators
 * to monitor security posture, IT helpdesk performance, endpoint
 * protection coverage, compliance status, and integration health.
 * 
 * Requirements: 7.1, 7.3, 8.4
 */
export default function TenantAdminDashboardPage() {
    const { loading, refresh } = useDashboardData();
    const [error, setError] = React.useState<string | null>(null);

    const isLoading = loading.recentActivity || loading.kpis;

    if (error) {
        return (
            <ClientLayout>
                <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4 sm:p-6">
                    <ErrorMessage
                        title="Dashboard Error"
                        message={error}
                        onRetry={() => {
                            setError(null);
                            refresh();
                        }}
                        retryLabel="Reload Dashboard"
                    />
                </div>
            </ClientLayout>
        );
    }

    if (isLoading) {
        return (
            <ClientLayout>
                <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
                    <div className="text-center">
                        <LoadingSpinner size="lg" color="primary" className="mb-4" />
                        <p className="text-neutral-400">Loading dashboard...</p>
                    </div>
                </div>
            </ClientLayout>
        );
    }

    return (
        <ClientLayout>
            <div className="flex-1 overflow-x-hidden min-w-0">
                <Suspense
                    fallback={
                        <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
                            <div className="text-center">
                                <LoadingSpinner size="lg" color="primary" className="mb-4" />
                                <p className="text-neutral-400">Loading dashboard components...</p>
                            </div>
                        </div>
                    }
                >
                    <TenantAdminDashboard />
                </Suspense>
            </div>
        </ClientLayout>
    );
}