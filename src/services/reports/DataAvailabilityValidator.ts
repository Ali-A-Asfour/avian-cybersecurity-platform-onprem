/**
 * Data Availability Validator Service
 * 
 * Validates data availability for report generation, implements graceful degradation
 * for missing data, and provides informative messages for data gaps.
 * 
 * Requirements: 9.5 - Data availability validation and graceful degradation
 */

import { logger } from '@/lib/logger';
import { EnhancedDateRange, ValidationResult } from '@/types/reports';
import { HistoricalDataStore } from './HistoricalDataStore';

/**
 * Data availability thresholds for different report types
 */
export interface DataAvailabilityThresholds {
    weekly: {
        minimumAlerts: number;
        minimumDevices: number;
        minimumDataPoints: number;
        requiredDataTypes: DataType[];
    };
    monthly: {
        minimumAlerts: number;
        minimumDevices: number;
        minimumDataPoints: number;
        requiredDataTypes: DataType[];
        minimumWeeksWithData: number;
    };
    quarterly: {
        minimumAlerts: number;
        minimumDevices: number;
        minimumDataPoints: number;
        requiredDataTypes: DataType[];
        minimumMonthsWithData: number;
    };
}

/**
 * Types of data required for report generation
 */
export enum DataType {
    ALERTS = 'alerts',
    METRICS = 'metrics',
    VULNERABILITIES = 'vulnerabilities',
    UPDATES = 'updates',
    DEVICES = 'devices'
}

/**
 * Data availability assessment result
 */
export interface DataAvailabilityAssessment {
    isAvailable: boolean;
    dataTypes: Record<DataType, DataTypeAvailability>;
    overallScore: number; // 0-100 percentage
    recommendations: string[];
    degradationStrategy?: DegradationStrategy;
    missingDataPeriods: DatePeriod[];
    estimatedReportQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'insufficient';
}

/**
 * Availability status for each data type
 */
export interface DataTypeAvailability {
    available: boolean;
    recordCount: number;
    coveragePercentage: number; // Percentage of time period covered
    lastUpdated?: Date;
    gaps: DatePeriod[];
    quality: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Date period for tracking gaps
 */
export interface DatePeriod {
    start: Date;
    end: Date;
    description: string;
}

/**
 * Graceful degradation strategy
 */
export interface DegradationStrategy {
    strategy: 'partial' | 'fallback' | 'placeholder' | 'skip';
    description: string;
    affectedSections: string[];
    userMessage: string;
    alternatives: string[];
}

/**
 * Data Availability Validator
 * 
 * Validates data availability for report generation and provides graceful
 * degradation strategies when data is insufficient.
 */
export class DataAvailabilityValidator {
    private readonly historicalDataStore: HistoricalDataStore;
    private readonly defaultThresholds: DataAvailabilityThresholds;

    constructor(historicalDataStore: HistoricalDataStore) {
        this.historicalDataStore = historicalDataStore;
        this.defaultThresholds = this.getDefaultThresholds();
    }

    /**
     * Validate data availability for report generation
     * 
     * Requirements: 9.5 - Validation for insufficient data scenarios
     */
    async validateDataAvailability(
        tenantId: string,
        dateRange: EnhancedDateRange,
        reportType: 'weekly' | 'monthly' | 'quarterly',
        customThresholds?: Partial<DataAvailabilityThresholds>
    ): Promise<DataAvailabilityAssessment> {
        // Input validation
        this.validateInputs(tenantId, dateRange, reportType);

        try {
            logger.info('Starting data availability validation', {
                tenantId,
                reportType,
                dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                category: 'reports-validation'
            });

            const thresholds = this.mergeThresholds(customThresholds);
            const reportThreshold = thresholds[reportType];

            // Assess availability for each data type
            const dataTypeAssessments = await this.assessDataTypes(
                tenantId,
                dateRange,
                reportThreshold.requiredDataTypes
            );

            // Check if too many critical data types failed to assess
            const criticalDataTypes = [DataType.ALERTS, DataType.METRICS];
            const failedCriticalAssessments = criticalDataTypes.filter(type =>
                dataTypeAssessments[type] &&
                dataTypeAssessments[type].recordCount === 0 &&
                dataTypeAssessments[type].gaps.length > 0 &&
                dataTypeAssessments[type].gaps[0]?.description?.includes('Unable to')
            );

            // If both critical data types failed to assess, return failsafe
            if (failedCriticalAssessments.length >= 2) {
                logger.warn('Multiple critical data types failed assessment, returning failsafe', {
                    tenantId,
                    reportType,
                    failedTypes: failedCriticalAssessments,
                    category: 'reports-validation'
                });
                return this.createFailsafeAssessment(new Error('Multiple critical data sources failed'));
            }

            // Calculate overall availability score
            const overallScore = this.calculateOverallScore(dataTypeAssessments);

            // Determine if data is sufficient for report generation
            const isAvailable = this.isDataSufficient(dataTypeAssessments, reportThreshold, overallScore);

            // Generate recommendations and degradation strategy
            const recommendations = this.generateRecommendations(dataTypeAssessments, reportType);
            const degradationStrategy = isAvailable ? undefined :
                this.createDegradationStrategy(dataTypeAssessments, reportType);

            // Identify missing data periods
            const missingDataPeriods = this.identifyMissingDataPeriods(dataTypeAssessments, dateRange);

            // Estimate report quality
            const estimatedReportQuality = this.estimateReportQuality(overallScore, dataTypeAssessments);

            const assessment: DataAvailabilityAssessment = {
                isAvailable,
                dataTypes: dataTypeAssessments,
                overallScore,
                recommendations,
                degradationStrategy,
                missingDataPeriods,
                estimatedReportQuality
            };

            logger.info('Data availability validation completed', {
                tenantId,
                reportType,
                isAvailable,
                overallScore,
                estimatedReportQuality,
                missingPeriodsCount: missingDataPeriods.length,
                category: 'reports-validation'
            });

            return assessment;

        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            logger.error('Failed to validate data availability', errorObj, {
                tenantId,
                reportType,
                dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                category: 'reports-validation'
            });

            // Return pessimistic assessment on validation failure
            return this.createFailsafeAssessment(errorObj);
        }
    }

