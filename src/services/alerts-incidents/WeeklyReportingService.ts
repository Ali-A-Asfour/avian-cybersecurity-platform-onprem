/**
 * Weekly Reporting Service for Alerts & Security Incidents Module
 * 
 * Creates automated weekly report generation with:
 * - Alerts digested, alerts escalated, incidents by severity, and outcomes
 * - Tenant-scoped data aggregation
 * - Report scheduling and delivery mechanisms
 * 
 * Requirements: 11.1
 */

import { db } from '../../lib/database';
import {
    securityAlerts,
    securityIncidents,
    incidentAlertLinks
} from '../../../database/schemas/alerts-incidents';
import { eq, and, gte, lte, sql, count, desc } from 'drizzle-orm';
import { logger } from '../../lib/logger';
import {
    SecurityAlert,
    SecurityIncident,
    AlertSeverity,
    AlertStatus,
    IncidentStatus,
    WeeklyReport as AlertsIncidentsWeeklyReport
} from '../../types/alerts-incidents';

/**
 * Weekly Report Data Structure for Alerts & Incidents
 */
export interface AlertsIncidentsWeeklyReport {
    id: string;
    tenantId: string;
    reportType: 'weekly';
    dateRange: {
        startDate: Date;
        endDate: Date;
    };
    generatedAt: Date;
    generatedBy: string;

    // Core metrics (Requirements: 11.1)
    alertsDigested: number;
    alertsEscalated: number;
    incidentsBySeverity: Record<AlertSeverity, number>;
    outcomes: Record<IncidentStatus, number>;

    // Additional insights
    alertsByStatus: Record<AlertStatus, number>;
    alertsBySeverity: Record<AlertSeverity, number>;
    escalationRate: number; // Percentage of alerts escalated to incidents
    averageResolutionTime: number; // Minutes for resolved incidents

    // Trend data
    dailyAlertCounts: Array<{
        date: string;
        count: number;
    }>;

    // Top classifications
    topAlertClassifications: Array<{
        classification: string;
        count: number;
    }>;
}

/**
 * Report Generation Filters
 */
export interface WeeklyReportFilters {
    tenantId: string;
    startDate: Date;
    endDate: Date;
    includeResolved?: boolean;
    includeDismissed?: boolean;
}

/**
 * Report Scheduling Configuration
 */
export interface ReportScheduleConfig {
    tenantId: string;
    enabled: boolean;
    dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
    hour: number; // 0-23
    timezone: string;
    recipients: string[]; // Email addresses
    deliveryMethod: 'email' | 'dashboard' | 'both';
}

/**
 * Weekly Reporting Service Class
 * 
 * Provides comprehensive weekly reporting for alerts and incidents
 * with tenant isolation and automated scheduling.
 */
export class WeeklyReportingService {

    // ========================================================================
    // Report Generation
    // ========================================================================

    /**
     * Generate weekly report for alerts and incidents
     * Requirements: 11.1
     */
    static async generateWeeklyReport(
        filters: WeeklyReportFilters,
        generatedBy: string = 'system'
    ): Promise<AlertsIncidentsWeeklyReport> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            logger.info('Starting weekly report generation', {
                tenantId: filters.tenantId,
                startDate: filters.startDate,
                endDate: filters.endDate,
                generatedBy,
            });

            const reportId = `weekly-alerts-incidents-${filters.tenantId}-${Date.now()}`;

            // Generate core metrics
            const [
                alertsDigested,
                alertsEscalated,
                incidentsBySeverity,
                outcomes,
                alertsByStatus,
                alertsBySeverity,
                averageResolutionTime,
                dailyAlertCounts,
                topAlertClassifications
            ] = await Promise.all([
                this.getAlertsDigested(filters),
                this.getAlertsEscalated(filters),
                this.getIncidentsBySeverity(filters),
                this.getIncidentOutcomes(filters),
                this.getAlertsByStatus(filters),
                this.getAlertsBySeverity(filters),
                this.getAverageResolutionTime(filters),
                this.getDailyAlertCounts(filters),
                this.getTopAlertClassifications(filters)
            ]);

            // Calculate escalation rate
            const escalationRate = alertsDigested > 0 ? (alertsEscalated / alertsDigested) * 100 : 0;

