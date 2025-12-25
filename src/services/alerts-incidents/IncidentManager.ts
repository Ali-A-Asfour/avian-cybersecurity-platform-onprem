/**
 * Incident Manager Service for Alerts & Security Incidents Module
 * 
 * Manages the complete security incident lifecycle with:
 * - Ownership preservation from alerts
 * - Incident creation from alert escalation with multiple alert support
 * - SLA timer calculation based on severity levels
 * - "Start Work" button functionality for deterministic SLA tracking
 * - Resolution outcome validation (summary for resolved, justification for dismissed)
 * 
 * Requirements: 6.2, 6.3, 7.1, 7.2, 7.4, 7.5, 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { db } from '../../lib/database';
import {
    securityIncidents,
    securityAlerts,
    incidentAlertLinks
} from '../../../database/schemas/alerts-incidents';
import { eq, and, desc, gte, lte, inArray, sql } from 'drizzle-orm';
import { logger } from '../../lib/logger';
import {
    SecurityIncident,
    SecurityAlert,
    CreateSecurityIncidentInput,
    UpdateSecurityIncidentInput,
    IncidentFilters,
    EscalateAlertInput,
    StartWorkInput,
    ResolveIncidentInput,
    IncidentStatus,
    AlertSeverity,
    SLA_TIMERS,
    IncidentWithAlerts,
    IncidentQueueResponse,
} from '../../types/alerts-incidents';
import { AuditService } from './AuditService';
import { SLABreachService } from './SLABreachService';
import { OwnershipEnforcementService } from './OwnershipEnforcementService';
import { IncidentCreationValidationService } from './IncidentCreationValidationService';
import { IncidentAuditState, AlertAuditState, AuditContext } from '../../types/audit-logs';

/**
 * Incident Manager Class
 * 
 * Provides comprehensive incident management with ownership preservation,
 * SLA tracking, and resolution outcome validation.
 */
export class IncidentManager {

    // ========================================================================
    // Incident Creation from Alert Investigation and Escalation
    // ========================================================================

    /**
     * Start investigation on assigned alert and create security incident
     * This is the primary workflow: Alert (assigned) → Investigate → Security Incident
     * Requirements: 4.2, 6.2, 6.3, 7.2, 13.4, 13.5, 13.6
     */
    static async investigateAlert(input: EscalateAlertInput, context?: AuditContext): Promise<string> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // CRITICAL: Validate that this is the only allowed path for incident creation
            const validationResult = IncidentCreationValidationService.validateIncidentCreation({
                source: 'api',
                endpoint: '/api/alerts-incidents/alerts/{id}/investigate',
                method: 'POST',
                userId: context?.userId,
                tenantId: input.tenantId,
                alertId: input.alertId
            });

            if (!validationResult.isAllowed) {
                logger.error('Incident creation validation failed during investigation', {
                    input,
                    validationError: validationResult.error
                });
                throw new Error(validationResult.error?.message || 'Incident creation not allowed');
            }

