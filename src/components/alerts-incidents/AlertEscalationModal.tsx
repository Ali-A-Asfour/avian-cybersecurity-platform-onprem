'use client';

import { useState } from 'react';
import { SecurityAlert, EscalateAlertInput } from '@/types/alerts-incidents';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SeverityBadge } from '@/components/ui/SeverityBadge';

interface AlertEscalationModalProps {
    alert: SecurityAlert;
    isOpen: boolean;
    onClose: () => void;
    onEscalate: (input: EscalateAlertInput) => Promise<void>;
}

/**
 * Alert Escalation Modal Component
 * 
 * Provides alert escalation form with:
 * - Optional incident title and description customization
 * - Alert context display
 * - Escalation to security incident creation
 * - Client-side validation to enforce investigation workflow
 * 
 * Requirements: 6.2, 6.3, 13.3, 13.6, 13.8
 */
export function AlertEscalationModal({
    alert,
    isOpen,
    onClose,
    onEscalate,
}: AlertEscalationModalProps) {
    const [incidentTitle, setIncidentTitle] = useState('');
    const [incidentDescription, setIncidentDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    /**
     * Check if escalation is allowed based on alert status
     * Requirements: 13.3, 13.6, 13.8
     */
    const canEscalate = (): boolean => {
        return alert.status === 'investigating';
    };

    /**
     * Get escalation validation message
     * Requirements: 13.4, 13.5, 13.6
     */
    const getEscalationValidationMessage = (): string | null => {
        if (alert.status === 'assigned') {
            return 'Investigation must be started before this alert can be escalated to a security incident.';
        }
        if (alert.status === 'open') {
            return 'Alert must be assigned and investigated before escalation.';
        }
        if (alert.status === 'escalated') {
            return 'This alert has already been escalated to a security incident.';
        }
        if (alert.status === 'closed_benign' || alert.status === 'closed_false_positive') {
            return 'This alert has already been resolved and cannot be escalated.';
        }
        return null;
    };

    /**
     * Generate default incident title based on alert
     */
    const getDefaultIncidentTitle = (): string => {
        const classification = alert.classification
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        return `Security Incident: ${classification} - ${alert.title}`;
    };

    /**
     * Generate default incident description based on alert
     */
    const getDefaultIncidentDescription = (): string => {
        const sourceSystem = formatSourceSystem(alert.sourceSystem);
        const detectedTime = new Date(alert.detectedAt).toLocaleString();

        let description = `This security incident was escalated from a ${alert.severity.toUpperCase()} severity alert detected by ${sourceSystem} on ${detectedTime}.\n\n`;

        if (alert.description) {
            description += `Alert Description: ${alert.description}\n\n`;
        }

        if (alert.defenderIncidentId) {
            description += `Microsoft Defender Incident ID: ${alert.defenderIncidentId}\n`;
        }

        if (alert.threatName) {
            description += `Threat Name: ${alert.threatName}\n`;
        }

        if (alert.affectedDevice) {
            description += `Affected Device: ${alert.affectedDevice}\n`;
        }

        if (alert.affectedUser) {
            description += `Affected User: ${alert.affectedUser}\n`;
        }

        description += `\nThis incident requires formal investigation and response according to security procedures.`;

        return description;
    };

    /**
     * Handle form submission with validation
     * Requirements: 13.3, 13.6, 13.8
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Client-side validation to prevent escalation before investigation
        if (!canEscalate()) {
            const validationMessage = getEscalationValidationMessage();
            alert(`Escalation blocked: ${validationMessage}`);
            return;
        }

        setIsSubmitting(true);

        try {
            const escalateInput: EscalateAlertInput = {
                alertId: alert.id,
                tenantId: alert.tenantId,
                incidentTitle: incidentTitle.trim() || getDefaultIncidentTitle(),
                incidentDescription: incidentDescription.trim() || getDefaultIncidentDescription(),
            };

            await onEscalate(escalateInput);

            // Reset form on success
            setIncidentTitle('');
            setIncidentDescription('');

        } catch (error) {
            // Error handling is done in parent component
            console.error('Escalation failed:', error);
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
        setIncidentTitle('');
        setIncidentDescription('');

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
                <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Escalate to Security Incident
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
                        {/* Workflow Validation Warning */}
                        {!canEscalate() && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                                <div className="flex items-start space-x-3">
                                    <div className="text-red-600 dark:text-red-400 mt-0.5">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
                                            Escalation Not Available
                                        </h4>
                                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                            {getEscalationValidationMessage()}
                                        </p>
                                        {alert.status === 'assigned' && (
                                            <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                                                <strong>Required workflow:</strong> Assigned → Investigate → (then escalation becomes available)
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Escalation Info - only show if escalation is allowed */}
                        {canEscalate() && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                                <div className="flex items-start space-x-3">
                                    <div className="text-yellow-600 dark:text-yellow-400 mt-0.5">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                            Escalating to Security Incident
                                        </h4>
                                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                            This alert will be converted to a formal security incident that requires investigation and resolution.
                                            You will maintain ownership of the incident and it will appear in your My Security Incidents queue.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Workflow Progress Indicator */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                                <div className="text-blue-600 dark:text-blue-400 mt-0.5">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                        Workflow Status
                                    </h4>
                                    <div className="mt-2">
                                        <div className="flex items-center space-x-4 text-sm">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                                <span className="text-gray-700 dark:text-gray-300">Assigned</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <div className={`w-3 h-3 rounded-full ${alert.status === 'investigating' || alert.status === 'escalated' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                                <span className="text-gray-700 dark:text-gray-300">Investigate</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <div className={`w-3 h-3 rounded-full ${alert.status === 'escalated' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                                <span className="text-gray-700 dark:text-gray-300">Escalate</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                                            Current status: <strong>{alert.status.charAt(0).toUpperCase() + alert.status.slice(1).replace('_', ' ')}</strong>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Incident Title */}
                        <div>
                            <label htmlFor="incidentTitle" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Incident Title (Optional)
                            </label>
                            <Input
                                id="incidentTitle"
                                type="text"
                                value={incidentTitle}
                                onChange={(e) => setIncidentTitle(e.target.value)}
                                placeholder={getDefaultIncidentTitle()}
                                className="w-full"
                                disabled={isSubmitting}
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Leave blank to use the default title based on the alert details
                            </p>
                        </div>

                        {/* Incident Description */}
                        <div>
                            <label htmlFor="incidentDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Incident Description (Optional)
                            </label>
                            <textarea
                                id="incidentDescription"
                                rows={6}
                                value={incidentDescription}
                                onChange={(e) => setIncidentDescription(e.target.value)}
                                placeholder={getDefaultIncidentDescription()}
                                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                                disabled={isSubmitting}
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Leave blank to use the default description with alert context and metadata
                            </p>
                        </div>

                        {/* Preview Section */}
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                                Incident Preview
                            </h4>
                            <div className="space-y-2">
                                <div>
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                        Title:
                                    </span>
                                    <p className="text-sm text-gray-900 dark:text-white">
                                        {incidentTitle.trim() || getDefaultIncidentTitle()}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                        Severity:
                                    </span>
                                    <div className="mt-1">
                                        <SeverityBadge
                                            severity={alert.severity as 'critical' | 'high' | 'medium' | 'low'}
                                            size="sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                        Owner:
                                    </span>
                                    <p className="text-sm text-gray-900 dark:text-white">
                                        You (ownership preserved from alert)
                                    </p>
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
                                disabled={isSubmitting || !canEscalate()}
                                className={`${canEscalate()
                                    ? 'bg-red-600 hover:bg-red-700 text-white'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    }`}
                                title={!canEscalate() ? getEscalationValidationMessage() || 'Escalation not available' : ''}
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Escalating...
                                    </>
                                ) : canEscalate() ? (
                                    'Escalate to Incident'
                                ) : (
                                    'Investigation Required'
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}