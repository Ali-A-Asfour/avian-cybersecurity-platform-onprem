'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { DeviceDetailPage } from '@/components/edr/DeviceDetailPage';

export default function EDRDeviceDetailPage() {
    const params = useParams();
    const deviceId = params.id as string;

    return (
        <ClientLayout>
            <DeviceDetailPage deviceId={deviceId} />
        </ClientLayout>
    );
}