    /**
     * Assess availability for each required data type
     */
    private async assessDataTypes(
        tenantId: string,
        dateRange: EnhancedDateRange,
        requiredDataTypes: DataType[]
    ): Promise<Record<DataType, DataTypeAvailability>> {
        const assessments: Record<DataType, DataTypeAvailability> = {} as any;

        for (const dataType of requiredDataTypes) {
            try {
                assessments[dataType] = await this.assessSingleDataType(tenantId, dateRange, dataType);
            } catch (error) {
                logger.warn('Failed to assess data type availability', {
                    tenantId,
                    dataType,
                    error: error instanceof Error ? error.message : String(error),
                    category: 'reports-validation'
                });

                // Create pessimistic assessment for failed data type
                assessments[dataType] = {
                    available: false,
                    recordCount: 0,
                    coveragePercentage: 0,
                    gaps: [{
                        start: dateRange.startDate,
                        end: dateRange.endDate,
                        description: `Unable to assess ${dataType} data availability`
                    }],
                    quality: 'poor'
                };
            }
        }

        return assessments;
    }

    /**
     * Assess availability for a single data type
     */
    private async assessSingleDataType(
        tenantId: string,
        dateRange: EnhancedDateRange,
        dataType: DataType
    ): Promise<DataTypeAvailability> {
        switch (dataType) {
            case DataType.ALERTS:
                return await this.assessAlertsAvailability(tenantId, dateRange);
            case DataType.METRICS:
                return await this.assessMetricsAvailability(tenantId, dateRange);
            case DataType.VULNERABILITIES:
                return await this.assessVulnerabilitiesAvailability(tenantId, dateRange);
            case DataType.UPDATES:
                return await this.assessUpdatesAvailability(tenantId, dateRange);
            case DataType.DEVICES:
                return await this.assessDevicesAvailability(tenantId, dateRange);
            default:
                throw new Error(`Unknown data type: ${dataType}`);
        }
    }

    /**
     * Assess alerts data availability
     */
    private async assessAlertsAvailability(
        tenantId: string,
        dateRange: EnhancedDateRange
    ): Promise<DataTypeAvailability> {
        const alerts = await this.historicalDataStore.getAlertHistory(tenantId, dateRange);
        const recordCount = alerts.length;

        // Calculate coverage by checking for data gaps
        const gaps = this.findDataGaps(
            alerts.map(a => a.createdAt),
            dateRange,
            'alerts'
        );

        const coveragePercentage = this.calculateCoveragePercentage(gaps, dateRange);
        const quality = this.assessDataQuality(recordCount, coveragePercentage, 'alerts');

        return {
            available: recordCount > 0,
            recordCount,
            coveragePercentage,
            lastUpdated: alerts.length > 0 ? new Date(Math.max(...alerts.map(a => a.createdAt.getTime()))) : undefined,
            gaps,
            quality
        };
    }

    /**
     * Assess metrics data availability
     */
    private async assessMetricsAvailability(
        tenantId: string,
        dateRange: EnhancedDateRange
    ): Promise<DataTypeAvailability> {
        const metrics = await this.historicalDataStore.getMetricsHistory(tenantId, dateRange);
        const recordCount = metrics.length;

        const gaps = this.findDataGaps(
            metrics.map(m => m.date),
            dateRange,
            'metrics'
        );

        const coveragePercentage = this.calculateCoveragePercentage(gaps, dateRange);
        const quality = this.assessDataQuality(recordCount, coveragePercentage, 'metrics');

        return {
            available: recordCount > 0,
            recordCount,
            coveragePercentage,
            lastUpdated: metrics.length > 0 ? new Date(Math.max(...metrics.map(m => m.date.getTime()))) : undefined,
            gaps,
            quality
        };
    }

