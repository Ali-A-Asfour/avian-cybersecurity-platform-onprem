/**
 * TypeScript types for Alerts & Security Incidents Module
 * These types correspond to the Drizzle ORM schema definitions
 */

// ============================================================================
// Alert Types
// ============================================================================

export type AlertStatus = 'open' | 'assigned' | 'investigating' | 'escalated' | 'closed_benign' | 'closed_false_positive';
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AlertSourceSystem = 'edr' | 'firewall' | 'email';

export interface SecurityAlert {
    id: string;
    tenantId: string;
    sourceSystem: AlertSourceSystem;
    sourceId: string; // External system ID

    // Classification
    alertType: string;
    classification: string;
    severity: AlertSeverity;

    // Content
    title: string;
    description: string | null;
    metadata: Record<string, any>;

    // Deduplication Intelligence (preserves reporting data)
    seenCount: number;
    firstSeenAt: Date;
    lastSeenAt: Date;

    // Microsoft Defender Context (if applicable)
    defenderIncidentId: string | null;
    defenderAlertId: string | null;
    defenderSeverity: string | null;
    threatName: string | null;
    affectedDevice: string | null;
    affectedUser: string | null;

    // Workflow State
    status: AlertStatus;
    assignedTo: string | null;
    assignedAt: Date | null;

    // Timestamps
    detectedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateSecurityAlertInput {
    tenantId: string;
    sourceSystem: AlertSourceSystem;
    sourceId: string;
    alertType: string;
    classification: string;
    severity: AlertSeverity;
    title: string;
    description?: string;
    metadata?: Record<string, any>;
    defenderIncidentId?: string;
    defenderAlertId?: string;
    defenderSeverity?: string;
    threatName?: string;
    affectedDevice?: string;
    affectedUser?: string;
    detectedAt: Date;
}

export interface UpdateSecurityAlertInput {
    status?: AlertStatus;
    assignedTo?: string;
    assignedAt?: Date;
    seenCount?: number;
    lastSeenAt?: Date;
    metadata?: Record<string, any>;
}

// ============================================================================
// Security Incident Types
// ============================================================================

export type IncidentStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';

export interface SecurityIncident {
    id: string;
    tenantId: string;
    ownerId: string;

    // Content
    title: string;
    description: string | null;
    severity: AlertSeverity;

    // Workflow State
    status: IncidentStatus;

    // Resolution
    resolutionSummary: string | null;
    dismissalJustification: string | null;

    // SLA Tracking
    slaAcknowledgeBy: Date;
    slaInvestigateBy: Date;
    slaResolveBy: Date;
    acknowledgedAt: Date | null;
    investigationStartedAt: Date | null;
    resolvedAt: Date | null;

    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateSecurityIncidentInput {
    tenantId: string;
    ownerId: string;
    title: string;
    description?: string;
    severity: AlertSeverity;
    slaAcknowledgeBy: Date;
    slaInvestigateBy: Date;
    slaResolveBy: Date;
}

export interface UpdateSecurityIncidentInput {
    status?: IncidentStatus;
    resolutionSummary?: string;
    dismissalJustification?: string;
    acknowledgedAt?: Date;
    investigationStartedAt?: Date;
    resolvedAt?: Date;
}

// ============================================================================
// Playbook Types
// ============================================================================

export type PlaybookStatus = 'active' | 'draft' | 'deprecated';

export interface InvestigationPlaybook {
    id: string;
    name: string;
    version: string;
    status: PlaybookStatus;

    // Content
    purpose: string;
    quickResponseGuide: string[]; // 3-step quick reference for SOC analysts
    initialValidationSteps: string[];
    sourceInvestigationSteps: string[];
    containmentChecks: string[];
    decisionGuidance: {
        escalateToIncident: string;
        resolveBenign: string;
        resolveFalsePositive: string;
    };

