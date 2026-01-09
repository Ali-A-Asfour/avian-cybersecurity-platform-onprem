'use client';

import React, { useState, useEffect } from 'react';
import { Ticket, TicketStatus, TicketSeverity, UserRole } from '@/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loader2, User, Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useTenant } from '@/contexts/TenantContext';

interface UnassignedTicketQueueProps {
    userRole: UserRole;
    userId: string;
    tenantId: string;
    onTicketAssigned?: (ticketId: string) => void;
}

interface QueueFilters {
    status?: TicketStatus[];
    severity?: TicketSeverity[];
    page?: number;
    limit?: number;
}

export function UnassignedTicketQueue({
    userRole,
    userId,
    tenantId,
    onTicketAssigned
}: UnassignedTicketQueueProps) {
    const { selectedTenant } = useTenant();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [assigningTickets, setAssigningTickets] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<QueueFilters>({
        page: 1,
        limit: 20,
    });
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
    });

    // Fetch unassigned tickets
    const fetchUnassignedTickets = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (filters.page) params.append('page', filters.page.toString());
            if (filters.limit) params.append('limit', filters.limit.toString());
            if (filters.status) {
                filters.status.forEach(status => params.append('status', status));
            }
            if (filters.severity) {
                filters.severity.forEach(severity => params.append('severity', severity));
            }

            // Prepare headers for cross-tenant users
            const headers: Record<string, string> = {};
            
            // For cross-tenant users, send selected tenant in headers
            if ([UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST].includes(userRole) && selectedTenant) {
                headers['x-selected-tenant'] = selectedTenant.id;
            }

            console.log('=== UNASSIGNED QUEUE FETCH ===');
            console.log('User role:', userRole);
            console.log('Selected tenant:', selectedTenant);
            console.log('Headers:', headers);
            console.log('=== END FETCH DEBUG ===');

            const response = await api.get(`/api/help-desk/queue/unassigned?${params}`, {
                headers
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch unassigned tickets');
            }

            const data = await response.json();
            setTickets(data.data.tickets);
            setPagination(data.data.pagination);
        } catch (err) {
            console.error('Error fetching unassigned tickets:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch tickets');
        } finally {
            setLoading(false);
        }
    };

    // Self-assign a ticket
    const handleSelfAssign = async (ticketId: string) => {
        try {
            setAssigningTickets(prev => new Set(prev).add(ticketId));

            const response = await api.post(`/api/tickets/${ticketId}/assign`, {
                assignee: userId,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to assign ticket');
            }

            // Refresh the queue to show updated positioning
            await fetchUnassignedTickets();

            // Notify parent component
            onTicketAssigned?.(ticketId);

            // Show success message (you might want to use a toast notification here)
            console.log('Ticket assigned successfully');
        } catch (err) {
            console.error('Error assigning ticket:', err);
            setError(err instanceof Error ? err.message : 'Failed to assign ticket');
        } finally {
            setAssigningTickets(prev => {
                const newSet = new Set(prev);
                newSet.delete(ticketId);
                return newSet;
            });
        }
    };

    // Get severity badge color
    const getSeverityColor = (severity: TicketSeverity): string => {
        switch (severity) {
            case TicketSeverity.CRITICAL:
                return 'bg-red-500 text-white';
            case TicketSeverity.HIGH:
                return 'bg-orange-500 text-white';
            case TicketSeverity.MEDIUM:
                return 'bg-yellow-500 text-black';
            case TicketSeverity.LOW:
                return 'bg-green-500 text-white';
            default:
                return 'bg-gray-500 text-white';
        }
    };

    // Get status badge color
    const getStatusColor = (status: TicketStatus): string => {
        switch (status) {
            case TicketStatus.NEW:
                return 'bg-blue-500 text-white';
            case TicketStatus.IN_PROGRESS:
                return 'bg-yellow-500 text-black';
            case TicketStatus.AWAITING_RESPONSE:
                return 'bg-orange-500 text-white';
            case TicketStatus.RESOLVED:
                return 'bg-green-500 text-white';
            case TicketStatus.CLOSED:
                return 'bg-gray-500 text-white';
            default:
                return 'bg-gray-500 text-white';
        }
    };

    // Format time ago
    const formatTimeAgo = (date: Date): string => {
        const now = new Date();
        const diffMs = now.getTime() - new Date(date).getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) {
            return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else if (diffHours > 0) {
            return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else {
            return 'Less than 1 hour ago';
        }
    };

    useEffect(() => {
        fetchUnassignedTickets();
    }, [filters, selectedTenant]); // Add selectedTenant as dependency

    if (loading && tickets.length === 0) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2">Loading unassigned tickets...</span>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Unassigned Tickets Queue
                        <Badge variant="secondary">{pagination.total}</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                            <div className="flex items-center">
                                <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                                <span className="text-red-700">{error}</span>
                            </div>
                        </div>
                    )}

                    {tickets.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No unassigned tickets in the queue</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {tickets.map((ticket) => (
                                <Card key={ticket.id} className="border-l-4 border-l-blue-500">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h3 className="font-semibold text-lg">{ticket.title}</h3>
                                                    <Badge className={getSeverityColor(ticket.severity)}>
                                                        {ticket.severity.toUpperCase()}
                                                    </Badge>
                                                    <Badge className={getStatusColor(ticket.status)}>
                                                        {ticket.status.replace('_', ' ').toUpperCase()}
                                                    </Badge>
                                                </div>

                                                <p className="text-gray-600 mb-3 line-clamp-2">
                                                    {ticket.description}
                                                </p>

                                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                                    <span>Requester: {typeof ticket.requester === 'string' ? ticket.requester : ticket.requester?.email || 'Unknown'}</span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-4 w-4" />
                                                        {formatTimeAgo(ticket.created_at)}
                                                    </span>
                                                    {ticket.device_name && (
                                                        <span>Device: {ticket.device_name}</span>
                                                    )}
                                                </div>

                                                {ticket.tags && ticket.tags.length > 0 && (
                                                    <div className="flex gap-1 mt-2">
                                                        {ticket.tags.map((tag, index) => (
                                                            <Badge key={index} variant="outline" className="text-xs">
                                                                {tag}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="ml-4 flex flex-col gap-2">
                                                <Button
                                                    onClick={() => handleSelfAssign(ticket.id)}
                                                    disabled={assigningTickets.has(ticket.id)}
                                                    className="bg-blue-600 hover:bg-blue-700"
                                                >
                                                    {assigningTickets.has(ticket.id) ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                            Assigning...
                                                        </>
                                                    ) : (
                                                        'Assign to me'
                                                    )}
                                                </Button>
                                                <Link href={`/help-desk/tickets/${ticket.id}`}>
                                                    <Button variant="outline" size="sm" className="w-full">
                                                        <ExternalLink className="h-4 w-4 mr-2" />
                                                        View Details
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div className="flex items-center justify-between mt-6">
                            <div className="text-sm text-gray-500">
                                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                                {pagination.total} tickets
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, pagination.page - 1) }))}
                                    disabled={pagination.page <= 1}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setFilters(prev => ({ ...prev, page: Math.min(pagination.pages, pagination.page + 1) }))}
                                    disabled={pagination.page >= pagination.pages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}