'use client';

import React, { useState } from 'react';
import { Ticket, TicketStatus, UserRole } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/textarea';
import {
    Settings,
    Play,
    Pause,
    CheckCircle,
    XCircle,
    RotateCcw,
    User,
    Clock,
    AlertTriangle
} from 'lucide-react';
import { api } from '@/lib/api-client';

interface TicketActionsProps {
    ticket: Ticket;
    userRole?: UserRole;
    userId?: string;
    onTicketUpdated: (ticket: Ticket) => void;
}

export function TicketActions({ ticket, userRole, userId, onTicketUpdated }: TicketActionsProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showResolutionForm, setShowResolutionForm] = useState(false);
    const [resolutionDescription, setResolutionDescription] = useState('');
    const [createKnowledgeArticle, setCreateKnowledgeArticle] = useState(false);

    // Check if user can perform actions
    const canPerformActions = userRole && [
        UserRole.IT_HELPDESK_ANALYST,
        UserRole.SECURITY_ANALYST,
        UserRole.TENANT_ADMIN
    ].includes(userRole);

    // Handle status change
    const handleStatusChange = async (newStatus: TicketStatus) => {
        try {
            setLoading(true);
            setError(null);

            const response = await api.put(`/api/tickets/${ticket.id}`, {
                status: newStatus,
            });

            if (!response.ok) {
                throw new Error('Failed to update ticket status');
            }

            const result = await response.json();
            if (result.success) {
                onTicketUpdated(result.data);
            } else {
                throw new Error(result.error?.message || 'Failed to update ticket status');
            }
        } catch (err) {
            console.error('Error updating ticket status:', err);
            setError(err instanceof Error ? err.message : 'Failed to update ticket status');
        } finally {
            setLoading(false);
        }
    };

    // Handle ticket resolution
    const handleResolveTicket = async () => {
        if (!resolutionDescription.trim()) {
            setError('Resolution description is required');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const response = await api.post(`/api/tickets/${ticket.id}/resolve`, {
                resolution: resolutionDescription.trim(),
                createKnowledgeArticle: createKnowledgeArticle,
                knowledgeArticleTitle: createKnowledgeArticle ? `Solution: ${ticket.title}` : undefined,
            });

            if (!response.ok) {
                throw new Error('Failed to resolve ticket');
            }

            const result = await response.json();
            if (result.success) {
                onTicketUpdated(result.data.ticket || result.data);
                setShowResolutionForm(false);
                setResolutionDescription('');
                setCreateKnowledgeArticle(false);
            } else {
                throw new Error(result.error?.message || 'Failed to resolve ticket');
            }
        } catch (err) {
            console.error('Error resolving ticket:', err);
            setError(err instanceof Error ? err.message : 'Failed to resolve ticket');
        } finally {
            setLoading(false);
        }
    };

    // Handle self-assignment
    const handleSelfAssign = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await api.post(`/api/tickets/${ticket.id}/assign`, {
                assignee: userId,
            });

            if (!response.ok) {
                throw new Error('Failed to assign ticket');
            }

            const result = await response.json();
            if (result.success) {
                onTicketUpdated(result.data);
            } else {
                throw new Error(result.error?.message || 'Failed to assign ticket');
            }
        } catch (err) {
            console.error('Error assigning ticket:', err);
            setError(err instanceof Error ? err.message : 'Failed to assign ticket');
        } finally {
            setLoading(false);
        }
    };

    // Get available actions based on current status
    const getAvailableActions = () => {
        if (!canPerformActions) return [];

        const actions = [];

        switch (ticket.status) {
            case TicketStatus.NEW:
                if (!ticket.assignee) {
                    actions.push({
                        label: 'Assign to Me',
                        action: handleSelfAssign,
                        icon: User,
                        color: 'bg-blue-600 hover:bg-blue-700',
                    });
                }
                actions.push({
                    label: 'Start Progress',
                    action: () => handleStatusChange(TicketStatus.IN_PROGRESS),
                    icon: Play,
                    color: 'bg-yellow-600 hover:bg-yellow-700',
                });
                break;

            case TicketStatus.IN_PROGRESS:
                actions.push(
                    {
                        label: 'Awaiting Response',
                        action: () => handleStatusChange(TicketStatus.AWAITING_RESPONSE),
                        icon: Clock,
                        color: 'bg-orange-600 hover:bg-orange-700',
                    },
                    {
                        label: 'Resolve',
                        action: () => setShowResolutionForm(true),
                        icon: CheckCircle,
                        color: 'bg-green-600 hover:bg-green-700',
                    }
                );
                break;

            case TicketStatus.AWAITING_RESPONSE:
                actions.push(
                    {
                        label: 'Resume Progress',
                        action: () => handleStatusChange(TicketStatus.IN_PROGRESS),
                        icon: Play,
                        color: 'bg-yellow-600 hover:bg-yellow-700',
                    },
                    {
                        label: 'Resolve',
                        action: () => setShowResolutionForm(true),
                        icon: CheckCircle,
                        color: 'bg-green-600 hover:bg-green-700',
                    }
                );
                break;

            case TicketStatus.RESOLVED:
                actions.push(
                    {
                        label: 'Close',
                        action: () => handleStatusChange(TicketStatus.CLOSED),
                        icon: XCircle,
                        color: 'bg-gray-600 hover:bg-gray-700',
                    },
                    {
                        label: 'Reopen',
                        action: () => handleStatusChange(TicketStatus.IN_PROGRESS),
                        icon: RotateCcw,
                        color: 'bg-yellow-600 hover:bg-yellow-700',
                    }
                );
                break;

            case TicketStatus.CLOSED:
                actions.push({
                    label: 'Reopen',
                    action: () => handleStatusChange(TicketStatus.IN_PROGRESS),
                    icon: RotateCcw,
                    color: 'bg-yellow-600 hover:bg-yellow-700',
                });
                break;
        }

        return actions;
    };

    const availableActions = getAvailableActions();

    if (!canPerformActions) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Actions
                </CardTitle>
            </CardHeader>
            <CardContent>
                {error && (
                    <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-md">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-400" />
                            <span className="text-red-300 text-sm">{error}</span>
                        </div>
                    </div>
                )}

                {/* Resolution Form */}
                {showResolutionForm && (
                    <div className="mb-6 p-4 bg-gray-800 border border-gray-600 rounded-lg">
                        <h4 className="font-medium text-gray-100 mb-3">Resolve Ticket</h4>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-200 mb-1">
                                    Resolution Description *
                                </label>
                                <Textarea
                                    value={resolutionDescription}
                                    onChange={(e) => setResolutionDescription(e.target.value)}
                                    placeholder="Describe how the issue was resolved..."
                                    rows={3}
                                    className="resize-none"
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={createKnowledgeArticle}
                                        onChange={(e) => setCreateKnowledgeArticle(e.target.checked)}
                                        className="rounded border-gray-300"
                                    />
                                    <span className="text-sm text-gray-200">
                                        Save this as a knowledge article
                                    </span>
                                </label>
                                <p className="text-xs text-gray-400 ml-6 mt-1">
                                    This will create a reusable solution for similar issues
                                </p>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button
                                    onClick={handleResolveTicket}
                                    disabled={loading || !resolutionDescription.trim()}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Resolve Ticket
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowResolutionForm(false);
                                        setResolutionDescription('');
                                        setCreateKnowledgeArticle(false);
                                        setError(null);
                                    }}
                                    disabled={loading}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Quick Actions */}
                {availableActions.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="font-medium text-gray-100 mb-3">Quick Actions</h4>
                        {availableActions.map((action, index) => {
                            const Icon = action.icon;
                            return (
                                <Button
                                    key={index}
                                    onClick={action.action}
                                    disabled={loading}
                                    className={`w-full justify-start text-white ${action.color}`}
                                >
                                    <Icon className="h-4 w-4 mr-2" />
                                    {action.label}
                                </Button>
                            );
                        })}
                    </div>
                )}

                {availableActions.length === 0 && !showResolutionForm && (
                    <div className="text-center py-4 text-gray-400">
                        <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No actions available</p>
                        <p className="text-xs mt-1">
                            Current status: {ticket.status.replace('_', ' ')}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}