'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { SeverityLevel } from '@/lib/badge-colors';
import {
  Ticket,
  TicketComment,
  TicketAttachment,
  TicketStatus,
  TicketSeverity,
  TicketPriority
} from '@/types';
import { api } from '@/lib/api-client';

interface TicketDetailProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
  ticket: Ticket | null;
  isUserView?: boolean;
  fieldPermissions?: Record<string, { canEdit: boolean; reason?: string }>;
}

export function TicketDetail({ isOpen, onClose, onEdit, ticket, isUserView = false, fieldPermissions }: TicketDetailProps) {
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignEmail, setReassignEmail] = useState('');
  const [reassignReason, setReassignReason] = useState('');

  useEffect(() => {
    if (ticket?.id && isOpen) {
      fetchComments();
      fetchAttachments();
    } else if (!isOpen) {
      // Reset data when modal closes to prevent stale data
      setComments([]);
      setAttachments([]);
      setNewComment('');
      setError(null);
    }
  }, [ticket?.id, isOpen]); // Only depend on ticket ID, not the entire ticket object

  const fetchComments = async () => {
    if (!ticket || commentsLoading) return; // Prevent duplicate calls

    try {
      setCommentsLoading(true);
      const response = await api.get(`/api/tickets/${ticket.id}/comments`);
      const result = await response.json();

      if (result.success) {
        console.log('Comments fetched successfully:', result.data);
        setComments(result.data);
      } else {
        console.error('Failed to fetch comments:', result.error);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setCommentsLoading(false);
    }
  };

  const fetchAttachments = async () => {
    if (!ticket || attachmentsLoading) return; // Prevent duplicate calls

    try {
      setAttachmentsLoading(true);
      const response = await api.get(`/api/tickets/${ticket.id}/attachments`);
      const result = await response.json();

      if (result.success) {
        setAttachments(result.data);
      } else {
        console.error('Failed to fetch attachments:', result.error);
      }
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!ticket || !newComment.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const response = await api.post(`/api/tickets/${ticket.id}/comments`, {
        content: newComment.trim(),
        is_internal: isInternal,
      });

      const result = await response.json();

      if (result.success) {
        setComments(prev => [...prev, result.data]);
        setNewComment('');
        setIsInternal(false);
      } else {
        setError(result.error?.message || 'Failed to add comment');
      }
    } catch (error) {
      setError('Failed to add comment');
      console.error('Error adding comment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !ticket) return;

    try {
      setLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(`/api/tickets/${ticket.id}/attachments`, formData, true);

      const result = await response.json();

      if (result.success) {
        setAttachments(prev => [...prev, result.data]);
      } else {
        setError(result.error?.message || 'Failed to upload file');
      }
    } catch (error) {
      setError('Failed to upload file');
      console.error('Error uploading file:', error);
    } finally {
      setLoading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticket) return;

    try {
      setLoading(true);
      setError(null);

      const response = await api.put(`/api/tickets/${ticket.id}`, {
        status: newStatus,
      });

      const result = await response.json();

      if (result.success) {
        // Update the ticket in parent component
        window.location.reload(); // Simple refresh for now
      } else {
        setError(result.error?.message || 'Failed to update status');
      }
    } catch (error) {
      setError('Failed to update status');
      console.error('Error updating status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReassignTicket = () => {
    setReassignEmail(ticket?.assignee || '');
    setReassignReason('');
    setShowReassignModal(true);
  };

  const handleSubmitReassign = async () => {
    if (!ticket || !reassignEmail.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const response = await api.post(`/api/tickets/${ticket.id}/reassign`, {
        assignee: reassignEmail.trim(),
        reason: reassignReason.trim() || undefined,
      });

      const result = await response.json();

      if (result.success) {
        setShowReassignModal(false);
        window.location.reload(); // Simple refresh for now
      } else {
        setError(result.error?.message || 'Failed to reassign ticket');
      }
    } catch (error) {
      setError('Failed to reassign ticket');
      console.error('Error reassigning ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoAssign = async () => {
    if (!ticket) return;

    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/api/tickets/auto-assign', {
        ticket_id: ticket.id,
        severity: ticket.severity,
      });

      const result = await response.json();

      if (result.success) {
        if (result.data.assigned) {
          window.location.reload(); // Simple refresh for now
        } else {
          setError('No available analysts for auto-assignment');
        }
      } else {
        setError(result.error?.message || 'Failed to auto-assign ticket');
      }
    } catch (error) {
      setError('Failed to auto-assign ticket');
      console.error('Error auto-assigning ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    // Map TicketStatus enum to standard status types
    const mapStatus = (stat: TicketStatus): 'new' | 'open' | 'investigating' | 'in_progress' | 'awaiting_response' | 'escalated' | 'resolved' | 'closed' | 'canceled' => {
      switch (stat) {
        case TicketStatus.NEW: return 'new';
        case TicketStatus.IN_PROGRESS: return 'in_progress';
        case TicketStatus.AWAITING_RESPONSE: return 'awaiting_response';
        case TicketStatus.RESOLVED: return 'resolved';
        case TicketStatus.CLOSED: return 'closed';
        default: return 'new';
      }
    };

    return <StatusBadge status={mapStatus(status)} size="sm" />;
  };

  const getSeverityBadge = (severity: TicketSeverity) => {
    // Map TicketSeverity enum to standard severity levels
    const mapSeverity = (sev: TicketSeverity): SeverityLevel => {
      switch (sev) {
        case TicketSeverity.CRITICAL: return 'critical';
        case TicketSeverity.HIGH: return 'high';
        case TicketSeverity.MEDIUM: return 'medium';
        case TicketSeverity.LOW: return 'low';
        default: return 'info';
      }
    };

    return <SeverityBadge severity={mapSeverity(severity)} size="sm" />;
  };

  const getPriorityBadge = (priority: TicketPriority) => {
    // Map TicketPriority enum to standard severity levels for visual consistency
    const mapPriority = (prio: TicketPriority): SeverityLevel => {
      switch (prio) {
        case TicketPriority.URGENT: return 'critical'; // Map URGENT to critical for visual priority
        case TicketPriority.HIGH: return 'high';
        case TicketPriority.MEDIUM: return 'medium';
        case TicketPriority.LOW: return 'low';
        default: return 'info';
      }
    };

    return <SeverityBadge severity={mapPriority(priority)} size="sm" />;
  };

  const formatDate = (date: Date | string) => {
    if (!date) return 'Unknown Date';
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return 'Invalid Date';
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getQuickActions = () => {
    if (!ticket) return [];

    const actions = [];

    switch (ticket.status) {
      case TicketStatus.NEW:
        actions.push(
          { label: 'Start Progress', status: TicketStatus.IN_PROGRESS, color: 'bg-yellow-600 hover:bg-yellow-700' }
        );
        break;
      case TicketStatus.IN_PROGRESS:
        actions.push(
          { label: 'Awaiting Response', status: TicketStatus.AWAITING_RESPONSE, color: 'bg-orange-600 hover:bg-orange-700' },
          { label: 'Resolve', status: TicketStatus.RESOLVED, color: 'bg-green-600 hover:bg-green-700' }
        );
        break;
      case TicketStatus.AWAITING_RESPONSE:
        actions.push(
          { label: 'Resume Progress', status: TicketStatus.IN_PROGRESS, color: 'bg-yellow-600 hover:bg-yellow-700' },
          { label: 'Resolve', status: TicketStatus.RESOLVED, color: 'bg-green-600 hover:bg-green-700' }
        );
        break;
      case TicketStatus.RESOLVED:
        actions.push(
          { label: 'Close', status: TicketStatus.CLOSED, color: 'bg-gray-600 hover:bg-gray-700' },
          { label: 'Reopen', status: TicketStatus.IN_PROGRESS, color: 'bg-yellow-600 hover:bg-yellow-700' }
        );
        break;
    }

    return actions;
  };

  if (!ticket) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Ticket #${ticket.id.slice(0, 8)}`} size="xl">
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="text-red-800 dark:text-red-200 text-sm">{error}</div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                {ticket.title}
              </h2>
              {fieldPermissions && !fieldPermissions.title?.canEdit && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200">
                  Title: Creator Only
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4 text-sm text-neutral-600 dark:text-neutral-400">
              <span>Created: {formatDate(ticket.created_at)}</span>
              <span>Requester: {ticket.requester}</span>
              {ticket.assignee && <span>Assignee: {ticket.assignee}</span>}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {!isUserView && onEdit && (
              <Button variant="outline" onClick={onEdit}>
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* Status and Metadata */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Status
            </label>
            {getStatusBadge(ticket.status)}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Severity
            </label>
            {getSeverityBadge(ticket.severity)}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Priority
            </label>
            {getPriorityBadge(ticket.priority)}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Category
            </label>
            <span className="text-neutral-700 dark:text-neutral-300">
              {ticket.category.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        {!isUserView && getQuickActions().length > 0 && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Quick Actions
            </label>
            <div className="flex flex-wrap gap-2">
              {getQuickActions().map(action => (
                <Button
                  key={action.status}
                  size="sm"
                  className={`text-white ${action.color}`}
                  onClick={() => handleStatusChange(action.status)}
                  disabled={loading}
                >
                  {action.label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReassignTicket()}
                disabled={loading}
              >
                Reassign
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAutoAssign()}
                disabled={loading}
              >
                Auto Assign
              </Button>
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Description
            </label>
            {fieldPermissions && !fieldPermissions.description?.canEdit && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200">
                Creator Only
              </span>
            )}
          </div>
          <div className="bg-neutral-50 dark:bg-neutral-800 rounded-md p-4">
            <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
              {ticket.description}
            </p>
          </div>
        </div>

        {/* Tags */}
        {ticket.tags && ticket.tags.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {ticket.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Attachments */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Attachments ({attachments.length})
            </label>
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
              >
                Upload File
              </Button>
            </div>
          </div>
          {attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.map(attachment => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-md"
                >
                  <div className="flex items-center space-x-3">
                    <div className="text-neutral-700 dark:text-neutral-300">
                      <div className="font-medium">{attachment.original_filename}</div>
                      <div className="text-sm text-neutral-500 dark:text-neutral-400">
                        {formatFileSize(attachment.file_size)} • {formatDate(attachment.created_at)}
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Download
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-neutral-500 dark:text-neutral-400">
              No attachments
            </div>
          )}
        </div>

        {/* Comments */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Comments ({comments.length})
          </label>

          {/* Add Comment */}
          <div className="mb-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-md">
            <textarea
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 resize-vertical"
              rows={3}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
            />
            <div className="flex items-center justify-between mt-2">
              {!isUserView && (
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    Internal comment
                  </span>
                </label>
              )}
              <Button
                onClick={handleAddComment}
                disabled={loading || !newComment.trim()}
                size="sm"
                className={isUserView ? 'ml-auto' : ''}
              >
                Add Comment
              </Button>
            </div>
          </div>

          {/* Comments List */}
          {commentsLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-3">
              {comments.filter(comment => !isUserView || !comment.is_internal).map(comment => {
                console.log('Rendering comment:', comment);
                return (
                <div
                  key={comment.id}
                  className={`p-4 rounded-md ${comment.is_internal
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    : 'bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600'
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">
                        {comment.user_name || `User ${comment.user_id?.slice(0, 8) || 'Unknown'}`}
                      </span>
                      {comment.is_internal && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          Internal
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">
                      {formatDate(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
              )})}
            </div>
          ) : (
            <div className="text-center py-4 text-neutral-500 dark:text-neutral-400">
              No comments yet
            </div>
          )}
        </div>
      </div>

      {/* Reassign Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Reassign Ticket
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Assignee Email *
                </label>
                <Input
                  type="email"
                  value={reassignEmail}
                  onChange={(e) => setReassignEmail(e.target.value)}
                  placeholder="Enter assignee email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Reason (Optional)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 resize-vertical"
                  rows={3}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="Reason for reassignment..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowReassignModal(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitReassign}
                disabled={loading || !reassignEmail.trim()}
              >
                {loading ? 'Reassigning...' : 'Reassign'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}