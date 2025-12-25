/**
 * SLA Breach Service for Alerts & Security Incidents Module
 * 
 * Provides comprehensive SLA breach tracking and alerting with:
 * - SLA monitoring service with breach detection
 * - Automated breach recording without workflow blocking
 * - SLA performance metrics calculation
 * - Alerts for approaching SLA deadlines
 * 
 * Requirements: 10.1, 11.4, 11.5
 */

import { db } from '../../lib/database';
import { securityIncidents } from '../../../database/schemas/alerts-incidents';
import { alertsIncidentsAuditLogs } from '../../../database/schemas/audit-logs';
import { eq, and, desc, gte, lte, inArray, sql } from 'drizzle-orm';
import { logger } from '../../lib/logger';
import {
    SecurityIncident,
    AlertSeverity,
    SLA_TIMERS,
} from '../../types/alerts-incidents';

// ============================================================================
// SLA Breach Types
// ============================================================================

export interface SLABreach {
    id: string;
    tenantId: string;
    incidentId: string;
    breachType: 'acknowledge' | 'investigate' | 'resolve';
    severity: AlertSeverity;
    expectedBy: Date;
    actualTime: Date | null; // null if still breached
    breachDurationMinutes: number;
    isResolved: boolean;
    createdAt: Date;
    resolvedAt: Date | null;
}

export interface SLABreachAlert {
    id: string;
    tenantId: string;
    incidentId: string;
    alertType: 'approaching_deadline' | 'breach_detected';
    breachType: 'acknowledge' | 'investigate' | 'resolve';
    severity: AlertSeverity;
    message: string;
    minutesUntilDeadline?: number; // for approaching alerts
    minutesSinceBreach?: number; // for breach alerts
    createdAt: Date;
    acknowledged: boolean;
    acknowledgedAt: Date | null;
    acknowledgedBy: string | null;
}

export interface SLAPerformanceMetrics {
    tenantId: string;
    period: {
        startDate: Date;
        endDate: Date;
    };
    totalIncidents: number;
    acknowledgeCompliance: {
        total: number;
        compliant: number;
        breached: number;
        complianceRate: number;
        averageTimeMinutes: number;
    };
    investigateCompliance: {
        total: number;
        compliant: number;
        breached: number;
        complianceRate: number;
        averageTimeMinutes: number;
    };
    resolveCompliance: {
        total: number;
        compliant: number;
        breached: number;
        complianceRate: number;
        averageTimeMinutes: number;
    };
    overallCompliance: {
        compliant: number;
        breached: number;
        complianceRate: number;
    };
    severityBreakdown: Record<AlertSeverity, {
        total: number;
        compliant: number;
        breached: number;
        complianceRate: number;
    }>;
}

export interface SLAMonitoringResult {
    tenantId: string;
    timestamp: Date;
    breachesDetected: SLABreach[];
    alertsGenerated: SLABreachAlert[];
    approachingDeadlines: {
        acknowledge: SecurityIncident[];
        investigate: SecurityIncident[];
        resolve: SecurityIncident[];
    };
}

// ============================================================================
// SLA Breach Service Class
// ============================================================================

/**
 * SLA Breach Service Class
 * 
 * Provides comprehensive SLA breach tracking with automated monitoring,
 * breach detection, alerting, and performance metrics calculation.
 */
export class SLABreachService {

    // ========================================================================
    // SLA Breach Detection
    // ========================================================================

    /**
     * Monitor SLA breaches for all active incidents
     * Requirements: 10.1, 11.4, 11.5
     */
    static async monitorSLABreaches(tenantId: string): Promise<SLAMonitoringResult> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            const now = new Date();
            const breachesDetected: SLABreach[] = [];
            const alertsGenerated: SLABreachAlert[] = [];

            // Get all active incidents for the tenant
            const activeIncidents = await db
                .select()
                .from(securityIncidents)
                .where(and(
                    eq(securityIncidents.tenantId, tenantId),
                    inArray(securityIncidents.status, ['open', 'in_progress'])
                ));

