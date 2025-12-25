'use client';

import React from 'react';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { AgentDeployment } from '@/components/agents/AgentDeployment';
import { useTenant } from '@/contexts/TenantContext';

export default function AgentDeployPage() {
  const { selectedTenant } = useTenant();

  return (
    <ClientLayout>
      <AgentDeployment tenantId={selectedTenant?.id || 'demo-tenant'} />
    </ClientLayout>
  );
}