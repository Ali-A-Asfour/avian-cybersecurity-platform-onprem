/**
 * Audit Service for Alerts & Security Incidents Module
 * 
 * Provides comprehensive audit logging for all alert and incident state changes with:
 * - Tenant isolation in audit logs
 * - User attribution and context tracking
 * - State change detection and logging
 * - Audit trail querying and reporting
 * - Compliance and accountability features
 * 
 * Requirements: 3.5, 7.2, 9.5
 */

import { db } from '../../lib/database';
import { alertsIncidentsAuditLogs } from '../../../database/schemas/audit-logs';
import { eq, and, desc, gte, lte, inArray, sql } from 'drizzle-orm';
import { logger } from '../../lib/logger';
import {
    AuditLog,
    CreateAuditLogInput,
    AuditContext,
    AuditLogFilters,
    AuditTrailResponse,
    EntityAuditTrail,
    AuditStatistics,
    StateChange,
    StateChangeDetails,
    AlertAuditState,
    IncidentAuditState,
    PlaybookAuditState,
    AlertStateChange,
    IncidentStateChange,
    PlaybookStateChange,
    AuditAction,
    AuditEntityType,
} from '../../types/audit-logs';

/**
 * Audit Service Class
 * 
 * Provides comprehensive audit logging with tenant isolation,
 * state change tracking, and compliance reporting.
 */
export class AuditService {

    // ========================================================================
    // Core Audit Logging
    // ========================================================================

    /**
     * Create audit log entry
     * Requirements: 3.5, 7.2, 9.5
     */
    static async createAuditLog(
        input: CreateAuditLogInput,
        context?: Partial<AuditContext>
    ): Promise<string> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            const auditEntry = {
                tenantId: input.tenantId,
                userId: input.userId,
                action: input.action,
                entityType: input.entityType,
                entityId: input.entityId,
                description: input.description,
                previousState: input.previousState || null,
                newState: input.newState,
                changeDetails: input.changeDetails || {},
                userAgent: context?.userAgent || input.userAgent || null,
                ipAddress: context?.ipAddress || input.ipAddress || null,
                sessionId: context?.sessionId || input.sessionId || null,
                metadata: {
                    ...input.metadata,
                    ...context?.metadata,
                },
            };

            const [auditLog] = await db.insert(alertsIncidentsAuditLogs).values(auditEntry).returning();

            logger.info('Audit log created', {
                auditLogId: auditLog.id,
                tenantId: input.tenantId,
                userId: input.userId,
                action: input.action,
                entityType: input.entityType,
                entityId: input.entityId,
            });