            // Start transaction for atomic operation
            return await db.transaction(async (tx) => {
                // Fetch the alert to investigate
                // CRITICAL: Only allow investigation from 'assigned' status (Requirements: 13.4, 13.5, 13.6)
                const alert = await tx.select().from(securityAlerts).where(
                    and(
                        eq(securityAlerts.id, input.alertId),
                        eq(securityAlerts.tenantId, input.tenantId),
                        eq(securityAlerts.status, 'assigned') // ENFORCED: Only assigned status allowed
                    )
                ).limit(1);

                if (alert.length === 0) {
                    throw new Error('Alert not found or not in assigned status. Alert must be assigned before investigation.');
                }

                const sourceAlert = alert[0] as SecurityAlert;

                if (!sourceAlert.assignedTo) {
                    throw new Error('Alert must be assigned before investigation');
                }

                // Calculate SLA timers based on alert severity
                const slaTimers = this.calculateSLATimers(sourceAlert.severity);

                // Create incident with ownership preserved from alert
                const incidentInput: CreateSecurityIncidentInput = {
                    tenantId: input.tenantId,
                    ownerId: sourceAlert.assignedTo,
                    title: input.incidentTitle || `Security Incident: ${sourceAlert.title}`,
                    description: input.incidentDescription || sourceAlert.description || undefined,
                    severity: sourceAlert.severity,
                    slaAcknowledgeBy: slaTimers.acknowledgeBy,
                    slaInvestigateBy: slaTimers.investigateBy,
                    slaResolveBy: slaTimers.resolveBy,
                };

                const [incident] = await tx.insert(securityIncidents).values({
                    tenantId: incidentInput.tenantId,
                    ownerId: incidentInput.ownerId,
                    title: incidentInput.title,
                    description: incidentInput.description || null,
                    severity: incidentInput.severity,
                    status: 'open',
                    resolutionSummary: null,
                    dismissalJustification: null,
                    slaAcknowledgeBy: incidentInput.slaAcknowledgeBy,
                    slaInvestigateBy: incidentInput.slaInvestigateBy,
                    slaResolveBy: incidentInput.slaResolveBy,
                    acknowledgedAt: null,
                    investigationStartedAt: null,
                    resolvedAt: null,
                }).returning();

                // Link the alert to the incident as primary alert
                await tx.insert(incidentAlertLinks).values({
                    incidentId: incident.id,
                    alertId: input.alertId,
                    isPrimary: true,
                });

                // Update alert status to investigating (not escalated yet)
                await tx.update(securityAlerts)
                    .set({
                        status: 'investigating',
                        updatedAt: new Date(),
                    })
                    .where(eq(securityAlerts.id, input.alertId));

                // Log incident creation and alert investigation for audit trail
                const incidentState: IncidentAuditState = {
                    id: incident.id,
                    status: incident.status,
                    ownerId: incident.ownerId,
                    title: incident.title,
                    severity: incident.severity,
                    acknowledgedAt: incident.acknowledgedAt || undefined,
                    investigationStartedAt: incident.investigationStartedAt || undefined,
                    resolvedAt: incident.resolvedAt || undefined,
                    resolutionSummary: incident.resolutionSummary || undefined,
                    dismissalJustification: incident.dismissalJustification || undefined,
                    slaAcknowledgeBy: incident.slaAcknowledgeBy,
                    slaInvestigateBy: incident.slaInvestigateBy,
                    slaResolveBy: incident.slaResolveBy,
                };

                const previousAlertState: AlertAuditState = {
                    id: sourceAlert.id,
                    status: sourceAlert.status,
                    assignedTo: sourceAlert.assignedTo || undefined,
                    assignedAt: sourceAlert.assignedAt || undefined,
                    severity: sourceAlert.severity,
                    classification: sourceAlert.classification,
                    title: sourceAlert.title,
                    sourceSystem: sourceAlert.sourceSystem,
                    sourceId: sourceAlert.sourceId,
                    seenCount: sourceAlert.seenCount,
                    metadata: sourceAlert.metadata,
                };

                const newAlertState: AlertAuditState = {
                    ...previousAlertState,
                    status: 'investigating',
                };

                // Log incident creation
                await AuditService.logIncidentCreated(
                    input.tenantId,
                    sourceAlert.assignedTo,
                    incident.id,
                    incidentState,
                    input.alertId,
                    context
                );

                // Log alert investigation start
                await AuditService.logAlertEscalated(
                    input.tenantId,
                    sourceAlert.assignedTo,
                    input.alertId,
                    previousAlertState,
                    newAlertState,
                    incident.id,
                    context
                );

                // Track ownership preservation from alert to incident
                await OwnershipEnforcementService.trackOwnershipChange(
                    'incident',
                    incident.id,
                    input.tenantId,
                    null, // No previous owner for new incident
                    sourceAlert.assignedTo,
                    sourceAlert.assignedTo, // Owner creates incident
                    'Incident ownership preserved from investigated alert',
                    context
                );

                logger.info('Alert investigation started and security incident created', {
                    alertId: input.alertId,
                    incidentId: incident.id,
                    ownerId: sourceAlert.assignedTo,
                    tenantId: input.tenantId,
                    severity: sourceAlert.severity,
                });

                return incident.id;
            });
        } catch (error) {
            logger.error('Failed to start investigation and create incident', error instanceof Error ? error : new Error(String(error)), {
                alertId: input.alertId,
                tenantId: input.tenantId,
            });
            throw error;
        }
    }

    /**
     * Escalate alert to security incident with ownership preservation
     * Requirements: 6.2, 6.3, 7.2, 13.1, 13.2, 13.7, 13.9
     */
    static async escalateAlert(input: EscalateAlertInput, context?: AuditContext): Promise<string> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // CRITICAL: Validate that this is the only allowed path for incident creation
            const validationResult = IncidentCreationValidationService.validateIncidentCreation({
                source: 'api',
                endpoint: '/api/alerts-incidents/alerts/{id}/escalate',
                method: 'POST',
                userId: context?.userId,
                tenantId: input.tenantId,
                alertId: input.alertId
            });

            if (!validationResult.isAllowed) {
                logger.error('Incident creation validation failed during escalation', {
                    input,
                    validationError: validationResult.error
                });
                throw new Error(validationResult.error?.message || 'Incident creation not allowed');
            }

            // Start transaction for atomic operation
            return await db.transaction(async (tx) => {
                // Fetch the alert to escalate
                // CRITICAL: Only allow escalation from 'investigating' status (Requirements: 13.3, 13.4, 13.5, 13.6)
                const alert = await tx.select().from(securityAlerts).where(
                    and(
                        eq(securityAlerts.id, input.alertId),
                        eq(securityAlerts.tenantId, input.tenantId),
                        eq(securityAlerts.status, 'investigating') // ENFORCED: Only investigating status allowed
                    )
                ).limit(1);

                if (alert.length === 0) {
                    throw new Error('Alert not found or not in investigating status. Investigation must be completed before escalation.');
                }

                const sourceAlert = alert[0] as SecurityAlert;

                if (!sourceAlert.assignedTo) {
                    throw new Error('Alert must be assigned before escalation');
                }

                // Calculate SLA timers based on alert severity
                const slaTimers = this.calculateSLATimers(sourceAlert.severity);

                // Create incident with ownership preserved from alert
                const incidentInput: CreateSecurityIncidentInput = {
                    tenantId: input.tenantId,
                    ownerId: sourceAlert.assignedTo,
                    title: input.incidentTitle || `Security Incident: ${sourceAlert.title}`,
                    description: input.incidentDescription || sourceAlert.description || undefined,
                    severity: sourceAlert.severity,
                    slaAcknowledgeBy: slaTimers.acknowledgeBy,
                    slaInvestigateBy: slaTimers.investigateBy,
                    slaResolveBy: slaTimers.resolveBy,
                };

                const [incident] = await tx.insert(securityIncidents).values({
                    tenantId: incidentInput.tenantId,
                    ownerId: incidentInput.ownerId,
                    title: incidentInput.title,
                    description: incidentInput.description || null,
                    severity: incidentInput.severity,
                    status: 'open',
                    resolutionSummary: null,
                    dismissalJustification: null,
                    slaAcknowledgeBy: incidentInput.slaAcknowledgeBy,
                    slaInvestigateBy: incidentInput.slaInvestigateBy,
                    slaResolveBy: incidentInput.slaResolveBy,
                    acknowledgedAt: null,
                    investigationStartedAt: null,
                    resolvedAt: null,
                }).returning();

                // Link the alert to the incident as primary alert
                await tx.insert(incidentAlertLinks).values({
                    incidentId: incident.id,
                    alertId: input.alertId,
                    isPrimary: true,
                });

                // Update alert status to escalated
                await tx.update(securityAlerts)
                    .set({
                        status: 'escalated',
                        updatedAt: new Date(),
                    })
                    .where(eq(securityAlerts.id, input.alertId));

                // Log incident creation and alert escalation for audit trail
                const incidentState: IncidentAuditState = {
                    id: incident.id,
                    status: incident.status,
                    ownerId: incident.ownerId,
                    title: incident.title,
                    severity: incident.severity,
                    acknowledgedAt: incident.acknowledgedAt || undefined,
                    investigationStartedAt: incident.investigationStartedAt || undefined,
                    resolvedAt: incident.resolvedAt || undefined,
                    resolutionSummary: incident.resolutionSummary || undefined,
                    dismissalJustification: incident.dismissalJustification || undefined,
                    slaAcknowledgeBy: incident.slaAcknowledgeBy,
                    slaInvestigateBy: incident.slaInvestigateBy,
                    slaResolveBy: incident.slaResolveBy,
                };

                const previousAlertState: AlertAuditState = {
                    id: sourceAlert.id,
                    status: sourceAlert.status,
                    assignedTo: sourceAlert.assignedTo || undefined,
                    assignedAt: sourceAlert.assignedAt || undefined,
                    severity: sourceAlert.severity,
                    classification: sourceAlert.classification,
                    title: sourceAlert.title,
                    sourceSystem: sourceAlert.sourceSystem,
                    sourceId: sourceAlert.sourceId,
                    seenCount: sourceAlert.seenCount,
                    metadata: sourceAlert.metadata,
                };

                const newAlertState: AlertAuditState = {
                    ...previousAlertState,
                    status: 'escalated',
                };

                // Log incident creation
                await AuditService.logIncidentCreated(
                    input.tenantId,
                    sourceAlert.assignedTo,
                    incident.id,
                    incidentState,
                    input.alertId,
                    context
                );

                // Log alert escalation
                await AuditService.logAlertEscalated(
                    input.tenantId,
                    sourceAlert.assignedTo,
                    input.alertId,
                    previousAlertState,
                    newAlertState,
                    incident.id,
                    context
                );

                // Track ownership preservation from alert to incident
                await OwnershipEnforcementService.trackOwnershipChange(
                    'incident',
                    incident.id,
                    input.tenantId,
                    null, // No previous owner for new incident
                    sourceAlert.assignedTo,
                    sourceAlert.assignedTo, // Owner creates incident
                    'Incident ownership preserved from escalated alert',
                    context
                );

                logger.info('Alert escalated to security incident', {
                    alertId: input.alertId,
                    incidentId: incident.id,
                    ownerId: sourceAlert.assignedTo,
                    tenantId: input.tenantId,
                    severity: sourceAlert.severity,
                });

                return incident.id;
            });
        } catch (error) {
            logger.error('Failed to escalate alert to incident', error instanceof Error ? error : new Error(String(error)), {
                alertId: input.alertId,
                tenantId: input.tenantId,
            });
            throw error;
        }
    }

    /**
     * Add additional alert to existing incident
     * Requirements: 6.2, 6.3
     */
    static async addAlertToIncident(
        incidentId: string,
        alertId: string,
        tenantId: string,
        ownerId: string
    ): Promise<void> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            await db.transaction(async (tx) => {
                // Validate incident exists and is owned by user
                const incident = await tx.select().from(securityIncidents).where(
                    and(
                        eq(securityIncidents.id, incidentId),
                        eq(securityIncidents.tenantId, tenantId),
                        eq(securityIncidents.ownerId, ownerId),
                        inArray(securityIncidents.status, ['open', 'in_progress'])
                    )
                ).limit(1);

                if (incident.length === 0) {
                    throw new Error('Incident not found, not owned by user, or not in open/in_progress status');
                }

                // Validate alert exists and is assigned to same user
                const alert = await tx.select().from(securityAlerts).where(
                    and(
                        eq(securityAlerts.id, alertId),
                        eq(securityAlerts.tenantId, tenantId),
                        eq(securityAlerts.assignedTo, ownerId),
                        inArray(securityAlerts.status, ['assigned', 'investigating'])
                    )
                ).limit(1);

                if (alert.length === 0) {
                    throw new Error('Alert not found, not assigned to user, or not in assignable status');
                }

                // Check if alert is already linked to an incident
                const existingLink = await tx.select().from(incidentAlertLinks).where(
                    eq(incidentAlertLinks.alertId, alertId)
                ).limit(1);

                if (existingLink.length > 0) {
                    throw new Error('Alert is already linked to an incident');
                }

                // Link alert to incident as secondary alert
                await tx.insert(incidentAlertLinks).values({
                    incidentId,
                    alertId,
                    isPrimary: false,
                });

                // Update alert status to escalated
                await tx.update(securityAlerts)
                    .set({
                        status: 'escalated',
                        updatedAt: new Date(),
                    })
                    .where(eq(securityAlerts.id, alertId));

                logger.info('Alert added to existing incident', {
                    alertId,
                    incidentId,
                    ownerId,
                    tenantId,
                });
            });
        } catch (error) {
            logger.error('Failed to add alert to incident', error instanceof Error ? error : new Error(String(error)), {
                alertId,
                incidentId,
                tenantId,
                ownerId,
            });
            throw error;
        }
    }

    // ========================================================================
    // SLA Timer Management
    // ========================================================================

    /**
     * Calculate SLA timers based on severity level
     * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
     */
    private static calculateSLATimers(severity: AlertSeverity): {
        acknowledgeBy: Date;
        investigateBy: Date;
        resolveBy: Date;
    } {
        const now = new Date();
        const slaConfig = SLA_TIMERS[severity];

        return {
            acknowledgeBy: new Date(now.getTime() + slaConfig.acknowledgeMinutes * 60 * 1000),
            investigateBy: new Date(now.getTime() + slaConfig.investigateMinutes * 60 * 1000),
            resolveBy: new Date(now.getTime() + slaConfig.resolveMinutes * 60 * 1000),
        };
    }

    /**
     * Start work on incident (deterministic SLA tracking)
     * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
     */
    static async startWork(input: StartWorkInput, context?: AuditContext): Promise<void> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Validate ownership and start work permissions
            const ownershipValidation = await OwnershipEnforcementService.validateIncidentOwnership(
                input.incidentId,
                input.tenantId,
                input.ownerId,
                'start_work'
            );

            if (!ownershipValidation.isValid) {
                throw new Error(`Start work denied: ${ownershipValidation.reason}`);
            }

            // Get current incident state before update
            const incident = await db.select().from(securityIncidents).where(
                and(
                    eq(securityIncidents.id, input.incidentId),
                    eq(securityIncidents.tenantId, input.tenantId),
                    eq(securityIncidents.ownerId, input.ownerId),
                    inArray(securityIncidents.status, ['open', 'in_progress'])
                )
            ).limit(1);

            if (incident.length === 0) {
                throw new Error('Incident not found, not owned by user, or not in startable status');
            }

            const now = new Date();

            // Update incident with acknowledgment and investigation start times (first time only)
            const result = await db
                .update(securityIncidents)
                .set({
                    status: 'in_progress',
                    acknowledgedAt: sql`COALESCE(${securityIncidents.acknowledgedAt}, ${now})`,
                    investigationStartedAt: sql`COALESCE(${securityIncidents.investigationStartedAt}, ${now})`,
                    updatedAt: now,
                })
                .where(and(
                    eq(securityIncidents.id, input.incidentId),
                    eq(securityIncidents.tenantId, input.tenantId),
                    eq(securityIncidents.ownerId, input.ownerId),
                    inArray(securityIncidents.status, ['open', 'in_progress'])
                ))
                .returning();

            if (result.length === 0) {
                throw new Error('Incident update failed - incident may have been modified by another user');
            }

            // Log work started for audit trail
            const previousState: IncidentAuditState = {
                id: incident[0].id,
                status: incident[0].status,
                ownerId: incident[0].ownerId,
                title: incident[0].title,
                severity: incident[0].severity,
                acknowledgedAt: incident[0].acknowledgedAt || undefined,
                investigationStartedAt: incident[0].investigationStartedAt || undefined,
                resolvedAt: incident[0].resolvedAt || undefined,
                resolutionSummary: incident[0].resolutionSummary || undefined,
                dismissalJustification: incident[0].dismissalJustification || undefined,
                slaAcknowledgeBy: incident[0].slaAcknowledgeBy,
                slaInvestigateBy: incident[0].slaInvestigateBy,
                slaResolveBy: incident[0].slaResolveBy,
            };

            const newState: IncidentAuditState = {
                ...previousState,
                status: 'in_progress',
                acknowledgedAt: result[0].acknowledgedAt || undefined,
                investigationStartedAt: result[0].investigationStartedAt || undefined,
            };

            await AuditService.logIncidentWorkStarted(
                input.tenantId,
                input.ownerId,
                input.incidentId,
                previousState,
                newState,
                context
            );

            logger.info('Work started on incident', {
                incidentId: input.incidentId,
                ownerId: input.ownerId,
                tenantId: input.tenantId,
                acknowledgedAt: result[0].acknowledgedAt,
                investigationStartedAt: result[0].investigationStartedAt,
            });
        } catch (error) {
            logger.error('Failed to start work on incident', error instanceof Error ? error : new Error(String(error)), {
                incidentId: input.incidentId,
                ownerId: input.ownerId,
                tenantId: input.tenantId,
            });
            throw error;
        }
    }

    // ========================================================================
    // Incident Resolution
    // ========================================================================

    /**
     * Resolve incident with outcome validation
     * Requirements: 7.4, 7.5
     */
    static async resolveIncident(input: ResolveIncidentInput, context?: AuditContext): Promise<void> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Validate ownership and resolution permissions
            const ownershipValidation = await OwnershipEnforcementService.validateIncidentOwnership(
                input.incidentId,
                input.tenantId,
                input.ownerId,
                input.outcome === 'resolved' ? 'resolve' : 'dismiss'
            );

            if (!ownershipValidation.isValid) {
                throw new Error(`Resolution denied: ${ownershipValidation.reason}`);
            }

            // Validate resolution input based on outcome
            if (input.outcome === 'resolved') {
                if (!input.summary || input.summary.trim().length === 0) {
                    throw new Error('Summary is required when resolving an incident');
                }
                if (input.justification) {
                    throw new Error('Justification should not be provided when resolving an incident');
                }
            } else if (input.outcome === 'dismissed') {
                if (!input.justification || input.justification.trim().length === 0) {
                    throw new Error('Justification is required when dismissing an incident');
                }
                if (input.summary) {
                    throw new Error('Summary should not be provided when dismissing an incident');
                }
            } else {
                throw new Error('Invalid outcome. Must be "resolved" or "dismissed"');
            }

            // Get current incident state before update
            const incident = await db.select().from(securityIncidents).where(
                and(
                    eq(securityIncidents.id, input.incidentId),
                    eq(securityIncidents.tenantId, input.tenantId),
                    eq(securityIncidents.ownerId, input.ownerId),
                    inArray(securityIncidents.status, ['open', 'in_progress'])
                )
            ).limit(1);

            if (incident.length === 0) {
                throw new Error('Incident not found, not owned by user, or not in resolvable status');
            }

            const now = new Date();
            const status: IncidentStatus = input.outcome;

            // Update incident with resolution
            const result = await db
                .update(securityIncidents)
                .set({
                    status,
                    resolutionSummary: input.summary || null,
                    dismissalJustification: input.justification || null,
                    resolvedAt: now,
                    updatedAt: now,
                })
                .where(and(
                    eq(securityIncidents.id, input.incidentId),
                    eq(securityIncidents.tenantId, input.tenantId),
                    eq(securityIncidents.ownerId, input.ownerId),
                    inArray(securityIncidents.status, ['open', 'in_progress'])
                ))
                .returning();

            if (result.length === 0) {
                throw new Error('Incident resolution failed - incident may have been modified by another user');
            }

            // Log incident resolution for audit trail
            const previousState: IncidentAuditState = {
                id: incident[0].id,
                status: incident[0].status,
                ownerId: incident[0].ownerId,
                title: incident[0].title,
                severity: incident[0].severity,
                acknowledgedAt: incident[0].acknowledgedAt || undefined,
                investigationStartedAt: incident[0].investigationStartedAt || undefined,
                resolvedAt: incident[0].resolvedAt || undefined,
                resolutionSummary: incident[0].resolutionSummary || undefined,
                dismissalJustification: incident[0].dismissalJustification || undefined,
                slaAcknowledgeBy: incident[0].slaAcknowledgeBy,
                slaInvestigateBy: incident[0].slaInvestigateBy,
                slaResolveBy: incident[0].slaResolveBy,
            };

            const newState: IncidentAuditState = {
                ...previousState,
                status,
                resolutionSummary: input.summary || undefined,
                dismissalJustification: input.justification || undefined,
                resolvedAt: now,
            };

            if (input.outcome === 'resolved') {
                await AuditService.logIncidentResolved(
                    input.tenantId,
                    input.ownerId,
                    input.incidentId,
                    previousState,
                    newState,
                    input.summary!,
                    context
                );
            } else {
                await AuditService.logIncidentDismissed(
                    input.tenantId,
                    input.ownerId,
                    input.incidentId,
                    previousState,
                    newState,
                    input.justification!,
                    context
                );
            }

            logger.info('Incident resolved', {
                incidentId: input.incidentId,
                outcome: input.outcome,
                ownerId: input.ownerId,
                tenantId: input.tenantId,
                resolvedAt: now,
            });
        } catch (error) {
            logger.error('Failed to resolve incident', error instanceof Error ? error : new Error(String(error)), {
                incidentId: input.incidentId,
                outcome: input.outcome,
                ownerId: input.ownerId,
                tenantId: input.tenantId,
            });
            throw error;
        }
    }

    // ========================================================================
    // Incident Querying
    // ========================================================================

    /**
     * Get incidents with tenant-scoped filtering
     * Requirements: 7.1, 8.1
     */
    static async getIncidents(filters: IncidentFilters): Promise<SecurityIncident[]> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            const conditions = [eq(securityIncidents.tenantId, filters.tenantId)];

            // Filter by owner (for My Incidents)
            if (filters.ownerId) {
                conditions.push(eq(securityIncidents.ownerId, filters.ownerId));
            }

            // Filter by status
            if (filters.status) {
                if (Array.isArray(filters.status)) {
                    conditions.push(inArray(securityIncidents.status, filters.status));
                } else {
                    conditions.push(eq(securityIncidents.status, filters.status));
                }
            }

            // Filter by severity
            if (filters.severity) {
                if (Array.isArray(filters.severity)) {
                    conditions.push(inArray(securityIncidents.severity, filters.severity));
                } else {
                    conditions.push(eq(securityIncidents.severity, filters.severity));
                }
            }

            // Filter by date range
            if (filters.startDate) {
                conditions.push(gte(securityIncidents.createdAt, filters.startDate));
            }
            if (filters.endDate) {
                conditions.push(lte(securityIncidents.createdAt, filters.endDate));
            }

            // Build query with ordering (newest first)
            const query = db
                .select()
                .from(securityIncidents)
                .where(and(...conditions))
                .orderBy(desc(securityIncidents.createdAt));

            // Apply pagination if specified
            if (filters.limit && filters.offset) {
                const incidents = await query.limit(filters.limit).offset(filters.offset);
                return incidents as SecurityIncident[];
            } else if (filters.limit) {
                const incidents = await query.limit(filters.limit);
                return incidents as SecurityIncident[];
            } else if (filters.offset) {
                const incidents = await query.offset(filters.offset);
                return incidents as SecurityIncident[];
            } else {
                const incidents = await query;
                return incidents as SecurityIncident[];
            }
        } catch (error) {
            logger.error('Failed to get incidents', error instanceof Error ? error : new Error(String(error)), {
                tenantId: filters.tenantId,
                ownerId: filters.ownerId,
            });
            throw error;
        }
    }

    /**
     * Get incidents owned by user (My Security Incidents tab)
     * Requirements: 7.1
     */
    static async getMyIncidents(
        tenantId: string,
        ownerId: string,
        limit?: number,
        offset?: number
    ): Promise<SecurityIncident[]> {
        return this.getIncidents({
            tenantId,
            ownerId,
            limit,
            offset,
        });
    }

    /**
     * Get all incidents for visibility (All Security Incidents tab - read-only)
     * Requirements: 8.1, 8.2, 8.4
     */
    static async getAllIncidents(
        tenantId: string,
        limit?: number,
        offset?: number
    ): Promise<SecurityIncident[]> {
        return this.getIncidents({
            tenantId,
            limit,
            offset,
        });
    }

    /**
     * Get incident with linked alerts
     * Requirements: 7.1, 7.2
     */
    static async getIncidentWithAlerts(
        incidentId: string,
        tenantId: string,
        ownerId?: string // Optional for read-only access
    ): Promise<IncidentWithAlerts | null> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Build incident query conditions
            const incidentConditions = [
                eq(securityIncidents.id, incidentId),
                eq(securityIncidents.tenantId, tenantId),
            ];

            // Add ownership filter if specified (for My Incidents)
            if (ownerId) {
                incidentConditions.push(eq(securityIncidents.ownerId, ownerId));
            }

            // Fetch incident
            const incident = await db.select().from(securityIncidents).where(
                and(...incidentConditions)
            ).limit(1);

            if (incident.length === 0) {
                return null;
            }

            // Fetch linked alerts
            const alertLinks = await db
                .select({
                    alert: securityAlerts,
                    isPrimary: incidentAlertLinks.isPrimary,
                })
                .from(incidentAlertLinks)
                .innerJoin(securityAlerts, eq(incidentAlertLinks.alertId, securityAlerts.id))
                .where(eq(incidentAlertLinks.incidentId, incidentId))
                .orderBy(desc(incidentAlertLinks.isPrimary), securityAlerts.createdAt);

            const alerts = alertLinks.map(link => link.alert as SecurityAlert);
            const primaryAlert = alertLinks.find(link => link.isPrimary)?.alert as SecurityAlert || null;

            return {
                incident: incident[0] as SecurityIncident,
                alerts,
                primaryAlert,
            };
        } catch (error) {
            logger.error('Failed to get incident with alerts', error instanceof Error ? error : new Error(String(error)), {
                incidentId,
                tenantId,
                ownerId,
            });
            throw error;
        }
    }

    /**
     * Get incident queue summary
     * Requirements: 7.1, 8.1
     */
    static async getIncidentQueueSummary(
        tenantId: string,
        ownerId?: string // Optional for My Incidents vs All Incidents
    ): Promise<IncidentQueueResponse> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            const conditions = [eq(securityIncidents.tenantId, tenantId)];

            if (ownerId) {
                conditions.push(eq(securityIncidents.ownerId, ownerId));
            }

            // Get incidents with counts
            const incidents = await this.getIncidents({
                tenantId,
                ownerId,
                limit: 50, // Default limit for queue display
            });

            // Get status counts
            const statusCounts = await db
                .select({
                    status: securityIncidents.status,
                    count: sql<number>`count(*)`,
                })
                .from(securityIncidents)
                .where(and(...conditions))
                .groupBy(securityIncidents.status);

            const openCount = statusCounts.find(s => s.status === 'open')?.count || 0;
            const inProgressCount = statusCounts.find(s => s.status === 'in_progress')?.count || 0;
            const total = statusCounts.reduce((sum, s) => sum + s.count, 0);

            return {
                incidents,
                total,
                openCount,
                inProgressCount,
            };
        } catch (error) {
            logger.error('Failed to get incident queue summary', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                ownerId,
            });
            throw error;
        }
    }

    // ========================================================================
    // SLA Monitoring
    // ========================================================================

    /**
     * Check for SLA breaches
     * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
     */
    static async checkSLABreaches(tenantId: string): Promise<{
        acknowledgeBreaches: SecurityIncident[];
        investigateBreaches: SecurityIncident[];
        resolveBreaches: SecurityIncident[];
    }> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            const now = new Date();

            // Find acknowledge SLA breaches (open incidents past acknowledge deadline)
            const acknowledgeBreaches = await db
                .select()
                .from(securityIncidents)
                .where(and(
                    eq(securityIncidents.tenantId, tenantId),
                    eq(securityIncidents.status, 'open'),
                    lte(securityIncidents.slaAcknowledgeBy, now)
                ));

            // Find investigate SLA breaches (in_progress incidents past investigate deadline)
            const investigateBreaches = await db
                .select()
                .from(securityIncidents)
                .where(and(
                    eq(securityIncidents.tenantId, tenantId),
                    eq(securityIncidents.status, 'in_progress'),
                    lte(securityIncidents.slaInvestigateBy, now)
                ));

            // Find resolve SLA breaches (open/in_progress incidents past resolve deadline)
            const resolveBreaches = await db
                .select()
                .from(securityIncidents)
                .where(and(
                    eq(securityIncidents.tenantId, tenantId),
                    inArray(securityIncidents.status, ['open', 'in_progress']),
                    lte(securityIncidents.slaResolveBy, now)
                ));

            return {
                acknowledgeBreaches: acknowledgeBreaches as SecurityIncident[],
                investigateBreaches: investigateBreaches as SecurityIncident[],
                resolveBreaches: resolveBreaches as SecurityIncident[],
            };
        } catch (error) {
            logger.error('Failed to check SLA breaches', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
            });
            throw error;
        }
    }

    /**
     * Get incidents approaching SLA deadlines
     * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
     */
    static async getIncidentsApproachingSLA(
        tenantId: string,
        warningMinutes: number = 30
    ): Promise<{
        acknowledgeWarnings: SecurityIncident[];
        investigateWarnings: SecurityIncident[];
        resolveWarnings: SecurityIncident[];
    }> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            const now = new Date();
            const warningTime = new Date(now.getTime() + warningMinutes * 60 * 1000);

            // Find incidents approaching acknowledge deadline
            const acknowledgeWarnings = await db
                .select()
                .from(securityIncidents)
                .where(and(
                    eq(securityIncidents.tenantId, tenantId),
                    eq(securityIncidents.status, 'open'),
                    gte(securityIncidents.slaAcknowledgeBy, now),
                    lte(securityIncidents.slaAcknowledgeBy, warningTime)
                ));

            // Find incidents approaching investigate deadline
            const investigateWarnings = await db
                .select()
                .from(securityIncidents)
                .where(and(
                    eq(securityIncidents.tenantId, tenantId),
                    eq(securityIncidents.status, 'in_progress'),
                    gte(securityIncidents.slaInvestigateBy, now),
                    lte(securityIncidents.slaInvestigateBy, warningTime)
                ));

            // Find incidents approaching resolve deadline
            const resolveWarnings = await db
                .select()
                .from(securityIncidents)
                .where(and(
                    eq(securityIncidents.tenantId, tenantId),
                    inArray(securityIncidents.status, ['open', 'in_progress']),
                    gte(securityIncidents.slaResolveBy, now),
                    lte(securityIncidents.slaResolveBy, warningTime)
                ));

            return {
                acknowledgeWarnings: acknowledgeWarnings as SecurityIncident[],
                investigateWarnings: investigateWarnings as SecurityIncident[],
                resolveWarnings: resolveWarnings as SecurityIncident[],
            };
        } catch (error) {
            logger.error('Failed to get incidents approaching SLA', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                warningMinutes,
            });
            throw error;
        }
    }

    // ========================================================================
    // Incident Creation Blocking (Requirements: 13.1, 13.2, 13.7, 13.9)
    // ========================================================================

    /**
     * BLOCKED: Direct incident creation is not allowed
     * This method exists to explicitly block any attempts at direct incident creation
     * Requirements: 13.1, 13.2, 13.7, 13.9
     */
    static async createIncident(): Promise<never> {
        const error = new Error('Direct incident creation is blocked. Security Incidents can only be created through alert escalation workflow.');

        logger.error('Blocked direct incident creation attempt', {
            method: 'createIncident',
            timestamp: new Date().toISOString(),
            error: error.message
        });

        throw error;
    }

    /**
     * BLOCKED: Bulk incident creation is not allowed
     * This method exists to explicitly block any attempts at bulk incident creation
     * Requirements: 13.1, 13.2, 13.7, 13.9
     */
    static async createIncidents(): Promise<never> {
        const error = new Error('Bulk incident creation is blocked. Security Incidents can only be created through individual alert escalation workflow.');

        logger.error('Blocked bulk incident creation attempt', {
            method: 'createIncidents',
            timestamp: new Date().toISOString(),
            error: error.message
        });

        throw error;
    }

    /**
     * BLOCKED: Administrative incident creation is not allowed
     * This method exists to explicitly block any attempts at administrative incident creation
     * Requirements: 13.1, 13.2, 13.7, 13.9
     */
    static async adminCreateIncident(): Promise<never> {
        const error = new Error('Administrative incident creation is blocked. Security Incidents can only be created through alert escalation workflow.');

        logger.error('Blocked administrative incident creation attempt', {
            method: 'adminCreateIncident',
            timestamp: new Date().toISOString(),
            error: error.message
        });

        throw error;
    }

    /**
     * Validate that incident creation is only allowed through escalation
     * Requirements: 13.1, 13.2, 13.7, 13.9
     */
    static validateIncidentCreationPath(alertId?: string, escalationContext?: boolean): void {
        if (!alertId || !escalationContext) {
            const error = new Error('Incident creation is only allowed through alert escalation workflow. Alert ID and escalation context are required.');

            logger.error('Invalid incident creation path', {
                alertId: alertId || 'missing',
                escalationContext: escalationContext || false,
                timestamp: new Date().toISOString()
            });

            throw error;
        }
    }
}