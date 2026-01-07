'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { AgentList } from '@/components/agents/AgentList';
import { useDemoContext } from '@/contexts/DemoContext';

export default function AgentsPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { currentTenant } = useDemoContext();

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
      <AgentList tenantId={currentTenant?.id || 'demo-tenant'} />
    </ClientLayout>
  );
}