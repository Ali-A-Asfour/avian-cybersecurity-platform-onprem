'use client';

import React from 'react';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { AgentList } from '@/components/agents/AgentList';
import { useDemoContext } from '@/contexts/DemoContext';

export default function AgentsPage() {
  const { currentTenant } = useDemoContext();

  return (
    <ClientLayout>
      <AgentList tenantId={currentTenant?.id || 'demo-tenant'} />
    </ClientLayout>
  );
}