'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { DeviceDetailPage } from '@/components/edr/DeviceDetailPage';

export default function EDRDeviceDetailPage() {
    const router = useRouter();
    const { isAuthenticated, loading: authLoading } = useAuth();
    const params = useParams();
    const deviceId = params.id as string;

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [authLoading, isAuthenticated, router]);

    if (authLoading || !isAuthenticated) {
        return null;
    }

    return (
        <ClientLayout>
            <DeviceDetailPage deviceId={deviceId} />
        </ClientLayout>
    );
}
