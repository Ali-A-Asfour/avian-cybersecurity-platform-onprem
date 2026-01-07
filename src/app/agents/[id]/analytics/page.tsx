'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AgentDataAnalytics } from '@/components/agents/AgentDataAnalytics';

interface AgentAnalyticsPageProps {
  params: {
    id: string;
  };
}

export default function AgentAnalyticsPage({ params }: AgentAnalyticsPageProps) {
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
    <div className="p-6">
      <AgentDataAnalytics agentId={params.id} />
    </div>
  );
}