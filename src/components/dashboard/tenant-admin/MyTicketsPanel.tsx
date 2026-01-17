'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api-client';

interface Ticket {
  id: string;
  title: string;
  status: 'new' | 'in_progress' | 'awaiting_response' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
}

interface MyTicketsPanelProps {
  className?: string;
}

const statusColors = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
  awaiting_response: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300',
};

const priorityColors = {
  low: 'text-gray-500',
  medium: 'text-blue-500',
  high: 'text-orange-500',
  urgent: 'text-red-500',
};

export function MyTicketsPanel({ className = '' }: MyTicketsPanelProps) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMyTickets = async () => {
      if (!user) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch tickets created by the current user (limit to 5 most recent)
        const response = await api.get('/api/tickets/user?limit=5&sort_by=created_at&sort_order=desc');

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setTickets(data.data || []);
          } else {
            setError('Failed to load tickets');
          }
        } else {
          setError('Failed to load tickets');
        }
      } catch (err) {
        console.error('Error fetching my tickets:', err);
        setError('Failed to load tickets');
      } finally {
        setLoading(false);
      }
    };

    fetchMyTickets();
  }, [user]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div className={`bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-neutral-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-neutral-700 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-3 bg-neutral-700 rounded w-3/4 mb-1"></div>
                  <div className="h-2 bg-neutral-700 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-neutral-800 border border-neutral-700 rounded-lg p-4 sm:p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-neutral-100">My Tickets</h3>
        <span className="text-sm text-neutral-400">
          {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error ? (
        <div className="text-center py-8">
          <div className="text-red-400 mb-2">⚠️ Error loading tickets</div>
          <p className="text-neutral-400 text-sm">{error}</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-neutral-400 mb-2">📝 No tickets yet</div>
          <p className="text-neutral-500 text-sm">
            Your submitted support tickets will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="flex items-start space-x-3 p-3 rounded-lg bg-neutral-700/50 hover:bg-neutral-700 transition-colors cursor-pointer"
              onClick={() => {
                // Could navigate to ticket details if needed
                console.log('Clicked ticket:', ticket.id);
              }}
            >
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-100 truncate">
                      {ticket.title}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[ticket.status]}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                      <span className={`text-xs font-medium ${priorityColors[ticket.priority]}`}>
                        {ticket.priority}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-xs text-neutral-400">
                    {formatDate(ticket.created_at)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tickets.length > 0 && (
        <div className="mt-4 pt-4 border-t border-neutral-700">
          <button
            onClick={() => {
              // Could navigate to full tickets list if needed
              console.log('View all tickets');
            }}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            View all my tickets →
          </button>
        </div>
      )}
    </div>
  );
}