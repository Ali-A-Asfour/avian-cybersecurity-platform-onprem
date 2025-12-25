'use client';

import React from 'react';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { AgentList } from '@/components/agents/AgentList';
import { useTenant } from '@/contexts/TenantContext';

export default function AgentsPage() {
  const { selectedTenant } = useTenant();

  return (
    <ClientLayout>
      <AgentList tenantId={selectedTenant?.id || 'demo-tenant'} />
    </ClientLayout>
  );
}