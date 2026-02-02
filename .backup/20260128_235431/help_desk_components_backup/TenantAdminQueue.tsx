'use client';

import React, { useState, useEffect } from 'react';
import { Ticket, TicketStatus, TicketSeverity, UserRole } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Loader2, Settings, Clock, AlertTriangle, ExternalLink, Search, Filter } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api-client';

interface TenantAdminQueueProps {
    userRole: UserRole;
    userId: string;
    tenantId: string;
}

interface QueueFilters {
    status?: TicketStatus[];
    severity?: TicketSeverity[];
    assignee?: string;
    requester?: string;
    page?: number;
    limit?: number;
}

export function TenantAdminQueue({ userRole, userId, tenantId }: TenantAdminQueueProps) {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);
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

    // Fetch tenant admin tickets
    const fetchTenantAdminTickets = async () => {
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
            if (filters.assignee) params.append('assignee', filters.assignee);
            if (filters.requester) params.append('requester', filters.requester);

            const response = await api.get(`/api/help-desk/queue/tenant-admin?${params}`);

            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = typeof errorData.error === 'string' ? errorData.error : 'Failed to fetch tenant tickets';
                throw new Error(errorMessage);
            }

            const data = await response.json();
            setTickets(data.data.tickets);
            setPagination(data.data.pagination);
        } catch (err) {
            console.error('Error fetching tenant admin tickets:', err);
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

    // Check if ticket is overdue
    const isOverdue = (ticket: Ticket): boolean => {
        if (!ticket.sla_deadline) return false;
        return new Date(ticket.sla_deadline) < new Date() &&
            ![TicketStatus.RESOLVED, TicketStatus.CLOSED].includes(ticket.status);
    };

    // Handle filter changes
    const handleFilterChange = (key: keyof QueueFilters, value: any) => {
        setFilters(prev => ({
            ...prev,
            [key]: value,
            page: 1, // Reset to first page when filters change
        }));
    };

    useEffect(() => {
        fetchTenantAdminTickets();
    }, [filters]);

    if (loading && tickets.length === 0) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2">Loading tenant tickets...</span>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            All Tenant Tickets
                            <Badge variant="secondary">{pagination.total}</Badge>
                        </CardTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <Filter className="h-4 w-4 mr-2" />
                            Filters
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    {showFilters && (
                        <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Status</label>
                                    <Select
                                        value={filters.status?.[0] || ''}
                                        onValueChange={(value) => handleFilterChange('status', value ? [value] : undefined)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="All statuses" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">All statuses</SelectItem>
                                            <SelectItem value={TicketStatus.NEW}>New</SelectItem>
                                            <SelectItem value={TicketStatus.IN_PROGRESS}>In Progress</SelectItem>
                                            <SelectItem value={TicketStatus.AWAITING_RESPONSE}>Awaiting Response</SelectItem>
                                            <SelectItem value={TicketStatus.RESOLVED}>Resolved</SelectItem>
                                            <SelectItem value={TicketStatus.CLOSED}>Closed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Severity</label>
                                    <Select
                                        value={filters.severity?.[0] || ''}
                                        onValueChange={(value) => handleFilterChange('severity', value ? [value] : undefined)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="All severities" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">All severities</SelectItem>
                                            <SelectItem value={TicketSeverity.CRITICAL}>Critical</SelectItem>
                                            <SelectItem value={TicketSeverity.HIGH}>High</SelectItem>
                                            <SelectItem value={TicketSeverity.MEDIUM}>Medium</SelectItem>
                                            <SelectItem value={TicketSeverity.LOW}>Low</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Assignee</label>
                                    <Input
                                        placeholder="Filter by assignee..."
                                        value={filters.assignee || ''}
                                        onChange={(e) => handleFilterChange('assignee', e.target.value || undefined)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Requester</label>
                                    <Input
                                        placeholder="Filter by requester..."
                                        value={filters.requester || ''}
                                        onChange={(e) => handleFilterChange('requester', e.target.value || undefined)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

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
                            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No tickets found</p>
                            <p className="text-sm mt-2">
                                {showFilters ? 'Try adjusting your filters' : 'No tickets have been created yet'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {tickets.map((ticket) => (
                                <Card
                                    key={ticket.id}
                                    className={`border-l-4 ${isOverdue(ticket)
                                        ? 'border-l-red-500 bg-red-50'
                                        : ticket.severity === TicketSeverity.CRITICAL
                                            ? 'border-l-red-500'
                                            : ticket.severity === TicketSeverity.HIGH
                                                ? 'border-l-orange-500'
                                                : 'border-l-blue-500'
                                        }`}
                                >
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
                                                    {isOverdue(ticket) && (
                                                        <Badge className="bg-red-500 text-white">
                                                            OVERDUE
                                                        </Badge>
                                                    )}
                                                </div>

                                                <p className="text-gray-600 mb-3 line-clamp-2">
                                                    {ticket.description}
                                                </p>

                                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                                    <span>Requester: {typeof ticket.requester === 'string' ? ticket.requester : ticket.requester?.email || 'Unknown'}</span>
                                                    {ticket.assignee && (
                                                        <span>Assigned to: {typeof ticket.assignee === 'string' ? ticket.assignee : ticket.assignee?.email || 'Unknown'}</span>
                                                    )}
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-4 w-4" />
                                                        {formatTimeAgo(ticket.created_at)}
                                                    </span>
                                                    {ticket.device_name && (
                                                        <span>Device: {ticket.device_name}</span>
                                                    )}
                                                    {ticket.sla_deadline && (
                                                        <span className={isOverdue(ticket) ? 'text-red-600 font-medium' : ''}>
                                                            SLA: {new Date(ticket.sla_deadline).toLocaleDateString()}
                                                        </span>
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

                                            <div className="ml-4">
                                                <Link href={`/help-desk/tickets/${ticket.id}`}>
                                                    <Button variant="outline" size="sm">
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