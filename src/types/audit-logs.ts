/**
 * Type definitions for Audit Logging system
 * Comprehensive audit trail for all alert and incident state changes
 */

// ============================================================================
// Audit Action Types
// ============================================================================

export type AuditAction =
    // Alert actions
    | 'alert_created'
    | 'alert_assigned'
    | 'alert_investigation_started'
    | 'alert_resolved'
    | 'alert_escalated'
    | 'alert_ownership_transferred'

    // Incident actions
    | 'incident_created'
    | 'incident_work_started'
    | 'incident_resolved'
    | 'incident_dismissed'
    | 'incident_ownership_transferred'
    | 'incident_alert_added'

    // Playbook actions
    | 'playbook_created'
    | 'playbook_updated'
    | 'playbook_status_changed'
    | 'playbook_classification_linked'
    | 'playbook_classification_unlinked';

export type AuditEntityType =
    | 'security_alert'
    | 'security_incident'
    | 'investigation_playbook'
    | 'playbook_classification_link';

// ============================================================================
// Audit Log Data Models
// ============================================================================

export interface AuditLog {
    id: string;
    tenantId: string;
    userId: string;
    action: AuditAction;
    entityType: AuditEntityType;
    entityId: string;
    description: string;
    previousState: Record<string, any> | null;
    newState: Record<string, any>;
    changeDetails: Record<string, any>;
    userAgent?: string;
    ipAddress?: string;
    sessionId?: string;
    metadata: Record<string, any>;
    createdAt: Date;
}

export interface CreateAuditLogInput {
    tenantId: string;
    userId: string;
    action: AuditAction;
    entityType: AuditEntityType;
    entityId: string;
    description: string;
    previousState?: Record<string, any> | null;
    newState: Record<string, any>;
    changeDetails?: Record<string, any>;
    userAgent?: string;
    ipAddress?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
}

// ============================================================================
// Audit Context
// ============================================================================

export interface AuditContext {
    tenantId: string;
    userId: string;
    userAgent?: string;
    ipAddress?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
}

// ============================================================================
// Audit Query Filters
// ============================================================================

export interface AuditLogFilters {
    tenantId: string;
    userId?: string;
    entityType?: AuditEntityType | AuditEntityType[];
    entityId?: string;
    action?: AuditAction | AuditAction[];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}

// ============================================================================
// Audit Trail Response
// ============================================================================

export interface AuditTrailResponse {
    logs: AuditLog[];
    total: number;
    hasMore: boolean;
}

export interface EntityAuditTrail {
    entityId: string;
    entityType: AuditEntityType;
    logs: AuditLog[];
    total: number;
}

// ============================================================================
// State Change Tracking
// ============================================================================

export interface StateChange {
    field: string;
    previousValue: any;
    newValue: any;
    type: 'created' | 'updated' | 'deleted';
}

export interface StateChangeDetails {
    changes: StateChange[];
    summary: string;
    affectedFields: string[];
}

// ============================================================================
// Audit Statistics
// ============================================================================

export interface AuditStatistics {
    tenantId: string;
    period: {
        startDate: Date;
        endDate: Date;
    };
    totalActions: number;
    actionBreakdown: Record<AuditAction, number>;
    entityBreakdown: Record<AuditEntityType, number>;
    userActivity: Array<{
        userId: string;
        actionCount: number;
        lastActivity: Date;
    }>;
    dailyActivity: Array<{
        date: string;
        actionCount: number;
    }>;
}

// ============================================================================
// Audit Report Types
// ============================================================================

export interface AuditReport {
    tenantId: string;
    reportType: 'user_activity' | 'entity_changes' | 'security_events' | 'compliance';
    period: {
        startDate: Date;
        endDate: Date;
    };
    data: AuditStatistics;
    generatedAt: Date;
    generatedBy: string;
}

// ============================================================================
// Alert-Specific Audit Types
// ============================================================================

