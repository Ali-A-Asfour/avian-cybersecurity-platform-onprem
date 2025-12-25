/**
 * Incident Workflow Validation Middleware
 * 
 * Enforces the single Security Incident creation path:
 * Alert → Assigned → Investigate → Escalate → Security Incident
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10
 */

import { NextRequest } from 'next/server';
import { db } from '../lib/database';
import { securityAlerts } from '../../database/schemas/alerts-incidents';
import { eq, and } from 'drizzle-orm';
import { logger } from '../lib/logger';

export interface WorkflowValidationResult {
    success: boolean;
    error?: {
        code: string;
        message: string;
        details?: {
            currentStatus?: string;
            requiredStatus?: string;
            workflowStep?: string;
            nextAction?: string;
        };
    };
}

/**
 * Validates that alert escalation follows the required workflow path
 * Requirements: 13.3, 13.4, 13.5, 13.6, 13.8
 */
export async function validateEscalationWorkflow(
    alertId: string,
    tenantId: string,
    userId: string
): Promise<WorkflowValidationResult> {
    try {
        if (!db) {
            return {
                success: false,
                error: {
                    code: 'DATABASE_ERROR',
                    message: 'Database connection not available'
                }
            };
        }

        // Fetch the alert to validate its current state
        const alert = await db.select().from(securityAlerts).where(
            and(
                eq(securityAlerts.id, alertId),
                eq(securityAlerts.tenantId, tenantId)
            )
        ).limit(1);

        if (alert.length === 0) {
            return {
                success: false,
                error: {
                    code: 'ALERT_NOT_FOUND',
                    message: 'Alert not found or access denied'
                }
            };
        }

        const currentAlert = alert[0];

        // Validate ownership - alert must be assigned to the requesting user
        if (!currentAlert.assignedTo || currentAlert.assignedTo !== userId) {
            return {
                success: false,
                error: {
                    code: 'ESCALATION_DENIED',
                    message: 'Alert must be assigned to you before escalation',
                    details: {
                        currentStatus: currentAlert.status,
                        requiredStatus: 'investigating',
                        workflowStep: 'assignment_required',
                        nextAction: 'Assign the alert to yourself first'
                    }
                }
            };
        }

        // CRITICAL: Enforce investigation gateway validation
        // Requirements: 13.3, 13.4, 13.5, 13.6
        if (currentAlert.status !== 'investigating') {
            const errorDetails = getWorkflowErrorDetails(currentAlert.status);

            return {
                success: false,
                error: {
                    code: 'INVESTIGATION_REQUIRED',
                    message: errorDetails.message,
                    details: errorDetails.details
                }
            };
        }

        // If we reach here, the alert is in 'investigating' status and owned by the user
        return { success: true };

    } catch (error) {
        logger.error('Workflow validation failed', error instanceof Error ? error : new Error(String(error)), {
            alertId,
            tenantId,
            userId
        });

        return {
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Unable to validate escalation workflow'
            }
        };
    }
}

/**
 * Get detailed error information based on current alert status
 * Requirements: 13.4, 13.5, 13.6
 */
function getWorkflowErrorDetails(currentStatus: string): {
    message: string;
    details: {
        currentStatus: string;
        requiredStatus: string;
        workflowStep: string;
        nextAction: string;
    };
} {
    switch (currentStatus) {
        case 'open':
            return {
                message: 'Alert must be assigned and investigated before escalation. Current workflow step: Unassigned Alert',
                details: {
                    currentStatus: 'open',
                    requiredStatus: 'investigating',
                    workflowStep: 'assignment_required',
                    nextAction: 'Assign the alert to yourself, then click "Investigate" to begin investigation'
                }
            };

        case 'assigned':
            return {
                message: 'Alert must be investigated before escalation. Current workflow step: Assigned but Not Investigated',
                details: {
                    currentStatus: 'assigned',
                    requiredStatus: 'investigating',
                    workflowStep: 'investigation_required',
                    nextAction: 'Click "Investigate" to begin investigation before escalation becomes available'
                }
            };

        case 'escalated':
            return {
                message: 'Alert has already been escalated to a Security Incident',
                details: {
                    currentStatus: 'escalated',
                    requiredStatus: 'investigating',
                    workflowStep: 'already_escalated',
                    nextAction: 'Alert is already escalated - check My Security Incidents tab'
                }
            };

        case 'closed_benign':
        case 'closed_false_positive':
            return {
                message: 'Alert has already been resolved and cannot be escalated',
                details: {
                    currentStatus,
                    requiredStatus: 'investigating',
                    workflowStep: 'already_resolved',
                    nextAction: 'Alert is closed - escalation is no longer possible'
                }
            };

        default:
            return {
                message: 'Alert is not in a valid state for escalation. Investigation is required first.',
                details: {
                    currentStatus,
                    requiredStatus: 'investigating',
                    workflowStep: 'invalid_status',
                    nextAction: 'Ensure alert is assigned to you and investigation has been started'
                }
            };
    }
}

/**
 * Validates that no direct incident creation is attempted
 * Requirements: 13.1, 13.2, 13.7, 13.9
 */
