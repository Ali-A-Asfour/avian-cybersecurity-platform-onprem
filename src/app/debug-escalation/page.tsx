'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { EscalationTest } from '@/components/debug/EscalationTest';

export default function DebugEscalationPage() {
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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
            <EscalationTest />
        </div>
    );
}