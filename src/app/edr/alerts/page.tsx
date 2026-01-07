'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AlertsDashboard } from '@/components/edr/AlertsDashboard';

export default function AlertsPage() {
    const router = useRouter();
    const { isAuthenticated, loading: authLoading } = useAuth();

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [authLoading, isAuthenticated, router]);

    if (authLoading || !isAuthenticated) {
        return null;
    }

    return (
        <div className="container mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Security Alerts
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Monitor and manage security threats detected by Microsoft Defender
                </p>
            </div>
            <AlertsDashboard />
        </div>
    );
}
