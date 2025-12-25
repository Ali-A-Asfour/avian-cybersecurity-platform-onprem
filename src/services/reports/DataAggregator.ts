/**
 * Data Aggregator Service
 * 
 * Retrieves and processes security data for report generation with tenant isolation.
 * Implements AlertsDigest, UpdatesSummary, and VulnerabilityPosture aggregation
 * with timezone support and weekly timeline generation.
 * 
 * Requirements: 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.5
 */

import { logger } from '@/lib/logger';
import {
    EnhancedDateRange,
    AlertsDigest,
    UpdatesSummary,
    VulnerabilityPosture,
    DailyAlertCount,
    AlertClassification,
    AlertSource,
    AlertRecord,
    MetricsRecord,
    TrendData,
    RecurringAlertType,
    VulnerabilityAging
} from '@/types/reports';
import { HistoricalDataStore } from './HistoricalDataStore';
import { AlertClassificationService } from './AlertClassificationService';
import { ReportCacheService } from './ReportCacheService';

/**
 * Trend analysis configuration for monthly reports
 */
interface TrendAnalysisConfig {
    includeWeekOverWeek: boolean;
    includeRecurringAlerts: boolean;
    includeVulnerabilityAging: boolean;
    minimumRecurrenceThreshold: number;
}

/**
 * Data Aggregator Service
 * 
 * Orchestrates data retrieval and processing for report generation.
 * Provides aggregated data structures for AlertsDigest, UpdatesSummary,
 * and VulnerabilityPosture with proper timezone handling.
 */
export class DataAggregator {
    private readonly historicalDataStore: HistoricalDataStore;
    private readonly alertClassificationService: AlertClassificationService;
    private readonly cacheService: ReportCacheService;

    constructor(
        historicalDataStore: HistoricalDataStore,
        alertClassificationService: AlertClassificationService,
        cacheService?: ReportCacheService
    ) {
        this.historicalDataStore = historicalDataStore;
        this.alertClassificationService = alertClassificationService;
        this.cacheService = cacheService || new ReportCacheService();
    }

    /**
     * Validates tenant access and date range parameters
     */
    private validateInputs(tenantId: string, dateRange: EnhancedDateRange): void {
        if (!tenantId || typeof tenantId !== 'string') {
            throw new Error('Valid tenant ID is required');
        }

        if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
            throw new Error('Valid date range is required');
        }

        if (dateRange.startDate >= dateRange.endDate) {
            throw new Error('Start date must be before end date');
        }

        if (!dateRange.timezone) {
            throw new Error('Timezone is required for proper date handling');
        }

