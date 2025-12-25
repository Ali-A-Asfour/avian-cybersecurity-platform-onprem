'use client';

import { ClientLayout } from '@/components/layout/ClientLayout';
import { PerformanceDashboard } from '@/components/performance/PerformanceDashboard';

export default function PerformancePage() {
  return (
    <ClientLayout>
      <PerformanceDashboard />
    </ClientLayout>
  );
}