'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Ticket, UserRole } from '@/types';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TicketResolutionModal } from '@/components/help-desk/TicketResolutionModal';
import { api } from '@/lib/api-client';

export const dynamic = 'force-dynamic';

export default function MyTicketsPage() {
    const router = useRouter();
    const { isAuthenticated, loading: authLoading, user } = useAuth();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [ticketsLoading, setTicketsLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [resolutionModalOpen, setResolutionModalOpen] = useState(false);
    const [ticketToResolve, setTicketToResolve] = useState<Ticket | null>(null);

    // Check if user can see detailed ticket information
    // Only IT staff and admins can view ticket details
    const canViewTicketDetails = user?.role && [
        'it_helpdesk_analyst',
        'security_analyst', 
        'tenant_admin',
        'super_admin'
    ].includes(user.role);

    // Check if user can perform ticket actions (status updates, resolution)
    const canPerformTicketActions = canViewTicketDetails;

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [authLoading, isAuthenticated, router]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchMyTickets();
        }
    }, [isAuthenticated]);

    if (authLoading || !isAuthenticated) {
        return null;
    }

    const fetchMyTickets = async () => {
        try {
            setTicketsLoading(true);

            // Fetch tickets assigned to the current user from the API
            const response = await api.get('/api/tickets/my');

            if (!response.ok) {
                throw new Error(`Failed to fetch tickets: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                // Handle the correct API response structure: { success: true, data: { tickets: [...], total: number } }
                setTickets(result.data?.tickets || []);
            } else {
                throw new Error(result.error?.message || 'Failed to fetch tickets');
            }
        } catch (error) {
            console.error('Error fetching my tickets:', error);
            // Show empty state on error
            setTickets([]);
        } finally {
            setTicketsLoading(false);
        }
    };

    const handleTicketClick = (ticket: Ticket) => {
        // Only allow detailed view for help desk staff and admins
        // Regular users cannot click on tickets at all
        if (!canViewTicketDetails) {
            console.log('Access denied: User does not have permission to view ticket details');
            return;
        }
        
        setSelectedTicket(ticket);
    };

    const handleStatusUpdate = async (ticketId: string, status: string) => {
        try {
            // Update ticket status via API
            const response = await api.put(`/api/tickets/${ticketId}`, { status });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to update ticket status');
            }

            const result = await response.json();

            if (result.success) {
                // Update local state with the updated ticket
                const updatedTickets = tickets.map(ticket =>
                    ticket.id === ticketId ? result.data : ticket
                );
                setTickets(updatedTickets);

                // Update selected ticket if it's the same one
                if (selectedTicket?.id === ticketId) {
                    setSelectedTicket(result.data);
                }

                console.log(`Ticket ${ticketId} status updated to ${status} successfully`);
            } else {
                throw new Error(result.error?.message || 'Failed to update ticket status');
            }
        } catch (error) {
            console.error('Error updating ticket status:', error);
            // Show error message to user (in real implementation, this would be a toast notification)
            alert(`Failed to update ticket status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleResolveTicket = async (ticketId: string, resolution: string, createKnowledgeArticle: boolean, knowledgeArticleTitle?: string) => {
        try {
            // Call the resolve endpoint with resolution data
            const response = await api.post(`/api/tickets/${ticketId}/resolve`, {
                resolution,
                createKnowledgeArticle,
                knowledgeArticleTitle,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to resolve ticket');
            }

            const result = await response.json();

            if (result.success) {
                // Update local state with the resolved ticket
                const updatedTickets = tickets.map(ticket =>
                    ticket.id === ticketId ? result.data.ticket : ticket
                );
                setTickets(updatedTickets);

                // Update selected ticket if it's the same one
                if (selectedTicket?.id === ticketId) {
                    setSelectedTicket(result.data.ticket);
                }

                console.log(`Ticket ${ticketId} resolved successfully`);

                // Show success message if knowledge article was created
                if (result.data.knowledgeArticle) {
                    console.log(`Knowledge article created: ${result.data.knowledgeArticle.id}`);
                }
            } else {
                throw new Error(result.error?.message || 'Failed to resolve ticket');
            }
        } catch (error) {
            console.error('Error resolving ticket:', error);
            throw error; // Re-throw to let the modal handle the error display
        }
    };

    const handleResolveClick = (ticket: Ticket) => {
        setTicketToResolve(ticket);
        setResolutionModalOpen(true);
    };

    const filteredTickets = tickets.filter(ticket => {
        if (filterStatus === 'all') return true;
        return ticket.status === filterStatus;
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
                            {canViewTicketDetails 
                                ? "Help desk tickets assigned to you. Use \"Assign to me\" in the general Helpdesk Tickets queue to add tickets here."
                                : "Your submitted tickets and their current status."
                            }
                        </p>
                    </div>
                    <Button
                        onClick={fetchMyTickets}
                        variant="outline"
                        className="text-sm"
                    >
                        Refresh
                    </Button>
                </div>

                {/* Help Notice */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                        <div className="text-blue-600 dark:text-blue-400 mt-0.5">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                {canViewTicketDetails ? "Personal Help Desk Queue" : "My Ticket Status"}
                            </h3>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                {canViewTicketDetails 
                                    ? "This queue shows only tickets you have assigned to yourself. To take on new tickets, visit the general \"Helpdesk Tickets\" queue and click \"Assign to me\"."
                                    : "Here you can view the status of tickets you have submitted. For detailed information or updates, please contact the help desk directly."
                                }
                            </p>
                        </div>
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
                </div>

                {/* Tickets List */}
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
                    {/* Show access restriction notice for regular users */}
                    {!canViewTicketDetails && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 p-4">
                            <div className="flex items-start space-x-3">
                                <div className="text-yellow-600 dark:text-yellow-400 mt-0.5">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                        Limited Access - Regular User
                                    </h3>
                                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                        You can view your ticket status but cannot access detailed information. Tickets are not clickable for regular users.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {ticketsLoading ? (
                        <div className="p-8 text-center">
                            <div className="text-gray-500 dark:text-gray-400">Loading tickets...</div>
                        </div>
                    ) : filteredTickets.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="w-12 h-12 mx-auto mb-4 text-gray-400">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                {filterStatus === 'all' 
                                    ? (canViewTicketDetails ? 'No tickets assigned to you' : 'No tickets found')
                                    : `No ${filterStatus.replace('_', ' ')} tickets`
                                }
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400">
                                {filterStatus === 'all'
                                    ? (canViewTicketDetails 
                                        ? 'Visit the "Helpdesk Tickets" queue and click "Assign to me" to take on tickets.'
                                        : 'You have not submitted any tickets yet.'
                                    )
                                    : `No tickets with ${filterStatus.replace('_', ' ')} status found.`
                                }
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredTickets.map((ticket) => (
                                <div
                                    key={ticket.id}
                                    className={`p-4 ${canViewTicketDetails 
                                        ? 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-l-4 border-transparent hover:border-blue-500' 
                                        : 'cursor-not-allowed bg-gray-50 dark:bg-gray-900 border-l-4 border-red-300'
                                    }`}
                                    onClick={canViewTicketDetails ? () => handleTicketClick(ticket) : (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('Click blocked for regular user - role:', user?.role);
                                        alert('Access denied: You do not have permission to view ticket details.');
                                    }}
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
                                                {ticket.category === 'security_incident' && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                                        Security
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                {ticket.title}
                                            </h3>
                                            {/* Show description only to help desk staff and admins */}
                                            {canViewTicketDetails && (
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                                    {ticket.description}
                                                </p>
                                            )}
                                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                <span>Requester: {ticket.requester}</span>
                                                <span>Created: {new Date(ticket.created_at).toLocaleDateString()}</span>
                                                <span>Updated: {new Date(ticket.updated_at).toLocaleDateString()}</span>
                                                {canViewTicketDetails && ticket.assignee && (
                                                    <span>Assignee: {ticket.assignee}</span>
                                                )}
                                            </div>
                                            {/* Show click hint only for help desk staff */}
                                            {canViewTicketDetails && (
                                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                    Click to view details and manage ticket
                                                </p>
                                            )}
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

                {/* Ticket Detail Modal - Only for help desk staff and admins */}
                {selectedTicket && canViewTicketDetails && (
                    <Modal
                        isOpen={true}
                        onClose={() => setSelectedTicket(null)}
                        title={`Ticket #${selectedTicket.id}`}
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
                                    <p className="mt-1 text-sm text-gray-900 dark:text-white capitalize">
                                        {selectedTicket.category.replace('_', ' ')}
                                    </p>
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

                            {/* Action Buttons - Only for help desk staff and admins */}
                            {canPerformTicketActions && (
                                <div className="flex space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                                    {selectedTicket.status === 'new' && (
                                        <Button
                                            onClick={() => handleStatusUpdate(selectedTicket.id, 'in_progress')}
                                            size="sm"
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            Start Work
                                        </Button>
                                    )}
                                    {selectedTicket.status === 'in_progress' && (
                                        <>
                                            <Button
                                                onClick={() => handleStatusUpdate(selectedTicket.id, 'awaiting_response')}
                                                size="sm"
                                                className="bg-orange-600 hover:bg-orange-700"
                                            >
                                                Awaiting Response
                                            </Button>
                                            <Button
                                                onClick={() => handleResolveClick(selectedTicket)}
                                                size="sm"
                                                className="bg-green-600 hover:bg-green-700"
                                            >
                                                Mark Resolved
                                            </Button>
                                        </>
                                    )}
                                    {selectedTicket.status === 'awaiting_response' && (
                                        <Button
                                            onClick={() => handleStatusUpdate(selectedTicket.id, 'in_progress')}
                                            size="sm"
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            Resume Work
                                        </Button>
                                    )}
                                    {selectedTicket.status === 'resolved' && (
                                        <Button
                                            onClick={() => handleStatusUpdate(selectedTicket.id, 'closed')}
                                            size="sm"
                                            className="bg-gray-600 hover:bg-gray-700"
                                        >
                                            Close Ticket
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </Modal>
                )}
            </div>

            {/* Ticket Resolution Modal - Only for help desk staff and admins */}
            {canPerformTicketActions && (
                <TicketResolutionModal
                    isOpen={resolutionModalOpen}
                    onClose={() => setResolutionModalOpen(false)}
                    ticket={ticketToResolve}
                    onResolve={handleResolveTicket}
                />
            )}
        </ClientLayout>
    );
}