export interface AlertAuditState {
    id: string;
    status: string;
    assignedTo?: string;
    assignedAt?: Date;
    severity: string;
    classification: string;
    title: string;
    sourceSystem: string;
    sourceId: string;
    seenCount: number;
    metadata: Record<string, any>;
}

export interface AlertStateChange extends StateChangeDetails {
    alertId: string;
    previousStatus?: string;
    newStatus: string;
    ownershipChange?: {
        previousOwner?: string;
        newOwner?: string;
    };
}

// ============================================================================
// Incident-Specific Audit Types
// ============================================================================

export interface IncidentAuditState {
    id: string;
    status: string;
    ownerId: string;
    title: string;
    severity: string;
    acknowledgedAt?: Date;
    investigationStartedAt?: Date;
    resolvedAt?: Date;
    resolutionSummary?: string;
    dismissalJustification?: string;
    slaAcknowledgeBy: Date;
    slaInvestigateBy: Date;
    slaResolveBy: Date;
}

export interface IncidentStateChange extends StateChangeDetails {
    incidentId: string;
    previousStatus?: string;
    newStatus: string;
    slaImpact?: {
        acknowledgeBreached?: boolean;
        investigateBreached?: boolean;
        resolveBreached?: boolean;
    };
    ownershipChange?: {
        previousOwner?: string;
        newOwner?: string;
    };
}

// ============================================================================
// Playbook-Specific Audit Types
// ============================================================================

export interface PlaybookAuditState {
    id: string;
    name: string;
    version: string;
    status: string;
    purpose: string;
    createdBy: string;
    classifications: string[];
}

export interface PlaybookStateChange extends StateChangeDetails {
    playbookId: string;
    previousStatus?: string;
    newStatus?: string;
    classificationChanges?: {
        added: string[];
        removed: string[];
    };
}

// ============================================================================
// Audit Event Builders
// ============================================================================

export interface AuditEventBuilder {
    forAlert(alertId: string): AlertAuditEventBuilder;
    forIncident(incidentId: string): IncidentAuditEventBuilder;
    forPlaybook(playbookId: string): PlaybookAuditEventBuilder;
}

export interface AlertAuditEventBuilder {
    created(newState: AlertAuditState): CreateAuditLogInput;
    assigned(previousState: AlertAuditState, newState: AlertAuditState): CreateAuditLogInput;
    investigationStarted(previousState: AlertAuditState, newState: AlertAuditState): CreateAuditLogInput;
    resolved(previousState: AlertAuditState, newState: AlertAuditState, outcome: string, notes: string): CreateAuditLogInput;
    escalated(previousState: AlertAuditState, newState: AlertAuditState, incidentId: string): CreateAuditLogInput;
    ownershipTransferred(previousState: AlertAuditState, newState: AlertAuditState): CreateAuditLogInput;
}

export interface IncidentAuditEventBuilder {
    created(newState: IncidentAuditState, primaryAlertId: string): CreateAuditLogInput;
    workStarted(previousState: IncidentAuditState, newState: IncidentAuditState): CreateAuditLogInput;
    resolved(previousState: IncidentAuditState, newState: IncidentAuditState, summary: string): CreateAuditLogInput;
    dismissed(previousState: IncidentAuditState, newState: IncidentAuditState, justification: string): CreateAuditLogInput;
    alertAdded(incidentState: IncidentAuditState, alertId: string): CreateAuditLogInput;
    ownershipTransferred(previousState: IncidentAuditState, newState: IncidentAuditState): CreateAuditLogInput;
}

export interface PlaybookAuditEventBuilder {
    created(newState: PlaybookAuditState): CreateAuditLogInput;
    updated(previousState: PlaybookAuditState, newState: PlaybookAuditState): CreateAuditLogInput;
    statusChanged(previousState: PlaybookAuditState, newState: PlaybookAuditState): CreateAuditLogInput;
    classificationLinked(playbookState: PlaybookAuditState, classification: string, isPrimary: boolean): CreateAuditLogInput;
    classificationUnlinked(playbookState: PlaybookAuditState, classification: string): CreateAuditLogInput;
}