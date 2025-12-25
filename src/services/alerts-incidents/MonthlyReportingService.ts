/**
 * Monthly Reporting Service for Alerts & Security Incidents Module
 * 
 * Creates automated monthly report generation with:
 * - Incident trends, MTTR calculation, and SLA compliance metrics
 * - Trend analysis and performance indicators
 * - Historical data preservation for reporting
 * 
 * Requirements: 11.2, 11.5
 */

import { db } from '../../lib/database';
import {
    securityAlerts,
    securityIncidents,
    incidentAlertLinks
} from '../../../database/schemas/alerts-incidents';
import { eq, and, gte, lte, sql, count, desc, avg } from 'drizzle-orm';
import { logger } from '../../lib/logger';
import {
    SecurityAlert,
    SecurityIncident,
    AlertSeverity,
    AlertStatus,
    IncidentStatus,
    MonthlyReport
} from '../../types/alerts-incidents';

/**
 * Report Generation Filters
 */
export interface MonthlyReportFilters {
    tenantId: string;
    startDate: Date;
    endDate: Date;
    includeResolved?: boolean;
    includeDismissed?: boolean;
}

/**
 * Report Scheduling Configuration
 */
export interface MonthlyReportScheduleConfig {
    tenantId: string;
    enabled: boolean;
    dayOfMonth: number; // 1-28 (safe for all months)
    hour: number; // 0-23
    timezone: string;
    recipients: string[]; // Email addresses
    deliveryMethod: 'email' | 'dashboard' | 'both';
}

/**
 * Incident Trend Data
 */
interface IncidentTrendData {
    totalIncidents: number;
    incidentsByStatus: Record<IncidentStatus, number>;
    incidentsBySeverity: Record<AlertSeverity, number>;
    weeklyBreakdown: Array<{
        weekStartDate: string;
        incidentCount: number;
        resolvedCount: number;
        escalatedCount: number;
    }>;
}

/**
 * SLA Compliance Data
 */
interface SLAComplianceData {
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
}

/**
 * Performance Indicators Data
 */
interface PerformanceIndicatorsData {
    alertToIncidentRatio: number;
    averageIncidentSeverity: number;
    resolutionEfficiency: number;
    analystWorkload: Array<{
        analystId: string;
        incidentsHandled: number;
        averageResolutionTime: number;
        slaComplianceRate: number;
    }>;
}

/**
 * Historical Comparison Data
 */
interface HistoricalComparisonData {
    previousMonthMttr: number;
    mttrTrend: 'improving' | 'declining' | 'stable';
    previousMonthIncidents: number;
    incidentVolumeTrend: 'increasing' | 'decreasing' | 'stable';
    previousMonthSlaCompliance: number;
    slaComplianceTrend: 'improving' | 'declining' | 'stable';
}

/**
 * Monthly Reporting Service Class
 * 
 * Provides comprehensive monthly reporting for alerts and incidents
 * with tenant isolation, trend analysis, and historical data preservation.
 */
export class MonthlyReportingService {

    // ========================================================================
    // Report Generation
    // ========================================================================