    /**
     * Assess vulnerabilities data availability
     */
    private async assessVulnerabilitiesAvailability(
        tenantId: string,
        dateRange: EnhancedDateRange
    ): Promise<DataTypeAvailability> {
        try {
            const vulnData = await this.historicalDataStore.getVulnerabilityPostureCalculations(
                tenantId,
                dateRange,
                'weekly'
            );

            const recordCount = (vulnData.totalDetected || 0) + (vulnData.totalMitigated || 0);

            // For vulnerabilities, we consider data available if we have any vulnerability information
            const available = recordCount > 0 || vulnData.severityBreakdown !== undefined;

            // Vulnerabilities may not have continuous data, so coverage is based on presence
            const coveragePercentage = available ? 85 : 0; // Assume good coverage if data exists
            const quality = this.assessDataQuality(recordCount, coveragePercentage, 'vulnerabilities');

            return {
                available,
                recordCount,
                coveragePercentage,
                gaps: available ? [] : [{
                    start: dateRange.startDate,
                    end: dateRange.endDate,
                    description: 'No vulnerability data available for this period'
                }],
                quality
            };
        } catch (error) {
            return {
                available: false,
                recordCount: 0,
                coveragePercentage: 0,
                gaps: [{
                    start: dateRange.startDate,
                    end: dateRange.endDate,
                    description: 'Unable to retrieve vulnerability data'
                }],
                quality: 'poor'
            };
        }
    }

    /**
     * Assess updates data availability
     */
    private async assessUpdatesAvailability(
        tenantId: string,
        dateRange: EnhancedDateRange
    ): Promise<DataTypeAvailability> {
        try {
            const updateData = await this.historicalDataStore.getUpdateSummaryAggregation(tenantId, dateRange);
            const recordCount = updateData.totalUpdatesApplied || 0;

            // Updates may be sporadic, so we're more lenient with coverage
            const available = recordCount > 0;
            const coveragePercentage = available ? 70 : 0; // Assume reasonable coverage if updates exist
            const quality = this.assessDataQuality(recordCount, coveragePercentage, 'updates');

            return {
                available,
                recordCount,
                coveragePercentage,
                gaps: available ? [] : [{
                    start: dateRange.startDate,
                    end: dateRange.endDate,
                    description: 'No update data available for this period'
                }],
                quality
            };
        } catch (error) {
            return {
                available: false,
                recordCount: 0,
                coveragePercentage: 0,
                gaps: [{
                    start: dateRange.startDate,
                    end: dateRange.endDate,
                    description: 'Unable to retrieve update data'
                }],
                quality: 'poor'
            };
        }
    }

    /**
     * Assess devices data availability
     */
    private async assessDevicesAvailability(
        tenantId: string,
        dateRange: EnhancedDateRange
    ): Promise<DataTypeAvailability> {
        try {
            // Get device information from metrics or alerts to infer device availability
            const metrics = await this.historicalDataStore.getMetricsHistory(tenantId, dateRange);
            const uniqueDevices = new Set(metrics.map(m => m.deviceId)).size;

            const available = uniqueDevices > 0;
            const coveragePercentage = available ? 90 : 0; // Device data is usually consistent
            const quality = this.assessDataQuality(uniqueDevices, coveragePercentage, 'devices');

            return {
                available,
                recordCount: uniqueDevices,
                coveragePercentage,
                gaps: available ? [] : [{
                    start: dateRange.startDate,
                    end: dateRange.endDate,
                    description: 'No device data available for this period'
                }],
                quality
            };
        } catch (error) {
            return {
                available: false,
                recordCount: 0,
                coveragePercentage: 0,
                gaps: [{
                    start: dateRange.startDate,
                    end: dateRange.endDate,
                    description: 'Unable to retrieve device data'
                }],
                quality: 'poor'
            };
        }
    }

    /**
     * Find gaps in data based on timestamps
     */
    private findDataGaps(
        timestamps: Date[],
        dateRange: EnhancedDateRange,
        dataType: string
    ): DatePeriod[] {
        if (timestamps.length === 0) {
            return [{
                start: dateRange.startDate,
                end: dateRange.endDate,
                description: `No ${dataType} data found in the entire period`
            }];
        }

        const gaps: DatePeriod[] = [];
        const sortedTimestamps = timestamps.sort((a, b) => a.getTime() - b.getTime());

        // Check for gap at the beginning
        const firstTimestamp = sortedTimestamps[0];
        if (firstTimestamp.getTime() > dateRange.startDate.getTime() + (24 * 60 * 60 * 1000)) { // More than 1 day gap
            gaps.push({
                start: dateRange.startDate,
                end: firstTimestamp,
                description: `No ${dataType} data at the beginning of the period`
            });
        }

        // Check for gaps between data points
        for (let i = 0; i < sortedTimestamps.length - 1; i++) {
            const current = sortedTimestamps[i];
            const next = sortedTimestamps[i + 1];
            const gapDuration = next.getTime() - current.getTime();

            // Consider gaps longer than 2 days as significant
            if (gapDuration > 2 * 24 * 60 * 60 * 1000) {
                gaps.push({
                    start: current,
                    end: next,
                    description: `${Math.round(gapDuration / (24 * 60 * 60 * 1000))} day gap in ${dataType} data`
                });
            }
        }

        // Check for gap at the end
        const lastTimestamp = sortedTimestamps[sortedTimestamps.length - 1];
        if (lastTimestamp.getTime() < dateRange.endDate.getTime() - (24 * 60 * 60 * 1000)) { // More than 1 day gap
            gaps.push({
                start: lastTimestamp,
                end: dateRange.endDate,
                description: `No ${dataType} data at the end of the period`
            });
        }

        return gaps;
    }

