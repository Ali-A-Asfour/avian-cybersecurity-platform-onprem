'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  Ticket,
  TicketStatus,
  TicketSeverity,
  TicketPriority,
  TicketCategory
} from '@/types';

interface TicketFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (ticket: Partial<Ticket>) => Promise<void>;
  ticket?: Ticket | null;
  mode: 'create' | 'edit';
  fieldPermissions?: Record<string, { canEdit: boolean; reason?: string }>;
  defaultCategory?: TicketCategory;
  allowedCategories?: TicketCategory[];
}

export function TicketForm({ isOpen, onClose, onSubmit, ticket, mode, fieldPermissions, defaultCategory, allowedCategories }: TicketFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: defaultCategory || TicketCategory.SECURITY_INCIDENT,
    severity: TicketSeverity.MEDIUM,
    priority: TicketPriority.MEDIUM,
    assignee: '',
    tags: [] as string[],
    status: TicketStatus.NEW,
  });
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to check if a field can be edited
  const canEditField = (fieldName: string): boolean => {
    if (mode === 'create') return true;
    return fieldPermissions?.[fieldName]?.canEdit ?? true;
  };

  // Helper function to get field disabled reason
  const getFieldDisabledReason = (fieldName: string): string | undefined => {
    if (mode === 'create') return undefined;
    return fieldPermissions?.[fieldName]?.reason;
  };

  useEffect(() => {
    if (ticket && mode === 'edit') {
      setFormData({
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
        severity: ticket.severity,
        priority: ticket.priority,
        assignee: ticket.assignee || '',
        tags: ticket.tags || [],
        status: ticket.status,
      });
    } else {
      // Reset form for create mode
      setFormData({
        title: '',
        description: '',
        category: TicketCategory.SECURITY_INCIDENT,
        severity: TicketSeverity.MEDIUM,
        priority: TicketPriority.MEDIUM,
        assignee: '',
        tags: [],
        status: TicketStatus.NEW,
      });
    }
    setTagInput('');
    setError(null);
  }, [ticket, mode, isOpen]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  const handleKeyPress = (_e: unknown) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async (_e: unknown) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.title.trim()) {
        throw new Error('Title is required');
      }
      if (!formData.description.trim()) {
        throw new Error('Description is required');
      }

      await onSubmit(formData);
      onClose();
    } catch {
      setError(err instanceof Error ? err.message : 'Failed to save ticket');
    } finally {
      setLoading(false);
    }
  };

  const allCategoryOptions = [
    // Security categories
    { value: TicketCategory.SECURITY_INCIDENT, label: 'Security Incident' },
    { value: TicketCategory.VULNERABILITY, label: 'Vulnerability' },
    { value: TicketCategory.MALWARE_DETECTION, label: 'Malware Detection' },
    { value: TicketCategory.PHISHING_ATTEMPT, label: 'Phishing Attempt' },
    { value: TicketCategory.DATA_BREACH, label: 'Data Breach' },
    { value: TicketCategory.POLICY_VIOLATION, label: 'Policy Violation' },
    { value: TicketCategory.COMPLIANCE, label: 'Compliance' },
    // IT Support categories
    { value: TicketCategory.IT_SUPPORT, label: 'IT Support' },
    { value: TicketCategory.HARDWARE_ISSUE, label: 'Hardware Issue' },
    { value: TicketCategory.SOFTWARE_ISSUE, label: 'Software Issue' },
    { value: TicketCategory.NETWORK_ISSUE, label: 'Network Issue' },
    { value: TicketCategory.ACCESS_REQUEST, label: 'Access Request' },
    { value: TicketCategory.ACCOUNT_SETUP, label: 'Account Setup' },
    // General categories
    { value: TicketCategory.GENERAL_REQUEST, label: 'General Request' },
    { value: TicketCategory.OTHER, label: 'Other' },
  ];

  const categoryOptions = allowedCategories
    ? allCategoryOptions.filter(option => allowedCategories.includes(option.value))
    : allCategoryOptions;

  const severityOptions = [
    { value: TicketSeverity.LOW, label: 'Low', color: 'text-green-600' },
    { value: TicketSeverity.MEDIUM, label: 'Medium', color: 'text-yellow-600' },
    { value: TicketSeverity.HIGH, label: 'High', color: 'text-orange-600' },
    { value: TicketSeverity.CRITICAL, label: 'Critical', color: 'text-red-600' },
  ];

  const priorityOptions = [
    { value: TicketPriority.LOW, label: 'Low' },
    { value: TicketPriority.MEDIUM, label: 'Medium' },
    { value: TicketPriority.HIGH, label: 'High' },
    { value: TicketPriority.URGENT, label: 'Urgent' },
  ];

  const statusOptions = [
    { value: TicketStatus.NEW, label: 'New' },
    { value: TicketStatus.IN_PROGRESS, label: 'In Progress' },
    { value: TicketStatus.AWAITING_RESPONSE, label: 'Awaiting Response' },
    { value: TicketStatus.RESOLVED, label: 'Resolved' },
    { value: TicketStatus.CLOSED, label: 'Closed' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mode === 'create' ? 'Create Ticket' : 'Edit Ticket'}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="text-red-800 dark:text-red-200 text-sm">{error}</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Title *
                {!canEditField('title') && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
                    (Read-only: {getFieldDisabledReason('title')})
                  </span>
                )}
              </label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Enter ticket title"
                required
                disabled={!canEditField('title')}
                className={!canEditField('title') ? 'bg-neutral-100 dark:bg-neutral-700 cursor-not-allowed' : ''}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Category *
                {!canEditField('category') && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
                    (Read-only)
                  </span>
                )}
              </label>
              <select
                className={`w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 ${!canEditField('category') ? 'bg-neutral-100 dark:bg-neutral-700 cursor-not-allowed' : ''
                  }`}
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                required
                disabled={!canEditField('category')}
              >
                {categoryOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Severity *
                {!canEditField('severity') && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
                    (Read-only)
                  </span>
                )}
              </label>
              <select
                className={`w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 ${!canEditField('severity') ? 'bg-neutral-100 dark:bg-neutral-700 cursor-not-allowed' : ''
                  }`}
                value={formData.severity}
                onChange={(e) => handleInputChange('severity', e.target.value)}
                required
                disabled={!canEditField('severity')}
              >
                {severityOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Priority *
                {!canEditField('priority') && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
                    (Read-only)
                  </span>
                )}
              </label>
              <select
                className={`w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 ${!canEditField('priority') ? 'bg-neutral-100 dark:bg-neutral-700 cursor-not-allowed' : ''
                  }`}
                value={formData.priority}
                onChange={(e) => handleInputChange('priority', e.target.value)}
                required
                disabled={!canEditField('priority')}
              >
                {priorityOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Assignee
                {!canEditField('assignee') && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
                    (Read-only)
                  </span>
                )}
              </label>
              <Input
                type="email"
                value={formData.assignee}
                onChange={(e) => handleInputChange('assignee', e.target.value)}
                placeholder="Enter assignee email"
                disabled={!canEditField('assignee')}
                className={!canEditField('assignee') ? 'bg-neutral-100 dark:bg-neutral-700 cursor-not-allowed' : ''}
              />
            </div>

            {mode === 'edit' && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Status
                  {!canEditField('status') && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
                      (Read-only)
                    </span>
                  )}
                </label>
                <select
                  className={`w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 ${!canEditField('status') ? 'bg-neutral-100 dark:bg-neutral-700 cursor-not-allowed' : ''
                    }`}
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  disabled={!canEditField('status')}
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Tags
                {!canEditField('tags') && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
                    (Read-only)
                  </span>
                )}
              </label>
              <div className="flex space-x-2 mb-2">
                <Input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Add tag"
                  disabled={!canEditField('tags')}
                  className={!canEditField('tags') ? 'bg-neutral-100 dark:bg-neutral-700 cursor-not-allowed' : ''}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddTag}
                  disabled={!tagInput.trim() || !canEditField('tags')}
                >
                  Add
                </Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200"
                    >
                      {tag}
                      {canEditField('tags') && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-200"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Description - Full Width */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Description *
            {!canEditField('description') && (
              <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
                (Read-only: {getFieldDisabledReason('description')})
              </span>
            )}
          </label>
          <textarea
            className={`w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 resize-vertical ${!canEditField('description') ? 'bg-neutral-100 dark:bg-neutral-700 cursor-not-allowed' : ''
              }`}
            rows={6}
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Describe the issue in detail..."
            required
            disabled={!canEditField('description')}
          />
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
          >
            {loading ? 'Saving...' : mode === 'create' ? 'Create Ticket' : 'Update Ticket'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}