            const report: AlertsIncidentsWeeklyReport = {
                id: reportId,
                tenantId: filters.tenantId,
                reportType: 'weekly',
                dateRange: {
                    startDate: filters.startDate,
                    endDate: filters.endDate,
                },
                generatedAt: new Date(),
                generatedBy,
                alertsDigested,
                alertsEscalated,
                incidentsBySeverity,
                outcomes,
                alertsByStatus,
                alertsBySeverity,
                escalationRate: Math.round(escalationRate * 100) / 100, // Round to 2 decimal places
                averageResolutionTime,
                dailyAlertCounts,
                topAlertClassifications,
            };

            logger.info('Weekly report generated successfully', {
                reportId: report.id,
                tenantId: filters.tenantId,
                alertsDigested,
                alertsEscalated,
                escalationRate: report.escalationRate,
            });

            return report;
        } catch (error) {
            logger.error('Failed to generate weekly report', error instanceof Error ? error : new Error(String(error)), {
                tenantId: filters.tenantId,
                startDate: filters.startDate,
                endDate: filters.endDate,
            });
            throw error;
        }
    }

    // ========================================================================
    // Data Aggregation Methods
    // ========================================================================

    /**
     * Get total alerts digested (created) in the period
     */
    private static async getAlertsDigested(filters: WeeklyReportFilters): Promise<number> {
        if (!db) return 0;

        const result = await db
            .select({ count: count() })
            .from(securityAlerts)
            .where(and(
                eq(securityAlerts.tenantId, filters.tenantId),
                gte(securityAlerts.createdAt, filters.startDate),
                lte(securityAlerts.createdAt, filters.endDate)
            ));

        return result[0]?.count || 0;
    }

    /**
     * Get total alerts escalated to incidents in the period
     */
    private static async getAlertsEscalated(filters: WeeklyReportFilters): Promise<number> {
        if (!db) return 0;

        const result = await db
            .select({ count: count() })
            .from(securityAlerts)
            .where(and(
                eq(securityAlerts.tenantId, filters.tenantId),
                eq(securityAlerts.status, 'escalated'),
                gte(securityAlerts.updatedAt, filters.startDate),
                lte(securityAlerts.updatedAt, filters.endDate)
            ));

        return result[0]?.count || 0;
    }

    /**
     * Get incidents by severity in the period
     */
    private static async getIncidentsBySeverity(filters: WeeklyReportFilters): Promise<Record<AlertSeverity, number>> {
        if (!db) {
            return { critical: 0, high: 0, medium: 0, low: 0 };
        }

        const result = await db
            .select({
                severity: securityIncidents.severity,
                count: count(),
            })
            .from(securityIncidents)
            .where(and(
                eq(securityIncidents.tenantId, filters.tenantId),
                gte(securityIncidents.createdAt, filters.startDate),
                lte(securityIncidents.createdAt, filters.endDate)
            ))
            .groupBy(securityIncidents.severity);

        const incidentsBySeverity: Record<AlertSeverity, number> = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
        };

        result.forEach(row => {
            incidentsBySeverity[row.severity as AlertSeverity] = row.count;
        });

        return incidentsBySeverity;
    }

    /**
     * Get incident outcomes in the period
     */
    private static async getIncidentOutcomes(filters: WeeklyReportFilters): Promise<Record<IncidentStatus, number>> {
        if (!db) {
            return { open: 0, in_progress: 0, resolved: 0, dismissed: 0 };
        }

        const result = await db
            .select({
                status: securityIncidents.status,
                count: count(),
            })
            .from(securityIncidents)
            .where(and(
                eq(securityIncidents.tenantId, filters.tenantId),
                gte(securityIncidents.createdAt, filters.startDate),
                lte(securityIncidents.createdAt, filters.endDate)
            ))
            .groupBy(securityIncidents.status);

        const outcomes: Record<IncidentStatus, number> = {
            open: 0,
            in_progress: 0,
            resolved: 0,
            dismissed: 0,
        };

        result.forEach(row => {
            outcomes[row.status as IncidentStatus] = row.count;
        });

        return outcomes;
    }

    /**
     * Get alerts by status in the period
     */
    private static async getAlertsByStatus(filters: WeeklyReportFilters): Promise<Record<AlertStatus, number>> {
        if (!db) {
            return { open: 0, assigned: 0, investigating: 0, escalated: 0, closed_benign: 0, closed_false_positive: 0 };
        }

        const result = await db
            .select({
                status: securityAlerts.status,
                count: count(),
            })
            .from(securityAlerts)
            .where(and(
                eq(securityAlerts.tenantId, filters.tenantId),
                gte(securityAlerts.createdAt, filters.startDate),
                lte(securityAlerts.createdAt, filters.endDate)
            ))
            .groupBy(securityAlerts.status);

        const alertsByStatus: Record<AlertStatus, number> = {
            open: 0,
            assigned: 0,
            investigating: 0,
            escalated: 0,
            closed_benign: 0,
            closed_false_positive: 0,
        };

        result.forEach(row => {
            alertsByStatus[row.status as AlertStatus] = row.count;
        });

        return alertsByStatus;
    }

    /**
     * Get alerts by severity in the period
     */
    private static async getAlertsBySeverity(filters: WeeklyReportFilters): Promise<Record<AlertSeverity, number>> {
        if (!db) {
            return { critical: 0, high: 0, medium: 0, low: 0 };
        }

        const result = await db
            .select({
                severity: securityAlerts.severity,
                count: count(),
            })
            .from(securityAlerts)
            .where(and(
                eq(securityAlerts.tenantId, filters.tenantId),
                gte(securityAlerts.createdAt, filters.startDate),
                lte(securityAlerts.createdAt, filters.endDate)
            ))
            .groupBy(securityAlerts.severity);

        const alertsBySeverity: Record<AlertSeverity, number> = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
        };

        result.forEach(row => {
            alertsBySeverity[row.severity as AlertSeverity] = row.count;
        });

        return alertsBySeverity;
    }

    /**
     * Get average resolution time for incidents resolved in the period (in minutes)
     */
    private static async getAverageResolutionTime(filters: WeeklyReportFilters): Promise<number> {
        if (!db) return 0;

        const result = await db
            .select({
                avgResolutionTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${securityIncidents.resolvedAt} - ${securityIncidents.createdAt})) / 60)`,
            })
            .from(securityIncidents)
            .where(and(
                eq(securityIncidents.tenantId, filters.tenantId),
                gte(securityIncidents.resolvedAt, filters.startDate),
                lte(securityIncidents.resolvedAt, filters.endDate),
                sql`${securityIncidents.resolvedAt} IS NOT NULL`
            ));

        return Math.round(result[0]?.avgResolutionTime || 0);
    }

    /**
     * Get daily alert counts for the period
     */
    private static async getDailyAlertCounts(filters: WeeklyReportFilters): Promise<Array<{ date: string; count: number }>> {
        if (!db) return [];

        const result = await db
            .select({
                date: sql<string>`DATE(${securityAlerts.createdAt})`,
                count: count(),
            })
            .from(securityAlerts)
            .where(and(
                eq(securityAlerts.tenantId, filters.tenantId),
                gte(securityAlerts.createdAt, filters.startDate),
                lte(securityAlerts.createdAt, filters.endDate)
            ))
            .groupBy(sql`DATE(${securityAlerts.createdAt})`)
            .orderBy(sql`DATE(${securityAlerts.createdAt})`);

        return result.map(row => ({
            date: row.date,
            count: row.count,
        }));
    }

    /**
     * Get top alert classifications in the period
     */
    private static async getTopAlertClassifications(filters: WeeklyReportFilters): Promise<Array<{ classification: string; count: number }>> {
        if (!db) return [];

        const result = await db
            .select({
                classification: securityAlerts.classification,
                count: count(),
            })
            .from(securityAlerts)
            .where(and(
                eq(securityAlerts.tenantId, filters.tenantId),
                gte(securityAlerts.createdAt, filters.startDate),
                lte(securityAlerts.createdAt, filters.endDate)
            ))
            .groupBy(securityAlerts.classification)
            .orderBy(desc(count()))
            .limit(10);

        return result.map(row => ({
            classification: row.classification,
            count: row.count,
        }));
    }

    // ========================================================================
    // Report Scheduling and Delivery
    // ========================================================================

    /**
     * Schedule weekly report generation
     * Requirements: 11.1
     */
    static async scheduleWeeklyReport(config: ReportScheduleConfig): Promise<void> {
        try {
            logger.info('Scheduling weekly report', {
                tenantId: config.tenantId,
                dayOfWeek: config.dayOfWeek,
                hour: config.hour,
                timezone: config.timezone,
                recipients: config.recipients.length,
            });

            // In a production environment, this would integrate with a job scheduler
            // like node-cron, Bull Queue, or AWS EventBridge
            // For now, we'll log the scheduling configuration

            // TODO: Implement actual scheduling mechanism
            // This could be:
            // 1. Cron job registration
            // 2. Database-stored schedule configuration
            // 3. Queue-based scheduling system

            logger.info('Weekly report scheduled successfully', {
                tenantId: config.tenantId,
                enabled: config.enabled,
            });
        } catch (error) {
            logger.error('Failed to schedule weekly report', error instanceof Error ? error : new Error(String(error)), {
                tenantId: config.tenantId,
            });
            throw error;
        }
    }

    /**
     * Deliver weekly report via configured method
     * Requirements: 11.1
     */
    static async deliverWeeklyReport(
        report: AlertsIncidentsWeeklyReport,
        config: ReportScheduleConfig
    ): Promise<void> {
        try {
            logger.info('Delivering weekly report', {
                reportId: report.id,
                tenantId: report.tenantId,
                deliveryMethod: config.deliveryMethod,
                recipients: config.recipients.length,
            });

            switch (config.deliveryMethod) {
                case 'email':
                    await this.deliverViaEmail(report, config.recipients);
                    break;
                case 'dashboard':
                    await this.deliverViaDashboard(report);
                    break;
                case 'both':
                    await Promise.all([
                        this.deliverViaEmail(report, config.recipients),
                        this.deliverViaDashboard(report)
                    ]);
                    break;
                default:
                    throw new Error(`Unsupported delivery method: ${config.deliveryMethod}`);
            }

            logger.info('Weekly report delivered successfully', {
                reportId: report.id,
                tenantId: report.tenantId,
                deliveryMethod: config.deliveryMethod,
            });
        } catch (error) {
            logger.error('Failed to deliver weekly report', error instanceof Error ? error : new Error(String(error)), {
                reportId: report.id,
                tenantId: report.tenantId,
            });
            throw error;
        }
    }

    /**
     * Deliver report via email
     */
    private static async deliverViaEmail(
        report: AlertsIncidentsWeeklyReport,
        recipients: string[]
    ): Promise<void> {
        // TODO: Implement email delivery
        // This would integrate with an email service like:
        // 1. AWS SES
        // 2. SendGrid
        // 3. Nodemailer with SMTP

        logger.info('Email delivery simulated', {
            reportId: report.id,
            recipients: recipients.length,
            alertsDigested: report.alertsDigested,
            alertsEscalated: report.alertsEscalated,
        });
    }

    /**
     * Deliver report via dashboard
     */
    private static async deliverViaDashboard(
        report: AlertsIncidentsWeeklyReport
    ): Promise<void> {
        // TODO: Implement dashboard delivery
        // This would:
        // 1. Store report in database for dashboard access
        // 2. Send notification to dashboard users
        // 3. Update dashboard widgets with new data

        logger.info('Dashboard delivery simulated', {
            reportId: report.id,
            tenantId: report.tenantId,
        });
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    /**
     * Get date range for current week
     */
    static getCurrentWeekDateRange(): { startDate: Date; endDate: Date } {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

        // Calculate start of week (Monday)
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        startDate.setHours(0, 0, 0, 0);

        // Calculate end of week (Sunday)
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);

        return { startDate, endDate };
    }

    /**
     * Get date range for previous week
     */
    static getPreviousWeekDateRange(): { startDate: Date; endDate: Date } {
        const currentWeek = this.getCurrentWeekDateRange();

        const startDate = new Date(currentWeek.startDate);
        startDate.setDate(currentWeek.startDate.getDate() - 7);

        const endDate = new Date(currentWeek.endDate);
        endDate.setDate(currentWeek.endDate.getDate() - 7);

        return { startDate, endDate };
    }

    /**
     * Validate report generation inputs
     */
    static validateReportInputs(filters: WeeklyReportFilters): void {
        if (!filters.tenantId) {
            throw new Error('Tenant ID is required');
        }

        if (!filters.startDate || !filters.endDate) {
            throw new Error('Start date and end date are required');
        }

        if (filters.startDate >= filters.endDate) {
            throw new Error('Start date must be before end date');
        }

        const maxRangeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
        if (filters.endDate.getTime() - filters.startDate.getTime() > maxRangeMs) {
            throw new Error('Date range cannot exceed 7 days for weekly reports');
        }
    }
}