            return auditLog.id;
        } catch (error) {
            logger.error('Failed to create audit log', error instanceof Error ? error : new Error(String(error)), {
                tenantId: input.tenantId,
                userId: input.userId,
                action: input.action,
                entityType: input.entityType,
                entityId: input.entityId,
            });
            throw error;
        }
    }

    // ========================================================================
    // Alert Audit Logging
    // ========================================================================

    /**
     * Log alert creation
     * Requirements: 3.5
     */
    static async logAlertCreated(
        tenantId: string,
        userId: string,
        alertId: string,
        alertState: AlertAuditState,
        context?: Partial<AuditContext>
    ): Promise<void> {
        const input: CreateAuditLogInput = {
            tenantId,
            userId,
            action: 'alert_created',
            entityType: 'security_alert',
            entityId: alertId,
            description: `Alert created: ${alertState.title} (${alertState.severity})`,
            previousState: null,
            newState: alertState,
            changeDetails: {
                summary: 'Alert created from external source',
                affectedFields: ['status', 'severity', 'classification', 'title'],
                sourceSystem: alertState.sourceSystem,
                sourceId: alertState.sourceId,
            },
            metadata: {
                sourceSystem: alertState.sourceSystem,
                sourceId: alertState.sourceId,
                classification: alertState.classification,
                severity: alertState.severity,
            },
        };

        await this.createAuditLog(input, context);
    }

    /**
     * Log alert assignment
     * Requirements: 3.5
     */
    static async logAlertAssigned(
        tenantId: string,
        userId: string,
        alertId: string,
        previousState: AlertAuditState,
        newState: AlertAuditState,
        context?: Partial<AuditContext>
    ): Promise<void> {
        const stateChange = this.detectAlertStateChanges(previousState, newState);

        const input: CreateAuditLogInput = {
            tenantId,
            userId,
            action: 'alert_assigned',
            entityType: 'security_alert',
            entityId: alertId,
            description: `Alert assigned to analyst`,
            previousState,
            newState,
            changeDetails: {
                ...stateChange,
                ownershipChange: {
                    previousOwner: previousState.assignedTo,
                    newOwner: newState.assignedTo,
                },
            },
            metadata: {
                assignedTo: newState.assignedTo,
                assignedAt: newState.assignedAt,
                severity: newState.severity,
            },
        };

        await this.createAuditLog(input, context);
    }

    /**
     * Log investigation started
     * Requirements: 3.5
     */
    static async logAlertInvestigationStarted(
        tenantId: string,
        userId: string,
        alertId: string,
        previousState: AlertAuditState,
        newState: AlertAuditState,
        context?: Partial<AuditContext>
    ): Promise<void> {
        const stateChange = this.detectAlertStateChanges(previousState, newState);

        const input: CreateAuditLogInput = {
            tenantId,
            userId,
            action: 'alert_investigation_started',
            entityType: 'security_alert',
            entityId: alertId,
            description: `Investigation started on alert`,
            previousState,
            newState,
            changeDetails: stateChange,
            metadata: {
                investigationStartedBy: userId,
                severity: newState.severity,
                classification: newState.classification,
            },
        };

        await this.createAuditLog(input, context);
    }

    /**
     * Log alert resolution
     * Requirements: 3.5
     */
    static async logAlertResolved(
        tenantId: string,
        userId: string,
        alertId: string,
        previousState: AlertAuditState,
        newState: AlertAuditState,
        outcome: string,
        notes: string,
        context?: Partial<AuditContext>
    ): Promise<void> {
        const stateChange = this.detectAlertStateChanges(previousState, newState);

        const input: CreateAuditLogInput = {
            tenantId,
            userId,
            action: 'alert_resolved',
            entityType: 'security_alert',
            entityId: alertId,
            description: `Alert resolved as ${outcome}`,
            previousState,
            newState,
            changeDetails: {
                ...stateChange,
                outcome,
                notes,
            },
            metadata: {
                outcome,
                notes,
                resolvedBy: userId,
                severity: newState.severity,
                resolutionTime: new Date().toISOString(),
            },
        };

        await this.createAuditLog(input, context);
    }

    /**
     * Log alert escalation to incident
     * Requirements: 3.5
     */
    static async logAlertEscalated(
        tenantId: string,
        userId: string,
        alertId: string,
        previousState: AlertAuditState,
        newState: AlertAuditState,
        incidentId: string,
        context?: Partial<AuditContext>
    ): Promise<void> {
        const stateChange = this.detectAlertStateChanges(previousState, newState);

        const input: CreateAuditLogInput = {
            tenantId,
            userId,
            action: 'alert_escalated',
            entityType: 'security_alert',
            entityId: alertId,
            description: `Alert escalated to security incident`,
            previousState,
            newState,
            changeDetails: {
                ...stateChange,
                incidentId,
                escalationReason: 'Analyst decision to escalate to formal incident response',
            },
            metadata: {
                incidentId,
                escalatedBy: userId,
                severity: newState.severity,
                escalationTime: new Date().toISOString(),
            },
        };

        await this.createAuditLog(input, context);
    }

    // ========================================================================
    // Incident Audit Logging
    // ========================================================================

    /**
     * Log incident creation
     * Requirements: 7.2
     */
    static async logIncidentCreated(
        tenantId: string,
        userId: string,
        incidentId: string,
        incidentState: IncidentAuditState,
        primaryAlertId: string,
        context?: Partial<AuditContext>
    ): Promise<void> {
        const input: CreateAuditLogInput = {
            tenantId,
            userId,
            action: 'incident_created',
            entityType: 'security_incident',
            entityId: incidentId,
            description: `Security incident created from alert escalation`,
            previousState: null,
            newState: incidentState,
            changeDetails: {
                summary: 'Incident created from alert escalation',
                affectedFields: ['status', 'ownerId', 'severity', 'title'],
                primaryAlertId,
                slaTimers: {
                    acknowledgeBy: incidentState.slaAcknowledgeBy,
                    investigateBy: incidentState.slaInvestigateBy,
                    resolveBy: incidentState.slaResolveBy,
                },
            },
            metadata: {
                primaryAlertId,
                ownerId: incidentState.ownerId,
                severity: incidentState.severity,
                slaAcknowledgeBy: incidentState.slaAcknowledgeBy,
                slaInvestigateBy: incidentState.slaInvestigateBy,
                slaResolveBy: incidentState.slaResolveBy,
            },
        };

        await this.createAuditLog(input, context);
    }

    /**
     * Log incident work started
     * Requirements: 7.2
     */
    static async logIncidentWorkStarted(
        tenantId: string,
        userId: string,
        incidentId: string,
        previousState: IncidentAuditState,
        newState: IncidentAuditState,
        context?: Partial<AuditContext>
    ): Promise<void> {
        const stateChange = this.detectIncidentStateChanges(previousState, newState);

        const input: CreateAuditLogInput = {
            tenantId,
            userId,
            action: 'incident_work_started',
            entityType: 'security_incident',
            entityId: incidentId,
            description: `Work started on security incident`,
            previousState,
            newState,
            changeDetails: {
                ...stateChange,
                slaImpact: this.calculateSLAImpact(newState),
            },
            metadata: {
                workStartedBy: userId,
                acknowledgedAt: newState.acknowledgedAt,
                investigationStartedAt: newState.investigationStartedAt,
                severity: newState.severity,
            },
        };

        await this.createAuditLog(input, context);
    }

    /**
     * Log incident resolution
     * Requirements: 7.2
     */
    static async logIncidentResolved(
        tenantId: string,
        userId: string,
        incidentId: string,
        previousState: IncidentAuditState,
        newState: IncidentAuditState,
        summary: string,
        context?: Partial<AuditContext>
    ): Promise<void> {
        const stateChange = this.detectIncidentStateChanges(previousState, newState);

        const input: CreateAuditLogInput = {
            tenantId,
            userId,
            action: 'incident_resolved',
            entityType: 'security_incident',
            entityId: incidentId,
            description: `Security incident resolved`,
            previousState,
            newState,
            changeDetails: {
                ...stateChange,
                summary,
                slaImpact: this.calculateSLAImpact(newState),
            },
            metadata: {
                resolvedBy: userId,
                resolutionSummary: summary,
                resolvedAt: newState.resolvedAt,
                severity: newState.severity,
                slaCompliance: this.checkSLACompliance(newState),
            },
        };

        await this.createAuditLog(input, context);
    }

    /**
     * Log incident dismissal
     * Requirements: 7.2
     */
    static async logIncidentDismissed(
        tenantId: string,
        userId: string,
        incidentId: string,
        previousState: IncidentAuditState,
        newState: IncidentAuditState,
        justification: string,
        context?: Partial<AuditContext>
    ): Promise<void> {
        const stateChange = this.detectIncidentStateChanges(previousState, newState);

        const input: CreateAuditLogInput = {
            tenantId,
            userId,
            action: 'incident_dismissed',
            entityType: 'security_incident',
            entityId: incidentId,
            description: `Security incident dismissed`,
            previousState,
            newState,
            changeDetails: {
                ...stateChange,
                justification,
                slaImpact: this.calculateSLAImpact(newState),
            },
            metadata: {
                dismissedBy: userId,
                dismissalJustification: justification,
                resolvedAt: newState.resolvedAt,
                severity: newState.severity,
                slaCompliance: this.checkSLACompliance(newState),
            },
        };

        await this.createAuditLog(input, context);
    }

    /**
     * Log alert added to incident
     * Requirements: 7.2
     */
    static async logIncidentAlertAdded(
        tenantId: string,
        userId: string,
        incidentId: string,
        incidentState: IncidentAuditState,
        alertId: string,
        context?: Partial<AuditContext>
    ): Promise<void> {
        const input: CreateAuditLogInput = {
            tenantId,
            userId,
            action: 'incident_alert_added',
            entityType: 'security_incident',
            entityId: incidentId,
            description: `Alert added to security incident`,
            previousState: incidentState,
            newState: incidentState,
            changeDetails: {
                summary: 'Additional alert linked to incident',
                affectedFields: ['linkedAlerts'],
                alertId,
            },
            metadata: {
                alertId,
                addedBy: userId,
                severity: incidentState.severity,
            },
        };

        await this.createAuditLog(input, context);
    }

    // ========================================================================
    // Playbook Audit Logging
    // ========================================================================

    /**
     * Log playbook creation
     * Requirements: 9.5
     */
    static async logPlaybookCreated(
        tenantId: string,
        userId: string,
        playbookId: string,
        playbookState: PlaybookAuditState,
        context?: Partial<AuditContext>
    ): Promise<void> {
        const input: CreateAuditLogInput = {
            tenantId,
            userId,
            action: 'playbook_created',
            entityType: 'investigation_playbook',
            entityId: playbookId,
            description: `Investigation playbook created: ${playbookState.name}`,
            previousState: null,
            newState: playbookState,
            changeDetails: {
                summary: 'New investigation playbook created',
                affectedFields: ['name', 'version', 'status', 'purpose'],
            },
            metadata: {
                name: playbookState.name,
                version: playbookState.version,
                status: playbookState.status,
                createdBy: playbookState.createdBy,
            },
        };

        await this.createAuditLog(input, context);
    }

    /**
     * Log playbook update
     * Requirements: 9.5
     */
    static async logPlaybookUpdated(
        tenantId: string,
        userId: string,
        playbookId: string,
        previousState: PlaybookAuditState,
        newState: PlaybookAuditState,
        context?: Partial<AuditContext>
    ): Promise<void> {
        const stateChange = this.detectPlaybookStateChanges(previousState, newState);

        const input: CreateAuditLogInput = {
            tenantId,
            userId,
            action: 'playbook_updated',
            entityType: 'investigation_playbook',
            entityId: playbookId,
            description: `Investigation playbook updated: ${newState.name}`,
            previousState,
            newState,
            changeDetails: stateChange,
            metadata: {
                name: newState.name,
                version: newState.version,
                status: newState.status,
                updatedBy: userId,
            },
        };

        await this.createAuditLog(input, context);
    }

    /**
     * Log playbook classification linking
     * Requirements: 9.5
     */
    static async logPlaybookClassificationLinked(
        tenantId: string,
        userId: string,
        playbookId: string,
        playbookState: PlaybookAuditState,
        classification: string,
        isPrimary: boolean,
        context?: Partial<AuditContext>
    ): Promise<void> {
        const input: CreateAuditLogInput = {
            tenantId,
            userId,
            action: 'playbook_classification_linked',
            entityType: 'investigation_playbook',
            entityId: playbookId,
            description: `Playbook linked to classification: ${classification} (${isPrimary ? 'primary' : 'secondary'})`,
            previousState: playbookState,
            newState: {
                ...playbookState,
                classifications: [...playbookState.classifications, classification],
            },
            changeDetails: {
                summary: `Classification ${classification} linked as ${isPrimary ? 'primary' : 'secondary'}`,
                affectedFields: ['classifications'],
                classification,
                isPrimary,
            },
            metadata: {
                classification,
                isPrimary,
                playbookName: playbookState.name,
                linkedBy: userId,
            },
        };

        await this.createAuditLog(input, context);
    }

    // ========================================================================
    // State Change Detection
    // ========================================================================

    /**
     * Detect changes between alert states
     */
    private static detectAlertStateChanges(
        previousState: AlertAuditState,
        newState: AlertAuditState
    ): AlertStateChange {
        const changes: StateChange[] = [];

        // Check each field for changes
        Object.keys(newState).forEach(key => {
            const prevValue = (previousState as any)[key];
            const newValue = (newState as any)[key];

            if (JSON.stringify(prevValue) !== JSON.stringify(newValue)) {
                changes.push({
                    field: key,
                    previousValue: prevValue,
                    newValue: newValue,
                    type: prevValue === undefined ? 'created' : 'updated',
                });
            }
        });

        return {
            alertId: newState.id,
            previousStatus: previousState.status,
            newStatus: newState.status,
            changes,
            summary: `Alert state changed: ${changes.map(c => c.field).join(', ')}`,
            affectedFields: changes.map(c => c.field),
            ownershipChange: previousState.assignedTo !== newState.assignedTo ? {
                previousOwner: previousState.assignedTo,
                newOwner: newState.assignedTo,
            } : undefined,
        };
    }

    /**
     * Detect changes between incident states
     */
    private static detectIncidentStateChanges(
        previousState: IncidentAuditState,
        newState: IncidentAuditState
    ): IncidentStateChange {
        const changes: StateChange[] = [];

        // Check each field for changes
        Object.keys(newState).forEach(key => {
            const prevValue = (previousState as any)[key];
            const newValue = (newState as any)[key];

            if (JSON.stringify(prevValue) !== JSON.stringify(newValue)) {
                changes.push({
                    field: key,
                    previousValue: prevValue,
                    newValue: newValue,
                    type: prevValue === undefined ? 'created' : 'updated',
                });
            }
        });

        return {
            incidentId: newState.id,
            previousStatus: previousState.status,
            newStatus: newState.status,
            changes,
            summary: `Incident state changed: ${changes.map(c => c.field).join(', ')}`,
            affectedFields: changes.map(c => c.field),
            slaImpact: this.calculateSLAImpact(newState),
            ownershipChange: previousState.ownerId !== newState.ownerId ? {
                previousOwner: previousState.ownerId,
                newOwner: newState.ownerId,
            } : undefined,
        };
    }

    /**
     * Detect changes between playbook states
     */
    private static detectPlaybookStateChanges(
        previousState: PlaybookAuditState,
        newState: PlaybookAuditState
    ): PlaybookStateChange {
        const changes: StateChange[] = [];

        // Check each field for changes
        Object.keys(newState).forEach(key => {
            const prevValue = (previousState as any)[key];
            const newValue = (newState as any)[key];

            if (JSON.stringify(prevValue) !== JSON.stringify(newValue)) {
                changes.push({
                    field: key,
                    previousValue: prevValue,
                    newValue: newValue,
                    type: prevValue === undefined ? 'created' : 'updated',
                });
            }
        });

        // Detect classification changes
        const prevClassifications = new Set(previousState.classifications);
        const newClassifications = new Set(newState.classifications);
        const added = [...newClassifications].filter(c => !prevClassifications.has(c));
        const removed = [...prevClassifications].filter(c => !newClassifications.has(c));

        return {
            playbookId: newState.id,
            previousStatus: previousState.status,
            newStatus: newState.status,
            changes,
            summary: `Playbook state changed: ${changes.map(c => c.field).join(', ')}`,
            affectedFields: changes.map(c => c.field),
            classificationChanges: added.length > 0 || removed.length > 0 ? {
                added,
                removed,
            } : undefined,
        };
    }

    // ========================================================================
    // SLA Impact Calculation
    // ========================================================================

    /**
     * Calculate SLA impact for incident
     */
    private static calculateSLAImpact(incidentState: IncidentAuditState) {
        const now = new Date();

        return {
            acknowledgeBreached: incidentState.acknowledgedAt
                ? incidentState.acknowledgedAt > incidentState.slaAcknowledgeBy
                : now > incidentState.slaAcknowledgeBy,
            investigateBreached: incidentState.investigationStartedAt
                ? incidentState.investigationStartedAt > incidentState.slaInvestigateBy
                : now > incidentState.slaInvestigateBy,
            resolveBreached: incidentState.resolvedAt
                ? incidentState.resolvedAt > incidentState.slaResolveBy
                : now > incidentState.slaResolveBy,
        };
    }

    /**
     * Check SLA compliance for incident
     */
    private static checkSLACompliance(incidentState: IncidentAuditState) {
        const slaImpact = this.calculateSLAImpact(incidentState);

        return {
            acknowledgeCompliant: !slaImpact.acknowledgeBreached,
            investigateCompliant: !slaImpact.investigateBreached,
            resolveCompliant: !slaImpact.resolveBreached,
            overallCompliant: !slaImpact.acknowledgeBreached &&
                !slaImpact.investigateBreached &&
                !slaImpact.resolveBreached,
        };
    }

    // ========================================================================
    // Audit Trail Querying
    // ========================================================================

    /**
     * Get audit logs with filtering
     * Requirements: 3.5, 7.2, 9.5
     */
    static async getAuditLogs(filters: AuditLogFilters): Promise<AuditTrailResponse> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            const conditions = [eq(alertsIncidentsAuditLogs.tenantId, filters.tenantId)];

            // Apply filters
            if (filters.userId) {
                conditions.push(eq(alertsIncidentsAuditLogs.userId, filters.userId));
            }

            if (filters.entityType) {
                if (Array.isArray(filters.entityType)) {
                    conditions.push(inArray(alertsIncidentsAuditLogs.entityType, filters.entityType));
                } else {
                    conditions.push(eq(alertsIncidentsAuditLogs.entityType, filters.entityType));
                }
            }

            if (filters.entityId) {
                conditions.push(eq(alertsIncidentsAuditLogs.entityId, filters.entityId));
            }

            if (filters.action) {
                if (Array.isArray(filters.action)) {
                    conditions.push(inArray(alertsIncidentsAuditLogs.action, filters.action));
                } else {
                    conditions.push(eq(alertsIncidentsAuditLogs.action, filters.action));
                }
            }

            if (filters.startDate) {
                conditions.push(gte(alertsIncidentsAuditLogs.createdAt, filters.startDate));
            }

            if (filters.endDate) {
                conditions.push(lte(alertsIncidentsAuditLogs.createdAt, filters.endDate));
            }

            // Get total count
            const [{ count }] = await db
                .select({ count: sql<number>`count(*)` })
                .from(alertsIncidentsAuditLogs)
                .where(and(...conditions));

            // Get logs with pagination
            let query = db
                .select()
                .from(alertsIncidentsAuditLogs)
                .where(and(...conditions))
                .orderBy(desc(alertsIncidentsAuditLogs.createdAt));

            if (filters.limit) {
                query = query.limit(filters.limit);
            }

            if (filters.offset) {
                query = query.offset(filters.offset);
            }

            const logs = await query;

            return {
                logs: logs as AuditLog[],
                total: count,
                hasMore: filters.limit ? (filters.offset || 0) + logs.length < count : false,
            };
        } catch (error) {
            logger.error('Failed to get audit logs', error instanceof Error ? error : new Error(String(error)), {
                tenantId: filters.tenantId,
            });
            throw error;
        }
    }

    /**
     * Get audit trail for specific entity
     * Requirements: 3.5, 7.2, 9.5
     */
    static async getEntityAuditTrail(
        tenantId: string,
        entityType: AuditEntityType,
        entityId: string,
        limit?: number
    ): Promise<EntityAuditTrail> {
        const filters: AuditLogFilters = {
            tenantId,
            entityType,
            entityId,
            limit,
        };

        const result = await this.getAuditLogs(filters);

        return {
            entityId,
            entityType,
            logs: result.logs,
            total: result.total,
        };
    }

    /**
     * Get user activity audit trail
     * Requirements: 3.5, 7.2, 9.5
     */
    static async getUserActivityTrail(
        tenantId: string,
        userId: string,
        startDate?: Date,
        endDate?: Date,
        limit?: number
    ): Promise<AuditTrailResponse> {
        const filters: AuditLogFilters = {
            tenantId,
            userId,
            startDate,
            endDate,
            limit,
        };

        return this.getAuditLogs(filters);
    }

    /**
     * Get audit statistics for reporting
     * Requirements: 3.5, 7.2, 9.5
     */
    static async getAuditStatistics(
        tenantId: string,
        startDate: Date,
        endDate: Date
    ): Promise<AuditStatistics> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Get total actions count
            const [{ totalActions }] = await db
                .select({ totalActions: sql<number>`count(*)` })
                .from(alertsIncidentsAuditLogs)
                .where(and(
                    eq(alertsIncidentsAuditLogs.tenantId, tenantId),
                    gte(alertsIncidentsAuditLogs.createdAt, startDate),
                    lte(alertsIncidentsAuditLogs.createdAt, endDate)
                ));

            // Get action breakdown
            const actionBreakdown = await db
                .select({
                    action: alertsIncidentsAuditLogs.action,
                    count: sql<number>`count(*)`,
                })
                .from(alertsIncidentsAuditLogs)
                .where(and(
                    eq(alertsIncidentsAuditLogs.tenantId, tenantId),
                    gte(alertsIncidentsAuditLogs.createdAt, startDate),
                    lte(alertsIncidentsAuditLogs.createdAt, endDate)
                ))
                .groupBy(alertsIncidentsAuditLogs.action);

            // Get entity breakdown
            const entityBreakdown = await db
                .select({
                    entityType: alertsIncidentsAuditLogs.entityType,
                    count: sql<number>`count(*)`,
                })
                .from(alertsIncidentsAuditLogs)
                .where(and(
                    eq(alertsIncidentsAuditLogs.tenantId, tenantId),
                    gte(alertsIncidentsAuditLogs.createdAt, startDate),
                    lte(alertsIncidentsAuditLogs.createdAt, endDate)
                ))
                .groupBy(alertsIncidentsAuditLogs.entityType);

            // Get user activity
            const userActivity = await db
                .select({
                    userId: alertsIncidentsAuditLogs.userId,
                    actionCount: sql<number>`count(*)`,
                    lastActivity: sql<Date>`max(${alertsIncidentsAuditLogs.createdAt})`,
                })
                .from(alertsIncidentsAuditLogs)
                .where(and(
                    eq(alertsIncidentsAuditLogs.tenantId, tenantId),
                    gte(alertsIncidentsAuditLogs.createdAt, startDate),
                    lte(alertsIncidentsAuditLogs.createdAt, endDate)
                ))
                .groupBy(alertsIncidentsAuditLogs.userId);

            // Get daily activity
            const dailyActivity = await db
                .select({
                    date: sql<string>`date(${alertsIncidentsAuditLogs.createdAt})`,
                    actionCount: sql<number>`count(*)`,
                })
                .from(alertsIncidentsAuditLogs)
                .where(and(
                    eq(alertsIncidentsAuditLogs.tenantId, tenantId),
                    gte(alertsIncidentsAuditLogs.createdAt, startDate),
                    lte(alertsIncidentsAuditLogs.createdAt, endDate)
                ))
                .groupBy(sql`date(${alertsIncidentsAuditLogs.createdAt})`)
                .orderBy(sql`date(${alertsIncidentsAuditLogs.createdAt})`);

            return {
                tenantId,
                period: { startDate, endDate },
                totalActions,
                actionBreakdown: actionBreakdown.reduce((acc, item) => {
                    acc[item.action] = item.count;
                    return acc;
                }, {} as Record<AuditAction, number>),
                entityBreakdown: entityBreakdown.reduce((acc, item) => {
                    acc[item.entityType] = item.count;
                    return acc;
                }, {} as Record<AuditEntityType, number>),
                userActivity,
                dailyActivity,
            };
        } catch (error) {
            logger.error('Failed to get audit statistics', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                startDate,
                endDate,
            });
            throw error;
        }
    }
}