            // Check each incident for SLA breaches
            for (const incident of activeIncidents) {
                const incidentBreaches = await this.detectIncidentSLABreaches(incident as SecurityIncident, now);
                breachesDetected.push(...incidentBreaches);

                // Generate alerts for new breaches
                for (const breach of incidentBreaches) {
                    const alert = await this.generateBreachAlert(breach);
                    alertsGenerated.push(alert);
                }
            }

            // Get incidents approaching deadlines (30 minutes warning)
            const approachingDeadlines = await this.getIncidentsApproachingDeadlines(tenantId, 30);

            // Generate approaching deadline alerts
            for (const incident of approachingDeadlines.acknowledge) {
                const alert = await this.generateApproachingDeadlineAlert(incident, 'acknowledge');
                alertsGenerated.push(alert);
            }

            for (const incident of approachingDeadlines.investigate) {
                const alert = await this.generateApproachingDeadlineAlert(incident, 'investigate');
                alertsGenerated.push(alert);
            }

            for (const incident of approachingDeadlines.resolve) {
                const alert = await this.generateApproachingDeadlineAlert(incident, 'resolve');
                alertsGenerated.push(alert);
            }

            // Log monitoring activity
            logger.info('SLA monitoring completed', {
                tenantId,
                activeIncidents: activeIncidents.length,
                breachesDetected: breachesDetected.length,
                alertsGenerated: alertsGenerated.length,
            });

