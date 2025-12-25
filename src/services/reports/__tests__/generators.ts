/**
 * Property-Based Testing Generators for AVIAN Reports Module
 * 
 * This file contains fast-check generators for creating test data
 * for property-based testing of the reports module.
 */

import * as fc from 'fast-check';
import {
    AlertClassification,
    AlertSource,
    AlertSeverity,
    AlertOutcome,
    EnhancedDateRange,
    AlertsDigest,
    UpdatesSummary,
    VulnerabilityPosture,
    DailyAlertCount,
    AlertRecord,
    MetricsRecord,
    ReportSnapshot,
    BaseReport
} from '@/types/reports';

// ============================================================================
// Basic Generators
// ============================================================================

export const tenantIdGen = fc.uuid();
export const userIdGen = fc.uuid();
export const deviceIdGen = fc.uuid();

export const alertClassificationGen = fc.constantFrom(
    ...Object.values(AlertClassification)
);

export const alertSourceGen = fc.constantFrom(
    ...Object.values(AlertSource)
);

export const alertSeverityGen = fc.constantFrom(
    ...Object.values(AlertSeverity)
);

export const alertOutcomeGen = fc.constantFrom(
    'security_incident' as AlertOutcome,
    'benign_activity' as AlertOutcome,
    'false_positive' as AlertOutcome
);

export const dayOfWeekGen = fc.constantFrom(
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
);

// ============================================================================
// Date and Time Generators
// ============================================================================

export const timezoneGen = fc.constantFrom(
    'America/Toronto',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Australia/Sydney'
);

export const enhancedDateRangeGen = fc.record({
    startDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
    endDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
    timezone: timezoneGen,
    weekStart: fc.constant('monday' as const)
}).filter(range => range.startDate < range.endDate);

// ============================================================================
// Alert Data Generators
// ============================================================================

export const dailyAlertCountGen = fc.record({
    date: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') })
        .filter(d => !isNaN(d.getTime()))
        .map(d => d.toISOString().split('T')[0]),
    dayOfWeek: dayOfWeekGen,
    count: fc.nat({ max: 1000 })
});

export const weeklyTimelineGen = fc.array(dailyAlertCountGen, {
    minLength: 7,
    maxLength: 7
});

export const alertsDigestGen = fc.record({
    totalAlertsDigested: fc.nat({ max: 10000 }),
    alertClassification: fc.record({
        [AlertClassification.PHISHING]: fc.nat({ max: 1000 }),
        [AlertClassification.MALWARE]: fc.nat({ max: 1000 }),
        [AlertClassification.SPYWARE]: fc.nat({ max: 1000 }),
        [AlertClassification.AUTHENTICATION]: fc.nat({ max: 1000 }),
        [AlertClassification.NETWORK]: fc.nat({ max: 1000 }),
        [AlertClassification.OTHER]: fc.nat({ max: 1000 })
    }),
    alertOutcomes: fc.record({
        securityIncidents: fc.nat({ max: 1000 }),
        benignActivity: fc.nat({ max: 1000 }),
        falsePositives: fc.nat({ max: 1000 })
    }),
    weeklyTimeline: weeklyTimelineGen,
    sourceBreakdown: fc.record({
        [AlertSource.DEFENDER]: fc.nat({ max: 1000 }),
        [AlertSource.SONICWALL]: fc.nat({ max: 1000 }),
        [AlertSource.AVAST]: fc.nat({ max: 1000 }),
        [AlertSource.FIREWALL_EMAIL]: fc.nat({ max: 1000 })
    })
});

// ============================================================================
// Updates and Vulnerability Generators
// ============================================================================

export const updatesSummaryGen = fc.record({
    totalUpdatesApplied: fc.nat({ max: 10000 }),
    updatesBySource: fc.record({
        windows: fc.nat({ max: 1000 }),
        microsoftOffice: fc.nat({ max: 1000 }),
        firewall: fc.nat({ max: 1000 }),
        other: fc.nat({ max: 1000 })
    })
});