    /**
     * Generate monthly report for alerts and incidents
     * Requirements: 11.2, 11.5
     */
    static async generateMonthlyReport(
        filters: MonthlyReportFilters,
        generatedBy: string = 'system'
    ): Promise<MonthlyReport> {
        try {
            if (!db) {
                throw new Error('Database connection not available');
            }

            logger.info('Starting monthly report generation', {
                tenantId: filters.tenantId,
                startDate: filters.startDate,
                endDate: filters.endDate,
                generatedBy,
            });

            const reportId = `monthly-alerts-incidents-${filters.tenantId}-${Date.now()}`;

            // Generate core metrics in parallel
            const [
                incidentTrends,
                mttr,
                slaCompliance,
                performanceIndicators,
                historicalComparison,
                topIncidentClassifications,
                criticalInsights
            ] = await Promise.all([
                this.getIncidentTrends(filters),
                this.getMTTR(filters),
                this.getSLACompliance(filters),
                this.getPerformanceIndicators(filters),
                this.getHistoricalComparison(filters),
                this.getTopIncidentClassifications(filters),
                this.generateCriticalInsights(filters)
            ]);

            const report: MonthlyReport = {
                id: reportId,
                tenantId: filters.tenantId,
                reportType: 'monthly',
                dateRange: {
                    startDate: filters.startDate,
                    endDate: filters.endDate,
                },
                generatedAt: new Date(),
                generatedBy,
                incidentTrends,
                mttr,
                slaCompliance,
                performanceIndicators,
                historicalComparison,
                topIncidentClassifications,
                criticalInsights,
            };

            logger.info('Monthly report generated successfully', {
                reportId: report.id,
                tenantId: filters.tenantId,
                totalIncidents: incidentTrends.totalIncidents,
                mttr: report.mttr,
                slaComplianceRate: slaCompliance.overallComplianceRate,
            });

            return report;
        } catch (error) {
            logger.error('Failed to generate monthly report', error instanceof Error ? error : new Error(String(error)), {
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
     * Get incident trends for the month
     * Requirements: 11.2
     */
    private static async getIncidentTrends(filters: MonthlyReportFilters): Promise<IncidentTrendData> {
        if (!db) {
            return {
                totalIncidents: 0,
                incidentsByStatus: { open: 0, in_progress: 0, resolved: 0, dismissed: 0 },
                incidentsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
                weeklyBreakdown: []
            };
        }

        // Get total incidents
        const totalIncidentsResult = await db
            .select({ count: count() })
            .from(securityIncidents)
            .where(and(
                eq(securityIncidents.tenantId, filters.tenantId),
                gte(securityIncidents.createdAt, filters.startDate),
                lte(securityIncidents.createdAt, filters.endDate)
            ));

        const totalIncidents = totalIncidentsResult[0]?.count || 0;

        // Get incidents by status
        const incidentsByStatusResult = await db
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

        const incidentsByStatus: Record<IncidentStatus, number> = {
            open: 0,
            in_progress: 0,
            resolved: 0,
            dismissed: 0,
        };

        incidentsByStatusResult.forEach(row => {
            incidentsByStatus[row.status as IncidentStatus] = row.count;
        });

        // Get incidents by severity
        const incidentsBySeverityResult = await db
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

        incidentsBySeverityResult.forEach(row => {
            incidentsBySeverity[row.severity as AlertSeverity] = row.count;
        });

        // Get weekly breakdown
        const weeklyBreakdown = await this.getWeeklyBreakdown(filters);

        return {
            totalIncidents,
            incidentsByStatus,
            incidentsBySeverity,
            weeklyBreakdown,
        };
    }

    /**
     * Get weekly breakdown of incidents
     */
    private static async getWeeklyBreakdown(filters: MonthlyReportFilters): Promise<Array<{
        weekStartDate: string;
        incidentCount: number;
        resolvedCount: number;
        escalatedCount: number;
    }>> {
        if (!db) return [];

        // Generate week boundaries for the month
        const weeks = this.generateWeekBoundaries(filters.startDate, filters.endDate);
        const weeklyData = [];

        for (const week of weeks) {
            // Get incident count for this week
            const incidentCountResult = await db
                .select({ count: count() })
                .from(securityIncidents)
                .where(and(
                    eq(securityIncidents.tenantId, filters.tenantId),
                    gte(securityIncidents.createdAt, week.start),
                    lte(securityIncidents.createdAt, week.end)
                ));

            // Get resolved count for this week
            const resolvedCountResult = await db
                .select({ count: count() })
                .from(securityIncidents)
                .where(and(
                    eq(securityIncidents.tenantId, filters.tenantId),
                    eq(securityIncidents.status, 'resolved'),
                    gte(securityIncidents.resolvedAt, week.start),
                    lte(securityIncidents.resolvedAt, week.end),
                    sql`${securityIncidents.resolvedAt} IS NOT NULL`
                ));

            // Get escalated alerts count for this week (alerts that became incidents)
            const escalatedCountResult = await db
                .select({ count: count() })
                .from(securityAlerts)
                .where(and(
                    eq(securityAlerts.tenantId, filters.tenantId),
                    eq(securityAlerts.status, 'escalated'),
                    gte(securityAlerts.updatedAt, week.start),
                    lte(securityAlerts.updatedAt, week.end)
                ));

            weeklyData.push({
                weekStartDate: week.start.toISOString().split('T')[0],
                incidentCount: incidentCountResult[0]?.count || 0,
                resolvedCount: resolvedCountResult[0]?.count || 0,
                escalatedCount: escalatedCountResult[0]?.count || 0,
            });
        }

        return weeklyData;
    }

    /**
     * Calculate Mean Time To Resolution (MTTR) in minutes
     * Requirements: 11.2
     */
    private static async getMTTR(filters: MonthlyReportFilters): Promise<number> {
        if (!db) return 0;

        const result = await db
            .select({
                avgResolutionTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${securityIncidents.resolvedAt} - ${securityIncidents.createdAt})) / 60)`,
            })
            .from(securityIncidents)
            .where(and(
                eq(securityIncidents.tenantId, filters.tenantId),
                gte(securityIncidents.createdAt, filters.startDate),
                lte(securityIncidents.createdAt, filters.endDate),
                sql`${securityIncidents.resolvedAt} IS NOT NULL`,
                eq(securityIncidents.status, 'resolved')
            ));

        return Math.round(result[0]?.avgResolutionTime || 0);
    }

    /**
     * Get SLA compliance metrics
     * Requirements: 11.2
     */
    private static async getSLACompliance(filters: MonthlyReportFilters): Promise<SLAComplianceData> {
        if (!db) {
            return {
                overallComplianceRate: 0,
                breachesBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
                breachesByType: { acknowledge: 0, investigate: 0, resolve: 0 },
                complianceByWeek: []
            };
        }

        // Get all incidents in the period
        const incidents = await db
            .select()
            .from(securityIncidents)
            .where(and(
                eq(securityIncidents.tenantId, filters.tenantId),
                gte(securityIncidents.createdAt, filters.startDate),
                lte(securityIncidents.createdAt, filters.endDate)
            ));

        let totalIncidents = incidents.length;
        let totalBreaches = 0;
        const breachesBySeverity: Record<AlertSeverity, number> = {
            critical: 0, high: 0, medium: 0, low: 0
        };
        const breachesByType = { acknowledge: 0, investigate: 0, resolve: 0 };

        // Analyze each incident for SLA breaches
        for (const incident of incidents) {
            let hasBreaches = false;

            // Check acknowledge SLA
            if (incident.acknowledgedAt && incident.acknowledgedAt > incident.slaAcknowledgeBy) {
                breachesByType.acknowledge++;
                hasBreaches = true;
            }

            // Check investigate SLA
            if (incident.investigationStartedAt && incident.investigationStartedAt > incident.slaInvestigateBy) {
                breachesByType.investigate++;
                hasBreaches = true;
            }

            // Check resolve SLA
            if (incident.resolvedAt && incident.resolvedAt > incident.slaResolveBy) {
                breachesByType.resolve++;
                hasBreaches = true;
            }

            if (hasBreaches) {
                totalBreaches++;
                breachesBySeverity[incident.severity as AlertSeverity]++;
            }
        }

        const overallComplianceRate = totalIncidents > 0
            ? Math.round(((totalIncidents - totalBreaches) / totalIncidents) * 100 * 100) / 100
            : 100;

        // Get weekly compliance breakdown
        const complianceByWeek = await this.getWeeklyComplianceBreakdown(filters);

        return {
            overallComplianceRate,
            breachesBySeverity,
            breachesByType,
            complianceByWeek,
        };
    }

    /**
     * Get weekly SLA compliance breakdown
     */
    private static async getWeeklyComplianceBreakdown(filters: MonthlyReportFilters): Promise<Array<{
        weekStartDate: string;
        complianceRate: number;
        totalIncidents: number;
        breaches: number;
    }>> {
        if (!db) return [];

        const weeks = this.generateWeekBoundaries(filters.startDate, filters.endDate);
        const weeklyCompliance = [];

        for (const week of weeks) {
            const incidents = await db
                .select()
                .from(securityIncidents)
                .where(and(
                    eq(securityIncidents.tenantId, filters.tenantId),
                    gte(securityIncidents.createdAt, week.start),
                    lte(securityIncidents.createdAt, week.end)
                ));

            let breaches = 0;
            for (const incident of incidents) {
                const hasAcknowledgeBreach = incident.acknowledgedAt && incident.acknowledgedAt > incident.slaAcknowledgeBy;
                const hasInvestigateBreach = incident.investigationStartedAt && incident.investigationStartedAt > incident.slaInvestigateBy;
                const hasResolveBreach = incident.resolvedAt && incident.resolvedAt > incident.slaResolveBy;

                if (hasAcknowledgeBreach || hasInvestigateBreach || hasResolveBreach) {
                    breaches++;
                }
            }

            const complianceRate = incidents.length > 0
                ? Math.round(((incidents.length - breaches) / incidents.length) * 100 * 100) / 100
                : 100;

            weeklyCompliance.push({
                weekStartDate: week.start.toISOString().split('T')[0],
                complianceRate,
                totalIncidents: incidents.length,
                breaches,
            });
        }

        return weeklyCompliance;
    }

    /**
     * Get performance indicators
     * Requirements: 11.2
     */
    private static async getPerformanceIndicators(filters: MonthlyReportFilters): Promise<PerformanceIndicatorsData> {
        if (!db) {
            return {
                alertToIncidentRatio: 0,
                averageIncidentSeverity: 0,
                resolutionEfficiency: 0,
                analystWorkload: []
            };
        }

        // Get alert to incident ratio
        const [alertCount, incidentCount] = await Promise.all([
            db.select({ count: count() })
                .from(securityAlerts)
                .where(and(
                    eq(securityAlerts.tenantId, filters.tenantId),
                    gte(securityAlerts.createdAt, filters.startDate),
                    lte(securityAlerts.createdAt, filters.endDate)
                )),
            db.select({ count: count() })
                .from(securityIncidents)
                .where(and(
                    eq(securityIncidents.tenantId, filters.tenantId),
                    gte(securityIncidents.createdAt, filters.startDate),
                    lte(securityIncidents.createdAt, filters.endDate)
                ))
        ]);

        const alertToIncidentRatio = incidentCount[0]?.count > 0
            ? Math.round((alertCount[0]?.count || 0) / incidentCount[0].count * 100) / 100
            : 0;

        // Calculate average incident severity (numerical scale)
        const severityWeights = { critical: 4, high: 3, medium: 2, low: 1 };
        const incidents = await db
            .select({ severity: securityIncidents.severity })
            .from(securityIncidents)
            .where(and(
                eq(securityIncidents.tenantId, filters.tenantId),
                gte(securityIncidents.createdAt, filters.startDate),
                lte(securityIncidents.createdAt, filters.endDate)
            ));

        const averageIncidentSeverity = incidents.length > 0
            ? incidents.reduce((sum, incident) => sum + severityWeights[incident.severity as AlertSeverity], 0) / incidents.length
            : 0;

        // Calculate resolution efficiency (percentage of incidents resolved vs dismissed)
        const resolvedCount = await db
            .select({ count: count() })
            .from(securityIncidents)
            .where(and(
                eq(securityIncidents.tenantId, filters.tenantId),
                eq(securityIncidents.status, 'resolved'),
                gte(securityIncidents.createdAt, filters.startDate),
                lte(securityIncidents.createdAt, filters.endDate)
            ));

        const resolutionEfficiency = incidentCount[0]?.count > 0
            ? Math.round((resolvedCount[0]?.count || 0) / incidentCount[0].count * 100 * 100) / 100
            : 0;

        // Get analyst workload data
        const analystWorkload = await this.getAnalystWorkload(filters);

        return {
            alertToIncidentRatio,
            averageIncidentSeverity: Math.round(averageIncidentSeverity * 100) / 100,
            resolutionEfficiency,
            analystWorkload,
        };
    }

    /**
     * Get analyst workload metrics
     */
    private static async getAnalystWorkload(filters: MonthlyReportFilters): Promise<Array<{
        analystId: string;
        incidentsHandled: number;
        averageResolutionTime: number;
        slaComplianceRate: number;
    }>> {
        if (!db) return [];

        // Get incidents by analyst (owner)
        const analystIncidents = await db
            .select({
                ownerId: securityIncidents.ownerId,
                count: count(),
                avgResolutionTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${securityIncidents.resolvedAt} - ${securityIncidents.createdAt})) / 60)`,
            })
            .from(securityIncidents)
            .where(and(
                eq(securityIncidents.tenantId, filters.tenantId),
                gte(securityIncidents.createdAt, filters.startDate),
                lte(securityIncidents.createdAt, filters.endDate)
            ))
            .groupBy(securityIncidents.ownerId);

        const workloadData = [];

        for (const analyst of analystIncidents) {
            // Calculate SLA compliance for this analyst
            const incidents = await db
                .select()
                .from(securityIncidents)
                .where(and(
                    eq(securityIncidents.tenantId, filters.tenantId),
                    eq(securityIncidents.ownerId, analyst.ownerId),
                    gte(securityIncidents.createdAt, filters.startDate),
                    lte(securityIncidents.createdAt, filters.endDate)
                ));

            let breaches = 0;
            for (const incident of incidents) {
                const hasAcknowledgeBreach = incident.acknowledgedAt && incident.acknowledgedAt > incident.slaAcknowledgeBy;
                const hasInvestigateBreach = incident.investigationStartedAt && incident.investigationStartedAt > incident.slaInvestigateBy;
                const hasResolveBreach = incident.resolvedAt && incident.resolvedAt > incident.slaResolveBy;

                if (hasAcknowledgeBreach || hasInvestigateBreach || hasResolveBreach) {
                    breaches++;
                }
            }

            const slaComplianceRate = incidents.length > 0
                ? Math.round(((incidents.length - breaches) / incidents.length) * 100 * 100) / 100
                : 100;

            workloadData.push({
                analystId: analyst.ownerId,
                incidentsHandled: analyst.count,
                averageResolutionTime: Math.round(analyst.avgResolutionTime || 0),
                slaComplianceRate,
            });
        }

        return workloadData.sort((a, b) => b.incidentsHandled - a.incidentsHandled);
    }

    /**
     * Get historical comparison with previous month
     * Requirements: 11.5
     */
    private static async getHistoricalComparison(filters: MonthlyReportFilters): Promise<HistoricalComparisonData> {
        if (!db) {
            return {
                previousMonthMttr: 0,
                mttrTrend: 'stable',
                previousMonthIncidents: 0,
                incidentVolumeTrend: 'stable',
                previousMonthSlaCompliance: 100,
                slaComplianceTrend: 'stable',
            };
        }

        // Calculate previous month date range
        const previousMonthStart = new Date(filters.startDate);
        previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);

        const previousMonthEnd = new Date(filters.endDate);
        previousMonthEnd.setMonth(previousMonthEnd.getMonth() - 1);

        const previousMonthFilters: MonthlyReportFilters = {
            ...filters,
            startDate: previousMonthStart,
            endDate: previousMonthEnd,
        };

        // Get previous month metrics
        const [previousMttr, previousIncidentCount, previousSlaCompliance] = await Promise.all([
            this.getMTTR(previousMonthFilters),
            this.getIncidentCount(previousMonthFilters),
            this.getSLAComplianceRate(previousMonthFilters)
        ]);

        // Get current month metrics for comparison
        const [currentMttr, currentIncidentCount, currentSlaCompliance] = await Promise.all([
            this.getMTTR(filters),
            this.getIncidentCount(filters),
            this.getSLAComplianceRate(filters)
        ]);

        // Determine trends
        const mttrTrend = this.calculateTrend(currentMttr, previousMttr, true); // Lower is better for MTTR
        const incidentVolumeTrend = this.calculateTrend(currentIncidentCount, previousIncidentCount, false);
        const slaComplianceTrend = this.calculateTrend(currentSlaCompliance, previousSlaCompliance, false);

        return {
            previousMonthMttr: previousMttr,
            mttrTrend,
            previousMonthIncidents: previousIncidentCount,
            incidentVolumeTrend,
            previousMonthSlaCompliance: previousSlaCompliance,
            slaComplianceTrend,
        };
    }

