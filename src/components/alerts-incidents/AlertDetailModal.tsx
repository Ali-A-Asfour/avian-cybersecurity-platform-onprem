'use client';

import { useState } from 'react';
import { SecurityAlert } from '@/types/alerts-incidents';
import { Button } from '@/components/ui/Button';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PlaybookRecommendation } from './PlaybookRecommendation';

interface AlertDetailModalProps {
    alert: SecurityAlert;
    isOpen: boolean;
    onClose: () => void;
    onEscalateToIncident: (alertId: string) => Promise<void>;
    onResolveAsBenign: (alertId: string, notes: string) => Promise<void>;
    onResolveAsFalsePositive: (alertId: string, notes: string) => Promise<void>;
    demoMode?: boolean;
}

/**
 * Alert Detail Modal Component
 * 
 * Shows full alert details and provides 3 resolution actions:
 * - Escalate to Security Incident (creates ticket in My Tickets + general queue, removes from My Alerts)
 * - Resolve as Benign (requires analyst note, removes from My Alerts)
 * - Resolve as False Positive (requires analyst note, removes from My Alerts)
 * 
 * Requirements: 4.1, 6.1, 6.2, 6.4, 6.5
 */
export function AlertDetailModal({
    alert,
    isOpen,
    onClose,
    onEscalateToIncident,
    onResolveAsBenign,
    onResolveAsFalsePositive,
    demoMode = false,
}: AlertDetailModalProps) {
    const [selectedAction, setSelectedAction] = useState<'escalate' | 'benign' | 'false_positive' | null>(null);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<{
        action?: string;
        notes?: string;
    }>({});

    /**
     * Validate form inputs
     * Requirements: 6.1, 6.4, 6.5
     */
    const validateForm = (): boolean => {
        const newErrors: typeof errors = {};

        // Validate action selection (Requirements: 6.1)
        if (!selectedAction) {
            newErrors.action = 'Please select a resolution action';
        }

        // Validate mandatory notes for resolution actions (Requirements: 6.4, 6.5)
        if ((selectedAction === 'benign' || selectedAction === 'false_positive') && !notes.trim()) {
            newErrors.notes = 'Analyst notes are required when resolving an alert';
        } else if ((selectedAction === 'benign' || selectedAction === 'false_positive') && notes.trim().length < 10) {
            newErrors.notes = 'Please provide more detailed notes (minimum 10 characters)';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    /**
     * Handle form submission
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            switch (selectedAction) {
                case 'escalate':
                    await onEscalateToIncident(alert.id);
                    break;
                case 'benign':
                    await onResolveAsBenign(alert.id, notes.trim());
                    break;
                case 'false_positive':
                    await onResolveAsFalsePositive(alert.id, notes.trim());
                    break;
            }

            // Reset form on success
            setSelectedAction(null);
            setNotes('');
            setErrors({});
            onClose();

        } catch (error) {
            // Error handling is done in parent component
            console.error('Action failed:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Handle modal close
     */
    const handleClose = () => {
        if (isSubmitting) return;

        // Reset form state
        setSelectedAction(null);
        setNotes('');
        setErrors({});

        onClose();
    };

    /**
     * Format source system for display
     */
    const formatSourceSystem = (sourceSystem: string): string => {
        switch (sourceSystem.toLowerCase()) {
            case 'edr': return 'Microsoft Defender';
            case 'firewall': return 'SonicWall Firewall';
            case 'email': return 'Email Alert';
            default: return sourceSystem.toUpperCase();
        }
    };

    /**
     * Format classification for display
     */
    const formatClassification = (classification: string): string => {
        return classification
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    /**
     * Format time ago without external dependencies
     */
    const formatTimeAgo = (date: Date): string => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Alert Details & Resolution
                            </h2>
                            <button
                                onClick={handleClose}
                                disabled={isSubmitting}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Alert Details */}
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900">
                        <div className="space-y-4">
                            {/* Alert Header */}
                            <div className="flex items-center space-x-4">
                                <SeverityBadge
                                    severity={alert.severity as 'critical' | 'high' | 'medium' | 'low'}
                                    size="md"
                                />
                                <StatusBadge
                                    status={alert.status === 'assigned' ? 'in_progress' : 'new'}
                                    size="md"
                                />
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {formatSourceSystem(alert.sourceSystem)}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {formatClassification(alert.classification)}
                                </span>
                            </div>

                            {/* Alert Title and Description */}
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                    {alert.title}
                                </h3>
                                {alert.description && (
                                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                        {alert.description}
                                    </p>
                                )}
                            </div>

                            {/* Alert Metadata */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <span className="font-medium text-gray-500 dark:text-gray-400">Created:</span>
                                    <div className="text-gray-900 dark:text-white">
                                        {new Date(alert.createdAt).toLocaleDateString()}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {formatTimeAgo(new Date(alert.createdAt))}
                                    </div>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-500 dark:text-gray-400">Assigned:</span>
                                    <div className="text-gray-900 dark:text-white">
                                        {alert.assignedAt ? new Date(alert.assignedAt).toLocaleDateString() : 'N/A'}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {alert.assignedAt ? formatTimeAgo(new Date(alert.assignedAt)) : ''}
                                    </div>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-500 dark:text-gray-400">Alert ID:</span>
                                    <div className="text-gray-900 dark:text-white font-mono text-xs">
                                        {alert.id}
                                    </div>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-500 dark:text-gray-400">Assigned To:</span>
                                    <div className="text-gray-900 dark:text-white">
                                        You
                                    </div>
                                </div>
                            </div>

                            {/* Microsoft Defender context if available */}
                            {alert.defenderIncidentId && (
                                <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                                        Microsoft Defender Context
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div>
                                            <span className="font-medium text-blue-700 dark:text-blue-300">Incident ID:</span>
                                            <span className="ml-2 text-blue-900 dark:text-blue-100 font-mono">
                                                {alert.defenderIncidentId}
                                            </span>
                                        </div>
                                        {alert.defenderAlertId && (
                                            <div>
                                                <span className="font-medium text-blue-700 dark:text-blue-300">Alert ID:</span>
                                                <span className="ml-2 text-blue-900 dark:text-blue-100 font-mono">
                                                    {alert.defenderAlertId}
                                                </span>
                                            </div>
                                        )}
                                        <div>
                                            <a
                                                href={`https://security.microsoft.com/incidents/${alert.defenderIncidentId}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline"
                                            >
                                                View in Microsoft Defender
                                                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Playbook Recommendations */}
                    <div className="px-6 py-4">
                        <PlaybookRecommendation
                            classification={alert.classification}
                            demoMode={demoMode}
                            className="mb-4"
                        />
                    </div>

                    {/* Resolution Actions Form */}
                    <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                                Choose Resolution Action
                            </h3>

                            {/* Action Selection */}
                            <div className="space-y-4">
                                {/* Escalate to Security Incident */}
                                <label className="flex items-start space-x-3 cursor-pointer p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    <input
                                        type="radio"
                                        name="action"
                                        value="escalate"
                                        checked={selectedAction === 'escalate'}
                                        onChange={(e) => setSelectedAction(e.target.value as 'escalate')}
                                        className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 dark:border-gray-600"
                                        disabled={isSubmitting}
                                    />
                                    <div className="flex-1">
                                        <div className="text-base font-medium text-red-700 dark:text-red-300">
                                            Escalate to Security Incident
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            Creates a Security Incident ticket in My Tickets and the general ticket queue.
                                            Removes this alert from My Alerts. Use when the alert represents a genuine security threat
                                            that requires formal incident response procedures.
                                        </div>
                                        <div className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">
                                            → Creates ticket in My Tickets + General Queue
                                        </div>
                                    </div>
                                </label>

                                {/* Resolve as Benign */}
                                <label className="flex items-start space-x-3 cursor-pointer p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    <input
                                        type="radio"
                                        name="action"
                                        value="benign"
                                        checked={selectedAction === 'benign'}
                                        onChange={(e) => setSelectedAction(e.target.value as 'benign')}
                                        className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 dark:border-gray-600"
                                        disabled={isSubmitting}
                                    />
                                    <div className="flex-1">
                                        <div className="text-base font-medium text-green-700 dark:text-green-300">
                                            Resolve as Benign
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            The alert represents legitimate activity that does not require further action.
                                            Removes this alert from My Alerts. Requires analyst notes explaining the determination.
                                        </div>
                                        <div className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">
                                            → Removes from My Alerts (requires notes)
                                        </div>
                                    </div>
                                </label>

                                {/* Resolve as False Positive */}
                                <label className="flex items-start space-x-3 cursor-pointer p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    <input
                                        type="radio"
                                        name="action"
                                        value="false_positive"
                                        checked={selectedAction === 'false_positive'}
                                        onChange={(e) => setSelectedAction(e.target.value as 'false_positive')}
                                        className="mt-1 h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 dark:border-gray-600"
                                        disabled={isSubmitting}
                                    />
                                    <div className="flex-1">
                                        <div className="text-base font-medium text-yellow-700 dark:text-yellow-300">
                                            Resolve as False Positive
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            The alert was incorrectly triggered and does not represent a real security concern.
                                            Removes this alert from My Alerts. Requires analyst notes explaining why it's a false positive.
                                        </div>
                                        <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 font-medium">
                                            → Removes from My Alerts (requires notes)
                                        </div>
                                    </div>
                                </label>
                            </div>

                            {errors.action && (
                                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                                    {errors.action}
                                </p>
                            )}
                        </div>

                        {/* Analyst Notes - Required for resolution actions */}
                        {(selectedAction === 'benign' || selectedAction === 'false_positive') && (
                            <div>
                                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Analyst Notes <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    id="notes"
                                    rows={4}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder={`Provide detailed notes about your investigation findings and the reason for resolving this alert as ${selectedAction === 'benign' ? 'benign' : 'a false positive'}...`}
                                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                                    disabled={isSubmitting}
                                />
                                <div className="mt-1 flex justify-between">
                                    <div>
                                        {errors.notes && (
                                            <p className="text-sm text-red-600 dark:text-red-400">
                                                {errors.notes}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {notes.length} characters
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleClose}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting || !selectedAction}
                                className={`${selectedAction === 'escalate'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : selectedAction === 'benign'
                                            ? 'bg-green-600 hover:bg-green-700'
                                            : selectedAction === 'false_positive'
                                                ? 'bg-yellow-600 hover:bg-yellow-700'
                                                : 'bg-gray-600 hover:bg-gray-700'
                                    } text-white`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Processing...
                                    </>
                                ) : selectedAction === 'escalate' ? (
                                    'Escalate to Security Incident'
                                ) : selectedAction === 'benign' ? (
                                    'Resolve as Benign'
                                ) : selectedAction === 'false_positive' ? (
                                    'Resolve as False Positive'
                                ) : (
                                    'Select Action'
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}