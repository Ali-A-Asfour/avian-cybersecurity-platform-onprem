'use client';

import React from 'react';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { DevicesDashboard } from '@/components/edr/DevicesDashboard';

export default function EDRDevicesPage() {
    return (
        <ClientLayout>
            <DevicesDashboard />
        </ClientLayout>
    );
}