    /**
     * Get incident count for a period
     */
    private static async getIncidentCount(filters: MonthlyReportFilters): Promise<number> {
        if (!db) return 0;

        const result = await db
            .select({ count: count() })
            .from(securityIncidents)
            .where(and(
                eq(securityIncidents.tenantId, filters.tenantId),
                gte(securityIncidents.createdAt, filters.startDate),
                lte(securityIncidents.createdAt, filters.endDate)
            ));

        return result[0]?.count || 0;
    }

    /**
     * Get SLA compliance rate for a period
     */
    private static async getSLAComplianceRate(filters: MonthlyReportFilters): Promise<number> {
        const slaData = await this.getSLACompliance(filters);
        return slaData.overallComplianceRate;
    }

    /**
     * Get top incident classifications
     */
    private static async getTopIncidentClassifications(filters: MonthlyReportFilters): Promise<Array<{
        classification: string;
        count: number;
        averageResolutionTime: number;
    }>> {
        if (!db) return [];

        // Get incidents with their primary alerts to get classifications
        const result = await db
            .select({
                classification: securityAlerts.classification,
                count: count(),
                avgResolutionTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${securityIncidents.resolvedAt} - ${securityIncidents.createdAt})) / 60)`,
            })
            .from(securityIncidents)
            .innerJoin(incidentAlertLinks, eq(incidentAlertLinks.incidentId, securityIncidents.id))
            .innerJoin(securityAlerts, eq(securityAlerts.id, incidentAlertLinks.alertId))
            .where(and(
                eq(securityIncidents.tenantId, filters.tenantId),
                eq(incidentAlertLinks.isPrimary, true),
                gte(securityIncidents.createdAt, filters.startDate),
                lte(securityIncidents.createdAt, filters.endDate)
            ))
            .groupBy(securityAlerts.classification)
            .orderBy(desc(count()))
            .limit(10);

        return result.map(row => ({
            classification: row.classification,
            count: row.count,
            averageResolutionTime: Math.round(row.avgResolutionTime || 0),
        }));
    }

    /**
     * Generate critical insights based on data analysis
     * Requirements: 11.2
     */
    private static async generateCriticalInsights(filters: MonthlyReportFilters): Promise<string[]> {
        const insights: string[] = [];

        try {
            // Get key metrics for analysis
            const [incidentTrends, mttr, slaCompliance, performanceIndicators] = await Promise.all([
                this.getIncidentTrends(filters),
                this.getMTTR(filters),
                this.getSLACompliance(filters),
                this.getPerformanceIndicators(filters)
            ]);

            // Analyze incident volume
            if (incidentTrends.totalIncidents === 0) {
                insights.push("No security incidents were created this month, indicating strong preventive security measures.");
            } else if (incidentTrends.totalIncidents > 50) {
                insights.push(`High incident volume detected (${incidentTrends.totalIncidents} incidents). Consider reviewing alert tuning and threat detection rules.`);
            }

            // Analyze MTTR
            if (mttr > 480) { // 8 hours
                insights.push(`Mean Time To Resolution (${Math.round(mttr / 60 * 100) / 100} hours) exceeds recommended thresholds. Review incident response processes.`);
            } else if (mttr < 120) { // 2 hours
                insights.push(`Excellent Mean Time To Resolution (${Math.round(mttr / 60 * 100) / 100} hours) demonstrates efficient incident response capabilities.`);
            }

            // Analyze SLA compliance
            if (slaCompliance.overallComplianceRate < 80) {
                insights.push(`SLA compliance rate (${slaCompliance.overallComplianceRate}%) is below target. Focus on acknowledge and investigate time improvements.`);
            } else if (slaCompliance.overallComplianceRate > 95) {
                insights.push(`Outstanding SLA compliance rate (${slaCompliance.overallComplianceRate}%) demonstrates mature incident response processes.`);
            }

            // Analyze severity distribution
            const criticalIncidents = incidentTrends.incidentsBySeverity.critical;
            const totalIncidents = incidentTrends.totalIncidents;
            if (criticalIncidents > 0 && totalIncidents > 0) {
                const criticalPercentage = Math.round((criticalIncidents / totalIncidents) * 100);
                if (criticalPercentage > 20) {
                    insights.push(`High percentage of critical incidents (${criticalPercentage}%). Review threat detection accuracy and incident classification criteria.`);
                }
            }

            // Analyze resolution efficiency
            if (performanceIndicators.resolutionEfficiency < 70) {
                insights.push(`Resolution efficiency (${performanceIndicators.resolutionEfficiency}%) indicates high dismissal rate. Review alert quality and investigation procedures.`);
            }

            // Analyze alert to incident ratio
            if (performanceIndicators.alertToIncidentRatio > 20) {
                insights.push(`High alert-to-incident ratio (${performanceIndicators.alertToIncidentRatio}:1) suggests potential alert fatigue. Consider alert tuning.`);
            } else if (performanceIndicators.alertToIncidentRatio < 5) {
                insights.push(`Low alert-to-incident ratio (${performanceIndicators.alertToIncidentRatio}:1) indicates effective alert filtering and high-quality security signals.`);
            }

            // If no specific insights, provide general summary
            if (insights.length === 0) {
                insights.push("Security incident metrics are within normal operational parameters. Continue monitoring for trends.");
            }

        } catch (error) {
            logger.error('Failed to generate critical insights', error instanceof Error ? error : new Error(String(error)));
            insights.push("Unable to generate detailed insights due to data analysis error. Manual review recommended.");
        }

        return insights;
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    /**
     * Generate week boundaries for a date range
     */
    private static generateWeekBoundaries(startDate: Date, endDate: Date): Array<{ start: Date; end: Date }> {
        const weeks = [];
        const current = new Date(startDate);

        // Start from the beginning of the week (Monday)
        const dayOfWeek = current.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        current.setDate(current.getDate() - daysToMonday);
        current.setHours(0, 0, 0, 0);

        while (current <= endDate) {
            const weekStart = new Date(current);
            const weekEnd = new Date(current);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            // Adjust boundaries to fit within the requested range
            const adjustedStart = weekStart < startDate ? startDate : weekStart;
            const adjustedEnd = weekEnd > endDate ? endDate : weekEnd;

            weeks.push({
                start: adjustedStart,
                end: adjustedEnd,
            });

            current.setDate(current.getDate() + 7);
        }

        return weeks;
    }

    /**
     * Calculate trend direction
     */
    private static calculateTrend(
        current: number,
        previous: number,
        lowerIsBetter: boolean = false
    ): 'improving' | 'declining' | 'stable' {
        const threshold = 0.05; // 5% threshold for stability
        const percentChange = previous > 0 ? (current - previous) / previous : 0;

        if (Math.abs(percentChange) < threshold) {
            return 'stable';
        }

        if (lowerIsBetter) {
            return percentChange < 0 ? 'improving' : 'declining';
        } else {
            return percentChange > 0 ? 'improving' : 'declining';
        }
    }

    /**
     * Get date range for current month
     */
    static getCurrentMonthDateRange(): { startDate: Date; endDate: Date } {
        const now = new Date();

        const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

        return { startDate, endDate };
    }

    /**
     * Get date range for previous month
     */
    static getPreviousMonthDateRange(): { startDate: Date; endDate: Date } {
        const now = new Date();

        const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
        const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));

        return { startDate, endDate };
    }

    /**
     * Validate report generation inputs
     */
    static validateReportInputs(filters: MonthlyReportFilters): void {
        if (!filters.tenantId) {
            throw new Error('Tenant ID is required');
        }

        if (!filters.startDate || !filters.endDate) {
            throw new Error('Start date and end date are required');
        }

        if (filters.startDate >= filters.endDate) {
            throw new Error('Start date must be before end date');
        }

        const maxRangeMs = 32 * 24 * 60 * 60 * 1000; // 32 days (covers longest month)
        if (filters.endDate.getTime() - filters.startDate.getTime() > maxRangeMs) {
            throw new Error('Date range cannot exceed 32 days for monthly reports');
        }
    }

    // ========================================================================
    // Report Scheduling and Delivery
    // ========================================================================

    /**
     * Schedule monthly report generation
     * Requirements: 11.5
     */
    static async scheduleMonthlyReport(config: MonthlyReportScheduleConfig): Promise<void> {
        try {
            logger.info('Scheduling monthly report', {
                tenantId: config.tenantId,
                dayOfMonth: config.dayOfMonth,
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

            logger.info('Monthly report scheduled successfully', {
                tenantId: config.tenantId,
                enabled: config.enabled,
            });
        } catch (error) {
            logger.error('Failed to schedule monthly report', error instanceof Error ? error : new Error(String(error)), {
                tenantId: config.tenantId,
            });
            throw error;
        }
    }

    /**
     * Deliver monthly report via configured method
     * Requirements: 11.5
     */
    static async deliverMonthlyReport(
        report: MonthlyReport,
        config: MonthlyReportScheduleConfig
    ): Promise<void> {
        try {
            logger.info('Delivering monthly report', {
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

            logger.info('Monthly report delivered successfully', {
                reportId: report.id,
                tenantId: report.tenantId,
                deliveryMethod: config.deliveryMethod,
            });
        } catch (error) {
            logger.error('Failed to deliver monthly report', error instanceof Error ? error : new Error(String(error)), {
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
        report: MonthlyReport,
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
            totalIncidents: report.incidentTrends.totalIncidents,
            mttr: report.mttr,
            slaCompliance: report.slaCompliance.overallComplianceRate,
        });
    }

    /**
     * Deliver report via dashboard
     */
    private static async deliverViaDashboard(
        report: MonthlyReport
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
}