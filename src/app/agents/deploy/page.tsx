'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { AgentDeployment } from '@/components/agents/AgentDeployment';
import { useDemoContext } from '@/contexts/DemoContext';

export default function AgentDeployPage() {
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
      <AgentDeployment tenantId={currentTenant?.id || 'demo-tenant'} />
    </ClientLayout>
  );
}