'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable } from '@/components/ui/DataTable';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Ticket,
  TicketStatus,
  TicketSeverity,
  TicketPriority,
  TicketCategory,
  TicketFilters
} from '@/types';
import { SeverityLevel, StatusType } from '@/lib/badge-colors';

interface TicketListProps {
  onCreateTicket: () => void;
  onEditTicket?: (ticket: Ticket) => void;
  onViewTicket: (ticket: Ticket) => void;
  categoryFilter?: TicketCategory[];
  pageTitle?: string;
}

export function TicketList({ onCreateTicket, onEditTicket, onViewTicket, categoryFilter, pageTitle = "Tickets" }: TicketListProps) {
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
    fetchTickets();
  }, [filters]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use mock data for development
      const { mockTickets, delay } = await import('@/lib/mock-data');
      await delay(500); // Simulate loading

      // Apply basic filtering if needed
      let filteredTickets = [...mockTickets];

      // Apply category filter if provided
      if (categoryFilter && categoryFilter.length > 0) {
        filteredTickets = filteredTickets.filter(ticket =>
          categoryFilter.includes(ticket.category as any)
        );
      }

      if (filters.status && filters.status.length > 0) {
        filteredTickets = filteredTickets.filter(ticket =>
          filters.status!.includes(ticket.status as any)
        );
      }

      if (filters.priority && filters.priority.length > 0) {
        filteredTickets = filteredTickets.filter(ticket =>
          filters.priority!.includes(ticket.priority as any)
        );
      }

      setTickets(filteredTickets);
      setTotalCount(filteredTickets.length);
    } catch (err) {
      setError('Failed to fetch tickets');
      console.error('Error fetching tickets:', err);
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

  // Map TicketPriority to SeverityLevel for the new SeverityBadge component
  const mapTicketPriorityToSeverityLevel = (priority: TicketPriority): SeverityLevel => {
    const priorityMapping: Record<TicketPriority, SeverityLevel> = {
      [TicketPriority.LOW]: 'low',
      [TicketPriority.MEDIUM]: 'medium',
      [TicketPriority.HIGH]: 'high',
      [TicketPriority.URGENT]: 'critical', // Map URGENT to critical for visual priority
    };
    return priorityMapping[priority];
  };

  const getStatusBadge = (status: TicketStatus) => {
    const statusType = mapTicketStatusToStatusType(status);
    return <StatusBadge status={statusType} size="sm" />;
  };

  const getSeverityBadge = (severity: TicketSeverity) => {
    const severityLevel = mapTicketSeverityToSeverityLevel(severity);
    return <SeverityBadge severity={severityLevel} size="sm" />;
  };

  const getPriorityBadge = (priority: TicketPriority) => {
    const severityLevel = mapTicketPriorityToSeverityLevel(priority);
    return <SeverityBadge severity={severityLevel} size="sm" />;
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
      key: 'assignee',
      label: 'Assignee',
      sortable: true,
      render: (ticket: Ticket) => (
        <span className="text-neutral-700 dark:text-neutral-300">
          {ticket.assignee || 'Unassigned'}
        </span>
      ),
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
            <span className="ml-2 text-neutral-600 dark:text-neutral-400">Loading tickets...</span>
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
            <div className="text-red-600 dark:text-red-400 mb-2">Error loading tickets</div>
            <div className="text-neutral-600 dark:text-neutral-400 mb-4">{error}</div>
            <Button onClick={fetchTickets}>Retry</Button>
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
            {pageTitle}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            {categoryFilter ?
              `Filtered tickets by category (${totalCount} total)` :
              `Manage security incidents and support requests (${totalCount} total)`
            }
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
                placeholder="Search tickets..."
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

      {/* Tickets Table */}
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
    </div>
  );
}