export async function validateNoDirectIncidentCreation(
    request: NextRequest
): Promise<WorkflowValidationResult> {
    const url = new URL(request.url);
    const method = request.method;

    // Block any POST requests to incident creation endpoints
    if (method === 'POST' && url.pathname.includes('/api/alerts-incidents/incidents')) {
        // Allow only specific incident management endpoints (start-work, resolve, dismiss)
        const allowedPaths = [
            '/start-work',
            '/resolve',
            '/dismiss'
        ];

        const isAllowedPath = allowedPaths.some(path => url.pathname.includes(path));

        if (!isAllowedPath) {
            // Check for specific blocking reasons
            let errorCode = 'DIRECT_INCIDENT_CREATION_BLOCKED';
            let message = 'Security Incidents can only be created through alert escalation workflow';

            // Check for bulk operations
            if (url.pathname.includes('/bulk') ||
                url.pathname.includes('/batch') ||
                url.searchParams.has('bulk') ||
                url.searchParams.has('batch')) {
                errorCode = 'BULK_INCIDENT_CREATION_BLOCKED';
                message = 'Bulk incident creation is not allowed. Each incident must be created through individual alert escalation.';
            }
            // Check for global operations
            else if (url.pathname.includes('/global') ||
                url.pathname.includes('/admin') ||
                url.searchParams.has('global') ||
                url.searchParams.has('admin')) {
                errorCode = 'GLOBAL_INCIDENT_CREATION_BLOCKED';
                message = 'Global incident creation is not allowed. Incidents must be created through alert escalation workflow.';
            }

            logger.warn('Blocked direct incident creation attempt', {
                method,
                url: url.pathname,
                userAgent: request.headers.get('user-agent'),
                timestamp: new Date().toISOString()
            });

            return {
                success: false,
                error: {
                    code: errorCode,
                    message,
                    details: {
                        workflowStep: 'direct_creation_blocked',
                        nextAction: 'Navigate to My Alerts, investigate an alert, then escalate it to create a Security Incident'
                    }
                }
            };
        }
    }

    // Block any bulk incident creation attempts
    if (method === 'POST' && (
        url.pathname.includes('/bulk') ||
        url.pathname.includes('/batch') ||
        url.searchParams.has('bulk') ||
        url.searchParams.has('batch')
    ) && url.pathname.includes('incident')) {
        logger.warn('Blocked bulk incident creation attempt', {
            method,
            url: url.pathname,
            searchParams: url.searchParams.toString(),
            userAgent: request.headers.get('user-agent'),
            timestamp: new Date().toISOString()
        });

        return {
            success: false,
            error: {
                code: 'BULK_INCIDENT_CREATION_BLOCKED',
                message: 'Bulk incident creation is not allowed. Each incident must be created through individual alert escalation.',
                details: {
                    workflowStep: 'bulk_creation_blocked',
                    nextAction: 'Process alerts individually through the investigation workflow'
                }
            }
        };
    }

    // Block any global incident creation buttons or endpoints
    if (method === 'POST' && (
        url.pathname.includes('/global') ||
        url.pathname.includes('/admin') ||
        url.searchParams.has('global') ||
        url.searchParams.has('admin')
    ) && url.pathname.includes('incident')) {
        logger.warn('Blocked global incident creation attempt', {
            method,
            url: url.pathname,
            searchParams: url.searchParams.toString(),
            userAgent: request.headers.get('user-agent'),
            timestamp: new Date().toISOString()
        });

        return {
            success: false,
            error: {
                code: 'GLOBAL_INCIDENT_CREATION_BLOCKED',
                message: 'Global incident creation is not allowed. Incidents must be created through alert escalation workflow.',
                details: {
                    workflowStep: 'global_creation_blocked',
                    nextAction: 'Use the alert investigation workflow to create incidents'
                }
            }
        };
    }

    return { success: true };
}

/**
 * System-wide incident creation validation
 * Enforces that incidents can ONLY be created through alert escalation workflow
 * Requirements: 13.1, 13.2, 13.7, 13.9
 */
export async function validateSystemWideIncidentCreation(
    request: NextRequest
): Promise<WorkflowValidationResult> {
    const url = new URL(request.url);
    const method = request.method;

    // Block any attempt to create incidents outside the escalation workflow
    if (method === 'POST') {
        // Check for any incident creation patterns
        const incidentCreationPatterns = [
            '/incidents',
            '/incident',
            'create-incident',
            'new-incident',
            'add-incident'
        ];

        const isIncidentCreation = incidentCreationPatterns.some(pattern =>
            url.pathname.includes(pattern)
        );

        if (isIncidentCreation) {
            // Allow only the specific escalation endpoint
            if (url.pathname.includes('/alerts/') && url.pathname.includes('/escalate')) {
                // This is the authorized escalation endpoint - allow it
                return { success: true };
            }

            // Block all other incident creation attempts
            if (true) {
                logger.warn('Blocked unauthorized incident creation attempt', {
                    method,
                    url: url.pathname,
                    patterns: incidentCreationPatterns.filter(p => url.pathname.includes(p)),
                    userAgent: request.headers.get('user-agent'),
                    timestamp: new Date().toISOString()
                });

                return {
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED_INCIDENT_CREATION',
                        message: 'Incidents can only be created through the alert escalation workflow',
                        details: {
                            workflowStep: 'unauthorized_creation_blocked',
                            nextAction: 'Use /api/alerts-incidents/alerts/{id}/escalate endpoint after investigation'
                        }
                    }
                };
            }
        }
    }

    return { success: true };
}

/**
 * Comprehensive workflow validation for all incident-related operations
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10
 */
export async function validateIncidentWorkflow(
    request: NextRequest,
    alertId?: string,
    tenantId?: string,
    userId?: string
): Promise<WorkflowValidationResult> {
    // First, check for system-wide incident creation attempts
    const systemWideCheck = await validateSystemWideIncidentCreation(request);
    if (!systemWideCheck.success) {
        return systemWideCheck;
    }

    // Then, check for direct incident creation attempts
    const directCreationCheck = await validateNoDirectIncidentCreation(request);
    if (!directCreationCheck.success) {
        return directCreationCheck;
    }

    // If this is an escalation request, validate the workflow
    if (alertId && tenantId && userId && request.url.includes('/escalate')) {
        return validateEscalationWorkflow(alertId, tenantId, userId);
    }

    return { success: true };
}