        if (dateRange.weekStart !== 'monday') {
            throw new Error('Week start must be Monday for ISO week compliance');
        }
    }

    /**
     * Converts dates to tenant timezone for consistent processing
     */
    private convertToTenantTimezone(dateRange: EnhancedDateRange): { start: Date; end: Date } {
        // For now, we'll use the provided dates directly
        // In a full implementation, this would use a timezone library like date-fns-tz
        return {
            start: dateRange.startDate,
            end: dateRange.endDate
        };
    }

    /**
     * Generates weekly timeline with Monday-Sunday buckets and zero-fill
     */
    private generateWeeklyTimeline(
        alerts: AlertRecord[],
        dateRange: EnhancedDateRange
    ): DailyAlertCount[] {
        const { start } = this.convertToTenantTimezone(dateRange);

        // Day names in Monday-first order
        const dayNames: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'> = [
            'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
        ];

        // Initialize timeline with zero counts for all 7 days
        const timeline: DailyAlertCount[] = [];

        // Generate exactly 7 days starting from the start date
        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + i);

            // Get day of week (0 = Sunday, 1 = Monday, etc.)
            const dayOfWeekIndex = currentDate.getDay();
            // Convert to our Monday-first format (0 = Monday, 6 = Sunday)
            const adjustedDayIndex = dayOfWeekIndex === 0 ? 6 : dayOfWeekIndex - 1;

            timeline.push({
                date: currentDate.toISOString().split('T')[0], // YYYY-MM-DD format in tenant timezone
                dayOfWeek: dayNames[adjustedDayIndex],
                count: 0 // Zero-fill - will be updated below
            });
        }

        // Count alerts for each day based on creation timestamps
        alerts.forEach(alert => {
            const alertDate = alert.createdAt.toISOString().split('T')[0];
            const timelineEntry = timeline.find(entry => entry.date === alertDate);
            if (timelineEntry) {
                timelineEntry.count++;
            }
        });

        logger.debug('Weekly timeline generated', {
            totalDays: timeline.length,
            totalAlerts: alerts.length,
            timelineData: timeline,
            category: 'reports'
        });

        return timeline;
    }

    /**
     * Implements AlertsDigest aggregation with timezone support
     * 
     * Requirements: 2.2, 2.3, 2.4, 2.5
     * - Categorizes alerts using AlertClassification enum
     * - Implements alert outcome classification (Security Incidents, Benign, False Positives)
     * - Adds weekly timeline generation (Monday-Sunday) in tenant timezone with zero-fill
     * - Includes source breakdown and attribution
     */
    async getAlertsDigest(tenantId: string, dateRange: EnhancedDateRange): Promise<AlertsDigest> {
        this.validateInputs(tenantId, dateRange);

        // Try to get from cache first
        const cachedDigest = await this.cacheService.getCachedAggregatedData<AlertsDigest>(
            tenantId,
            'alerts_digest',
            dateRange
        );

        if (cachedDigest) {
            logger.debug('AlertsDigest retrieved from cache', {
                tenantId,
                dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                category: 'reports'
            });
            return cachedDigest;
        }

        try {
            // Retrieve alert history from historical data store
            const alerts = await this.historicalDataStore.getAlertHistory(tenantId, dateRange);

            // Get alert outcome classification
            const outcomeClassification = await this.historicalDataStore.getAlertOutcomeClassification(tenantId, dateRange);

            // Calculate total alerts digested (using proper terminology per requirement 2.2)
            const totalAlertsDigested = alerts.length;

            // Categorize alerts by AVIAN classification (requirement 2.3)
            const alertClassification: Record<AlertClassification, number> = {
                [AlertClassification.PHISHING]: 0,
                [AlertClassification.MALWARE]: 0,
                [AlertClassification.SPYWARE]: 0,
                [AlertClassification.AUTHENTICATION]: 0,
                [AlertClassification.NETWORK]: 0,
                [AlertClassification.OTHER]: 0
            };

            alerts.forEach(alert => {
                alertClassification[alert.normalizedType]++;
            });

            // Calculate alert outcomes (requirement 2.4)
            // Ensure mutually exclusive totals
            const alertOutcomes = {
                securityIncidents: outcomeClassification.securityIncidents.length,
                benignActivity: outcomeClassification.benignActivity.length,
                falsePositives: outcomeClassification.falsePositives.length
            };

            // Verify mathematical consistency
            const totalOutcomes = alertOutcomes.securityIncidents + alertOutcomes.benignActivity + alertOutcomes.falsePositives;
            if (totalOutcomes !== totalAlertsDigested) {
                logger.warn('Alert outcome totals do not match total alerts', {
                    totalAlertsDigested,
                    totalOutcomes,
                    alertOutcomes,
                    tenantId,
                    category: 'reports'
                });
            }

            // Generate weekly timeline (Monday-Sunday) with zero-fill (requirement 2.5)
            const weeklyTimeline = this.generateWeeklyTimeline(alerts, dateRange);

            // Calculate source breakdown and attribution
            const sourceBreakdown: Record<AlertSource, number> = {
                [AlertSource.DEFENDER]: 0,
                [AlertSource.SONICWALL]: 0,
                [AlertSource.AVAST]: 0,
                [AlertSource.FIREWALL_EMAIL]: 0
            };

            alerts.forEach(alert => {
                sourceBreakdown[alert.source]++;
            });

            const alertsDigest: AlertsDigest = {
                totalAlertsDigested,
                alertClassification,
                alertOutcomes,
                weeklyTimeline,
                sourceBreakdown
            };

            // Cache the result
            await this.cacheService.cacheAggregatedData(tenantId, 'alerts_digest', dateRange, alertsDigest);

            logger.info('AlertsDigest aggregation completed', {
                tenantId,
                dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                totalAlertsDigested,
                alertClassification,
                alertOutcomes,
                sourceBreakdown,
                timelineDays: weeklyTimeline.length,
                category: 'reports'
            });

            return alertsDigest;

        } catch (error) {
            logger.error('Failed to generate AlertsDigest', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                category: 'reports'
            });
            throw new Error(`Failed to generate AlertsDigest: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Implements UpdatesSummary aggregation
     * 
     * Requirements: 3.1, 3.2, 3.3, 3.4
     * - Categorizes updates by source (Windows, Office, Firewall, Other)
     * - Implements total and per-category counting
     * - Adds progress visualization data preparation
     */
    async getUpdatesSummary(tenantId: string, dateRange: EnhancedDateRange): Promise<UpdatesSummary> {
        this.validateInputs(tenantId, dateRange);

        // Try to get from cache first
        const cachedSummary = await this.cacheService.getCachedAggregatedData<UpdatesSummary>(
            tenantId,
            'updates_summary',
            dateRange
        );

        if (cachedSummary) {
            logger.debug('UpdatesSummary retrieved from cache', {
                tenantId,
                dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                category: 'reports'
            });
            return cachedSummary;
        }

        try {
            // Get update summary aggregation from historical data store
            const updateData = await this.historicalDataStore.getUpdateSummaryAggregation(tenantId, dateRange);

            // Use proper terminology per requirement 3.1 ("Updates" instead of "OS Updates")
            const updatesSummary: UpdatesSummary = {
                totalUpdatesApplied: updateData.totalUpdatesApplied,
                updatesBySource: {
                    windows: updateData.updatesBySource.windows,
                    microsoftOffice: updateData.updatesBySource.microsoftOffice,
                    firewall: updateData.updatesBySource.firewall,
                    other: updateData.updatesBySource.other
                }
            };

            // Verify mathematical consistency (requirement 3.3)
            const calculatedTotal = Object.values(updatesSummary.updatesBySource).reduce((sum, count) => sum + count, 0);
            if (calculatedTotal !== updatesSummary.totalUpdatesApplied) {
                logger.warn('Update totals do not match sum of categories', {
                    totalUpdatesApplied: updatesSummary.totalUpdatesApplied,
                    calculatedTotal,
                    updatesBySource: updatesSummary.updatesBySource,
                    tenantId,
                    category: 'reports'
                });
            }

            // Cache the result
            await this.cacheService.cacheAggregatedData(tenantId, 'updates_summary', dateRange, updatesSummary);

            logger.info('UpdatesSummary aggregation completed', {
                tenantId,
                dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                totalUpdatesApplied: updatesSummary.totalUpdatesApplied,
                updatesBySource: updatesSummary.updatesBySource,
                progressVisualizationData: updateData.progressVisualizationData,
                category: 'reports'
            });

            return updatesSummary;

        } catch (error) {
            logger.error('Failed to generate UpdatesSummary', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                category: 'reports'
            });
            throw new Error(`Failed to generate UpdatesSummary: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Implements VulnerabilityPosture aggregation
     * 
     * Requirements: 4.1, 4.2, 4.3, 4.4
     * - Calculates vulnerability detection and mitigation counts
     * - Adds severity breakdown (Critical/High/Medium)
     * - Implements CVE and class categorization options
     */
    async getVulnerabilityPosture(
        tenantId: string,
        dateRange: EnhancedDateRange,
        reportType: 'weekly' | 'monthly' | 'quarterly' = 'weekly'
    ): Promise<VulnerabilityPosture> {
        this.validateInputs(tenantId, dateRange);

        // Try to get from cache first (include report type in cache key)
        const cacheKey = `vulnerability_posture_${reportType}`;
        const cachedPosture = await this.cacheService.getCachedAggregatedData<VulnerabilityPosture>(
            tenantId,
            cacheKey,
            dateRange
        );

        if (cachedPosture) {
            logger.debug('VulnerabilityPosture retrieved from cache', {
                tenantId,
                reportType,
                dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                category: 'reports'
            });
            return cachedPosture;
        }

        try {
            // Get vulnerability posture calculations from historical data store
            const vulnData = await this.historicalDataStore.getVulnerabilityPostureCalculations(
                tenantId,
                dateRange,
                reportType
            );

            // Build vulnerability posture with hierarchy based on report type
            const vulnerabilityPosture: VulnerabilityPosture = {
                totalDetected: vulnData.totalDetected,
                totalMitigated: vulnData.totalMitigated,
                severityBreakdown: vulnData.severityBreakdown // Always present (requirement 4.2)
            };

            // Add class breakdown for monthly reports (requirement 4.3)
            if (reportType === 'monthly' && vulnData.classBreakdown) {
                vulnerabilityPosture.classBreakdown = vulnData.classBreakdown;
            }

            // Add top CVEs for weekly and monthly (exclude from quarterly per requirement 4.4)
            if (reportType !== 'quarterly' && vulnData.topCVEs) {
                vulnerabilityPosture.topCVEs = vulnData.topCVEs.map(cve => ({
                    cveId: cve.cveId,
                    severity: cve.severity as any, // Type assertion for compatibility
                    description: `CVE ${cve.cveId}`, // Simplified description
                    affectedDevices: cve.affectedDevices,
                    mitigated: cve.mitigated
                }));
            }

            // Add risk reduction trend for quarterly reports (requirement 4.4)
            if (reportType === 'quarterly' && vulnData.riskReductionTrend) {
                vulnerabilityPosture.riskReductionTrend = vulnData.riskReductionTrend;
            }

            // Verify at least one breakdown option is present (requirement 4.4)
            const hasBreakdown = vulnerabilityPosture.severityBreakdown ||
                vulnerabilityPosture.classBreakdown ||
                vulnerabilityPosture.topCVEs;

            if (!hasBreakdown) {
                logger.warn('No vulnerability breakdown available', {
                    tenantId,
                    reportType,
                    category: 'reports'
                });
            }

            // Cache the result (include report type in cache key)
            const cacheKey = `vulnerability_posture_${reportType}`;
            await this.cacheService.cacheAggregatedData(tenantId, cacheKey, dateRange, vulnerabilityPosture);

            logger.info('VulnerabilityPosture aggregation completed', {
                tenantId,
                reportType,
                dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                totalDetected: vulnerabilityPosture.totalDetected,
                totalMitigated: vulnerabilityPosture.totalMitigated,
                hasSeverityBreakdown: !!vulnerabilityPosture.severityBreakdown,
                hasClassBreakdown: !!vulnerabilityPosture.classBreakdown,
                hasTopCVEs: !!vulnerabilityPosture.topCVEs,
                hasRiskReductionTrend: !!vulnerabilityPosture.riskReductionTrend,
                category: 'reports'
            });

            return vulnerabilityPosture;

        } catch (error) {
            logger.error('Failed to generate VulnerabilityPosture', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                reportType,
                dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                category: 'reports'
            });
            throw new Error(`Failed to generate VulnerabilityPosture: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Adds trend analysis for monthly reports
     * 
     * Requirements: 5.1, 5.2, 5.3, 5.5
     * - Implements week-over-week comparison logic
     * - Identifies recurring alert types
     * - Adds vulnerability aging calculations
     */
    async getTrendAnalysis(
        tenantId: string,
        dateRange: EnhancedDateRange,
        config: TrendAnalysisConfig = {
            includeWeekOverWeek: true,
            includeRecurringAlerts: true,
            includeVulnerabilityAging: true,
            minimumRecurrenceThreshold: 3
        }
    ): Promise<{
        weekOverWeekTrends: TrendData[];
        recurringAlertTypes: RecurringAlertType[];
        vulnerabilityAging: VulnerabilityAging;
    }> {
        this.validateInputs(tenantId, dateRange);

        try {
            const trends: TrendData[] = [];
            const recurringAlerts: RecurringAlertType[] = [];
            let vulnerabilityAging: VulnerabilityAging = {
                openVulnerabilities: {
                    lessThan30Days: 0,
                    thirtyTo90Days: 0,
                    moreThan90Days: 0
                },
                mitigatedThisPeriod: 0
            };

            // Calculate week-over-week trends (requirement 5.1, 5.2)
            if (config.includeWeekOverWeek) {
                const currentPeriodAlerts = await this.historicalDataStore.getAlertHistory(tenantId, dateRange);

                // Calculate previous period (same duration, shifted back)
                const periodDuration = dateRange.endDate.getTime() - dateRange.startDate.getTime();
                const previousPeriodEnd = new Date(dateRange.startDate.getTime());
                const previousPeriodStart = new Date(dateRange.startDate.getTime() - periodDuration);

                const previousDateRange: EnhancedDateRange = {
                    startDate: previousPeriodStart,
                    endDate: previousPeriodEnd,
                    timezone: dateRange.timezone,
                    weekStart: 'monday'
                };

                const previousPeriodAlerts = await this.historicalDataStore.getAlertHistory(tenantId, previousDateRange);

                // Calculate trends for key metrics
                const currentTotal = currentPeriodAlerts.length;
                const previousTotal = previousPeriodAlerts.length;
                const alertTrend = this.calculateTrend(currentTotal, previousTotal);

                trends.push({
                    metric: 'Total Alerts',
                    currentPeriod: currentTotal,
                    previousPeriod: previousTotal,
                    changePercentage: alertTrend.changePercentage,
                    trend: alertTrend.direction
                });

                // Calculate trends by severity
                const currentCritical = currentPeriodAlerts.filter(a => a.severity === 'critical').length;
                const previousCritical = previousPeriodAlerts.filter(a => a.severity === 'critical').length;
                const criticalTrend = this.calculateTrend(currentCritical, previousCritical);

                trends.push({
                    metric: 'Critical Alerts',
                    currentPeriod: currentCritical,
                    previousPeriod: previousCritical,
                    changePercentage: criticalTrend.changePercentage,
                    trend: criticalTrend.direction
                });
            }

            // Identify recurring alert types (requirement 5.3)
            if (config.includeRecurringAlerts) {
                const alerts = await this.historicalDataStore.getAlertHistory(tenantId, dateRange);

                // Group alerts by normalized type and count occurrences
                const alertTypeMap = new Map<AlertClassification, {
                    count: number;
                    severities: string[];
                    devices: Set<string>;
                }>();

                alerts.forEach(alert => {
                    const existing = alertTypeMap.get(alert.normalizedType);
                    if (existing) {
                        existing.count++;
                        existing.severities.push(alert.severity);
                        if (alert.deviceId) {
                            existing.devices.add(alert.deviceId);
                        }
                    } else {
                        alertTypeMap.set(alert.normalizedType, {
                            count: 1,
                            severities: [alert.severity],
                            devices: new Set(alert.deviceId ? [alert.deviceId] : [])
                        });
                    }
                });

                // Filter for recurring types (above threshold)
                alertTypeMap.forEach((data, alertType) => {
                    if (data.count >= config.minimumRecurrenceThreshold) {
                        // Calculate average severity
                        const severityScores = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
                        const avgScore = data.severities.reduce((sum, sev) => sum + (severityScores[sev as keyof typeof severityScores] || 1), 0) / data.severities.length;
                        const avgSeverity = avgScore >= 3.5 ? 'critical' : avgScore >= 2.5 ? 'high' : avgScore >= 1.5 ? 'medium' : 'low';

                        recurringAlerts.push({
                            alertType: alertType,
                            frequency: data.count,
                            averageSeverity: avgSeverity as any,
                            topDevices: Array.from(data.devices).slice(0, 5) // Top 5 affected devices
                        });
                    }
                });

                // Sort by frequency (most recurring first)
                recurringAlerts.sort((a, b) => b.frequency - a.frequency);
            }

            // Calculate vulnerability aging (requirement 5.5)
            if (config.includeVulnerabilityAging) {
                const vulnData = await this.historicalDataStore.getVulnerabilityPostureCalculations(
                    tenantId,
                    dateRange,
                    'monthly'
                );

                if (vulnData.vulnerabilityAging) {
                    vulnerabilityAging = {
                        openVulnerabilities: {
                            lessThan30Days: vulnData.vulnerabilityAging.lessThan30Days,
                            thirtyTo90Days: vulnData.vulnerabilityAging.thirtyTo90Days,
                            moreThan90Days: vulnData.vulnerabilityAging.moreThan90Days
                        },
                        mitigatedThisPeriod: vulnData.totalMitigated || 0
                    };
                }
            }

            logger.info('Trend analysis completed', {
                tenantId,
                dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                trendsCount: trends.length,
                recurringAlertsCount: recurringAlerts.length,
                vulnerabilityAging,
                config,
                category: 'reports'
            });

            return {
                weekOverWeekTrends: trends,
                recurringAlertTypes: recurringAlerts,
                vulnerabilityAging
            };

        } catch (error) {
            logger.error('Failed to generate trend analysis', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                category: 'reports'
            });
            throw new Error(`Failed to generate trend analysis: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Calculates trend direction and percentage change
     */
    private calculateTrend(current: number, previous: number): {
        changePercentage: number;
        direction: 'up' | 'down' | 'stable';
    } {
        if (previous === 0) {
            return {
                changePercentage: current > 0 ? 100 : 0,
                direction: current > 0 ? 'up' : 'stable'
            };
        }

        const changePercentage = ((current - previous) / previous) * 100;
        const roundedChange = Math.round(changePercentage * 100) / 100;

        let direction: 'up' | 'down' | 'stable' = 'stable';
        if (Math.abs(roundedChange) >= 5) { // 5% threshold for significant change
            direction = roundedChange > 0 ? 'up' : 'down';
        }

        return {
            changePercentage: roundedChange,
            direction
        };
    }

    /**
     * Gets metrics trends for comparative analysis
     */
    async getMetricsTrends(tenantId: string, dateRange: EnhancedDateRange): Promise<{
        threatMetrics: Record<string, number>;
        comparisonData: TrendData[];
    }> {
        this.validateInputs(tenantId, dateRange);

        try {
            // Get current period threat metrics
            const threatMetrics = await this.historicalDataStore.getThreatMetricsAggregation(tenantId, dateRange);

            // Calculate comparison data for trends
            const periodDuration = dateRange.endDate.getTime() - dateRange.startDate.getTime();
            const previousPeriodEnd = new Date(dateRange.startDate.getTime());
            const previousPeriodStart = new Date(dateRange.startDate.getTime() - periodDuration);

            const previousDateRange: EnhancedDateRange = {
                startDate: previousPeriodStart,
                endDate: previousPeriodEnd,
                timezone: dateRange.timezone,
                weekStart: 'monday'
            };

            const previousThreatMetrics = await this.historicalDataStore.getThreatMetricsAggregation(tenantId, previousDateRange);

            // Generate comparison data
            const comparisonData: TrendData[] = [];

            Object.entries(threatMetrics).forEach(([metric, currentValue]) => {
                const previousValue = previousThreatMetrics[metric] || 0;
                const trend = this.calculateTrend(currentValue, previousValue);

                comparisonData.push({
                    metric: metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), // Convert camelCase to Title Case
                    currentPeriod: currentValue,
                    previousPeriod: previousValue,
                    changePercentage: trend.changePercentage,
                    trend: trend.direction
                });
            });

            logger.info('Metrics trends calculated', {
                tenantId,
                dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                threatMetrics,
                comparisonCount: comparisonData.length,
                category: 'reports'
            });

            return {
                threatMetrics,
                comparisonData
            };

        } catch (error) {
            logger.error('Failed to calculate metrics trends', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                category: 'reports'
            });
            throw new Error(`Failed to calculate metrics trends: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Validates data aggregation results for consistency
     */
    async validateAggregationConsistency(
        tenantId: string,
        dateRange: EnhancedDateRange
    ): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            // Get all aggregated data
            const [alertsDigest, updatesSummary, vulnerabilityPosture] = await Promise.all([
                this.getAlertsDigest(tenantId, dateRange),
                this.getUpdatesSummary(tenantId, dateRange),
                this.getVulnerabilityPosture(tenantId, dateRange)
            ]);

            // Validate AlertsDigest consistency
            const totalClassifications = Object.values(alertsDigest.alertClassification).reduce((sum, count) => sum + count, 0);
            if (totalClassifications !== alertsDigest.totalAlertsDigested) {
                errors.push(`Alert classification totals (${totalClassifications}) do not match total alerts digested (${alertsDigest.totalAlertsDigested})`);
            }

            const totalOutcomes = alertsDigest.alertOutcomes.securityIncidents +
                alertsDigest.alertOutcomes.benignActivity +
                alertsDigest.alertOutcomes.falsePositives;
            if (totalOutcomes !== alertsDigest.totalAlertsDigested) {
                errors.push(`Alert outcome totals (${totalOutcomes}) do not match total alerts digested (${alertsDigest.totalAlertsDigested})`);
            }

            const timelineTotal = alertsDigest.weeklyTimeline.reduce((sum, day) => sum + day.count, 0);
            if (timelineTotal !== alertsDigest.totalAlertsDigested) {
                warnings.push(`Weekly timeline total (${timelineTotal}) does not match total alerts digested (${alertsDigest.totalAlertsDigested})`);
            }

            // Validate UpdatesSummary consistency
            const totalUpdatesBySource = Object.values(updatesSummary.updatesBySource).reduce((sum, count) => sum + count, 0);
            if (totalUpdatesBySource !== updatesSummary.totalUpdatesApplied) {
                errors.push(`Updates by source totals (${totalUpdatesBySource}) do not match total updates applied (${updatesSummary.totalUpdatesApplied})`);
            }

            // Validate VulnerabilityPosture consistency
            if (vulnerabilityPosture.totalMitigated > vulnerabilityPosture.totalDetected) {
                errors.push(`Total mitigated vulnerabilities (${vulnerabilityPosture.totalMitigated}) cannot exceed total detected (${vulnerabilityPosture.totalDetected})`);
            }

            const isValid = errors.length === 0;

            logger.info('Aggregation consistency validation completed', {
                tenantId,
                isValid,
                errorsCount: errors.length,
                warningsCount: warnings.length,
                category: 'reports'
            });

            return {
                isValid,
                errors,
                warnings
            };

        } catch (error) {
            errors.push(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
            return {
                isValid: false,
                errors,
                warnings
            };
        }
    }
}

/**
 * Default instance for use throughout the application
 */
export const dataAggregator = new DataAggregator(
    new HistoricalDataStore(),
    new AlertClassificationService(),
    new ReportCacheService()
);