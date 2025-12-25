'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { SeverityLevel } from '@/lib/badge-colors';
import {
  Ticket,
  TicketStatus,
  TicketSeverity,
  TicketPriority,
  TicketCategory,
  TicketFilters,
  UserRole
} from '@/types';

interface MyTicketListProps {
  onCreateTicket: () => void;
  onEditTicket?: (ticket: Ticket) => void;
  onViewTicket: (ticket: Ticket) => void;
  userRole: UserRole;
}

export function MyTicketList({ onCreateTicket, onEditTicket, onViewTicket, userRole }: MyTicketListProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TicketFilters>({
    page: 1,
    limit: 20,
    sort_by: 'created_at',
    sort_order: 'desc',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchMyTickets();
  }, [filters]);

  // Set up real-time updates with polling
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMyTickets();
    }, 30000); // Poll every 30 seconds for real-time updates

    return () => clearInterval(interval);
  }, [filters]);

  const fetchMyTickets = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use mock data for development
      const { mockTickets, delay } = await import('@/lib/mock-data');
      await delay(500); // Simulate loading

      // Filter tickets to show only those assigned to current user (simulate "my tickets")
      let myTickets = mockTickets.filter(ticket =>
        ticket.assigned_to && ticket.assigned_to !== null
      );

      // Apply basic filtering if needed
      if (filters.status && filters.status.length > 0) {
        myTickets = myTickets.filter(ticket =>
          filters.status!.includes(ticket.status as any)
        );
      }

      if (filters.severity && filters.severity.length > 0) {
        myTickets = myTickets.filter(ticket =>
          filters.severity!.includes(ticket.severity as any)
        );
      }

      if (filters.priority && filters.priority.length > 0) {
        myTickets = myTickets.filter(ticket =>
          filters.priority!.includes(ticket.priority as any)
        );
      }

      setTickets(myTickets);
      setTotalCount(myTickets.length);
    } catch (err) {
      setError('Failed to fetch my tickets');
      console.error('Error fetching my tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: string) => {
    setFilters(prev => ({
      ...prev,
      sort_by: column,
      sort_order: prev.sort_by === column && prev.sort_order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleFilterChange = (key: keyof TicketFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to first page when filtering
    }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const getStatusBadge = (status: TicketStatus) => {
    // Map TicketStatus enum to standard status types
    const mapStatus = (stat: TicketStatus): 'new' | 'open' | 'investigating' | 'in_progress' | 'awaiting_response' | 'escalated' | 'resolved' | 'closed' | 'canceled' => {
      switch (stat) {
        case TicketStatus.NEW: return 'new';
        case TicketStatus.IN_PROGRESS: return 'in_progress';
        case TicketStatus.AWAITING_RESPONSE: return 'awaiting_response';
        case TicketStatus.RESOLVED: return 'resolved';
        case TicketStatus.CLOSED: return 'closed';
        default: return 'new';
      }
    };

    return <StatusBadge status={mapStatus(status)} size="sm" />;
  };

  const getSeverityBadge = (severity: TicketSeverity) => {
    // Map TicketSeverity enum to standard severity levels
    const mapSeverity = (sev: TicketSeverity): SeverityLevel => {
      switch (sev) {
        case TicketSeverity.CRITICAL: return 'critical';
        case TicketSeverity.HIGH: return 'high';
        case TicketSeverity.MEDIUM: return 'medium';
        case TicketSeverity.LOW: return 'low';
        default: return 'info';
      }
    };

    return <SeverityBadge severity={mapSeverity(severity)} size="sm" />;
  };

  const getPriorityBadge = (priority: TicketPriority) => {
    // Map TicketPriority enum to standard severity levels for visual consistency
    const mapPriority = (prio: TicketPriority): SeverityLevel => {
      switch (prio) {
        case TicketPriority.URGENT: return 'critical'; // Map URGENT to critical for visual priority
        case TicketPriority.HIGH: return 'high';
        case TicketPriority.MEDIUM: return 'medium';
        case TicketPriority.LOW: return 'low';
        default: return 'info';
      }
    };

    return <SeverityBadge severity={mapPriority(priority)} size="sm" />;
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isOverdue = (ticket: Ticket) => {
    if (!ticket.sla_deadline) return false;
    return new Date(ticket.sla_deadline) < new Date() &&
      ![TicketStatus.RESOLVED, TicketStatus.CLOSED].includes(ticket.status);
  };

  const getRoleSpecificTitle = () => {
    switch (userRole) {
      case UserRole.SECURITY_ANALYST:
        return 'My Security Tickets';
      case UserRole.IT_HELPDESK_ANALYST:
        return 'My IT Support Tickets';
      default:
        return 'My Tickets';
    }
  };

  const getRoleSpecificDescription = () => {
    switch (userRole) {
      case UserRole.SECURITY_ANALYST:
        return 'Security incidents and threats assigned to you';
      case UserRole.IT_HELPDESK_ANALYST:
        return 'IT support requests assigned to you';
      default:
        return 'Tickets assigned to you';
    }
  };

  const columns = [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
      render: (ticket: Ticket) => (
        <span className="font-mono text-sm text-neutral-600 dark:text-neutral-400">
          {ticket.id.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (ticket: Ticket) => (
        <div className="max-w-xs">
          <div className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
            {ticket.title}
          </div>
          <div className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
            {ticket.requester}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (ticket: Ticket) => (
        <span className="capitalize text-neutral-700 dark:text-neutral-300">
          {ticket.category.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (ticket: Ticket) => getStatusBadge(ticket.status),
    },
    {
      key: 'severity',
      label: 'Severity',
      sortable: true,
      render: (ticket: Ticket) => getSeverityBadge(ticket.severity),
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (ticket: Ticket) => getPriorityBadge(ticket.priority),
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (ticket: Ticket) => (
        <div className="text-sm">
          <div className="text-neutral-700 dark:text-neutral-300">
            {formatDate(ticket.created_at)}
          </div>
          {isOverdue(ticket) && (
            <div className="text-red-600 dark:text-red-400 font-medium">
              Overdue
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (ticket: Ticket) => (
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewTicket(ticket)}
          >
            View
          </Button>
          {onEditTicket && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditTicket(ticket)}
            >
              Edit
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="ml-2 text-neutral-600 dark:text-neutral-400">Loading my tickets...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="text-red-600 dark:text-red-400 mb-2">Error loading my tickets</div>
            <div className="text-neutral-600 dark:text-neutral-400 mb-4">{error}</div>
            <Button onClick={fetchMyTickets}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {getRoleSpecificTitle()}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {getRoleSpecificDescription()} ({totalCount} total)
          </p>
        </div>
        <Button onClick={onCreateTicket}>
          Create Ticket
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Filters
          </h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Search
              </label>
              <Input
                type="text"
                placeholder="Search my tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Status
              </label>
              <select
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                value={filters.status?.[0] || ''}
                onChange={(e) => handleFilterChange('status', e.target.value ? [e.target.value] : undefined)}
              >
                <option value="">All Statuses</option>
                {Object.values(TicketStatus).map(status => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Severity
              </label>
              <select
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                value={filters.severity?.[0] || ''}
                onChange={(e) => handleFilterChange('severity', e.target.value ? [e.target.value] : undefined)}
              >
                <option value="">All Severities</option>
                {Object.values(TicketSeverity).map(severity => (
                  <option key={severity} value={severity}>
                    {severity.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Priority
              </label>
              <select
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                value={filters.priority?.[0] || ''}
                onChange={(e) => handleFilterChange('priority', e.target.value ? [e.target.value] : undefined)}
              >
                <option value="">All Priorities</option>
                {Object.values(TicketPriority).map(priority => (
                  <option key={priority} value={priority}>
                    {priority.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      {totalCount === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <svg className="w-16 h-16 text-neutral-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                No tickets assigned to you
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                You don't have any tickets assigned to you at the moment.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Tickets Table */
        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={tickets}
              onSort={handleSort}
              sortBy={filters.sort_by}
              sortOrder={filters.sort_order}
            />

            {/* Pagination */}
            {totalCount > filters.limit! && (
              <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">
                    Showing {((filters.page! - 1) * filters.limit!) + 1} to {Math.min(filters.page! * filters.limit!, totalCount)} of {totalCount} tickets
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={filters.page === 1}
                      onClick={() => handlePageChange(filters.page! - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={filters.page! * filters.limit! >= totalCount}
                      onClick={() => handlePageChange(filters.page! + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}