    /**
     * Calculate coverage percentage based on gaps
     */
    private calculateCoveragePercentage(gaps: DatePeriod[], dateRange: EnhancedDateRange): number {
        if (gaps.length === 0) {
            return 100;
        }

        const totalPeriod = dateRange.endDate.getTime() - dateRange.startDate.getTime();
        const gapDuration = gaps.reduce((total, gap) => {
            return total + (gap.end.getTime() - gap.start.getTime());
        }, 0);

        const coverage = Math.max(0, (totalPeriod - gapDuration) / totalPeriod * 100);
        return Math.round(coverage * 100) / 100; // Round to 2 decimal places
    }

    /**
     * Assess data quality based on record count and coverage
     */
    private assessDataQuality(
        recordCount: number,
        coveragePercentage: number,
        dataType: string
    ): 'excellent' | 'good' | 'fair' | 'poor' {
        if (recordCount === 0 || coveragePercentage === 0) {
            return 'poor';
        }

        // Different thresholds for different data types - more lenient
        let excellentThreshold = 80;
        let goodThreshold = 60;
        let fairThreshold = 30;

        if (dataType === 'updates' || dataType === 'vulnerabilities') {
            // Updates and vulnerabilities are more sporadic
            excellentThreshold = 80;
            goodThreshold = 60;
            fairThreshold = 30;
        }

        if (coveragePercentage >= excellentThreshold && recordCount >= 3) {
            return 'excellent';
        } else if (coveragePercentage >= goodThreshold && recordCount >= 2) {
            return 'good';
        } else if (coveragePercentage >= fairThreshold && recordCount >= 1) {
            return 'fair';
        } else {
            return 'poor';
        }
    }

    /**
     * Calculate overall availability score
     */
    private calculateOverallScore(dataTypes: Record<DataType, DataTypeAvailability>): number {
        const scores = Object.values(dataTypes).map(dt => dt.coveragePercentage);
        if (scores.length === 0) return 0;

        // Weighted average with higher weight for critical data types
        const weights = {
            [DataType.ALERTS]: 0.3,
            [DataType.METRICS]: 0.25,
            [DataType.VULNERABILITIES]: 0.2,
            [DataType.UPDATES]: 0.15,
            [DataType.DEVICES]: 0.1
        };

        let weightedSum = 0;
        let totalWeight = 0;

        Object.entries(dataTypes).forEach(([type, availability]) => {
            const weight = weights[type as DataType] || 0.1;
            weightedSum += availability.coveragePercentage * weight;
            totalWeight += weight;
        });

        return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    }

    /**
     * Determine if data is sufficient for report generation
     */
    private isDataSufficient(
        dataTypes: Record<DataType, DataTypeAvailability>,
        threshold: DataAvailabilityThresholds['weekly' | 'monthly' | 'quarterly'],
        overallScore: number
    ): boolean {
        // Check if all required data types are available
        const requiredTypesAvailable = threshold.requiredDataTypes.every(type =>
            dataTypes[type]?.available
        );

        // Check if we meet minimum thresholds
        const alertsCount = dataTypes[DataType.ALERTS]?.recordCount || 0;
        const meetsMinimumAlerts = alertsCount >= threshold.minimumAlerts;

        return requiredTypesAvailable && meetsMinimumAlerts;
    }

    /**
     * Generate recommendations for improving data availability
     */
    private generateRecommendations(
        dataTypes: Record<DataType, DataTypeAvailability>,
        reportType: 'weekly' | 'monthly' | 'quarterly'
    ): string[] {
        const recommendations: string[] = [];

        Object.entries(dataTypes).forEach(([type, availability]) => {
            if (!availability.available) {
                switch (type as DataType) {
                    case DataType.ALERTS:
                        recommendations.push('Configure your security systems to send alerts to AVIAN for comprehensive threat monitoring');
                        break;
                    case DataType.METRICS:
                        recommendations.push('Ensure firewall and EDR systems are properly integrated and sending performance metrics');
                        break;
                    case DataType.VULNERABILITIES:
                        recommendations.push('Enable vulnerability scanning and reporting in your security tools');
                        break;
                    case DataType.UPDATES:
                        recommendations.push('Configure update tracking to monitor system patching and maintenance');
                        break;
                    case DataType.DEVICES:
                        recommendations.push('Verify device registration and monitoring configuration');
                        break;
                }
            } else if (availability.quality === 'poor' || availability.quality === 'fair') {
                recommendations.push(`Improve ${type} data quality by addressing data gaps and ensuring consistent reporting`);
            }
        });

        // Add report-specific recommendations
        if (reportType === 'monthly' || reportType === 'quarterly') {
            const hasGaps = Object.values(dataTypes).some(dt => dt.gaps.length > 0);
            if (hasGaps) {
                recommendations.push(`For ${reportType} reports, ensure consistent data collection throughout the entire period for accurate trend analysis`);
            }
        }

        // Add general recommendations if no specific issues found
        if (recommendations.length === 0) {
            recommendations.push('Data availability looks good. Continue monitoring to maintain report quality');
        }

        return recommendations;
    }

