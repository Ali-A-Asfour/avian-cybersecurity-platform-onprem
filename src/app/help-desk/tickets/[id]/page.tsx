'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { UserRole, Ticket, TicketComment, TicketAttachment, TicketStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Loader2, ArrowLeft, User, Clock, Phone, Mail, MessageSquare, Paperclip, AlertTriangle } from 'lucide-react';
import { TicketTimeline } from '@/components/help-desk/TicketTimeline';
import { TicketActions } from '@/components/help-desk/TicketActions';
import { ContactPreferences } from '@/components/help-desk/ContactPreferences';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api-client';

export default function TicketDetailPage() {
    const params = useParams();
    const router = useRouter();
    const ticketId = params.id as string;
    const { isAuthenticated, loading: authLoading } = useAuth();

    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [comments, setComments] = useState<TicketComment[]>([]);
    const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<any>(null);
    const [tenant, setTenant] = useState<any>(null);

    // Authentication check
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [authLoading, isAuthenticated, router]);

    // Fetch user context
    useEffect(() => {
        const fetchUserContext = async () => {
            try {
                // In a real app, this would come from your auth context
                // For now, we'll simulate it
                const mockUser = {
                    id: 'user-123',
                    role: UserRole.IT_HELPDESK_ANALYST,
                    email: 'analyst@example.com',
                    first_name: 'Help Desk',
                    last_name: 'Analyst',
                };

                const mockTenant = {
                    id: 'tenant-123',
                    name: 'Demo Tenant',
                    domain: 'demo.example.com',
                };

                setUser(mockUser);
                setTenant(mockTenant);
            } catch (error) {
                console.error('Error fetching user context:', error);
            }
        };

        fetchUserContext();
    }, []);

    // Fetch ticket details
    useEffect(() => {
        const fetchTicketDetails = async () => {
            if (!ticketId) return;

            try {
                setLoading(true);
                setError(null);

                // Fetch ticket
                const ticketResponse = await api.get(`/api/tickets/${ticketId}`);
                if (!ticketResponse.ok) {
                    throw new Error('Failed to fetch ticket');
                }
                const ticketData = await ticketResponse.json();
                setTicket(ticketData.data);

                // Fetch comments
                const commentsResponse = await api.get(`/api/tickets/${ticketId}/comments`);
                if (commentsResponse.ok) {
                    const commentsData = await commentsResponse.json();
                    setComments(commentsData.data || []);
                }

                // Fetch attachments
                const attachmentsResponse = await api.get(`/api/tickets/${ticketId}/attachments`);
                if (attachmentsResponse.ok) {
                    const attachmentsData = await attachmentsResponse.json();
                    setAttachments(attachmentsData.data || []);
                }
            } catch (err) {
                console.error('Error fetching ticket details:', err);
                setError(err instanceof Error ? err.message : 'Failed to fetch ticket details');
            } finally {
                setLoading(false);
            }
        };

        fetchTicketDetails();
    }, [ticketId]);

    // Handle comment added
    const handleCommentAdded = (newComment: TicketComment) => {
        setComments(prev => [...prev, newComment]);
    };

    // Handle ticket updated
    const handleTicketUpdated = (updatedTicket: Ticket) => {
        setTicket(updatedTicket);
    };

    // Get severity badge color
    const getSeverityColor = (severity: string): string => {
        switch (severity.toLowerCase()) {
            case 'critical':
                return 'bg-red-500 text-white';
            case 'high':
                return 'bg-orange-500 text-white';
            case 'medium':
                return 'bg-yellow-500 text-black';
            case 'low':
                return 'bg-green-500 text-white';
            default:
                return 'bg-gray-500 text-white';
        }
    };

    // Get status badge color
    const getStatusColor = (status: string): string => {
        switch (status.toLowerCase()) {
            case 'new':
                return 'bg-blue-500 text-white';
            case 'in_progress':
                return 'bg-yellow-500 text-black';
            case 'awaiting_response':
                return 'bg-orange-500 text-white';
            case 'resolved':
                return 'bg-green-500 text-white';
            case 'closed':
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

    if (authLoading || !isAuthenticated) {
        return null;
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading ticket details...</span>
            </div>
        );
    }

    if (error || !ticket) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                    <h1 className="text-xl font-semibold mb-2">Error Loading Ticket</h1>
                    <p className="text-gray-600 mb-4">{error || 'Ticket not found'}</p>
                    <Button onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Go Back
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">Ticket #{ticket.id.slice(0, 8)}</h1>
                        <p className="text-gray-600 mt-1">
                            Created {formatTimeAgo(ticket.created_at)} by {ticket.requester}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge className={getSeverityColor(ticket.severity)}>
                        {ticket.severity.toUpperCase()}
                    </Badge>
                    <Badge className={getStatusColor(ticket.status)}>
                        {ticket.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Ticket Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5" />
                                {ticket.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                                    <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
                                </div>

                                {ticket.tags && ticket.tags.length > 0 && (
                                    <div>
                                        <h4 className="font-medium text-gray-900 mb-2">Tags</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {ticket.tags.map((tag, index) => (
                                                <Badge key={index} variant="outline" className="text-xs">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Timeline */}
                    <TicketTimeline
                        ticketId={ticket.id}
                        comments={comments}
                        attachments={attachments}
                        userRole={user?.role}
                        onCommentAdded={handleCommentAdded}
                    />
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Contact Preferences - Prominent Display */}
                    <ContactPreferences ticket={ticket} />

                    {/* Device Information - Prominent Display */}
                    {ticket.device_name && (
                        <Card className="border-l-4 border-l-blue-500">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    Device Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <div className="text-sm text-blue-600 font-medium">Device ID</div>
                                    <div className="text-xl font-bold text-blue-900" data-testid="device-id">
                                        {ticket.device_name}
                                    </div>
                                    <div className="text-sm text-blue-600 mt-1">
                                        Use this ID for remote support
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Ticket Actions */}
                    <TicketActions
                        ticket={ticket}
                        userRole={user?.role}
                        userId={user?.id}
                        onTicketUpdated={handleTicketUpdated}
                    />

                    {/* Ticket Metadata */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Ticket Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Category:</span>
                                <span className="font-medium">{ticket.category.replace('_', ' ')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Priority:</span>
                                <span className="font-medium">{ticket.priority}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Assignee:</span>
                                <span className="font-medium">{ticket.assignee || 'Unassigned'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Created:</span>
                                <span className="font-medium">
                                    {new Date(ticket.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Updated:</span>
                                <span className="font-medium">
                                    {new Date(ticket.updated_at).toLocaleDateString()}
                                </span>
                            </div>
                            {ticket.sla_deadline && (
                                <div className="flex justify-between">
                                    <span className="text-gray-600">SLA Deadline:</span>
                                    <span className="font-medium">
                                        {new Date(ticket.sla_deadline).toLocaleDateString()}
                                    </span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Attachments Summary */}
                    {attachments.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Paperclip className="h-5 w-5" />
                                    Attachments ({attachments.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {attachments.slice(0, 3).map((attachment) => (
                                        <div key={attachment.id} className="flex items-center justify-between text-sm">
                                            <span className="truncate">{attachment.original_filename}</span>
                                            <Button variant="outline" size="sm">
                                                Download
                                            </Button>
                                        </div>
                                    ))}
                                    {attachments.length > 3 && (
                                        <div className="text-sm text-gray-500">
                                            +{attachments.length - 3} more files
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}