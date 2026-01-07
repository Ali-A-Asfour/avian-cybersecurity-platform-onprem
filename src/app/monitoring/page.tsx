'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { MonitoringDashboard } from '@/components/monitoring/MonitoringDashboard';

export const dynamic = 'force-dynamic';

export default function MonitoringPage() {
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
    <ClientLayout>
      <MonitoringDashboard />
    </ClientLayout>
  );
}