    /**
     * Create graceful degradation strategy
     * 
     * Requirements: 9.5 - Graceful degradation for missing data
     */
    private createDegradationStrategy(
        dataTypes: Record<DataType, DataTypeAvailability>,
        reportType: 'weekly' | 'monthly' | 'quarterly'
    ): DegradationStrategy {
        const unavailableTypes = Object.entries(dataTypes)
            .filter(([_, availability]) => !availability.available)
            .map(([type, _]) => type);

        const poorQualityTypes = Object.entries(dataTypes)
            .filter(([_, availability]) => availability.available && availability.quality === 'poor')
            .map(([type, _]) => type);

        // Determine strategy based on missing data severity
        const totalDataTypes = Object.keys(dataTypes).length;
        const unavailableCount = unavailableTypes.length;
        const missingCriticalData = unavailableTypes.includes(DataType.ALERTS) && unavailableTypes.includes(DataType.METRICS);

        // Check if alerts failed due to system error (not just missing data)
        const alertsSystemError = dataTypes[DataType.ALERTS] &&
            dataTypes[DataType.ALERTS].gaps.length > 0 &&
            dataTypes[DataType.ALERTS].gaps[0]?.description?.includes('Unable to');

        // Skip strategy: System errors only (not missing data)
        if (alertsSystemError) {
            return {
                strategy: 'skip',
                description: 'Skip report generation due to insufficient data',
                affectedSections: ['Entire Report'],
                userMessage: `Cannot generate ${reportType} report due to insufficient data availability.`,
                alternatives: [
                    'Try generating a report for a different time period',
                    'Ensure your security systems are properly configured',
                    'Contact support for assistance with data collection'
                ]
            };
        }

        // Partial strategy: Multiple data types missing (including critical data)
        if (missingCriticalData || unavailableCount >= 2) {
            return {
                strategy: 'partial',
                description: 'Generate partial report with available data only',
                affectedSections: unavailableTypes.map(type => this.getReportSectionName(type)),
                userMessage: `This ${reportType} report is incomplete due to missing data. Only sections with available data are included.`,
                alternatives: [
                    'Wait for more data to be collected before generating the report',
                    'Review individual system dashboards for missing information',
                    'Contact your system administrator to verify data collection'
                ]
            };
        }

        // Fallback strategy: Missing alerts (most critical single data type)
        if (unavailableTypes.includes(DataType.ALERTS)) {
            return {
                strategy: 'fallback',
                description: 'Generate report with placeholder content for missing alert data',
                affectedSections: ['Alerts Digest', 'Security Incidents', 'Weekly Timeline'],
                userMessage: 'This report contains limited information due to insufficient alert data. Some sections show placeholder content.',
                alternatives: [
                    'Configure alert forwarding to improve future reports',
                    'Contact support for assistance with data integration',
                    'Review system logs manually for security events'
                ]
            };
        }

        // Placeholder strategy: Data available but poor quality
        if (poorQualityTypes.length > 0) {
            return {
                strategy: 'placeholder',
                description: 'Generate report with warnings about data quality issues',
                affectedSections: poorQualityTypes.map(type => this.getReportSectionName(type)),
                userMessage: `This report includes all sections, but some data may be incomplete or have gaps.`,
                alternatives: [
                    'Review the data quality warnings in each section',
                    'Consider the limitations when making decisions based on this report',
                    'Improve data collection consistency for better future reports'
                ]
            };
        }

        // Default fallback for single missing non-critical data type
        return {
            strategy: 'fallback',
            description: 'Generate report with placeholder content for missing data',
            affectedSections: unavailableTypes.map(type => this.getReportSectionName(type)),
            userMessage: `This report has limited information in some sections due to missing ${unavailableTypes.join(', ')} data.`,
            alternatives: [
                'Configure missing data sources to improve future reports',
                'Contact support for assistance with data integration'
            ]
        };
    }

    /**
     * Get report section name for data type
     */
    private getReportSectionName(dataType: string): string {
        switch (dataType) {
            case DataType.ALERTS: return 'Alerts Digest';
            case DataType.METRICS: return 'System Metrics';
            case DataType.VULNERABILITIES: return 'Vulnerability Posture';
            case DataType.UPDATES: return 'Updates Summary';
            case DataType.DEVICES: return 'Device Coverage';
            default: return dataType;
        }
    }

    /**
     * Identify missing data periods
     */
    private identifyMissingDataPeriods(
        dataTypes: Record<DataType, DataTypeAvailability>,
        dateRange: EnhancedDateRange
    ): DatePeriod[] {
        const allGaps: DatePeriod[] = [];

        Object.entries(dataTypes).forEach(([type, availability]) => {
            availability.gaps.forEach(gap => {
                allGaps.push({
                    ...gap,
                    description: `${type}: ${gap.description}`
                });
            });
        });

        // Merge overlapping gaps
        return this.mergeOverlappingPeriods(allGaps);
    }

    /**
     * Merge overlapping date periods
     */
    private mergeOverlappingPeriods(periods: DatePeriod[]): DatePeriod[] {
        if (periods.length === 0) return [];

        const sorted = periods.sort((a, b) => a.start.getTime() - b.start.getTime());
        const merged: DatePeriod[] = [sorted[0]];

        for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i];
            const last = merged[merged.length - 1];

