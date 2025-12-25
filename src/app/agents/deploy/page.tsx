'use client';

import React from 'react';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { AgentDeployment } from '@/components/agents/AgentDeployment';
import { useDemoContext } from '@/contexts/DemoContext';

export default function AgentDeployPage() {
  const { currentTenant } = useDemoContext();

  return (
    <ClientLayout>
      <AgentDeployment tenantId={currentTenant?.id || 'demo-tenant'} />
    </ClientLayout>
  );
}