            return {
                tenantId,
                timestamp: now,
                breachesDetected,
                alertsGenerated,
                approachingDeadlines,
            };
        } catch (error) {
            logger.error('Failed to monitor SLA breaches', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
            });
            throw error;
        }
    }

    /**
     * Detect SLA breaches for a specific incident
     * Requirements: 10.1, 11.4
     */
    private static async detectIncidentSLABreaches(
        incident: SecurityIncident,
        currentTime: Date
    ): Promise<SLABreach[]> {
        const breaches: SLABreach[] = [];

        // Check acknowledge SLA breach
        if (incident.status === 'open' && currentTime > incident.slaAcknowledgeBy) {
            const breachDurationMinutes = Math.floor(
                (currentTime.getTime() - incident.slaAcknowledgeBy.getTime()) / (1000 * 60)
            );

            breaches.push({
                id: `${incident.id}-acknowledge-${currentTime.getTime()}`,
                tenantId: incident.tenantId,
                incidentId: incident.id,
                breachType: 'acknowledge',
                severity: incident.severity,
                expectedBy: incident.slaAcknowledgeBy,
                actualTime: null, // Still breached
                breachDurationMinutes,
                isResolved: false,
                createdAt: currentTime,
                resolvedAt: null,
            });
        }

        // Check investigate SLA breach
        if (incident.status === 'in_progress' &&
            (!incident.investigationStartedAt || currentTime > incident.slaInvestigateBy)) {
            const breachDurationMinutes = Math.floor(
                (currentTime.getTime() - incident.slaInvestigateBy.getTime()) / (1000 * 60)
            );

            breaches.push({
                id: `${incident.id}-investigate-${currentTime.getTime()}`,
                tenantId: incident.tenantId,
                incidentId: incident.id,
                breachType: 'investigate',
                severity: incident.severity,
                expectedBy: incident.slaInvestigateBy,
                actualTime: incident.investigationStartedAt || null,
                breachDurationMinutes,
                isResolved: false,
                createdAt: currentTime,
                resolvedAt: null,
            });
        }

        // Check resolve SLA breach
        if (inArray(incident.status, ['open', 'in_progress']) && currentTime > incident.slaResolveBy) {
            const breachDurationMinutes = Math.floor(
                (currentTime.getTime() - incident.slaResolveBy.getTime()) / (1000 * 60)
            );

            breaches.push({
                id: `${incident.id}-resolve-${currentTime.getTime()}`,
                tenantId: incident.tenantId,
                incidentId: incident.id,
                breachType: 'resolve',
                severity: incident.severity,
                expectedBy: incident.slaResolveBy,
                actualTime: incident.resolvedAt || null,
                breachDurationMinutes,
                isResolved: false,
                createdAt: currentTime,
                resolvedAt: null,
            });
        }

        return breaches;
    }

    /**
     * Get incidents approaching SLA deadlines
     * Requirements: 10.1, 11.4
     */
    private static async getIncidentsApproachingDeadlines(
        tenantId: string,
        warningMinutes: number
    ): Promise<{
        acknowledge: SecurityIncident[];
        investigate: SecurityIncident[];
        resolve: SecurityIncident[];
    }> {
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
            acknowledge: acknowledgeWarnings as SecurityIncident[],
            investigate: investigateWarnings as SecurityIncident[],
            resolve: resolveWarnings as SecurityIncident[],
        };
    }

    // ========================================================================
    // SLA Alert Generation
    // ========================================================================

    /**
     * Generate breach alert
     * Requirements: 11.4, 11.5
     */
    private static async generateBreachAlert(breach: SLABreach): Promise<SLABreachAlert> {
        const message = this.formatBreachMessage(breach);

        return {
            id: `alert-${breach.id}`,
            tenantId: breach.tenantId,
            incidentId: breach.incidentId,
            alertType: 'breach_detected',
            breachType: breach.breachType,
            severity: breach.severity,
            message,
            minutesSinceBreach: breach.breachDurationMinutes,
            createdAt: breach.createdAt,
            acknowledged: false,
            acknowledgedAt: null,
            acknowledgedBy: null,
        };
    }

    /**
     * Generate approaching deadline alert
     * Requirements: 11.4, 11.5
     */
    private static async generateApproachingDeadlineAlert(
        incident: SecurityIncident,
        breachType: 'acknowledge' | 'investigate' | 'resolve'
    ): Promise<SLABreachAlert> {
        const now = new Date();
        let deadline: Date;

        switch (breachType) {
            case 'acknowledge':
                deadline = incident.slaAcknowledgeBy;
                break;
            case 'investigate':
                deadline = incident.slaInvestigateBy;
                break;
            case 'resolve':
                deadline = incident.slaResolveBy;
                break;
        }

        const minutesUntilDeadline = Math.floor(
            (deadline.getTime() - now.getTime()) / (1000 * 60)
        );

        const message = this.formatApproachingDeadlineMessage(incident, breachType, minutesUntilDeadline);

        return {
            id: `alert-${incident.id}-${breachType}-approaching-${now.getTime()}`,
            tenantId: incident.tenantId,
            incidentId: incident.id,
            alertType: 'approaching_deadline',
            breachType,
            severity: incident.severity,
            message,
            minutesUntilDeadline,
            createdAt: now,
            acknowledged: false,
            acknowledgedAt: null,
            acknowledgedBy: null,
        };
    }

    /**
     * Format breach message
     */
    private static formatBreachMessage(breach: SLABreach): string {
        const severityText = breach.severity.toUpperCase();
        const breachTypeText = breach.breachType.charAt(0).toUpperCase() + breach.breachType.slice(1);

        return `${severityText} incident SLA breach: ${breachTypeText} deadline exceeded by ${breach.breachDurationMinutes} minutes (Incident: ${breach.incidentId})`;
    }

    /**
     * Format approaching deadline message
     */
    private static formatApproachingDeadlineMessage(
        incident: SecurityIncident,
        breachType: string,
        minutesUntilDeadline: number
    ): string {
        const severityText = incident.severity.toUpperCase();
        const breachTypeText = breachType.charAt(0).toUpperCase() + breachType.slice(1);

        return `${severityText} incident approaching SLA deadline: ${breachTypeText} due in ${minutesUntilDeadline} minutes (Incident: ${incident.id})`;
    }

    // ========================================================================
    // SLA Performance Metrics
    // ========================================================================

    /**
     * Calculate SLA performance metrics for reporting
     * Requirements: 11.4, 11.5
     */
    static async calculateSLAPerformanceMetrics(
        tenantId: string,
        startDate: Date,
        endDate: Date
    ): Promise<SLAPerformanceMetrics> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            // Get all incidents in the period (including resolved ones)
            const incidents = await db
                .select()
                .from(securityIncidents)
                .where(and(
                    eq(securityIncidents.tenantId, tenantId),
                    gte(securityIncidents.createdAt, startDate),
                    lte(securityIncidents.createdAt, endDate)
                ));

            const totalIncidents = incidents.length;

            // Calculate compliance metrics
            const acknowledgeMetrics = this.calculateComplianceMetrics(incidents, 'acknowledge');
            const investigateMetrics = this.calculateComplianceMetrics(incidents, 'investigate');
            const resolveMetrics = this.calculateComplianceMetrics(incidents, 'resolve');

            // Calculate overall compliance
            const overallCompliant = incidents.filter(incident =>
                this.isIncidentCompliant(incident as SecurityIncident)
            ).length;
            const overallBreached = totalIncidents - overallCompliant;

            // Calculate severity breakdown
            const severityBreakdown = this.calculateSeverityBreakdown(incidents);

            return {
                tenantId,
                period: { startDate, endDate },
                totalIncidents,
                acknowledgeCompliance: acknowledgeMetrics,
                investigateCompliance: investigateMetrics,
                resolveCompliance: resolveMetrics,
                overallCompliance: {
                    compliant: overallCompliant,
                    breached: overallBreached,
                    complianceRate: totalIncidents > 0 ? (overallCompliant / totalIncidents) * 100 : 100,
                },
                severityBreakdown,
            };
        } catch (error) {
            logger.error('Failed to calculate SLA performance metrics', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                startDate,
                endDate,
            });
            throw error;
        }
    }

    /**
     * Calculate compliance metrics for specific SLA type
     */
    private static calculateComplianceMetrics(
        incidents: any[],
        slaType: 'acknowledge' | 'investigate' | 'resolve'
    ) {
        const relevantIncidents = incidents.filter(incident => {
            // Only include incidents that should have reached this SLA stage
            switch (slaType) {
                case 'acknowledge':
                    return true; // All incidents should be acknowledged
                case 'investigate':
                    return incident.acknowledgedAt !== null; // Only acknowledged incidents
                case 'resolve':
                    return incident.investigationStartedAt !== null; // Only investigated incidents
                default:
                    return false;
            }
        });

        const total = relevantIncidents.length;
        let compliant = 0;
        let totalTimeMinutes = 0;

        for (const incident of relevantIncidents) {
            const isCompliant = this.isIncidentSLACompliant(incident, slaType);
            if (isCompliant) {
                compliant++;
            }

            // Calculate actual time taken
            const actualTime = this.getActualSLATime(incident, slaType);
            if (actualTime !== null) {
                totalTimeMinutes += actualTime;
            }
        }

        const breached = total - compliant;
        const complianceRate = total > 0 ? (compliant / total) * 100 : 100;
        const averageTimeMinutes = total > 0 ? totalTimeMinutes / total : 0;

        return {
            total,
            compliant,
            breached,
            complianceRate,
            averageTimeMinutes,
        };
    }

    /**
     * Check if incident is compliant for specific SLA type
     */
    private static isIncidentSLACompliant(incident: any, slaType: 'acknowledge' | 'investigate' | 'resolve'): boolean {
        switch (slaType) {
            case 'acknowledge':
                return incident.acknowledgedAt !== null &&
                    incident.acknowledgedAt <= incident.slaAcknowledgeBy;
            case 'investigate':
                return incident.investigationStartedAt !== null &&
                    incident.investigationStartedAt <= incident.slaInvestigateBy;
            case 'resolve':
                return incident.resolvedAt !== null &&
                    incident.resolvedAt <= incident.slaResolveBy;
            default:
                return false;
        }
    }

    /**
     * Get actual time taken for SLA type (in minutes)
     */
    private static getActualSLATime(incident: any, slaType: 'acknowledge' | 'investigate' | 'resolve'): number | null {
        const createdAt = new Date(incident.createdAt);

        switch (slaType) {
            case 'acknowledge':
                if (incident.acknowledgedAt) {
                    return Math.floor((new Date(incident.acknowledgedAt).getTime() - createdAt.getTime()) / (1000 * 60));
                }
                break;
            case 'investigate':
                if (incident.investigationStartedAt && incident.acknowledgedAt) {
                    return Math.floor((new Date(incident.investigationStartedAt).getTime() - new Date(incident.acknowledgedAt).getTime()) / (1000 * 60));
                }
                break;
            case 'resolve':
                if (incident.resolvedAt) {
                    return Math.floor((new Date(incident.resolvedAt).getTime() - createdAt.getTime()) / (1000 * 60));
                }
                break;
        }

        return null;
    }

    /**
     * Check if incident is overall compliant
     */
    private static isIncidentCompliant(incident: SecurityIncident): boolean {
        return this.isIncidentSLACompliant(incident, 'acknowledge') &&
            this.isIncidentSLACompliant(incident, 'investigate') &&
            this.isIncidentSLACompliant(incident, 'resolve');
    }

    /**
     * Calculate severity breakdown
     */
    private static calculateSeverityBreakdown(incidents: any[]): Record<AlertSeverity, {
        total: number;
        compliant: number;
        breached: number;
        complianceRate: number;
    }> {
        const severities: AlertSeverity[] = ['critical', 'high', 'medium', 'low'];
        const breakdown = {} as Record<AlertSeverity, any>;

        for (const severity of severities) {
            const severityIncidents = incidents.filter(incident => incident.severity === severity);
            const total = severityIncidents.length;
            const compliant = severityIncidents.filter(incident =>
                this.isIncidentCompliant(incident as SecurityIncident)
            ).length;
            const breached = total - compliant;
            const complianceRate = total > 0 ? (compliant / total) * 100 : 100;

            breakdown[severity] = {
                total,
                compliant,
                breached,
                complianceRate,
            };
        }

        return breakdown;
    }

    // ========================================================================
    // SLA Breach Recording (Non-blocking)
    // ========================================================================

    /**
     * Record SLA breach without blocking workflow
     * Requirements: 11.4, 11.5
     */
    static async recordSLABreach(breach: SLABreach): Promise<void> {
        try {
            // This would typically insert into a dedicated SLA breach tracking table
            // For now, we'll log it for audit purposes
            logger.warn('SLA breach recorded', {
                incidentId: breach.incidentId,
                tenantId: breach.tenantId,
                breachType: breach.breachType,
                severity: breach.severity,
                breachDurationMinutes: breach.breachDurationMinutes,
                expectedBy: breach.expectedBy,
                actualTime: breach.actualTime,
            });

            // In a production system, you would also:
            // 1. Insert into sla_breaches table
            // 2. Send notifications to relevant stakeholders
            // 3. Update dashboards/metrics
            // 4. Trigger escalation workflows if needed
        } catch (error) {
            // Non-blocking: log error but don't throw
            logger.error('Failed to record SLA breach (non-blocking)', error instanceof Error ? error : new Error(String(error)), {
                incidentId: breach.incidentId,
                tenantId: breach.tenantId,
                breachType: breach.breachType,
            });
        }
    }

    /**
     * Acknowledge SLA breach alert
     * Requirements: 11.4, 11.5
     */
    static async acknowledgeSLAAlert(
        alertId: string,
        tenantId: string,
        userId: string
    ): Promise<void> {
        try {
            // This would typically update the SLA alert in the database
            logger.info('SLA alert acknowledged', {
                alertId,
                tenantId,
                userId,
                acknowledgedAt: new Date(),
            });

            // In a production system, you would:
            // 1. Update sla_breach_alerts table
            // 2. Mark alert as acknowledged
            // 3. Record who acknowledged it and when
        } catch (error) {
            logger.error('Failed to acknowledge SLA alert', error instanceof Error ? error : new Error(String(error)), {
                alertId,
                tenantId,
                userId,
            });
            throw error;
        }
    }
}