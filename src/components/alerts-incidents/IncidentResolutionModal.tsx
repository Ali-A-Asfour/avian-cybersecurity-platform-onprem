'use client';

import { useState } from 'react';
import { SecurityIncident, ResolveIncidentInput } from '@/types/alerts-incidents';
import { Button } from '@/components/ui/Button';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface IncidentResolutionModalProps {
    incident: SecurityIncident;
    outcome: 'resolved' | 'dismissed';
    isOpen: boolean;
    onClose: () => void;
    onResolve: (input: ResolveIncidentInput) => Promise<void>;
}

/**
 * Incident Resolution Modal Component
 * 
 * Provides resolution form with summary/justification validation:
 * - "Resolved" requires summary
 * - "Dismissed" requires justification
 * - Displays incident details and SLA information
 * 
 * Requirements: 7.4, 7.5
 */
export function IncidentResolutionModal({
    incident,
    outcome,
    isOpen,
    onClose,
    onResolve,
}: IncidentResolutionModalProps) {
    const [summary, setSummary] = useState('');
    const [justification, setJustification] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Handle form submission
     * Requirements: 7.4, 7.5
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validate required fields based on outcome
        if (outcome === 'resolved') {
            if (!summary.trim()) {
                setError('Summary is required when resolving an incident');
                return;
            }
        } else if (outcome === 'dismissed') {
            if (!justification.trim()) {
                setError('Justification is required when dismissing an incident');
                return;
            }
        }

        setLoading(true);

        try {
            const input: ResolveIncidentInput = {
                incidentId: incident.id,
                tenantId: incident.tenantId,
                ownerId: incident.ownerId,
                outcome,
                summary: outcome === 'resolved' ? summary.trim() : undefined,
                justification: outcome === 'dismissed' ? justification.trim() : undefined,
            };

            await onResolve(input);

            // Reset form on success (modal will be closed by parent)
            setSummary('');
            setJustification('');
            setError(null);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handle modal close
     */
    const handleClose = () => {
        if (!loading) {
            setSummary('');
            setJustification('');
            setError(null);
            onClose();
        }
    };

    /**
     * Map severity to SeverityBadge format
     */
    const mapSeverityToBadge = (severity: string): 'critical' | 'high' | 'medium' | 'low' | 'info' => {
        switch (severity.toLowerCase()) {
            case 'critical': return 'critical';
            case 'high': return 'high';
            case 'medium': return 'medium';
            case 'low': return 'low';
            default: return 'info';
        }
    };

    /**
     * Map status to StatusBadge format
     */
    const mapStatusToBadge = (status: string): 'new' | 'open' | 'investigating' | 'in_progress' | 'awaiting_response' | 'escalated' | 'resolved' | 'closed' | 'canceled' => {
        switch (status.toLowerCase()) {
            case 'open': return 'open';
            case 'in_progress': return 'in_progress';
            case 'resolved': return 'resolved';
            case 'dismissed': return 'closed';
            default: return 'new';
        }
    };

    /**
     * Format date for display
     */
    const formatDate = (date: Date | string): string => {
        return new Date(date).toLocaleString();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                {/* Background overlay */}
                <div
                    className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                    onClick={handleClose}
                />

                {/* Modal panel */}
                <div className="relative inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full z-50">
                    {/* Header */}
                    <div className="bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                {outcome === 'resolved' ? 'Resolve Incident' : 'Dismiss Incident'}
                            </h3>
                            <button
                                onClick={handleClose}
                                disabled={loading}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="bg-white dark:bg-gray-800 px-6 py-4">
                        {/* Incident Details */}
                        <div className="mb-6">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                                Incident Details
                            </h4>
                            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Title:
                                    </span>
                                    <span className="text-sm text-gray-900 dark:text-white">
                                        {incident.title}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Severity:
                                    </span>
                                    <SeverityBadge
                                        severity={mapSeverityToBadge(incident.severity)}
                                        size="sm"
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Status:
                                    </span>
                                    <StatusBadge
                                        status={mapStatusToBadge(incident.status)}
                                        size="sm"
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Created:
                                    </span>
                                    <span className="text-sm text-gray-900 dark:text-white">
                                        {formatDate(incident.createdAt)}
                                    </span>
                                </div>

                                {incident.description && (
                                    <div>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                                            Description:
                                        </span>
                                        <p className="text-sm text-gray-900 dark:text-white">
                                            {incident.description}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Resolution Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {outcome === 'resolved' ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Resolution Summary *
                                    </label>
                                    <textarea
                                        value={summary}
                                        onChange={(e) => setSummary(e.target.value)}
                                        placeholder="Provide a detailed summary of how this incident was resolved..."
                                        rows={4}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    />
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Describe the actions taken, root cause identified, and resolution steps completed.
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Dismissal Justification *
                                    </label>
                                    <textarea
                                        value={justification}
                                        onChange={(e) => setJustification(e.target.value)}
                                        placeholder="Provide justification for why this incident is being dismissed..."
                                        rows={4}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    />
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Explain why this incident does not require further action (e.g., false positive, duplicate, out of scope).
                                    </p>
                                </div>
                            )}

                            {/* Error Message */}
                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                            </svg>
                                        </div>
                                        <div className="ml-3">
                                            <p className="text-sm text-red-800 dark:text-red-200">
                                                {error}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleClose}
                                    disabled={loading}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant={outcome === 'resolved' ? 'primary' : 'danger'}
                                    loading={loading}
                                    disabled={loading || (outcome === 'resolved' ? !summary.trim() : !justification.trim())}
                                >
                                    {outcome === 'resolved' ? 'Resolve Incident' : 'Dismiss Incident'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}