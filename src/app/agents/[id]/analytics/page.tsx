'use client';

import React from 'react';
import { AgentDataAnalytics } from '@/components/agents/AgentDataAnalytics';

interface AgentAnalyticsPageProps {
  params: {
    id: string;
  };
}

export default function AgentAnalyticsPage({ params }: AgentAnalyticsPageProps) {
  return (
    <div className="p-6">
      <AgentDataAnalytics agentId={params.id} />
    </div>
  );
}