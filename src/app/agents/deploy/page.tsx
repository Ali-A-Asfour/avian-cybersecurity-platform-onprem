'use client';

import React from 'react';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { AgentDeployment } from '@/components/agents/AgentDeployment';
import { useTenantContext } from '@/contexts/TenantContext';

export default function AgentDeployPage() {
  const { selectedTenant } = useTenantContext();

  return (
    <ClientLayout>
      <AgentDeployment tenantId={selectedTenant?.id || 'demo-tenant'} />
    </ClientLayout>
  );
}