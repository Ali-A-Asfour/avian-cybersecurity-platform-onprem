/**
 * Incident Creation Validation Service
 * 
 * Provides comprehensive validation to ensure Security Incidents can ONLY
 * be created through the alert escalation workflow. This service enforces
 * the single controlled path for incident creation across all system integrations.
 * 
 * Requirements: 13.1, 13.2, 13.7, 13.9
 */

import { logger } from '../../lib/logger';

export interface IncidentCreationValidationResult {
    isAllowed: boolean;
    error?: {
        code: string;
        message: string;
        details: {
            workflowStep: string;
            nextAction: string;
            blockedReason: string;
        };
    };
}

export interface ValidationContext {
    source: 'api' | 'webhook' | 'integration' | 'bulk' | 'admin' | 'system';
    endpoint?: string;
    method?: string;
    userAgent?: string;
    userId?: string;
    tenantId?: string;
    alertId?: string; // Required for escalation
}

/**
 * Incident Creation Validation Service
 * 
 * Enforces that incidents can ONLY be created through alert escalation workflow
 */
export class IncidentCreationValidationService {

    /**
     * Validate incident creation attempt
     * Requirements: 13.1, 13.2, 13.7, 13.9
     */
    static validateIncidentCreation(context: ValidationContext): IncidentCreationValidationResult {
        // Log all incident creation attempts for audit
        logger.info('Incident creation validation requested', {
            source: context.source,
            endpoint: context.endpoint,
            method: context.method,
            userId: context.userId,
            tenantId: context.tenantId,
            alertId: context.alertId,
            timestamp: new Date().toISOString()
        });

        // RULE 1: Only allow escalation from alerts (Requirements: 13.1, 13.2)
        if (!context.alertId) {
            const error = this.createBlockedError(
                'NO_ALERT_CONTEXT',
                'Security Incidents can only be created by escalating an existing alert',
                'missing_alert_context',
                'Navigate to My Alerts, investigate an alert, then escalate it to create a Security Incident',
                'No alert ID provided for escalation'
            );

            logger.warn('Blocked incident creation - no alert context', {
                context,
                error
            });

            return { isAllowed: false, error };
        }

        // RULE 2: Block direct API creation (Requirements: 13.2, 13.7)
        if (context.source === 'api' && context.endpoint && !context.endpoint.includes('/escalate')) {
            const error = this.createBlockedError(
                'DIRECT_API_CREATION_BLOCKED',
                'Direct API incident creation is not allowed',
                'direct_api_blocked',
                'Use the alert escalation endpoint: /api/alerts-incidents/alerts/{id}/escalate',
                'Direct API creation attempted outside escalation workflow'
            );

            logger.warn('Blocked direct API incident creation', {
                context,
                error
            });

            return { isAllowed: false, error };
        }

        // RULE 3: Block webhook/integration creation (Requirements: 13.1, 13.9)
        if (context.source === 'webhook' || context.source === 'integration') {
            const error = this.createBlockedError(
                'EXTERNAL_CREATION_BLOCKED',
                'External systems cannot create incidents directly - must create alerts for analyst review',
                'external_creation_blocked',
                'External systems should create alerts that analysts can investigate and escalate',
                'External system attempted direct incident creation'
            );

            logger.warn('Blocked external incident creation', {
                context,
                error
            });

            return { isAllowed: false, error };
        }

        // RULE 4: Block bulk operations (Requirements: 13.2, 13.9)
        if (context.source === 'bulk') {
            const error = this.createBlockedError(
                'BULK_CREATION_BLOCKED',
                'Bulk incident creation is not allowed - each incident must be created through individual alert escalation',
                'bulk_creation_blocked',
                'Process alerts individually through the investigation workflow',
                'Bulk incident creation attempted'
            );

            logger.warn('Blocked bulk incident creation', {
                context,
                error
            });

            return { isAllowed: false, error };
        }

        // RULE 5: Block admin/system creation (Requirements: 13.1, 13.7)
        if (context.source === 'admin' || context.source === 'system') {
            const error = this.createBlockedError(
                'ADMIN_CREATION_BLOCKED',
                'Administrative incident creation is not allowed - must follow alert escalation workflow',
                'admin_creation_blocked',
                'Use the standard alert investigation and escalation workflow',
                'Administrative incident creation attempted'
            );

            logger.warn('Blocked administrative incident creation', {
                context,
                error
            });

            return { isAllowed: false, error };
        }

        // If we reach here, this is a valid escalation attempt
        logger.info('Incident creation validation passed', {
            context,
            result: 'allowed'
        });

        return { isAllowed: true };
    }

    /**
     * Validate that an endpoint is the authorized escalation endpoint
     * Requirements: 13.1, 13.2
     */
    static isAuthorizedEscalationEndpoint(endpoint: string): boolean {
        const authorizedPatterns = [
            '/api/alerts-incidents/alerts/',
            '/escalate'
        ];

        return authorizedPatterns.every(pattern => endpoint.includes(pattern));
    }

    /**
     * Create standardized blocked error response
     */
    private static createBlockedError(
        code: string,
        message: string,
        workflowStep: string,
        nextAction: string,
        blockedReason: string
    ) {
        return {
            code,
            message,
            details: {
                workflowStep,
                nextAction,
                blockedReason
            }
        };
    }

    /**
     * Log incident creation attempt for audit trail
     */
    static logIncidentCreationAttempt(
        context: ValidationContext,
        result: 'allowed' | 'blocked',
        error?: any
    ): void {
        const logData = {
            context,
            result,
            error,
            timestamp: new Date().toISOString(),
            auditType: 'incident_creation_attempt'
        };

        if (result === 'blocked') {
            logger.warn('Incident creation blocked', logData);
        } else {
            logger.info('Incident creation allowed', logData);
        }
    }
}