            if (current.start.getTime() <= last.end.getTime()) {
                // Overlapping periods - merge them
                last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
                last.description += `, ${current.description}`;
            } else {
                merged.push(current);
            }
        }

        return merged;
    }

    /**
     * Estimate report quality based on data availability
     */
    private estimateReportQuality(
        overallScore: number,
        dataTypes: Record<DataType, DataTypeAvailability>
    ): 'excellent' | 'good' | 'fair' | 'poor' | 'insufficient' {
        // Check if we have the basic required data types available
        const hasAlertsAndMetrics = dataTypes[DataType.ALERTS]?.available && dataTypes[DataType.METRICS]?.available;

        if (!hasAlertsAndMetrics) {
            return 'insufficient';
        }

        // Adjust quality based on overall score but be more lenient
        if (overallScore >= 70) return 'excellent';
        if (overallScore >= 40) return 'good';
        if (overallScore >= 20) return 'fair';
        if (overallScore >= 10) return 'poor';
        return 'insufficient';
    }

    /**
     * Create failsafe assessment when validation fails
     */
    private createFailsafeAssessment(error: Error): DataAvailabilityAssessment {
        logger.error('Creating failsafe assessment due to validation failure', error, {
            category: 'reports-validation'
        });

        return {
            isAvailable: false,
            dataTypes: {} as any,
            overallScore: 0,
            recommendations: [
                'Unable to validate data availability due to system error',
                'Contact support for assistance',
                'Try again in a few minutes'
            ],
            degradationStrategy: {
                strategy: 'skip',
                description: 'Cannot generate report due to validation failure',
                affectedSections: ['Entire Report'],
                userMessage: 'Report generation is temporarily unavailable due to a system issue.',
                alternatives: [
                    'Try again in a few minutes',
                    'Contact support if the issue persists',
                    'Check system status page for known issues'
                ]
            },
            missingDataPeriods: [],
            estimatedReportQuality: 'insufficient'
        };
    }

    /**
     * Get default data availability thresholds
     */
    private getDefaultThresholds(): DataAvailabilityThresholds {
        return {
            weekly: {
                minimumAlerts: 1,
                minimumDevices: 1,
                minimumDataPoints: 1,
                requiredDataTypes: [DataType.ALERTS, DataType.METRICS]
            },
            monthly: {
                minimumAlerts: 1,
                minimumDevices: 1,
                minimumDataPoints: 1,
                requiredDataTypes: [DataType.ALERTS, DataType.METRICS, DataType.VULNERABILITIES],
                minimumWeeksWithData: 1
            },
            quarterly: {
                minimumAlerts: 1,
                minimumDevices: 1,
                minimumDataPoints: 1,
                requiredDataTypes: [DataType.ALERTS, DataType.METRICS, DataType.VULNERABILITIES],
                minimumMonthsWithData: 1
            }
        };
    }

    /**
     * Merge custom thresholds with defaults
     */
    private mergeThresholds(customThresholds?: Partial<DataAvailabilityThresholds>): DataAvailabilityThresholds {
        if (!customThresholds) return this.defaultThresholds;

        return {
            weekly: { ...this.defaultThresholds.weekly, ...customThresholds.weekly },
            monthly: { ...this.defaultThresholds.monthly, ...customThresholds.monthly },
            quarterly: { ...this.defaultThresholds.quarterly, ...customThresholds.quarterly }
        };
    }

    /**
     * Validate input parameters for data availability validation
     * 
     * Requirements: 9.5 - Input validation for data scenarios
     */
    private validateInputs(
        tenantId: string,
        dateRange: EnhancedDateRange,
        reportType: 'weekly' | 'monthly' | 'quarterly'
    ): void {
        // Validate tenant ID
        if (!tenantId || tenantId.trim() === '') {
            throw new Error('Valid tenant ID is required');
        }

        // Validate date range
        if (!dateRange.startDate || !dateRange.endDate) {
            throw new Error('Start date and end date are required');
        }

        if (dateRange.startDate >= dateRange.endDate) {
            throw new Error('Start date must be before end date');
        }

        // Validate timezone
        if (!dateRange.timezone || dateRange.timezone.trim() === '') {
            throw new Error('Timezone is required');
        }

        // Validate week start (must be Monday for ISO week compliance)
        if (dateRange.weekStart !== 'monday') {
            throw new Error('Week start must be Monday');
        }

        // Validate report type
        const validReportTypes = ['weekly', 'monthly', 'quarterly'];
        if (!validReportTypes.includes(reportType)) {
            throw new Error(`Invalid report type: ${reportType}. Must be one of: ${validReportTypes.join(', ')}`);
        }

        // Validate date range is reasonable for report type
        const daysDiff = Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24));

        switch (reportType) {
            case 'weekly':
                if (daysDiff > 14) {
                    logger.warn('Date range exceeds recommended duration for weekly report', {
                        reportType,
                        daysDiff,
                        recommended: 7,
                        category: 'reports-validation'
                    });
                }
                break;
            case 'monthly':
                if (daysDiff > 62) { // ~2 months
                    logger.warn('Date range exceeds recommended duration for monthly report', {
                        reportType,
                        daysDiff,
                        recommended: 31,
                        category: 'reports-validation'
                    });
                }
                break;
            case 'quarterly':
                if (daysDiff > 186) { // ~6 months
                    logger.warn('Date range exceeds recommended duration for quarterly report', {
                        reportType,
                        daysDiff,
                        recommended: 93,
                        category: 'reports-validation'
                    });
                }
                break;
        }

        // Validate timezone format (basic IANA timezone validation)
        if (!this.isValidTimezone(dateRange.timezone)) {
            throw new Error(`Invalid timezone format: ${dateRange.timezone}. Must be a valid IANA timezone (e.g., 'America/Toronto')`);
        }
    }

    /**
     * Validate IANA timezone format
     */
    private isValidTimezone(timezone: string): boolean {
        try {
            // Try to create a date with the timezone to validate it
            new Intl.DateTimeFormat('en', { timeZone: timezone });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate data retention requirements for report generation
     * 
     * Requirements: 9.5 - Preserve all necessary metrics across required retention periods
     */
    async validateDataRetention(
        tenantId: string,
        dateRange: EnhancedDateRange,
        reportType: 'weekly' | 'monthly' | 'quarterly'
    ): Promise<{
        meetsRetentionRequirements: boolean;
        retentionIssues: string[];
        oldestDataAvailable: Date | null;
        dataRetentionScore: number; // 0-100
    }> {
        try {
            const retentionIssues: string[] = [];
            let oldestDataAvailable: Date | null = null;

            // Get the oldest data across all data types
            const [alerts, metrics] = await Promise.all([
                this.historicalDataStore.getAlertHistory(tenantId, {
                    ...dateRange,
                    startDate: new Date(dateRange.startDate.getTime() - (365 * 24 * 60 * 60 * 1000)), // Look back 1 year
                    endDate: dateRange.endDate
                }),
                this.historicalDataStore.getMetricsHistory(tenantId, {
                    ...dateRange,
                    startDate: new Date(dateRange.startDate.getTime() - (365 * 24 * 60 * 60 * 1000)), // Look back 1 year
                    endDate: dateRange.endDate
                })
            ]);

            // Find oldest available data
            const allDates: Date[] = [
                ...alerts.map(a => a.createdAt),
                ...metrics.map(m => m.date)
            ];

            if (allDates.length > 0) {
                oldestDataAvailable = new Date(Math.min(...allDates.map(d => d.getTime())));
            }

            // Check retention requirements based on report type
            const requiredRetentionDays = this.getRequiredRetentionDays(reportType);
            const requiredRetentionDate = new Date(dateRange.startDate.getTime() - (requiredRetentionDays * 24 * 60 * 60 * 1000));

            let meetsRetentionRequirements = true;
            let dataRetentionScore = 100;

            if (!oldestDataAvailable) {
                retentionIssues.push('No historical data available for retention validation');
                meetsRetentionRequirements = false;
                dataRetentionScore = 0;
            } else if (oldestDataAvailable > requiredRetentionDate) {
                const availableDays = Math.ceil((dateRange.startDate.getTime() - oldestDataAvailable.getTime()) / (1000 * 60 * 60 * 24));
                retentionIssues.push(
                    `Insufficient data retention: ${availableDays} days available, ${requiredRetentionDays} days required for ${reportType} reports`
                );
                meetsRetentionRequirements = false;
                dataRetentionScore = Math.max(0, Math.round((availableDays / requiredRetentionDays) * 100));
            }

            // Check for data consistency across the retention period
            if (oldestDataAvailable && meetsRetentionRequirements) {
                const consistencyScore = await this.assessDataConsistency(tenantId, requiredRetentionDate, dateRange.startDate);
                if (consistencyScore < 80) {
                    retentionIssues.push(`Data consistency issues detected in retention period (${consistencyScore}% consistency)`);
                    dataRetentionScore = Math.min(dataRetentionScore, consistencyScore);
                }
            }

            logger.info('Data retention validation completed', {
                tenantId,
                reportType,
                meetsRetentionRequirements,
                dataRetentionScore,
                oldestDataAvailable,
                issuesCount: retentionIssues.length,
                category: 'reports-validation'
            });

            return {
                meetsRetentionRequirements,
                retentionIssues,
                oldestDataAvailable,
                dataRetentionScore
            };

        } catch (error) {
            logger.error('Failed to validate data retention', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                reportType,
                category: 'reports-validation'
            });

            return {
                meetsRetentionRequirements: false,
                retentionIssues: ['Unable to validate data retention due to system error'],
                oldestDataAvailable: null,
                dataRetentionScore: 0
            };
        }
    }

    /**
     * Get required retention days for report type
     */
    private getRequiredRetentionDays(reportType: 'weekly' | 'monthly' | 'quarterly'): number {
        switch (reportType) {
            case 'weekly':
                return 30; // 30 days for weekly reports (to show trends)
            case 'monthly':
                return 90; // 90 days for monthly reports (to show quarterly trends)
            case 'quarterly':
                return 365; // 1 year for quarterly reports (to show yearly trends)
            default:
                return 30;
        }
    }

    /**
     * Assess data consistency across a time period
     */
    private async assessDataConsistency(
        tenantId: string,
        startDate: Date,
        endDate: Date
    ): Promise<number> {
        try {
            const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const sampleSize = Math.min(30, totalDays); // Sample up to 30 days
            const sampleInterval = Math.max(1, Math.floor(totalDays / sampleSize));

            let daysWithData = 0;

            for (let i = 0; i < sampleSize; i++) {
                const sampleDate = new Date(startDate.getTime() + (i * sampleInterval * 24 * 60 * 60 * 1000));
                const dayEnd = new Date(sampleDate.getTime() + (24 * 60 * 60 * 1000));

                const [alerts, metrics] = await Promise.all([
                    this.historicalDataStore.getAlertHistory(tenantId, {
                        startDate: sampleDate,
                        endDate: dayEnd,
                        timezone: 'UTC',
                        weekStart: 'monday'
                    }),
                    this.historicalDataStore.getMetricsHistory(tenantId, {
                        startDate: sampleDate,
                        endDate: dayEnd,
                        timezone: 'UTC',
                        weekStart: 'monday'
                    })
                ]);

                // Consider a day to have data if it has either alerts or metrics
                if (alerts.length > 0 || metrics.length > 0) {
                    daysWithData++;
                }
            }

            return Math.round((daysWithData / sampleSize) * 100);

        } catch (error) {
            logger.warn('Failed to assess data consistency', {
                tenantId,
                error: error instanceof Error ? error.message : String(error),
                category: 'reports-validation'
            });
            return 50; // Return moderate score on error
        }
    }

    /**
     * Generate enhanced informative message for data gaps with retention info
     * 
     * Requirements: 9.5 - Informative messages for data gaps
     */
    generateDataGapMessage(assessment: DataAvailabilityAssessment): string {
        if (assessment.isAvailable && assessment.estimatedReportQuality === 'good') {
            return 'All required data is available for report generation.';
        }

        const messages: string[] = [];

        // Add overall quality message
        messages.push(`Report quality: ${assessment.estimatedReportQuality}`);

        // Add specific data type issues
        Object.entries(assessment.dataTypes).forEach(([type, availability]) => {
            if (!availability.available) {
                messages.push(`• No ${type} data available`);
            } else if (availability.quality === 'poor') {
                messages.push(`• ${type} data has significant gaps (${availability.coveragePercentage}% coverage)`);
            } else if (availability.gaps.length > 0) {
                messages.push(`• ${type} data has ${availability.gaps.length} gap(s)`);
            }
        });

        // Add degradation strategy message
        if (assessment.degradationStrategy) {
            messages.push(`Strategy: ${assessment.degradationStrategy.userMessage}`);
        }

        return messages.join('\n');
    }

    /**
     * Generate comprehensive data availability report
     * 
     * Requirements: 9.5 - Comprehensive validation and informative messaging
     */
    async generateDataAvailabilityReport(
        tenantId: string,
        dateRange: EnhancedDateRange,
        reportType: 'weekly' | 'monthly' | 'quarterly'
    ): Promise<{
        assessment: DataAvailabilityAssessment;
        retentionValidation: Awaited<ReturnType<typeof this.validateDataRetention>>;
        recommendations: string[];
        summary: string;
    }> {
        // Run both availability and retention validation
        const [assessment, retentionValidation] = await Promise.all([
            this.validateDataAvailability(tenantId, dateRange, reportType),
            this.validateDataRetention(tenantId, dateRange, reportType)
        ]);

        // Generate comprehensive recommendations
        const recommendations = [
            ...assessment.recommendations,
            ...retentionValidation.retentionIssues.map(issue => `Retention: ${issue}`)
        ];

        // Generate summary
        const summary = this.generateComprehensiveSummary(assessment, retentionValidation, reportType);

        return {
            assessment,
            retentionValidation,
            recommendations,
            summary
        };
    }

    /**
     * Generate comprehensive summary of data availability and retention
     */
    private generateComprehensiveSummary(
        assessment: DataAvailabilityAssessment,
        retentionValidation: Awaited<ReturnType<typeof this.validateDataRetention>>,
        reportType: string
    ): string {
        const summaryParts: string[] = [];

        // Overall status
        if (assessment.isAvailable && retentionValidation.meetsRetentionRequirements) {
            summaryParts.push(`✅ ${reportType} report can be generated with ${assessment.estimatedReportQuality} quality`);
        } else if (assessment.isAvailable && !retentionValidation.meetsRetentionRequirements) {
            summaryParts.push(`⚠️ ${reportType} report can be generated but with limited historical context`);
        } else {
            summaryParts.push(`❌ ${reportType} report cannot be generated due to insufficient data`);
        }

        // Data availability summary
        summaryParts.push(`Data availability: ${assessment.overallScore}%`);

        // Retention summary
        summaryParts.push(`Data retention: ${retentionValidation.dataRetentionScore}%`);

        // Oldest data available
        if (retentionValidation.oldestDataAvailable) {
            const daysBack = Math.ceil((Date.now() - retentionValidation.oldestDataAvailable.getTime()) / (1000 * 60 * 60 * 24));
            summaryParts.push(`Historical data available: ${daysBack} days`);
        }

        // Key issues
        const totalIssues = assessment.missingDataPeriods.length + retentionValidation.retentionIssues.length;
        if (totalIssues > 0) {
            summaryParts.push(`Issues identified: ${totalIssues}`);
        }

        return summaryParts.join(' | ');
    }
}