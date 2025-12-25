'use client';

import { SecurityAlert } from '@/types/alerts-incidents';

interface WorkflowGuidanceProps {
    alert: SecurityAlert;
    className?: string;
}

/**
 * Workflow Guidance Component
 * 
 * Displays clear workflow progression for simplified alert processing.
 * Shows the streamlined sequence: Assigned → Investigate (creates security ticket)
 * 
 * Requirements: 13.3, 13.4, 13.5
 */
export function WorkflowGuidance({ alert, className }: WorkflowGuidanceProps) {
    /**
     * Get workflow step status
     */
    const getStepStatus = (step: 'assigned' | 'ticket_created'): 'completed' | 'current' | 'pending' => {
        switch (step) {
            case 'assigned':
                return alert.status === 'open' ? 'pending' : 'completed';
            case 'ticket_created':
                if (alert.status === 'escalated' || alert.status === 'investigating' ||
                    alert.status === 'closed_benign' || alert.status === 'closed_false_positive') {
                    return 'completed';
                }
                return alert.status === 'assigned' ? 'current' : 'pending';
            default:
                return 'pending';
        }
    };

    /**
     * Get step icon
     */
    const getStepIcon = (status: 'completed' | 'current' | 'pending') => {
        switch (status) {
            case 'completed':
                return (
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </div>
                );
            case 'current':
                return (
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    </div>
                );
            case 'pending':
                return (
                    <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full"></div>
                    </div>
                );
        }
    };

    /**
     * Get step description
     */
    const getStepDescription = (step: 'assigned' | 'ticket_created'): string => {
        switch (step) {
            case 'assigned':
                return 'Alert has been assigned to an analyst';
            case 'ticket_created':
                return 'Security ticket created - moved to Security Incidents tab for investigation';
        }
    };

    /**
     * Get current step message
     */
    const getCurrentStepMessage = (): string => {
        switch (alert.status) {
            case 'assigned':
                return 'Click "Investigate" to create a security ticket and move to Security Incidents tab';
            case 'investigating':
            case 'escalated':
                return 'Security ticket created - check Security Incidents tab for investigation and resolution';
            case 'closed_benign':
                return 'Alert resolved as benign activity';
            case 'closed_false_positive':
                return 'Alert resolved as false positive';
            default:
                return 'Alert is pending assignment';
        }
    };

    const assignedStatus = getStepStatus('assigned');
    const ticketCreatedStatus = getStepStatus('ticket_created');

    return (
        <div className={`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 ${className || ''}`}>
            <div className="flex items-start space-x-3">
                <div className="text-blue-600 dark:text-blue-400 mt-0.5">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                </div>
                <div className="flex-1">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-3">
                        Simplified Alert Workflow
                    </h4>

                    {/* Workflow Steps */}
                    <div className="space-y-4">
                        {/* Step 1: Assigned */}
                        <div className="flex items-center space-x-3">
                            {getStepIcon(assignedStatus)}
                            <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                        1. Assigned
                                    </span>
                                    {assignedStatus === 'completed' && (
                                        <span className="text-xs text-green-600 dark:text-green-400">✓</span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                    {getStepDescription('assigned')}
                                </p>
                            </div>
                        </div>

                        {/* Connector */}
                        <div className="ml-3 w-px h-4 bg-gray-300 dark:bg-gray-600"></div>

                        {/* Step 2: Create Security Ticket */}
                        <div className="flex items-center space-x-3">
                            {getStepIcon(ticketCreatedStatus)}
                            <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                        2. Create Security Ticket
                                    </span>
                                    {ticketCreatedStatus === 'completed' && (
                                        <span className="text-xs text-green-600 dark:text-green-400">✓</span>
                                    )}
                                    {ticketCreatedStatus === 'current' && (
                                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">← Click "Investigate"</span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                    {getStepDescription('ticket_created')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Current Status Message */}
                    <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
                        <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                            Current Status: {getCurrentStepMessage()}
                        </p>
                    </div>

                    {/* Workflow Notice */}
                    {alert.status === 'assigned' && (
                        <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                            <p className="text-xs text-green-800 dark:text-green-200">
                                <strong>Simplified Workflow:</strong> Click "Investigate" to automatically create a security ticket and move this alert to the Security Incidents tab where you can investigate, resolve, or escalate as needed.
                            </p>
                        </div>
                    )}

                    {/* Completion Notice */}
                    {(alert.status === 'escalated' || alert.status === 'investigating') && (
                        <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                            <p className="text-xs text-blue-800 dark:text-blue-200">
                                <strong>Security Ticket Created:</strong> This alert has been moved to the Security Incidents tab. All investigation, resolution, and escalation actions are now available there.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}