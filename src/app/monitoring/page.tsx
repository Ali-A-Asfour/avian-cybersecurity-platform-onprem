'use client';

import { ClientLayout } from '@/components/layout/ClientLayout';
import { MonitoringDashboard } from '@/components/monitoring/MonitoringDashboard';

export const dynamic = 'force-dynamic';

export default function MonitoringPage() {
  return (
    <ClientLayout>
      <MonitoringDashboard />
    </ClientLayout>
  );
}