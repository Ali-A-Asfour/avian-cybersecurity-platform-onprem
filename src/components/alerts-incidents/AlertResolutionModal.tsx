'use client';

import { useState } from 'react';
import { SecurityAlert, ResolveAlertInput } from '@/types/alerts-incidents';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SeverityBadge } from '@/components/ui/SeverityBadge';

interface AlertResolutionModalProps {
    alert: SecurityAlert;
    isOpen: boolean;
    onClose: () => void;
    onResolve: (input: ResolveAlertInput) => Promise<void>;
}

/**
 * Alert Resolution Modal Component
 * 
 * Provides alert resolution form with:
 * - Outcome validation (exactly one selection required)
 * - Mandatory analyst notes for both outcomes
 * - Alert context display
 * 
 * Requirements: 6.1, 6.4, 6.5
 */
export function AlertResolutionModal({
    alert,
    isOpen,
    onClose,
    onResolve,
}: AlertResolutionModalProps) {
    const [outcome, setOutcome] = useState<'benign' | 'false_positive' | ''>('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<{
        outcome?: string;
        notes?: string;
    }>({});

    /**
     * Validate form inputs
     * Requirements: 6.1, 6.4, 6.5
     */
    const validateForm = (): boolean => {
        const newErrors: typeof errors = {};

        // Validate outcome selection (Requirements: 6.1)
        if (!outcome) {
            newErrors.outcome = 'Please select an outcome';
        }

        // Validate mandatory notes (Requirements: 6.4, 6.5)
        if (!notes.trim()) {
            newErrors.notes = 'Analyst notes are required when resolving an alert';
        } else if (notes.trim().length < 10) {
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
            const resolveInput: ResolveAlertInput = {
                alertId: alert.id,
                tenantId: alert.tenantId,
                outcome: outcome as 'benign' | 'false_positive',
                notes: notes.trim(),
            };

            await onResolve(resolveInput);

            // Reset form on success
            setOutcome('');
            setNotes('');
            setErrors({});

        } catch (error) {
            // Error handling is done in parent component
            console.error('Resolution failed:', error);
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
        setOutcome('');
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
                <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Resolve Alert
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

                    {/* Alert Context */}
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900">
                        <div className="space-y-3">
                            <div className="flex items-center space-x-3">
                                <SeverityBadge
                                    severity={alert.severity as 'critical' | 'high' | 'medium' | 'low'}
                                    size="sm"
                                />
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {formatSourceSystem(alert.sourceSystem)}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {formatClassification(alert.classification)}
                                </span>
                            </div>

                            <div>
                                <h3 className="font-medium text-gray-900 dark:text-white">
                                    {alert.title}
                                </h3>
                                {alert.description && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        {alert.description}
                                    </p>
                                )}
                            </div>

                            {/* Microsoft Defender context if available */}
                            {alert.defenderIncidentId && (
                                <div className="text-xs text-blue-600 dark:text-blue-400">
                                    <a
                                        href={`https://security.microsoft.com/incidents/${alert.defenderIncidentId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline"
                                    >
                                        View in Microsoft Defender ↗
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
                        {/* Outcome Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Resolution Outcome <span className="text-red-500">*</span>
                            </label>
                            <div className="space-y-3">
                                <label className="flex items-start space-x-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="outcome"
                                        value="benign"
                                        checked={outcome === 'benign'}
                                        onChange={(e) => setOutcome(e.target.value as 'benign')}
                                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                        disabled={isSubmitting}
                                    />
                                    <div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            Resolve - Benign
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            The alert represents legitimate activity that does not require further action
                                        </div>
                                    </div>
                                </label>

                                <label className="flex items-start space-x-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="outcome"
                                        value="false_positive"
                                        checked={outcome === 'false_positive'}
                                        onChange={(e) => setOutcome(e.target.value as 'false_positive')}
                                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                        disabled={isSubmitting}
                                    />
                                    <div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            Resolve - False Positive
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            The alert was incorrectly triggered and does not represent a real security concern
                                        </div>
                                    </div>
                                </label>
                            </div>
                            {errors.outcome && (
                                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                                    {errors.outcome}
                                </p>
                            )}
                        </div>

                        {/* Analyst Notes */}
                        <div>
                            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Analyst Notes <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                id="notes"
                                rows={4}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Provide detailed notes about your investigation findings and the reason for this resolution..."
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
                                disabled={isSubmitting}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Resolving...
                                    </>
                                ) : (
                                    'Resolve Alert'
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}