    // Metadata
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateInvestigationPlaybookInput {
    name: string;
    version: string;
    status?: PlaybookStatus;
    purpose: string;
    quickResponseGuide?: string[];
    initialValidationSteps?: string[];
    sourceInvestigationSteps?: string[];
    containmentChecks?: string[];
    decisionGuidance: {
        escalateToIncident: string;
        resolveBenign: string;
        resolveFalsePositive: string;
    };
    createdBy: string;
}

export interface UpdateInvestigationPlaybookInput {
    name?: string;
    version?: string;
    status?: PlaybookStatus;
    purpose?: string;
    quickResponseGuide?: string[];
    initialValidationSteps?: string[];
    sourceInvestigationSteps?: string[];
    containmentChecks?: string[];
    decisionGuidance?: {
        escalateToIncident: string;
        resolveBenign: string;
        resolveFalsePositive: string;
    };
}

// ============================================================================
// Junction Table Types
// ============================================================================

export interface IncidentAlertLink {
    incidentId: string;
    alertId: string;
    isPrimary: boolean;
    createdAt: Date;
}

export interface PlaybookClassificationLink {
    playbookId: string;
    classification: string;
    isPrimary: boolean;
    playbookStatus: PlaybookStatus;
    createdAt: Date;
}

// ============================================================================
// Alert Manager Types
// ============================================================================

export interface AlertDeduplicationKey {
    tenantId: string;
    sourceSystem: AlertSourceSystem;
    sourceId: string;
    alertType: string;
    classification: string;
}

export interface AlertFilters {
    tenantId: string;
    status?: AlertStatus | AlertStatus[];
    severity?: AlertSeverity | AlertSeverity[];
    assignedTo?: string;
    classification?: string;
    sourceSystem?: AlertSourceSystem;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}

export interface IncidentFilters {
    tenantId: string;
    ownerId?: string;
    status?: IncidentStatus | IncidentStatus[];
    severity?: AlertSeverity | AlertSeverity[];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}

// ============================================================================
// Assignment and Ownership Types
// ============================================================================

export interface AssignAlertInput {
    alertId: string;
    assignedTo: string;
    tenantId: string; // For tenant isolation validation
}

export interface EscalateAlertInput {
    alertId: string;
    tenantId: string; // For tenant isolation validation
    incidentTitle?: string;
    incidentDescription?: string;
}

export interface ResolveAlertInput {
    alertId: string;
    tenantId: string; // For tenant isolation validation
    userId: string; // For ownership validation
    outcome: 'benign' | 'false_positive';
    notes: string; // Mandatory analyst notes
}

export interface StartWorkInput {
    incidentId: string;
    tenantId: string; // For tenant isolation validation
    ownerId: string; // For ownership validation
}

export interface ResolveIncidentInput {
    incidentId: string;
    tenantId: string; // For tenant isolation validation
    ownerId: string; // For ownership validation
    outcome: 'resolved' | 'dismissed';
    summary?: string; // Required for resolved
    justification?: string; // Required for dismissed
}

// ============================================================================
// SLA Configuration Types
// ============================================================================

export interface SLATimers {
    acknowledgeMinutes: number;
    investigateMinutes: number;
    resolveMinutes: number;
}

export const SLA_TIMERS: Record<AlertSeverity, SLATimers> = {
    critical: {
        acknowledgeMinutes: 15,
        investigateMinutes: 60,
        resolveMinutes: 240, // 4 hours
    },
    high: {
        acknowledgeMinutes: 30,
        investigateMinutes: 120,
        resolveMinutes: 480, // 8 hours
    },
    medium: {
        acknowledgeMinutes: 60,
        investigateMinutes: 240,
        resolveMinutes: 1440, // 24 hours
    },
    low: {
        acknowledgeMinutes: 240,
        investigateMinutes: 480,
        resolveMinutes: 4320, // 72 hours
    },
};

// ============================================================================
// Microsoft Defender Integration Types
// ============================================================================

export interface DefenderContext {
    incidentId: string;
    alertId: string;
    severity: string;
    threatName: string;
    affectedDevice: string;
    affectedUser: string;
    deepLink: string;
}

export interface DefenderIntegrationConfig {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    authority: string;
    scope: string[];
}

// ============================================================================
// Normalization Types
// ============================================================================

export interface NormalizedAlert {
    sourceSystem: AlertSourceSystem;
    sourceId: string;
    alertType: string;
    classification: string;
    severity: AlertSeverity;
    title: string;
    description: string;
    metadata: Record<string, any>;
    detectedAt: Date;
    defenderContext?: DefenderContext;
}

export interface EDRAlertInput {
    incidentId: string;
    alertId: string;
    severity: string;
    title: string;
    description: string;
    threatName: string;
    affectedDevice: string;
    affectedUser: string;
    detectedAt: Date;
    metadata: Record<string, any>;
}

export interface FirewallAlertInput {
    deviceId: string;
    alertType: string;
    severity: AlertSeverity;
    message: string;
    metadata: Record<string, any>;
    detectedAt: Date;
}

export interface EmailAlertInput {
    subject: string;
    body: string;
    sender: string;
    receivedAt: Date;
    deviceIdentifier?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface AlertWithPlaybooks {
    alert: SecurityAlert;
    playbooks: InvestigationPlaybook[];
}

export interface IncidentWithAlerts {
    incident: SecurityIncident;
    alerts: SecurityAlert[];
    primaryAlert: SecurityAlert | null;
}

export interface AlertQueueResponse {
    alerts: SecurityAlert[];
    total: number;
    unassignedCount: number;
    assignedCount: number;
}

export interface IncidentQueueResponse {
    incidents: SecurityIncident[];
    total: number;
    openCount: number;
    inProgressCount: number;
}

// ============================================================================
// Error Types
// ============================================================================

export interface AlertsIncidentsError {
    code: string;
    message: string;
    details?: Record<string, any>;
}

export interface ValidationError {
    field: string;
    message: string;
    code: string;
}

// ============================================================================
// Audit Types
// ============================================================================

export interface AuditLogEntry {
    id: string;
    tenantId: string;
    entityType: 'alert' | 'incident' | 'playbook';
    entityId: string;
    action: string;
    userId: string;
    oldValues: Record<string, any> | null;
    newValues: Record<string, any> | null;
    timestamp: Date;
}

// ============================================================================
// Reporting Types
// ============================================================================

export interface AlertMetrics {
    totalAlerts: number;
    alertsByStatus: Record<AlertStatus, number>;
    alertsBySeverity: Record<AlertSeverity, number>;
    alertsBySource: Record<AlertSourceSystem, number>;
    escalationRate: number; // Percentage of alerts escalated to incidents
}

export interface IncidentMetrics {
    totalIncidents: number;
    incidentsByStatus: Record<IncidentStatus, number>;
    incidentsBySeverity: Record<AlertSeverity, number>;
    averageResolutionTime: number; // Minutes
    slaBreaches: number;
    slaComplianceRate: number; // Percentage
}

export interface WeeklyReport {
    alertsDigested: number;
    alertsEscalated: number;
    incidentsBySeverity: Record<AlertSeverity, number>;
    outcomes: Record<IncidentStatus, number>;
}

export interface MonthlyReport {
    id: string;
    tenantId: string;
    reportType: 'monthly';
    dateRange: {
        startDate: Date;
        endDate: Date;
    };
    generatedAt: Date;
    generatedBy: string;
    incidentTrends: {
        totalIncidents: number;
        incidentsByStatus: Record<IncidentStatus, number>;
        incidentsBySeverity: Record<AlertSeverity, number>;
        weeklyBreakdown: Array<{
            weekStartDate: string;
            incidentCount: number;
            resolvedCount: number;
            escalatedCount: number;
        }>;
    };
    mttr: number; // Mean Time To Resolution in minutes
    slaCompliance: {
        overallComplianceRate: number;
        breachesBySeverity: Record<AlertSeverity, number>;
        breachesByType: {
            acknowledge: number;
            investigate: number;
            resolve: number;
        };
        complianceByWeek: Array<{
            weekStartDate: string;
            complianceRate: number;
            totalIncidents: number;
            breaches: number;
        }>;
    };
    performanceIndicators: {
        alertToIncidentRatio: number;
        averageIncidentSeverity: number;
        resolutionEfficiency: number;
        analystWorkload: Array<{
            analystId: string;
            incidentsHandled: number;
            averageResolutionTime: number;
            slaComplianceRate: number;
        }>;
    };
    historicalComparison: {
        previousMonthMttr: number;
        mttrTrend: 'improving' | 'declining' | 'stable';
        previousMonthIncidents: number;
        incidentVolumeTrend: 'increasing' | 'decreasing' | 'stable';
        previousMonthSlaCompliance: number;
        slaComplianceTrend: 'improving' | 'declining' | 'stable';
    };
    topIncidentClassifications: Array<{
        classification: string;
        count: number;
        averageResolutionTime: number;
    }>;
    criticalInsights: string[];
}

export interface QuarterlyReport {
    id: string;
    tenantId: string;
    reportType: 'quarterly';
    dateRange: {
        startDate: Date;
        endDate: Date;
    };
    generatedAt: Date;
    generatedBy: string;

