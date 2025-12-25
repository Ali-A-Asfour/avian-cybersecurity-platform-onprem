'use client';

import { useEffect, useState } from 'react';
import { Alert, TicketPriority } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SeverityBadge } from '@/components/ui/SeverityBadge';

interface IncidentEscalationModalProps {
  alert: Alert | null;
  isOpen: boolean;
  onClose: () => void;
  onEscalate: (alert: Alert, escalationData: EscalationData) => Promise<void>;
}

interface EscalationData {
  incident_title: string;
  incident_description?: string;
  assignee?: string;
  priority: TicketPriority;
}

/**
 * @deprecated This component is deprecated and should not be used.
 * Security incidents can only be created through the new alerts-incidents workflow.
 * Use the alerts-incidents module at /alerts-incidents instead.
 * Requirements: 13.1, 13.2, 13.7, 13.9
 */
export function IncidentEscalationModal({
  alert,
  isOpen,
  onClose,
  onEscalate
}: IncidentEscalationModalProps) {
  const [isEscalating, setIsEscalating] = useState(false);
  const [formData, setFormData] = useState<EscalationData>({
    incident_title: '',
    incident_description: '',
    assignee: '',
    priority: TicketPriority.HIGH,
  });

  // Reset form when modal opens with new alert
  useEffect(() => {
    if (alert && isOpen) {
      setFormData({
        incident_title: `Security Incident: ${alert.title}`,
        incident_description: `This incident was escalated from alert ${alert.id} due to its ${alert.severity} severity level.

**Original Alert Details:**
- Source: ${alert.source}
- Category: ${alert.category}
- Severity: ${alert.severity}
- Created: ${new Date(alert.created_at).toLocaleString()}

**Alert Description:**
${alert.description}

**Recommended Actions:**
1. Investigate the alert details and metadata
2. Assess the potential impact and scope
3. Implement containment measures if necessary
4. Document findings and response actions
5. Update incident status as investigation progresses`,
        assignee: '',
        priority: alert.severity === 'critical' ? TicketPriority.URGENT : TicketPriority.HIGH,
      });
    }
  }, [alert, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alert) return;

    // Block incident creation - redirect to new system
    alert('This incident creation method is no longer available. Please use the new Alerts & Security Incidents module at /alerts-incidents to manage security incidents through the proper workflow.');
    onClose();

    // Redirect to new system
    window.location.href = '/alerts-incidents';
  };

  const handleClose = () => {
    if (!isEscalating) {
      onClose();
    }
  };

  if (!alert) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Incident Creation Unavailable">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Deprecation Warning */}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Incident Creation Method Deprecated
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                <p>
                  This incident creation interface is no longer available. Security incidents can only be created through the new Alerts & Security Incidents workflow to ensure proper SOC standards and investigation integrity.
                </p>
                <p className="mt-2">
                  <strong>Please use the new system at:</strong> <code>/alerts-incidents</code>
                </p>
                <p className="mt-1">
                  <strong>Required workflow:</strong> Alert → Assign → Investigate → Escalate → Security Incident
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* Alert Summary */}
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Alert Being Escalated
          </h3>
          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
            <div><strong>Alert ID:</strong> {alert.id}</div>
            <div><strong>Title:</strong> {alert.title}</div>
            <div><strong>Source:</strong> {alert.source}</div>
            <div className="flex items-center space-x-2">
              <strong>Severity:</strong>
              <SeverityBadge
                severity={alert.severity as 'critical' | 'high' | 'medium' | 'low' | 'info'}
                size="sm"
              />
            </div>
            <div><strong>Category:</strong> {alert.category}</div>
          </div>
        </div>

        {/* Incident Details Form */}
        <div className="space-y-4">
          <div>
            <label htmlFor="incident_title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Incident Title *
            </label>
            <Input
              id="incident_title"
              type="text"
              value={formData.incident_title}
              onChange={(e) => setFormData(prev => ({ ...prev, incident_title: e.target.value }))}
              required
              placeholder="Enter incident title"
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority *
            </label>
            <select
              id="priority"
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as TicketPriority }))}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value={TicketPriority.URGENT}>Urgent</option>
              <option value={TicketPriority.HIGH}>High</option>
              <option value={TicketPriority.MEDIUM}>Medium</option>
              <option value={TicketPriority.LOW}>Low</option>
            </select>
          </div>

          <div>
            <label htmlFor="assignee" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Assign To (Optional)
            </label>
            <Input
              id="assignee"
              type="email"
              value={formData.assignee}
              onChange={(e) => setFormData(prev => ({ ...prev, assignee: e.target.value }))}
              placeholder="Enter assignee email"
              className="w-full"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Leave empty to assign later
            </p>
          </div>

          <div>
            <label htmlFor="incident_description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Additional Notes (Optional)
            </label>
            <textarea
              id="incident_description"
              value={formData.incident_description}
              onChange={(e) => setFormData(prev => ({ ...prev, incident_description: e.target.value }))}
              rows={6}
              placeholder="Add any additional context or notes for the incident"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
            />
          </div>
        </div>

        {/* Warning Notice */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Important Notice
              </h3>
              <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                <p>
                  Creating this incident will:
                </p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Generate a high-priority security ticket</li>
                  <li>Notify all tenant administrators via email</li>
                  <li>Mark the original alert as "investigating"</li>
                  <li>Create an audit trail linking the alert to the incident</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isEscalating}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isEscalating || !formData.incident_title.trim()}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Go to New System
          </Button>
        </div>
      </form>
    </Modal>
  );
}