export const vulnerabilityPostureGen = fc.record({
    totalDetected: fc.nat({ max: 10000 }),
    totalMitigated: fc.nat({ max: 10000 }),
    severityBreakdown: fc.record({
        critical: fc.nat({ max: 1000 }),
        high: fc.nat({ max: 1000 }),
        medium: fc.nat({ max: 1000 })
    }),
    classBreakdown: fc.option(fc.dictionary(fc.string(), fc.nat({ max: 100 }))),
    topCVEs: fc.option(fc.array(fc.record({
        cveId: fc.string({ minLength: 8, maxLength: 20 }),
        severity: alertSeverityGen,
        description: fc.lorem({ maxCount: 10 }),
        affectedDevices: fc.nat({ max: 100 }),
        mitigated: fc.boolean()
    }), { maxLength: 10 })),
    riskReductionTrend: fc.option(fc.record({
        quarterStart: fc.nat({ max: 1000 }),
        quarterEnd: fc.nat({ max: 1000 }),
        percentReduction: fc.float({ min: -100, max: 100 })
    }))
});

// ============================================================================
// Historical Data Generators
// ============================================================================

export const alertRecordGen = fc.record({
    id: fc.uuid(),
    tenantId: tenantIdGen,
    rawAlertType: fc.string({ minLength: 5, maxLength: 50 }),
    normalizedType: alertClassificationGen,
    severity: alertSeverityGen,
    outcome: alertOutcomeGen,
    createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
    resolvedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
    deviceId: fc.option(deviceIdGen),
    source: alertSourceGen,
    sourceSubtype: fc.option(fc.string({ minLength: 3, maxLength: 20 }))
}).filter(record => record.createdAt <= record.resolvedAt);

export const metricsRecordGen = fc.record({
    id: fc.uuid(),
    tenantId: tenantIdGen,
    deviceId: deviceIdGen,
    date: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
    threatsBlocked: fc.nat({ max: 10000 }),
    updatesApplied: fc.nat({ max: 1000 }),
    vulnerabilitiesDetected: fc.nat({ max: 1000 }),
    vulnerabilitiesMitigated: fc.nat({ max: 1000 }),
    source: fc.constantFrom('firewall' as const, 'edr' as const)
});

// ============================================================================
// Report Generators
// ============================================================================

export const reportSnapshotGen = fc.record({
    id: fc.uuid(),
    tenantId: tenantIdGen,
    reportId: fc.uuid(),
    reportType: fc.constantFrom('weekly' as const, 'monthly' as const, 'quarterly' as const),
    dateRange: enhancedDateRangeGen,
    generatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
    generatedBy: userIdGen,
    slideData: fc.array(fc.record({
        slideId: fc.uuid(),
        slideType: fc.string({ minLength: 5, maxLength: 30 }),
        computedMetrics: fc.dictionary(fc.string(), fc.anything()),
        chartData: fc.array(fc.anything(), { maxLength: 5 }),
        templateData: fc.dictionary(fc.string(), fc.anything())
    }), { maxLength: 10 }),
    templateVersion: fc.string({ minLength: 5, maxLength: 10 }),
    dataSchemaVersion: fc.string({ minLength: 5, maxLength: 10 }),
    pdfStorageKey: fc.option(fc.string({ minLength: 10, maxLength: 100 })),
    pdfSize: fc.option(fc.nat({ max: 100000000 })), // up to 100MB
    isArchived: fc.boolean()
});

