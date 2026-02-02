'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, User, Eye, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api-client';
import { UserRole } from '@/types';
import { useDemoContext } from '@/contexts/DemoContext';

interface Ticket {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    severity: string;
    created_at: string;
    updated_at: string;
    assigned_to?: string;
    created_by: string;
    tenant_id: string;
    category: string;
    requester_email?: string;
    requester: string;
}

interface ClosedTicketsQueueProps {
    userRole: UserRole;
    userId: string;
    tenantId: string;
}

export function ClosedTicketsQueue({ userRole, userId, tenantId }: ClosedTicketsQueueProps) {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { selectedTenant } = useDemoContext();

    const fetchClosedTickets = async () => {
        try {
            setLoading(true);
            setError(null);

            console.log('=== CLOSED TICKETS FETCH ===');
            console.log('User role:', userRole);
            console.log('Selected tenant:', selectedTenant);

            // Prepare headers for cross-tenant users
            const headers: Record<string, string> = {};
            
            // For cross-tenant users, send selected tenant in headers
            if ([UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST].includes(userRole) && selectedTenant) {
                headers['x-selected-tenant-id'] = selectedTenant.id;
            }

            console.log('Headers:', headers);
            console.log('=== END FETCH DEBUG ===');

            const response = await api.get('/api/help-desk/queue/closed-tickets', {
                headers
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch closed tickets');
            }

            const data = await response.json();
            setTickets(data.data || []);
        } catch (error) {
            console.error('Error fetching closed tickets:', error);
            setError(error instanceof Error ? error.message : 'Failed to fetch closed tickets');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClosedTickets();
    }, [userRole, userId, tenantId, selectedTenant]);

    const handleViewDetails = (ticketId: string) => {
        // Open in same tab instead of new tab so back button works
        window.location.href = `/help-desk/tickets/${ticketId}`;
    };

    const handleReopenTicket = async (ticketId: string) => {
        try {
            const headers: Record<string, string> = {};
            
            // For cross-tenant users, send selected tenant in headers
            if ([UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST].includes(userRole) && selectedTenant) {
                headers['x-selected-tenant-id'] = selectedTenant.id;
            }

            const response = await api.put(`/api/tickets/${ticketId}/resolve`, {
                reason: 'Ticket reopened from closed queue'
            }, {
                headers
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = typeof errorData.error === 'string' ? errorData.error : 'Failed to reopen ticket';
                throw new Error(errorMessage);
            }

            // Refresh the queue to show updated tickets
            await fetchClosedTickets();

        } catch (error) {
            console.error('Error reopening ticket:', error);
            alert('Failed to reopen ticket: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getPriorityColor = (priority: string) => {
        switch (priority.toLowerCase()) {
            case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
            case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'low': return 'bg-green-100 text-green-800 border-green-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading closed tickets...</span>
            </div>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="text-center text-red-600">
                        <p>Error: {error}</p>
                        <Button 
                            onClick={fetchClosedTickets}
                            className="mt-2"
                            variant="outline"
                        >
                            Retry
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (tickets.length === 0) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="text-center text-gray-500">
                        <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <h3 className="text-lg font-medium mb-2">No Closed Tickets</h3>
                        <p>No resolved or closed tickets found.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        Closed Tickets
                    </h2>
                    <p className="text-gray-600 text-sm mt-1">
                        {userRole === UserRole.USER 
                            ? 'Your resolved and closed tickets' 
                            : 'Resolved and closed tickets you handled'
                        }
                    </p>
                </div>
                <Badge variant="outline" className="text-sm">
                    {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
                </Badge>
            </div>

            <div className="grid gap-4">
                {tickets.map((ticket) => (
                    <Card key={ticket.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="font-medium text-gray-900 truncate">
                                            {ticket.title}
                                        </h3>
                                        <Badge 
                                            variant="outline" 
                                            className={`text-xs ${getPriorityColor(ticket.priority)}`}
                                        >
                                            {ticket.priority}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-200">
                                            <CheckCircle className="h-3 w-3 mr-1" />
                                            Resolved
                                        </Badge>
                                    </div>
                                    
                                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                        {ticket.description}
                                    </p>
                                    
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <div className="flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            <span>{ticket.requester || ticket.requester_email}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            <span>Resolved {formatDate(ticket.updated_at)}</span>
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            ID: {ticket.id.substring(0, 8)}...
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 ml-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleViewDetails(ticket.id)}
                                        className="flex items-center gap-1"
                                    >
                                        <Eye className="h-3 w-3" />
                                        View
                                    </Button>
                                    
                                    {/* Only show reopen for help desk staff */}
                                    {[UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST, UserRole.TENANT_ADMIN].includes(userRole) && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleReopenTicket(ticket.id)}
                                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                                        >
                                            <RotateCcw className="h-3 w-3" />
                                            Reopen
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}