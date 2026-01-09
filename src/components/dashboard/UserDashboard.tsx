'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { Modal } from '@/components/ui/Modal';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

interface UserTicket {
  id: string;
  title: string;
  description?: string;
  status: 'new' | 'in_progress' | 'awaiting_response' | 'resolved' | 'closed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: Date;
  updated_at: Date;
}

interface SecurityStatus {
  overall: 'secure' | 'warning' | 'critical';
  lastScan: Date;
  issues: number;
  recommendations: string[];
}

export function UserDashboard() {
  const router = useRouter();
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);

  useEffect(() => {
    fetchUserTickets();
    fetchSecurityStatus();
  }, []);

  const fetchUserTickets = async () => {
    try {
      // Fetch tickets created by the current user (limit to 3 most recent)
      const response = await api.get('/api/tickets/user?limit=3&sort_by=created_at&sort_order=desc');

      if (!response.ok) {
        console.warn('Failed to fetch tickets, showing empty state');
        setTickets([]);
        return;
      }

      const result = await response.json();

      if (result.success && result.data) {
        // Map the API response to UserTicket format
        const userTickets: UserTicket[] = result.data.map((ticket: any) => ({
          id: ticket.id,
          title: ticket.title,
          description: ticket.description || 'No description provided',
          status: ticket.status,
          severity: ticket.severity || ticket.priority || 'low',
          created_at: new Date(ticket.created_at),
          updated_at: new Date(ticket.updated_at),
        }));

        setTickets(userTickets);
      } else {
        setTickets([]);
      }
    } catch (error) {
      console.warn('Error fetching user tickets:', error);
      // Set empty array on error - user will see "No open tickets" message
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSecurityStatus = async () => {
    try {
      // For now, use mock security status
      // In a real app, this would fetch from a security status API
      const mockSecurityStatus: SecurityStatus = {
        overall: 'secure',
        lastScan: new Date(Date.now() - 6 * 60 * 60 * 1000),
        issues: 0,
        recommendations: [
          'Enable two-factor authentication',
          'Update your password',
          'Review recent login activity',
        ],
      };

      setSecurityStatus(mockSecurityStatus);
    } catch (error) {
      console.error('Error fetching security status:', error);
    }
  };

  const handleTicketClick = (ticket: UserTicket) => {
    setSelectedTicket(ticket);
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusBadge = (status: string) => {
    // Map to standard status types
    const mapStatus = (stat: string): 'new' | 'open' | 'investigating' | 'in_progress' | 'awaiting_response' | 'escalated' | 'resolved' | 'closed' | 'canceled' => {
      switch (stat) {
        case 'new': return 'new';
        case 'in_progress': return 'in_progress';
        case 'awaiting_response': return 'awaiting_response';
        case 'resolved': return 'resolved';
        case 'closed': return 'closed';
        default: return 'new';
      }
    };

    return <StatusBadge status={mapStatus(status)} size="sm" />;
  };

  const getSeverityBadge = (severity: string) => {
    // Map to standard severity levels
    const mapSeverity = (sev: string): 'critical' | 'high' | 'medium' | 'low' | 'info' => {
      switch (sev.toLowerCase()) {
        case 'critical': return 'critical';
        case 'high': return 'high';
        case 'medium': return 'medium';
        case 'low': return 'low';
        default: return 'info';
      }
    };

    return <SeverityBadge severity={mapSeverity(severity)} size="sm" />;
  };

  const getSecurityStatusIcon = (status: string) => {
    switch (status) {
      case 'secure':
        return (
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case 'warning':
        return (
          <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        );
      case 'critical':
        return (
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Less than an hour ago';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 border border-neutral-200 dark:border-neutral-700">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Welcome to your Security Portal
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400">
          Stay informed about your security tickets and system status. Need help? Create a new ticket below.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          onClick={() => router.push('/help-desk/tickets/new')}
          className="flex-1 sm:flex-none"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New Ticket
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Open Tickets */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              My Open Tickets
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              {tickets.filter(t => !['resolved', 'closed'].includes(t.status)).length} active tickets
            </p>
          </div>
          <div className="p-6">
            {tickets.filter(t => !['resolved', 'closed'].includes(t.status)).length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-neutral-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-neutral-600 dark:text-neutral-400">No open tickets</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-1">
                  You're all caught up!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {tickets.filter(t => !['resolved', 'closed'].includes(t.status)).map((ticket) => (
                  <div
                    key={ticket.id}
                    className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 cursor-pointer transition-colors"
                    onClick={() => handleTicketClick(ticket)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {ticket.title}
                      </h4>
                      {getSeverityBadge(ticket.severity)}
                    </div>
                    <div className="flex items-center justify-between">
                      {getStatusBadge(ticket.status)}
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        Updated {formatRelativeTime(ticket.updated_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Security Status */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Security Status
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              Last scan: {securityStatus ? formatRelativeTime(securityStatus.lastScan) : 'Never'}
            </p>
          </div>
          <div className="p-6">
            {securityStatus && (
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  {getSecurityStatusIcon(securityStatus.overall)}
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">
                      {securityStatus.overall === 'secure' ? 'All Clear' :
                        securityStatus.overall === 'warning' ? 'Attention Needed' : 'Critical Issues'}
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      {securityStatus.issues === 0 ? 'No security issues detected' :
                        `${securityStatus.issues} issue${securityStatus.issues > 1 ? 's' : ''} found`}
                    </p>
                  </div>
                </div>

                {securityStatus.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                      Security Recommendations
                    </h4>
                    <ul className="space-y-2">
                      {securityStatus.recommendations.slice(0, 3).map((rec, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm text-neutral-600 dark:text-neutral-400">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Recent Activity
          </h3>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            <div className="flex items-center space-x-3 text-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-neutral-600 dark:text-neutral-400">
                Ticket #2 status updated to "In Progress"
              </span>
              <span className="text-neutral-500 dark:text-neutral-500">3 hours ago</span>
            </div>
            <div className="flex items-center space-x-3 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-neutral-600 dark:text-neutral-400">
                Security scan completed successfully
              </span>
              <span className="text-neutral-500 dark:text-neutral-500">6 hours ago</span>
            </div>
            <div className="flex items-center space-x-3 text-sm">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span className="text-neutral-600 dark:text-neutral-400">
                Password reset request submitted
              </span>
              <span className="text-neutral-500 dark:text-neutral-500">2 days ago</span>
            </div>
          </div>
        </div>
      </div>

      {/* Simple Ticket View Modal for Regular Users */}
      {selectedTicket && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedTicket(null)}
          title={`Ticket #${selectedTicket.id}`}
          size="md"
        >
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title
              </label>
              <p className="text-sm text-gray-900 dark:text-white">
                {selectedTicket.title}
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                {selectedTicket.description || 'No description provided'}
              </p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <div className="flex items-center space-x-2">
                {getStatusBadge(selectedTicket.status)}
                {getSeverityBadge(selectedTicket.severity)}
              </div>
            </div>

            {/* Time Posted */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Created
              </label>
              <p className="text-sm text-gray-900 dark:text-white">
                {formatDateTime(selectedTicket.created_at)}
              </p>
            </div>

            {/* Last Updated */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Last Updated
              </label>
              <p className="text-sm text-gray-900 dark:text-white">
                {formatDateTime(selectedTicket.updated_at)}
              </p>
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={() => setSelectedTicket(null)}
                variant="outline"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}