'use client';

import React from 'react';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { VulnerabilityDashboard } from '@/components/edr/VulnerabilityDashboard';

export default function EDRVulnerabilitiesPage() {
    return (
        <ClientLayout>
            <div className="p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        EDR Vulnerabilities
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Monitor and manage security vulnerabilities across your endpoints
                    </p>
                </div>
                <VulnerabilityDashboard />
            </div>
        </ClientLayout>
    );
}
