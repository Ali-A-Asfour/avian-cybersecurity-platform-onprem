'use client';

import React, { useState, useEffect } from 'react';
import { Ticket, TicketStatus, TicketSeverity, UserRole } from '@/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loader2, Users, Clock, AlertTriangle, ExternalLink, User } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api-client';

interface GeneralTicketQueueProps {
    userRole: UserRole;
    userId: string;
    tenantId: string;
}

interface QueueFilters {
    status?: TicketStatus[];
    severity?: TicketSeverity[];
    page?: number;
    limit?: number;
}

export function GeneralTicketQueue({
    userRole,
    userId,
    tenantId,
}: GeneralTicketQueueProps) {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
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

    // Fetch all tickets (general queue)
    const fetchAllTickets = async () => {
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

            const response = await api.get(`/api/tickets?${params}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch tickets');
            }

            const data = await response.json();
            setTickets(data.data);
            setPagination({
                page: data.meta?.page || 1,
                limit: data.meta?.limit || 20,
                total: data.meta?.total || 0,
                pages: Math.ceil((data.meta?.total || 0) / (data.meta?.limit || 20)),
            });
        } catch (err) {
            console.error('Error fetching tickets:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch tickets');
        } finally {
            setLoading(false);
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

    // Get assignment status display
    const getAssignmentStatus = (ticket: Ticket): { text: string; color: string; icon: React.ReactNode } => {
        if (!ticket.assignee) {
            return {
                text: 'Unassigned',
                color: 'text-orange-600',
                icon: <AlertTriangle className="h-4 w-4" />
            };
        }
        return {
            text: `Assigned to ${ticket.assignee}`,
            color: 'text-blue-600',
            icon: <User className="h-4 w-4" />
        };
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
        fetchAllTickets();
    }, [filters]);

    if (loading && tickets.length === 0) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2">Loading all tickets...</span>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        General Queue - All Tickets
                        <Badge variant="secondary">{pagination.total}</Badge>
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                        View all tickets including assigned, unassigned, and closed tickets
                    </p>
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
                            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No tickets found</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {tickets.map((ticket) => {
                                const assignmentStatus = getAssignmentStatus(ticket);
                                return (
                                    <Card key={ticket.id} className={`border-l-4 ${
                                        !ticket.assignee ? 'border-l-orange-500' : 
                                        ticket.status === TicketStatus.CLOSED ? 'border-l-gray-500' :
                                        'border-l-blue-500'
                                    }`}>
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

                                                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                                                        <span>Requester: {typeof ticket.requester === 'string' ? ticket.requester : ticket.requester?.email || 'Unknown'}</span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-4 w-4" />
                                                            {formatTimeAgo(ticket.created_at)}
                                                        </span>
                                                        {ticket.device_name && (
                                                            <span>Device: {ticket.device_name}</span>
                                                        )}
                                                    </div>

                                                    <div className={`flex items-center gap-1 text-sm ${assignmentStatus.color} mb-2`}>
                                                        {assignmentStatus.icon}
                                                        <span>{assignmentStatus.text}</span>
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
                                );
                            })}
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