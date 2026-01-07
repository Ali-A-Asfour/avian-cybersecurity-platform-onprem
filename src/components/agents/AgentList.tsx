'use client';

import React, { useEffect, useState } from 'react';
import { Agent, AgentStatus } from '@/types';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { api } from '@/lib/api-client';

interface AgentListProps {
  tenantId: string;
}

export function AgentList({ tenantId }: AgentListProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
  }, [tenantId]);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/agents');
      const data = await response.json();

      if (data.success) {
        setAgents(data.data);
      } else {
        setError(data.error?.message || 'Failed to fetch agents');
      }
    } catch {
      setError('Failed to fetch agents');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: AgentStatus) => {
    const statusConfig = {
      [AgentStatus.ACTIVE]: { status: 'resolved' as const, label: 'Active' },
      [AgentStatus.INACTIVE]: { status: 'closed' as const, label: 'Inactive' },
      [AgentStatus.INSTALLING]: { status: 'in_progress' as const, label: 'Installing' },
      [AgentStatus.ERROR]: { status: 'escalated' as const, label: 'Error' },
      [AgentStatus.UPDATING]: { status: 'investigating' as const, label: 'Updating' },
      [AgentStatus.OFFLINE]: { status: 'escalated' as const, label: 'Offline' },
      [AgentStatus.PENDING]: { status: 'new' as const, label: 'Pending' },
    };

    const config = statusConfig[status];
    return <StatusBadge status={config.status} size="sm" />;
  };

  const formatLastHeartbeat = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const columns = [
    {
      key: 'hostname',
      label: 'Hostname',
      render: (agent: Agent) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {agent.hostname}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {agent.ip_address}
          </div>
        </div>
      ),
    },
    {
      key: 'os_info',
      label: 'Operating System',
      render: (agent: Agent) => (
        <div>
          <div className="text-sm text-gray-900 dark:text-white">
            {agent.os_type}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {agent.os_version}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (agent: Agent) => getStatusBadge(agent.status),
    },
    {
      key: 'installed_tools',
      label: 'Tools',
      render: (agent: Agent) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {agent.installed_tools.length} installed
        </div>
      ),
    },
    {
      key: 'last_heartbeat',
      label: 'Last Seen',
      render: (agent: Agent) => (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {formatLastHeartbeat(agent.last_heartbeat)}
        </div>
      ),
    },
    {
      key: 'health',
      label: 'Health',
      render: (agent: Agent) => (
        <div className="text-xs">
          <div>CPU: {agent.health_metrics.cpu_usage.toFixed(1)}%</div>
          <div>Memory: {agent.health_metrics.memory_usage.toFixed(1)}%</div>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (agent: Agent) => (
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleViewAgent(agent.id)}
          >
            View
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleViewAnalytics(agent.id)}
          >
            Analytics
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleConfigureAgent(agent.id)}
          >
            Configure
          </Button>
        </div>
      ),
    },
  ];

  const handleViewAgent = (_agentId: string) => {
    // Navigate to agent detail view
    window.location.href = `/agents/${agentId}`;
  };

  const handleViewAnalytics = (_agentId: string) => {
    // Navigate to agent analytics
    window.location.href = `/agents/${agentId}/analytics`;
  };

  const handleConfigureAgent = (_agentId: string) => {
    // Navigate to agent configuration
    window.location.href = `/agents/${agentId}/configure`;
  };

  if (loading) {
    return (
      <Card>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="p-6">
          <div className="text-center">
            <div className="text-red-600 dark:text-red-400 mb-2">Error</div>
            <div className="text-gray-600 dark:text-gray-400 mb-4">{error}</div>
            <Button onClick={fetchAgents}>Retry</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Endpoint Agents
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Manage deployed agents and monitor their status
          </p>
        </div>
        <Button onClick={() => window.location.href = '/agents/deploy'}>
          Deploy New Agent
        </Button>
      </div>

      {agents.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <div className="text-gray-400 dark:text-gray-500 mb-4">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No agents deployed
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Deploy your first AVIAN agent to start monitoring and managing client assets.
            </p>
            <Button onClick={() => window.location.href = '/agents/deploy'}>
              Deploy First Agent
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="p-6">
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search agents..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                onChange={(e) => {
                  // Implement search functionality here if needed
                }}
              />
            </div>
            <DataTable
              data={agents}
              columns={columns}
            />
          </div>
        </Card>
      )}
    </div>
  );
}