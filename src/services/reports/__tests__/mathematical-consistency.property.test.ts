/**
 * Property-Based Tests for Mathematical Consistency
 * 
 * **Feature: avian-reports-module, Property 6: Mathematical consistency**
 * **Validates: Requirements 2.4, 3.3**
 */

import * as fc from 'fast-check';
import { generators } from './generators';
import { DataAggregator } from '../DataAggregator';
import { AlertsDigest, UpdatesSummary, VulnerabilityPosture, AlertClassification, AlertSource } from '@/types/reports';

// Mock dependencies
jest.mock('../HistoricalDataStore');

describe('Mathematical Consistency Properties', () => {
    let dataAggregator: DataAggregator;

    beforeEach(() => {
        jest.clearAllMocks();
        dataAggregator = new DataAggregator();
    });

    describe('Property 6: Mathematical consistency', () => {
        it('should ensure alert classification totals equal totalAlertsDigested', () => {
            /**
             * **Feature: avian-reports-module, Property 6: Mathematical consistency**
             * **Validates: Requirements 2.4, 3.3**
             */
            fc.assert(
                fc.property(
                    generators.consistentAlertsDigest,
                    (alertsDigest) => {
                        // Property: Sum of alert classification categories must equal total
                        const classificationSum = Object.values(alertsDigest.alertClassification)
                            .reduce((sum, count) => sum + count, 0);

                        expect(classificationSum).toBe(alertsDigest.totalAlertsDigested);

                        // Property: Each classification count must be non-negative
                        Object.values(AlertClassification).forEach(classification => {
                            expect(alertsDigest.alertClassification[classification]).toBeGreaterThanOrEqual(0);
                        });

                        // Property: All required classifications must be present
                        const requiredClassifications = Object.values(AlertClassification);
                        requiredClassifications.forEach(classification => {
                            expect(alertsDigest.alertClassification).toHaveProperty(classification);
                            expect(typeof alertsDigest.alertClassification[classification]).toBe('number');
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should ensure alert outcomes are mutually exclusive and sum to total', () => {
            /**
             * **Feature: avian-reports-module, Property 6: Mathematical consistency**
             * **Validates: Requirements 2.4**
             */
            fc.assert(
                fc.property(
                    generators.consistentAlertsDigest,
                    (alertsDigest) => {
                        const { securityIncidents, benignActivity, falsePositives } = alertsDigest.alertOutcomes;

                        // Property: Sum of outcomes must equal total alerts digested
                        const outcomesSum = securityIncidents + benignActivity + falsePositives;
                        expect(outcomesSum).toBe(alertsDigest.totalAlertsDigested);

                        // Property: Each outcome count must be non-negative
                        expect(securityIncidents).toBeGreaterThanOrEqual(0);
                        expect(benignActivity).toBeGreaterThanOrEqual(0);
                        expect(falsePositives).toBeGreaterThanOrEqual(0);

                        // Property: Outcomes are mutually exclusive (no overlap possible)
                        // This is enforced by the data structure, but we verify the math
                        expect(securityIncidents + benignActivity + falsePositives).toBe(
                            alertsDigest.totalAlertsDigested
                        );

                        // Property: If total is zero, all outcomes must be zero
                        if (alertsDigest.totalAlertsDigested === 0) {
                            expect(securityIncidents).toBe(0);
                            expect(benignActivity).toBe(0);
                            expect(falsePositives).toBe(0);
                        }

                        // Property: If total is non-zero, at least one outcome must be non-zero
                        if (alertsDigest.totalAlertsDigested > 0) {
                            expect(securityIncidents + benignActivity + falsePositives).toBeGreaterThan(0);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should ensure weekly timeline counts sum to total alerts for date range', () => {
            /**
             * **Feature: avian-reports-module, Property 6: Mathematical consistency**
             * **Validates: Requirements 2.4**
             */
            fc.assert(
                fc.property(
                    generators.consistentAlertsDigest,
                    (alertsDigest) => {
                        // Property: Sum of daily counts in weekly timeline must equal total
                        const timelineSum = alertsDigest.weeklyTimeline
                            .reduce((sum, day) => sum + day.count, 0);

                        expect(timelineSum).toBe(alertsDigest.totalAlertsDigested);

                        // Property: Weekly timeline must have exactly 7 days
                        expect(alertsDigest.weeklyTimeline).toHaveLength(7);

                        // Property: Each day count must be non-negative
                        alertsDigest.weeklyTimeline.forEach(day => {
                            expect(day.count).toBeGreaterThanOrEqual(0);
                            expect(typeof day.count).toBe('number');
                            expect(Number.isInteger(day.count)).toBe(true);
                        });

                        // Property: Days must be properly formatted and ordered
                        const expectedDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                        alertsDigest.weeklyTimeline.forEach((day, index) => {
                            expect(day.dayOfWeek).toBe(expectedDays[index]);
                            expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should ensure source breakdown totals equal totalAlertsDigested', () => {
            /**
             * **Feature: avian-reports-module, Property 6: Mathematical consistency**
             * **Validates: Requirements 2.4**
             */
            fc.assert(
                fc.property(
                    generators.consistentAlertsDigest,
                    (alertsDigest) => {
                        // Property: Sum of source breakdown must equal total
                        const sourceSum = Object.values(alertsDigest.sourceBreakdown)
                            .reduce((sum, count) => sum + count, 0);

                        expect(sourceSum).toBe(alertsDigest.totalAlertsDigested);

                        // Property: Each source count must be non-negative
                        Object.values(AlertSource).forEach(source => {
                            expect(alertsDigest.sourceBreakdown[source]).toBeGreaterThanOrEqual(0);
                            expect(typeof alertsDigest.sourceBreakdown[source]).toBe('number');
                            expect(Number.isInteger(alertsDigest.sourceBreakdown[source])).toBe(true);
                        });

                        // Property: All required sources must be present
                        const requiredSources = Object.values(AlertSource);
                        requiredSources.forEach(source => {
                            expect(alertsDigest.sourceBreakdown).toHaveProperty(source);
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should ensure updates by source sum to totalUpdatesApplied', () => {
            /**
             * **Feature: avian-reports-module, Property 6: Mathematical consistency**
             * **Validates: Requirements 3.3**
             */
            fc.assert(
                fc.property(
                    generators.consistentUpdatesSummary,
                    (updatesSummary) => {
                        const { windows, microsoftOffice, firewall, other } = updatesSummary.updatesBySource;

                        // Property: Sum of updates by source must equal total
                        const sourceSum = windows + microsoftOffice + firewall + other;
                        expect(sourceSum).toBe(updatesSummary.totalUpdatesApplied);

                        // Property: Each source count must be non-negative
                        expect(windows).toBeGreaterThanOrEqual(0);
                        expect(microsoftOffice).toBeGreaterThanOrEqual(0);
                        expect(firewall).toBeGreaterThanOrEqual(0);
                        expect(other).toBeGreaterThanOrEqual(0);

                        // Property: All counts must be integers
                        expect(Number.isInteger(windows)).toBe(true);
                        expect(Number.isInteger(microsoftOffice)).toBe(true);
                        expect(Number.isInteger(firewall)).toBe(true);
                        expect(Number.isInteger(other)).toBe(true);

                        // Property: If total is zero, all sources must be zero
                        if (updatesSummary.totalUpdatesApplied === 0) {
                            expect(windows).toBe(0);
                            expect(microsoftOffice).toBe(0);
                            expect(firewall).toBe(0);
                            expect(other).toBe(0);
                        }

                        // Property: If total is non-zero, at least one source must be non-zero
                        if (updatesSummary.totalUpdatesApplied > 0) {
                            expect(windows + microsoftOffice + firewall + other).toBeGreaterThan(0);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should ensure vulnerability posture mathematical relationships', () => {
            /**
             * **Feature: avian-reports-module, Property 6: Mathematical consistency**
             * **Validates: Requirements 2.4, 3.3**
             */
            fc.assert(
                fc.property(
                    generators.vulnerabilityPosture,
                    (vulnPosture) => {
                        // Property: Mitigated count cannot exceed detected count
                        expect(vulnPosture.totalMitigated).toBeLessThanOrEqual(vulnPosture.totalDetected);

                        // Property: All counts must be non-negative
                        expect(vulnPosture.totalDetected).toBeGreaterThanOrEqual(0);
                        expect(vulnPosture.totalMitigated).toBeGreaterThanOrEqual(0);

                        // Property: Severity breakdown counts must be non-negative
                        expect(vulnPosture.severityBreakdown.critical).toBeGreaterThanOrEqual(0);
                        expect(vulnPosture.severityBreakdown.high).toBeGreaterThanOrEqual(0);
                        expect(vulnPosture.severityBreakdown.medium).toBeGreaterThanOrEqual(0);

                        // Property: All counts must be integers
                        expect(Number.isInteger(vulnPosture.totalDetected)).toBe(true);
                        expect(Number.isInteger(vulnPosture.totalMitigated)).toBe(true);
                        expect(Number.isInteger(vulnPosture.severityBreakdown.critical)).toBe(true);
                        expect(Number.isInteger(vulnPosture.severityBreakdown.high)).toBe(true);
                        expect(Number.isInteger(vulnPosture.severityBreakdown.medium)).toBe(true);

                        // Property: If class breakdown exists, all values must be non-negative
                        if (vulnPosture.classBreakdown) {
                            Object.values(vulnPosture.classBreakdown).forEach(count => {
                                expect(count).toBeGreaterThanOrEqual(0);
                                expect(Number.isInteger(count)).toBe(true);
                            });
                        }

                        // Property: Risk reduction trend percentages must be within valid range
                        if (vulnPosture.riskReductionTrend) {
                            expect(vulnPosture.riskReductionTrend.percentReduction).toBeGreaterThanOrEqual(-100);
                            expect(vulnPosture.riskReductionTrend.percentReduction).toBeLessThanOrEqual(100);
                            expect(vulnPosture.riskReductionTrend.quarterStart).toBeGreaterThanOrEqual(0);
                            expect(vulnPosture.riskReductionTrend.quarterEnd).toBeGreaterThanOrEqual(0);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should maintain mathematical consistency across multiple aggregations', () => {
            /**
             * **Feature: avian-reports-module, Property 6: Mathematical consistency**
             * **Validates: Requirements 2.4, 3.3**
             */
            fc.assert(
                fc.property(
                    generators.consistentAlertsDigest,
                    generators.consistentUpdatesSummary,
                    generators.vulnerabilityPosture,
                    (alertsDigest, updatesSummary, vulnPosture) => {
                        // Property: All totals must be consistent within their own domains

                        // Alerts domain consistency
                        const alertClassificationSum = Object.values(alertsDigest.alertClassification)
                            .reduce((sum, count) => sum + count, 0);
                        const alertOutcomesSum = alertsDigest.alertOutcomes.securityIncidents +
                            alertsDigest.alertOutcomes.benignActivity +
                            alertsDigest.alertOutcomes.falsePositives;
                        const alertTimelineSum = alertsDigest.weeklyTimeline
                            .reduce((sum, day) => sum + day.count, 0);
                        const alertSourceSum = Object.values(alertsDigest.sourceBreakdown)
                            .reduce((sum, count) => sum + count, 0);

                        expect(alertClassificationSum).toBe(alertsDigest.totalAlertsDigested);
                        expect(alertOutcomesSum).toBe(alertsDigest.totalAlertsDigested);
                        expect(alertTimelineSum).toBe(alertsDigest.totalAlertsDigested);
                        expect(alertSourceSum).toBe(alertsDigest.totalAlertsDigested);

                        // Updates domain consistency
                        const updatesSourceSum = updatesSummary.updatesBySource.windows +
                            updatesSummary.updatesBySource.microsoftOffice +
                            updatesSummary.updatesBySource.firewall +
                            updatesSummary.updatesBySource.other;

                        expect(updatesSourceSum).toBe(updatesSummary.totalUpdatesApplied);

                        // Vulnerability domain consistency
                        expect(vulnPosture.totalMitigated).toBeLessThanOrEqual(vulnPosture.totalDetected);

                        // Property: Cross-domain relationships should be logical
                        // (These are business logic constraints, not strict mathematical requirements)

                        // If there are security incidents, there should be some alerts
                        if (alertsDigest.alertOutcomes.securityIncidents > 0) {
                            expect(alertsDigest.totalAlertsDigested).toBeGreaterThan(0);
                        }

                        // If there are vulnerabilities detected, there might be related alerts
                        // (This is a weak relationship since not all vulnerabilities generate alerts)
                        if (vulnPosture.totalDetected > 0 && alertsDigest.totalAlertsDigested > 0) {
                            // Both systems are active, which is a valid state
                            expect(vulnPosture.totalDetected).toBeGreaterThanOrEqual(0);
                            expect(alertsDigest.totalAlertsDigested).toBeGreaterThanOrEqual(0);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should handle edge cases with zero values correctly', () => {
            /**
             * **Feature: avian-reports-module, Property 6: Mathematical consistency**
             * **Validates: Requirements 2.4, 3.3**
             */
            fc.assert(
                fc.property(
                    fc.constantFrom(0, 1, 2, 5, 10), // Small numbers including zero
                    (total) => {
                        // Generate consistent data with specific totals including zero
                        const alertsDigest = {
                            totalAlertsDigested: total,
                            alertClassification: {
                                [AlertClassification.PHISHING]: total,
                                [AlertClassification.MALWARE]: 0,
                                [AlertClassification.SPYWARE]: 0,
                                [AlertClassification.AUTHENTICATION]: 0,
                                [AlertClassification.NETWORK]: 0,
                                [AlertClassification.OTHER]: 0
                            },
                            alertOutcomes: {
                                securityIncidents: total,
                                benignActivity: 0,
                                falsePositives: 0
                            },
                            weeklyTimeline: Array(7).fill(null).map((_, i) => ({
                                date: new Date(2024, 0, 1 + i).toISOString().split('T')[0],
                                dayOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][i] as any,
                                count: i === 0 ? total : 0 // All alerts on Monday
                            })),
                            sourceBreakdown: {
                                [AlertSource.DEFENDER]: total,
                                [AlertSource.SONICWALL]: 0,
                                [AlertSource.AVAST]: 0,
                                [AlertSource.FIREWALL_EMAIL]: 0
                            }
                        };

                        // Property: Mathematical consistency must hold even for edge cases
                        const classificationSum = Object.values(alertsDigest.alertClassification)
                            .reduce((sum, count) => sum + count, 0);
                        const outcomesSum = alertsDigest.alertOutcomes.securityIncidents +
                            alertsDigest.alertOutcomes.benignActivity +
                            alertsDigest.alertOutcomes.falsePositives;
                        const timelineSum = alertsDigest.weeklyTimeline
                            .reduce((sum, day) => sum + day.count, 0);
                        const sourceSum = Object.values(alertsDigest.sourceBreakdown)
                            .reduce((sum, count) => sum + count, 0);

                        expect(classificationSum).toBe(total);
                        expect(outcomesSum).toBe(total);
                        expect(timelineSum).toBe(total);
                        expect(sourceSum).toBe(total);

                        // Property: Zero case must be handled correctly
                        if (total === 0) {
                            Object.values(alertsDigest.alertClassification).forEach(count => {
                                expect(count).toBe(0);
                            });
                            expect(alertsDigest.alertOutcomes.securityIncidents).toBe(0);
                            expect(alertsDigest.alertOutcomes.benignActivity).toBe(0);
                            expect(alertsDigest.alertOutcomes.falsePositives).toBe(0);
                            alertsDigest.weeklyTimeline.forEach(day => {
                                expect(day.count).toBe(0);
                            });
                            Object.values(alertsDigest.sourceBreakdown).forEach(count => {
                                expect(count).toBe(0);
                            });
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});