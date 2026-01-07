'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth as useAuthContext } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Ticket } from '@/types';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api-client';

export const dynamic = 'force-dynamic';

export default function TicketsPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authContextLoading } = useAuthContext();
  const { user, loading } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const fetchAllTickets = useCallback(async () => {
    try {
      setTicketsLoading(true);

      // Fetch user's own tickets (created by them or assigned to them)
      const response = await api.get('/api/tickets/user-tickets');

      if (!response.ok) {
        if (response.status === 401) {
          // Mock data for development/demo mode
          setTickets([
            { id: '1', title: 'Sample Ticket 1', status: 'open', priority: 'high', created_at: new Date().toISOString() },
            { id: '2', title: 'Sample Ticket 2', status: 'in_progress', priority: 'medium', created_at: new Date().toISOString() }
          ]);
        } else {
          console.error('Failed to fetch user tickets:', response.status);
          setTickets([]);
        }
        return;
      }

      const result = await response.json();

      if (result.success) {
        setTickets(result.data?.tickets || []);
      } else {
        console.error('Error in API response:', result.error);
        setTickets([]);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authContextLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authContextLoading, isAuthenticated, router]);

  useEffect(() => {
    // Redirect users to appropriate ticket queue based on role
    if (!loading && user) {
      if (user.role === 'security_analyst') {
        router.push('/security-tickets');
        return;
      } else if (user.role === 'it_helpdesk_analyst') {
        router.push('/helpdesk-tickets');
        return;
      }
    }
    fetchAllTickets();
  }, [loading, user, router, fetchAllTickets]);

  // Early return after all hooks to prevent rendering when not authenticated
  if (authContextLoading || !isAuthenticated) {
    return null;
  }

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
  };

  const filteredTickets = tickets.filter(ticket => {
    if (filterStatus !== 'all' && ticket.status !== filterStatus) return false;
    if (filterCategory !== 'all' && ticket.category !== filterCategory) return false;
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'awaiting_response': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'security_incident': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'access_request': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'network_issue': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'software_issue': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'hardware_issue': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <ClientLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              My Tickets
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              View tickets you've created or are assigned to. Create new tickets or visit role-specific queues to work on tickets.
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={() => router.push('/help-desk/tickets/new')}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
            >
              New Ticket
            </Button>
            <Button
              onClick={fetchAllTickets}
              variant="outline"
              className="text-sm"
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex space-x-4 items-center">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter by Status:
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="in_progress">In Progress</option>
            <option value="awaiting_response">Awaiting Response</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter by Category:
          </label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="all">All Categories</option>
            <option value="security_incident">Security Incidents</option>
            <option value="access_request">Access Requests</option>
            <option value="network_issue">Network Issues</option>
            <option value="software_issue">Software Issues</option>
            <option value="hardware_issue">Hardware Issues</option>
            <option value="account_setup">Account Setup</option>
            <option value="it_support">IT Support</option>
          </select>
        </div>

        {/* Tickets List */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          {ticketsLoading ? (
            <div className="p-8 text-center">
              <div className="text-gray-500 dark:text-gray-400">Loading tickets...</div>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {filterStatus === 'all' ? 'No tickets yet' : `No ${filterStatus.replace('_', ' ')} tickets`}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                {filterStatus === 'all'
                  ? 'You haven\'t created any tickets or been assigned to any tickets yet. Create your first ticket to get started.'
                  : `No tickets with ${filterStatus.replace('_', ' ')} status found.`
                }
              </p>
              {filterStatus === 'all' && (
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={() => router.push('/help-desk/tickets/new')}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Create New Ticket
                  </Button>
                  <Button
                    onClick={() => router.push('/helpdesk-tickets')}
                    variant="outline"
                  >
                    Browse Helpdesk Queue
                  </Button>
                  <Button
                    onClick={() => router.push('/security-tickets')}
                    variant="outline"
                  >
                    Browse Security Queue
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => handleTicketClick(ticket)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          #{ticket.id}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(ticket.category)}`}>
                          {(ticket.category || 'general').replace('_', ' ')}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {ticket.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {ticket.description}
                      </p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>Requester: {ticket.requester}</span>
                        <span>Assignee: {ticket.assignee || 'Unassigned'}</span>
                        <span>Created: {new Date(ticket.created_at).toLocaleDateString()}</span>
                        <span>Updated: {new Date(ticket.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <SeverityBadge
                        severity={ticket.severity as 'critical' | 'high' | 'medium' | 'low' | 'info'}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ticket Detail Modal */}
        {selectedTicket && (
          <Modal
            isOpen={true}
            onClose={() => setSelectedTicket(null)}
            title={`Ticket #${selectedTicket.id} (Read-Only)`}
            size="lg"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <StatusBadge
                    status={selectedTicket.status as 'new' | 'open' | 'investigating' | 'in_progress' | 'awaiting_response' | 'escalated' | 'resolved' | 'closed' | 'canceled'}
                    size="sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Priority
                  </label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selectedTicket.priority)}`}>
                    {selectedTicket.priority}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Category
                  </label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(selectedTicket.category)}`}>
                    {(selectedTicket.category || 'general').replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Severity
                  </label>
                  <SeverityBadge
                    severity={selectedTicket.severity as 'critical' | 'high' | 'medium' | 'low' | 'info'}
                    size="sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Title
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  {selectedTicket.title}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  {selectedTicket.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Requester
                  </label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {selectedTicket.requester}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Assignee
                  </label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {selectedTicket.assignee || 'Unassigned'}
                  </p>
                </div>
              </div>

              {selectedTicket.source_alert_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Source Alert ID
                  </label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                    {selectedTicket.source_alert_id}
                  </p>
                </div>
              )}

              {selectedTicket.tags && selectedTicket.tags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tags
                  </label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedTicket.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm text-gray-500 dark:text-gray-400">
                <div>
                  <span className="font-medium">Created:</span>{' '}
                  {new Date(selectedTicket.created_at).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">Updated:</span>{' '}
                  {new Date(selectedTicket.updated_at).toLocaleString()}
                </div>
              </div>

              {/* Personal ticket notice */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  This is your personal ticket view. To work on tickets with full functionality, visit the appropriate queue: "My Tickets" for assigned tickets or role-specific queues for new work.
                </p>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </ClientLayout>
  );
}