export const baseReportGen = fc.record({
    id: fc.uuid(),
    tenantId: tenantIdGen,
    reportType: fc.constantFrom('weekly' as const, 'monthly' as const, 'quarterly' as const),
    dateRange: enhancedDateRangeGen,
    generatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
    generatedBy: userIdGen,
    slides: fc.array(fc.record({
        id: fc.uuid(),
        title: fc.lorem({ maxCount: 5 }),
        content: fc.record({
            heading: fc.lorem({ maxCount: 3 }),
            subheading: fc.option(fc.lorem({ maxCount: 5 })),
            summary: fc.lorem({ maxCount: 20 }),
            keyPoints: fc.array(fc.lorem({ maxCount: 10 }), { maxLength: 5 }),
            callouts: fc.array(fc.record({
                type: fc.constantFrom('info' as const, 'warning' as const, 'success' as const, 'highlight' as const),
                text: fc.lorem({ maxCount: 10 }),
                icon: fc.option(fc.string({ minLength: 3, maxLength: 20 }))
            }), { maxLength: 3 })
        }),
        charts: fc.array(fc.record({
            id: fc.uuid(),
            type: fc.constantFrom('bar' as const, 'donut' as const, 'progress' as const, 'line' as const, 'timeline' as const),
            title: fc.lorem({ maxCount: 3 }),
            data: fc.record({
                labels: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { maxLength: 10 }),
                datasets: fc.array(fc.record({
                    label: fc.string({ minLength: 3, maxLength: 20 }),
                    data: fc.array(fc.nat({ max: 1000 }), { maxLength: 10 }),
                    backgroundColor: fc.option(fc.array(fc.string({ minLength: 6, maxLength: 6 }).map(s => '#' + s), { maxLength: 10 })),
                    borderColor: fc.option(fc.array(fc.string({ minLength: 6, maxLength: 6 }).map(s => '#' + s), { maxLength: 10 })),
                    borderWidth: fc.option(fc.nat({ max: 5 }))
                }), { maxLength: 5 }),
                metadata: fc.option(fc.dictionary(fc.string(), fc.anything()))
            }),
            styling: fc.record({
                theme: fc.constant('dark' as const),
                colors: fc.array(fc.string({ minLength: 6, maxLength: 6 }).map(s => '#' + s), { maxLength: 10 }),
                fontSize: fc.nat({ min: 8, max: 24 }),
                showLegend: fc.boolean(),
                showGrid: fc.boolean()
            })
        }), { maxLength: 4 }),
        layout: fc.record({
            type: fc.constantFrom('executive-overview' as const, 'data-visualization' as const, 'trend-analysis' as const, 'summary' as const),
            orientation: fc.constant('landscape' as const),
            theme: fc.constant('dark' as const),
            branding: fc.constant('avian' as const)
        })
    }), { maxLength: 10 }),
    templateVersion: fc.string({ minLength: 5, maxLength: 10 }),
    dataSchemaVersion: fc.string({ minLength: 5, maxLength: 10 })
});

// ============================================================================
// Constraint Generators (for mathematical consistency testing)
// ============================================================================

/**
 * Generates AlertsDigest with mathematically consistent data
 * Ensures sum of classifications equals total, sum of outcomes equals total, etc.
 */
export const consistentAlertsDigestGen = fc.nat({ max: 10000 }).chain(total => {
    if (total === 0) {
        return fc.constant({
            totalAlertsDigested: 0,
            alertClassification: {
                [AlertClassification.PHISHING]: 0,
                [AlertClassification.MALWARE]: 0,
                [AlertClassification.SPYWARE]: 0,
                [AlertClassification.AUTHENTICATION]: 0,
                [AlertClassification.NETWORK]: 0,
                [AlertClassification.OTHER]: 0
            },
            alertOutcomes: {
                securityIncidents: 0,
                benignActivity: 0,
                falsePositives: 0
            },
            weeklyTimeline: Array(7).fill(null).map((_, i) => ({
                date: new Date(2024, 0, 1 + i).toISOString().split('T')[0],
                dayOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][i] as any,
                count: 0
            })),
            sourceBreakdown: {
                [AlertSource.DEFENDER]: 0,
                [AlertSource.SONICWALL]: 0,
                [AlertSource.AVAST]: 0,
                [AlertSource.FIREWALL_EMAIL]: 0
            }
        });
    }

    return fc.record({
        totalAlertsDigested: fc.constant(total),
        alertClassification: fc.array(fc.nat({ max: total }), { minLength: 6, maxLength: 6 })
            .map(values => {
                const sum = values.reduce((a, b) => a + b, 0);
                if (sum === 0) {
                    return {
                        [AlertClassification.PHISHING]: total,
                        [AlertClassification.MALWARE]: 0,
                        [AlertClassification.SPYWARE]: 0,
                        [AlertClassification.AUTHENTICATION]: 0,
                        [AlertClassification.NETWORK]: 0,
                        [AlertClassification.OTHER]: 0
                    };
                }
                const factor = total / sum;
                const adjusted = values.map(v => Math.floor(v * factor));
                const remainder = total - adjusted.reduce((a, b) => a + b, 0);
                if (remainder > 0) adjusted[0] += remainder;
                return {
                    [AlertClassification.PHISHING]: adjusted[0],
                    [AlertClassification.MALWARE]: adjusted[1],
                    [AlertClassification.SPYWARE]: adjusted[2],
                    [AlertClassification.AUTHENTICATION]: adjusted[3],
                    [AlertClassification.NETWORK]: adjusted[4],
                    [AlertClassification.OTHER]: adjusted[5]
                };
            }),
        alertOutcomes: fc.array(fc.nat({ max: total }), { minLength: 3, maxLength: 3 })
            .map(values => {
                const sum = values.reduce((a, b) => a + b, 0);
                if (sum === 0) {
                    return {
                        securityIncidents: total,
                        benignActivity: 0,
                        falsePositives: 0
                    };
                }
                const factor = total / sum;
                const adjusted = values.map(v => Math.floor(v * factor));
                const remainder = total - adjusted.reduce((a, b) => a + b, 0);
                if (remainder > 0) adjusted[0] += remainder;
                return {
                    securityIncidents: adjusted[0],
                    benignActivity: adjusted[1],
                    falsePositives: adjusted[2]
                };
            }),
        weeklyTimeline: fc.array(fc.nat({ max: Math.floor(total / 7) + 1 }), { minLength: 7, maxLength: 7 })
            .map(values => {
                const sum = values.reduce((a, b) => a + b, 0);
                const factor = sum > 0 ? total / sum : 0;
                const adjusted = values.map(v => Math.floor(v * factor));
                const remainder = total - adjusted.reduce((a, b) => a + b, 0);
                if (remainder > 0) adjusted[0] += remainder;

                return adjusted.map((count, i) => ({
                    date: new Date(2024, 0, 1 + i).toISOString().split('T')[0],
                    dayOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][i] as any,
                    count
                }));
            }),
        sourceBreakdown: fc.array(fc.nat({ max: total }), { minLength: 4, maxLength: 4 })
            .map(values => {
                const sum = values.reduce((a, b) => a + b, 0);
                if (sum === 0) {
                    return {
                        [AlertSource.DEFENDER]: total,
                        [AlertSource.SONICWALL]: 0,
                        [AlertSource.AVAST]: 0,
                        [AlertSource.FIREWALL_EMAIL]: 0
                    };
                }
                const factor = total / sum;
                const adjusted = values.map(v => Math.floor(v * factor));
                const remainder = total - adjusted.reduce((a, b) => a + b, 0);
                if (remainder > 0) adjusted[0] += remainder;
                return {
                    [AlertSource.DEFENDER]: adjusted[0],
                    [AlertSource.SONICWALL]: adjusted[1],
                    [AlertSource.AVAST]: adjusted[2],
                    [AlertSource.FIREWALL_EMAIL]: adjusted[3]
                };
            })
    });
});