    // Executive Risk Summary (Requirements: 11.3)
    executiveRiskSummary: {
        overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
        riskScore: number; // 0-100 scale
        keyRiskFactors: string[];
        riskTrends: 'improving' | 'stable' | 'deteriorating';
        criticalIncidentsCount: number;
        highSeverityIncidentsCount: number;
        unmitigatedRisks: Array<{
            classification: string;
            severity: AlertSeverity;
            count: number;
            averageResolutionTime: number;
        }>;
    };

    // Incident Volume Trends (Requirements: 11.3)
    incidentVolumeTrends: {
        quarterlyTotal: number;
        monthlyBreakdown: Array<{
            month: string;
            incidentCount: number;
            criticalCount: number;
            highCount: number;
            mediumCount: number;
            lowCount: number;
        }>;
        yearOverYearComparison: {
            previousQuarterTotal: number;
            percentageChange: number;
            trend: 'increasing' | 'decreasing' | 'stable';
        };
        seasonalPatterns: Array<{
            pattern: string;
            description: string;
            recommendation: string;
        }>;
    };

    // SLA Performance Analysis (Requirements: 11.3, 11.5)
    slaPerformanceAnalysis: {
        overallCompliance: number;
        complianceByMonth: Array<{
            month: string;
            complianceRate: number;
            totalIncidents: number;
            breaches: number;
        }>;
        breachesBySeverity: Record<AlertSeverity, number>;
        breachesByType: {
            acknowledge: number;
            investigate: number;
            resolve: number;
        };
        improvementRecommendations: string[];
        benchmarkComparison: {
            industryAverage: number;
            performanceGap: number;
            ranking: 'above_average' | 'average' | 'below_average';
        };
    };

    // Executive Dashboards Data
    executiveDashboards: {
        securityPosture: {
            maturityScore: number; // 0-100
            controlEffectiveness: number; // 0-100
            threatLandscape: Array<{
                threatType: string;
                frequency: number;
                impact: AlertSeverity;
            }>;
        };
        operationalEfficiency: {
            mttrTrend: Array<{
                month: string;
                mttr: number;
            }>;
            analystProductivity: {
                averageIncidentsPerAnalyst: number;
                topPerformers: Array<{
                    analystId: string;
                    incidentsHandled: number;
                    averageResolutionTime: number;
                    slaComplianceRate: number;
                }>;
            };
            resourceUtilization: {
                alertToIncidentRatio: number;
                falsePositiveRate: number;
                escalationRate: number;
            };
        };
        complianceMetrics: {
            dataRetentionCompliance: number; // Percentage
            auditTrailCompleteness: number; // Percentage
            regulatoryAlignmentScore: number; // 0-100
        };
    };

    // Long-term Data Retention
    dataRetention: {
        retentionPeriodMonths: number;
        archivedIncidentsCount: number;
        complianceStatus: 'compliant' | 'at_risk' | 'non_compliant';
        nextArchivalDate: Date;
    };
}