'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Firewall Page - Redirects tenant admins to dashboard
 * 
 * Tenant admins no longer have access to the firewall page.
 * They should use the main dashboard instead.
 */
export default function FirewallPage() {
    const router = useRouter();
    const { isAuthenticated, loading: authLoading } = useAuth();

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
            return;
        }
        // For now, redirect all users to dashboard
        // In a real app, you'd check the user's role first
        if (isAuthenticated) {
            router.replace('/dashboard/tenant-admin');
        }
    }, [authLoading, isAuthenticated, router]);

    if (authLoading || !isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-neutral-400">Redirecting to Dashboard...</p>
            </div>
        </div>
    );
}