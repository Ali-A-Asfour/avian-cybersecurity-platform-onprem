'use client';

import React, { useState } from 'react';
import { TicketComment, TicketAttachment, UserRole } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/textarea';
import {
    MessageSquare,
    User,
    Clock,
    Paperclip,
    Send,
    Eye,
    EyeOff,
    FileText,
    Download
} from 'lucide-react';
import { authenticatedFetch, api } from '@/lib/api-client';

interface TicketTimelineProps {
    ticketId: string;
    comments: TicketComment[];
    attachments: TicketAttachment[];
    userRole?: UserRole;
    onCommentAdded: (comment: TicketComment) => void;
}

interface TimelineItem {
    id: string;
    type: 'comment' | 'attachment' | 'system';
    timestamp: Date;
    author?: string;
    content?: string;
    isInternal?: boolean;
    attachment?: TicketAttachment;
    systemMessage?: string;
}

export function TicketTimeline({
    ticketId,
    comments,
    attachments,
    userRole,
    onCommentAdded
}: TicketTimelineProps) {
    const [newComment, setNewComment] = useState('');
    const [isInternal, setIsInternal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showInternalNotes, setShowInternalNotes] = useState(true);

    // Combine comments and attachments into a chronological timeline
    const timelineItems: TimelineItem[] = [
        ...comments.map(comment => ({
            id: comment.id,
            type: 'comment' as const,
            timestamp: new Date(comment.created_at),
            author: comment.user_id,
            content: comment.content,
            isInternal: comment.is_internal,
        })),
        ...attachments.map(attachment => ({
            id: attachment.id,
            type: 'attachment' as const,
            timestamp: new Date(attachment.created_at),
            author: attachment.uploaded_by,
            attachment,
        })),
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Filter timeline items based on user role and internal note visibility
    const filteredTimelineItems = timelineItems.filter(item => {
        // End users should not see internal notes
        if (userRole === UserRole.USER && item.isInternal) {
            return false;
        }

        // For analysts, respect the show/hide internal notes toggle
        if (item.isInternal && !showInternalNotes) {
            return false;
        }

        return true;
    });

    // Handle adding a new comment
    const handleAddComment = async () => {
        if (!newComment.trim()) return;

        try {
            setLoading(true);
            setError(null);

            const response = await api.post(`/api/tickets/${ticketId}/comments`, {
                content: newComment.trim(),
                is_internal: isInternal,
            });

            if (!response.ok) {
                throw new Error('Failed to add comment');
            }

            const result = await response.json();
            if (result.success) {
                onCommentAdded(result.data);
                setNewComment('');
                setIsInternal(false);
            } else {
                throw new Error(result.error?.message || 'Failed to add comment');
            }
        } catch (err) {
            console.error('Error adding comment:', err);
            setError(err instanceof Error ? err.message : 'Failed to add comment');
        } finally {
            setLoading(false);
        }
    };

    // Handle file upload
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            setError(null);

            const formData = new FormData();
            formData.append('file', file);

            const response = await authenticatedFetch(`/api/tickets/${ticketId}/attachments`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to upload file');
            }

            const result = await response.json();
            if (result.success) {
                // Refresh the page to show the new attachment
                window.location.reload();
            } else {
                throw new Error(result.error?.message || 'Failed to upload file');
            }
        } catch (err) {
            console.error('Error uploading file:', err);
            setError(err instanceof Error ? err.message : 'Failed to upload file');
        } finally {
            setLoading(false);
            // Reset file input
            event.target.value = '';
        }
    };

    // Format timestamp
    const formatTimestamp = (date: Date): string => {
        return new Date(date).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Format file size
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Get user display name
    const getUserDisplayName = (userId: string): string => {
        // In a real app, you'd look up the user name
        return `User ${userId.slice(0, 8)}`;
    };

    const canAddInternalNotes = userRole && [
        UserRole.IT_HELPDESK_ANALYST,
        UserRole.SECURITY_ANALYST,
        UserRole.TENANT_ADMIN
    ].includes(userRole);

    const canViewInternalNotes = userRole && [
        UserRole.IT_HELPDESK_ANALYST,
        UserRole.SECURITY_ANALYST,
        UserRole.TENANT_ADMIN
    ].includes(userRole);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Timeline ({filteredTimelineItems.length})
                    </CardTitle>
                    {canViewInternalNotes && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowInternalNotes(!showInternalNotes)}
                            className="flex items-center gap-2"
                        >
                            {showInternalNotes ? (
                                <>
                                    <EyeOff className="h-4 w-4" />
                                    Hide Internal
                                </>
                            ) : (
                                <>
                                    <Eye className="h-4 w-4" />
                                    Show Internal
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-center">
                            <span className="text-red-700">{error}</span>
                        </div>
                    </div>
                )}

                {/* Add Comment/Note Section */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-3">
                        <Textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Add a comment or update..."
                            rows={3}
                            className="resize-none"
                        />

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {canAddInternalNotes && (
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={isInternal}
                                            onChange={(e) => setIsInternal(e.target.checked)}
                                            className="rounded border-gray-300"
                                        />
                                        <span className="text-sm text-gray-600">
                                            Internal note (hidden from end users)
                                        </span>
                                    </label>
                                )}

                                <div>
                                    <input
                                        type="file"
                                        id="file-upload"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                        disabled={loading}
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => document.getElementById('file-upload')?.click()}
                                        disabled={loading}
                                        className="flex items-center gap-2"
                                    >
                                        <Paperclip className="h-4 w-4" />
                                        Attach File
                                    </Button>
                                </div>
                            </div>

                            <Button
                                onClick={handleAddComment}
                                disabled={loading || !newComment.trim()}
                                className="flex items-center gap-2"
                            >
                                <Send className="h-4 w-4" />
                                {isInternal ? 'Add Internal Note' : 'Add Comment'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Timeline Items */}
                <div className="space-y-4">
                    {filteredTimelineItems.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No timeline activity yet</p>
                            <p className="text-sm mt-1">Add a comment to start the conversation</p>
                        </div>
                    ) : (
                        filteredTimelineItems.map((item, index) => (
                            <div key={item.id} className="relative">
                                {/* Timeline connector line */}
                                {index < filteredTimelineItems.length - 1 && (
                                    <div className="absolute left-6 top-12 w-0.5 h-full bg-gray-200"></div>
                                )}

                                <div className="flex gap-4">
                                    {/* Avatar/Icon */}
                                    <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${item.type === 'comment'
                                        ? item.isInternal
                                            ? 'bg-blue-100 text-blue-600'
                                            : 'bg-gray-100 text-gray-600'
                                        : 'bg-green-100 text-green-600'
                                        }`}>
                                        {item.type === 'comment' ? (
                                            <MessageSquare className="h-5 w-5" />
                                        ) : (
                                            <Paperclip className="h-5 w-5" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className={`p-4 rounded-lg ${item.type === 'comment'
                                            ? item.isInternal
                                                ? 'bg-blue-50 border border-blue-200'
                                                : 'bg-white border border-gray-200'
                                            : 'bg-green-50 border border-green-200'
                                            }`}>
                                            {/* Header */}
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-900">
                                                        {getUserDisplayName(item.author || 'system')}
                                                    </span>
                                                    {item.isInternal && (
                                                        <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800">
                                                            Internal
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                                    <Clock className="h-4 w-4" />
                                                    {formatTimestamp(item.timestamp)}
                                                </div>
                                            </div>

                                            {/* Content */}
                                            {item.type === 'comment' && item.content && (
                                                <p className="text-gray-700 whitespace-pre-wrap">
                                                    {item.content}
                                                </p>
                                            )}

                                            {item.type === 'attachment' && item.attachment && (
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <FileText className="h-5 w-5 text-gray-400" />
                                                        <div>
                                                            <div className="font-medium text-gray-900">
                                                                {item.attachment.original_filename}
                                                            </div>
                                                            <div className="text-sm text-gray-500">
                                                                {formatFileSize(item.attachment.file_size)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button variant="outline" size="sm">
                                                        <Download className="h-4 w-4 mr-2" />
                                                        Download
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}