/**
 * Generates UpdatesSummary with mathematically consistent data
 */
export const consistentUpdatesSummaryGen = fc.nat({ max: 10000 }).chain(total => {
    if (total === 0) {
        return fc.constant({
            totalUpdatesApplied: 0,
            updatesBySource: {
                windows: 0,
                microsoftOffice: 0,
                firewall: 0,
                other: 0
            }
        });
    }

    return fc.array(fc.nat({ max: total }), { minLength: 4, maxLength: 4 })
        .map(values => {
            const sum = values.reduce((a, b) => a + b, 0);
            if (sum === 0) {
                return {
                    totalUpdatesApplied: total,
                    updatesBySource: {
                        windows: total,
                        microsoftOffice: 0,
                        firewall: 0,
                        other: 0
                    }
                };
            }
            const factor = total / sum;
            const adjusted = values.map(v => Math.floor(v * factor));
            const remainder = total - adjusted.reduce((a, b) => a + b, 0);
            if (remainder > 0) adjusted[0] += remainder;

            return {
                totalUpdatesApplied: total,
                updatesBySource: {
                    windows: adjusted[0],
                    microsoftOffice: adjusted[1],
                    firewall: adjusted[2],
                    other: adjusted[3]
                }
            };
        });
});

// ============================================================================
// Export all generators
// ============================================================================

export const generators = {
    // Basic
    tenantId: tenantIdGen,
    userId: userIdGen,
    deviceId: deviceIdGen,
    alertClassification: alertClassificationGen,
    alertSource: alertSourceGen,
    alertSeverity: alertSeverityGen,
    alertOutcome: alertOutcomeGen,
    dayOfWeek: dayOfWeekGen,
    timezone: timezoneGen,

    // Complex
    enhancedDateRange: enhancedDateRangeGen,
    dailyAlertCount: dailyAlertCountGen,
    weeklyTimeline: weeklyTimelineGen,
    alertsDigest: alertsDigestGen,
    updatesSummary: updatesSummaryGen,
    vulnerabilityPosture: vulnerabilityPostureGen,
    alertRecord: alertRecordGen,
    metricsRecord: metricsRecordGen,
    reportSnapshot: reportSnapshotGen,
    baseReport: baseReportGen,

    // Consistent (mathematically correct)
    consistentAlertsDigest: consistentAlertsDigestGen,
    consistentUpdatesSummary: consistentUpdatesSummaryGen
};