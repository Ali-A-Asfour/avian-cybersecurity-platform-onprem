'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Ticket, TicketStatus, TicketSeverity } from '@/types';
import { SeverityLevel, StatusType } from '@/lib/badge-colors';

interface UserTicketListProps {
  onCreateTicket: () => void;
  onViewTicket: (ticket: Ticket) => void;
}

export function UserTicketList({ onCreateTicket, onViewTicket }: UserTicketListProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');

  useEffect(() => {
    // Mock data for user's tickets - in real app, fetch from API with user filter
    const mockUserTickets: Ticket[] = [
      {
        id: '1',
        tenant_id: 'tenant-1',
        requester: 'mr.linux@acme.com',
        assignee: 'analyst@acme.com',
        title: 'Password reset request',
        description: 'I forgot my password and need it reset. I tried the self-service option but it\'s not working.',
        category: 'request' as any,
        severity: TicketSeverity.LOW,
        priority: 'medium' as any,
        status: TicketStatus.AWAITING_RESPONSE,
        tags: ['password', 'access'],
        sla_deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        id: '2',
        tenant_id: 'tenant-1',
        requester: 'mr.linux@acme.com',
        assignee: 'analyst@acme.com',
        title: 'Suspicious email received',
        description: 'I received an email that looks suspicious. It\'s asking me to click a link and enter my credentials. I didn\'t click anything but wanted to report it.',
        category: 'security' as any,
        severity: TicketSeverity.MEDIUM,
        priority: 'high' as any,
        status: TicketStatus.IN_PROGRESS,
        tags: ['phishing', 'email'],
        sla_deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        updated_at: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
      {
        id: '3',
        tenant_id: 'tenant-1',
        requester: 'mr.linux@acme.com',
        assignee: 'analyst@acme.com',
        title: 'VPN access not working',
        description: 'I can\'t connect to the company VPN from home. Getting error message "Connection failed".',
        category: 'incident' as any,
        severity: TicketSeverity.HIGH,
        priority: 'high' as any,
        status: TicketStatus.RESOLVED,
        tags: ['vpn', 'remote-access'],
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        updated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      },
      {
        id: '4',
        tenant_id: 'tenant-1',
        requester: 'mr.linux@acme.com',
        assignee: 'analyst@acme.com',
        title: 'Request access to HR system',
        description: 'I need access to the HR system for my new role. My manager approved this request.',
        category: 'request' as any,
        severity: TicketSeverity.LOW,
        priority: 'low' as any,
        status: TicketStatus.CLOSED,
        tags: ['access', 'hr-system'],
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        updated_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      },
    ];

    setTickets(mockUserTickets);
    setLoading(false);
  }, []);

  // Map TicketStatus to StatusType for the new StatusBadge component
  const mapTicketStatusToStatusType = (status: TicketStatus): StatusType => {
    const statusMapping: Record<TicketStatus, StatusType> = {
      [TicketStatus.NEW]: 'new',
      [TicketStatus.IN_PROGRESS]: 'in_progress',
      [TicketStatus.AWAITING_RESPONSE]: 'awaiting_response',
      [TicketStatus.RESOLVED]: 'resolved',
      [TicketStatus.CLOSED]: 'closed',
    };
    return statusMapping[status];
  };

  // Map TicketSeverity to SeverityLevel for the new SeverityBadge component
  const mapTicketSeverityToSeverityLevel = (severity: TicketSeverity): SeverityLevel => {
    const severityMapping: Record<TicketSeverity, SeverityLevel> = {
      [TicketSeverity.LOW]: 'low',
      [TicketSeverity.MEDIUM]: 'medium',
      [TicketSeverity.HIGH]: 'high',
      [TicketSeverity.CRITICAL]: 'critical',
    };
    return severityMapping[severity];
  };

  const getStatusBadge = (status: TicketStatus) => {
    const statusType = mapTicketStatusToStatusType(status);
    return <StatusBadge status={statusType} size="sm" />;
  };

  const getSeverityBadge = (severity: TicketSeverity) => {
    const severityLevel = mapTicketSeverityToSeverityLevel(severity);
    return <SeverityBadge severity={severityLevel} size="sm" />;
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Less than an hour ago';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  const filteredTickets = tickets.filter(ticket => {
    switch (filter) {
      case 'open':
        return ![TicketStatus.RESOLVED, TicketStatus.CLOSED].includes(ticket.status);
      case 'closed':
        return [TicketStatus.RESOLVED, TicketStatus.CLOSED].includes(ticket.status);
      default:
        return true;
    }
  });

  const openTicketsCount = tickets.filter(t => ![TicketStatus.RESOLVED, TicketStatus.CLOSED].includes(t.status)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            My Support Requests
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {openTicketsCount} open request{openTicketsCount !== 1 ? 's' : ''} • {tickets.length} total
          </p>
        </div>
        <Button onClick={onCreateTicket} className="mt-4 sm:mt-0">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Request
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-neutral-200 dark:border-neutral-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'all', label: 'All Requests', count: tickets.length },
            { key: 'open', label: 'Open', count: openTicketsCount },
            { key: 'closed', label: 'Closed', count: tickets.length - openTicketsCount },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${filter === tab.key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 dark:text-neutral-400 dark:hover:text-neutral-300'
                }`}
            >
              {tab.label}
              <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-neutral-100 dark:bg-neutral-800">
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tickets List */}
      <div className="space-y-4">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 text-neutral-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
              {filter === 'all' ? 'No requests yet' : `No ${filter} requests`}
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              {filter === 'all'
                ? 'Get started by creating your first support request.'
                : `You don't have any ${filter} requests at the moment.`
              }
            </p>
            {filter === 'all' && (
              <Button onClick={onCreateTicket}>
                Create Your First Request
              </Button>
            )}
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onViewTicket(ticket)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 truncate">
                    {ticket.title}
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2">
                    {ticket.description}
                  </p>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  {getSeverityBadge(ticket.severity)}
                  {getStatusBadge(ticket.status)}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400">
                <div className="flex items-center space-x-4">
                  <span>Request #{ticket.id}</span>
                  <span>•</span>
                  <span>Created {formatRelativeTime(ticket.created_at)}</span>
                  {ticket.updated_at.getTime() !== ticket.created_at.getTime() && (
                    <>
                      <span>•</span>
                      <span>Updated {formatRelativeTime(ticket.updated_at)}</span>
                    </>
                  )}
                </div>
                {ticket.sla_deadline && ![TicketStatus.RESOLVED, TicketStatus.CLOSED].includes(ticket.status) && (
                  <div className="flex items-center space-x-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Response due {formatRelativeTime(ticket.sla_deadline)}</span>
                  </div>
                )}
              </div>

              {ticket.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {ticket.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 rounded text-xs bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}