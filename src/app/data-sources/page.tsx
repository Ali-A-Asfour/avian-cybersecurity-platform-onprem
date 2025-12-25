'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataSourceList } from '@/components/data-ingestion/DataSourceList';
import { TenantAwareLayout } from '@/components/layout/TenantAwareLayout';
import { Card } from '@/components/ui/Card';
import { UserRole } from '@/types';

function LoadingFallback() {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-center h-32">
        <div className="text-gray-500">Loading data sources...</div>
      </div>
    </Card>
  );
}

export default function DataSourcesPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use demo context instead of API calls
    setUserRole(UserRole.SECURITY_ANALYST); // Default to security analyst for demo
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <TenantAwareLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      </TenantAwareLayout>
    );
  }

  if (userRole !== UserRole.SECURITY_ANALYST && userRole !== UserRole.SUPER_ADMIN) {
    return null; // Will redirect
  }

  return (
    <TenantAwareLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Data Sources</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage security data ingestion sources for the selected client
          </p>
        </div>
        <Suspense fallback={<LoadingFallback />}>
          <DataSourceList />
        </Suspense>
      </div>
    </TenantAwareLayout>
  );
}