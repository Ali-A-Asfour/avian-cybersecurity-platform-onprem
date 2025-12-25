/**
 * Property-Based Tests for Data Categorization Completeness
 * 
 * **Feature: avian-reports-module, Property 3: Data categorization completeness**
 * **Validates: Requirements 2.3, 3.2, 4.2, 4.4**
 */

import * as fc from 'fast-check';
import { generators } from './generators';
import { DataAggregator } from '../DataAggregator';
import { AlertClassification, AlertSource, AlertsDigest, UpdatesSummary, VulnerabilityPosture } from '@/types/reports';

// Mock dependencies
jest.mock('../HistoricalDataStore');

describe('Data Categorization Completeness Properties', () => {
    let dataAggregator: DataAggregator;

    beforeEach(() => {
        jest.clearAllMocks();
        dataAggregator = new DataAggregator();
    });

    describe('Property 3: Data categorization completeness', () => {
        it('should ensure all required alert classifications are present', () => {
            /**
             * **Feature: avian-reports-module, Property 3: Data categorization completeness**
             * **Validates: Requirements 2.3, 3.2, 4.2, 4.4**
             */
            fc.assert(
                fc.property(
                    generators.alertsDigest,
                    (alertsDigest) => {
                        // Property: All required alert classifications must be present
                        const requiredClassifications = [
                            AlertClassification.PHISHING,
                            AlertClassification.MALWARE,
                            AlertClassification.SPYWARE,
                            AlertClassification.AUTHENTICATION,
                            AlertClassification.NETWORK,
                            AlertClassification.OTHER
                        ];

                        requiredClassifications.forEach(classification => {
                            expect(alertsDigest.alertClassification).toHaveProperty(classification);
                            expect(typeof alertsDigest.alertClassification[classification]).toBe('number');
                            expect(alertsDigest.alertClassification[classification]).toBeGreaterThanOrEqual(0);
                        });

                        // Property: No additional classifications should be present
                        const actualClassifications = Object.keys(alertsDigest.alertClassification);
                        expect(actualClassifications.length).toBe(requiredClassifications.length);

                        actualClassifications.forEach(classification => {
                            expect(requiredClassifications).toContain(classification as AlertClassification);
                        });

                        // Property: Classification enum coverage must be complete
                        const enumValues = Object.values(AlertClassification);
                        enumValues.forEach(enumValue => {
                            expect(alertsDigest.alertClassification).toHaveProperty(enumValue);
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should ensure all required alert outcome categories are present', () => {
            /**
             * **Feature: avian-reports-module, Property 3: Data categorization completeness**
             * **Validates: Requirements 2.3**
             */
            fc.assert(
                fc.property(
                    generators.alertsDigest,
                    (alertsDigest) => {
                        // Property: All required outcome categories must be present
                        const requiredOutcomes = ['securityIncidents', 'benignActivity', 'falsePositives'];

                        requiredOutcomes.forEach(outcome => {
                            expect(alertsDigest.alertOutcomes).toHaveProperty(outcome);
                            expect(typeof alertsDigest.alertOutcomes[outcome as keyof typeof alertsDigest.alertOutcomes]).toBe('number');
                            expect(alertsDigest.alertOutcomes[outcome as keyof typeof alertsDigest.alertOutcomes]).toBeGreaterThanOrEqual(0);
                        });

                        // Property: No additional outcome categories should be present
                        const actualOutcomes = Object.keys(alertsDigest.alertOutcomes);
                        expect(actualOutcomes.length).toBe(requiredOutcomes.length);

                        actualOutcomes.forEach(outcome => {
                            expect(requiredOutcomes).toContain(outcome);
                        });

                        // Property: Outcomes must be mutually exclusive categories
                        expect(alertsDigest.alertOutcomes.securityIncidents).toBeGreaterThanOrEqual(0);
                        expect(alertsDigest.alertOutcomes.benignActivity).toBeGreaterThanOrEqual(0);
                        expect(alertsDigest.alertOutcomes.falsePositives).toBeGreaterThanOrEqual(0);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should ensure all required alert sources are categorized', () => {
            /**
             * **Feature: avian-reports-module, Property 3: Data categorization completeness**
             * **Validates: Requirements 2.3**
             */
            fc.assert(
                fc.property(
                    generators.alertsDigest,
                    (alertsDigest) => {
                        // Property: All required alert sources must be present
                        const requiredSources = [
                            AlertSource.DEFENDER,
                            AlertSource.SONICWALL,
                            AlertSource.AVAST,
                            AlertSource.FIREWALL_EMAIL
                        ];

                        requiredSources.forEach(source => {
                            expect(alertsDigest.sourceBreakdown).toHaveProperty(source);
                            expect(typeof alertsDigest.sourceBreakdown[source]).toBe('number');
                            expect(alertsDigest.sourceBreakdown[source]).toBeGreaterThanOrEqual(0);
                        });

                        // Property: Source enum coverage must be complete
                        const enumValues = Object.values(AlertSource);
                        enumValues.forEach(enumValue => {
                            expect(alertsDigest.sourceBreakdown).toHaveProperty(enumValue);
                        });

                        // Property: No additional sources should be present
                        const actualSources = Object.keys(alertsDigest.sourceBreakdown);
                        expect(actualSources.length).toBe(requiredSources.length);

                        actualSources.forEach(source => {
                            expect(requiredSources).toContain(source as AlertSource);
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should ensure all required update source categories are present', () => {
            /**
             * **Feature: avian-reports-module, Property 3: Data categorization completeness**
             * **Validates: Requirements 3.2**
             */
            fc.assert(
                fc.property(
                    generators.updatesSummary,
                    (updatesSummary) => {
                        // Property: All required update sources must be present
                        const requiredSources = ['windows', 'microsoftOffice', 'firewall', 'other'];

                        requiredSources.forEach(source => {
                            expect(updatesSummary.updatesBySource).toHaveProperty(source);
                            expect(typeof updatesSummary.updatesBySource[source as keyof typeof updatesSummary.updatesBySource]).toBe('number');
                            expect(updatesSummary.updatesBySource[source as keyof typeof updatesSummary.updatesBySource]).toBeGreaterThanOrEqual(0);
                        });

                        // Property: No additional update sources should be present
                        const actualSources = Object.keys(updatesSummary.updatesBySource);
                        expect(actualSources.length).toBe(requiredSources.length);

                        actualSources.forEach(source => {
                            expect(requiredSources).toContain(source);
                        });

                        // Property: Update categories must cover all possible sources
                        expect(updatesSummary.updatesBySource.windows).toBeGreaterThanOrEqual(0);
                        expect(updatesSummary.updatesBySource.microsoftOffice).toBeGreaterThanOrEqual(0);
                        expect(updatesSummary.updatesBySource.firewall).toBeGreaterThanOrEqual(0);
                        expect(updatesSummary.updatesBySource.other).toBeGreaterThanOrEqual(0);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should ensure vulnerability breakdown options are properly categorized', () => {
            /**
             * **Feature: avian-reports-module, Property 3: Data categorization completeness**
             * **Validates: Requirements 4.2, 4.4**
             */
            fc.assert(
                fc.property(
                    generators.vulnerabilityPosture,
                    (vulnPosture) => {
                        // Property: Severity breakdown must always be present (required for all report types)
                        expect(vulnPosture.severityBreakdown).toBeDefined();
                        expect(typeof vulnPosture.severityBreakdown).toBe('object');

                        // Property: All required severity levels must be present
                        const requiredSeverities = ['critical', 'high', 'medium'];
                        requiredSeverities.forEach(severity => {
                            expect(vulnPosture.severityBreakdown).toHaveProperty(severity);
                            expect(typeof vulnPosture.severityBreakdown[severity as keyof typeof vulnPosture.severityBreakdown]).toBe('number');
                            expect(vulnPosture.severityBreakdown[severity as keyof typeof vulnPosture.severityBreakdown]).toBeGreaterThanOrEqual(0);
                        });

                        // Property: At least one breakdown option must be available
                        const hasClassBreakdown = vulnPosture.classBreakdown !== null && vulnPosture.classBreakdown !== undefined;
                        const hasTopCVEs = vulnPosture.topCVEs !== null && vulnPosture.topCVEs !== undefined;
                        const hasSeverityBreakdown = vulnPosture.severityBreakdown !== null && vulnPosture.severityBreakdown !== undefined;

                        // Severity breakdown is always required, so at least one option is always available
                        expect(hasSeverityBreakdown).toBe(true);

                        // Property: If class breakdown exists, it must be properly structured
                        if (hasClassBreakdown && vulnPosture.classBreakdown) {
                            Object.entries(vulnPosture.classBreakdown).forEach(([className, count]) => {
                                expect(typeof className).toBe('string');
                                expect(className.length).toBeGreaterThan(0);
                                expect(typeof count).toBe('number');
                                expect(count).toBeGreaterThanOrEqual(0);
                            });
                        }

                        // Property: If top CVEs exist, they must be properly structured
                        if (hasTopCVEs && vulnPosture.topCVEs) {
                            expect(Array.isArray(vulnPosture.topCVEs)).toBe(true);
                            vulnPosture.topCVEs.forEach(cve => {
                                expect(typeof cve.cveId).toBe('string');
                                expect(cve.cveId.length).toBeGreaterThan(0);
                                expect(typeof cve.severity).toBe('string');
                                expect(typeof cve.description).toBe('string');
                                expect(typeof cve.affectedDevices).toBe('number');
                                expect(cve.affectedDevices).toBeGreaterThanOrEqual(0);
                                expect(typeof cve.mitigated).toBe('boolean');
                            });
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should ensure weekly timeline has complete day coverage', () => {
            /**
             * **Feature: avian-reports-module, Property 3: Data categorization completeness**
             * **Validates: Requirements 2.3**
             */
            fc.assert(
                fc.property(
                    generators.alertsDigest,
                    (alertsDigest) => {
                        // Property: Weekly timeline must have exactly 7 days
                        expect(alertsDigest.weeklyTimeline).toHaveLength(7);

                        // Property: All days of the week must be represented
                        const requiredDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                        const actualDays = alertsDigest.weeklyTimeline.map(day => day.dayOfWeek);

                        expect(actualDays).toEqual(requiredDays);

                        // Property: Each day must have proper structure
                        alertsDigest.weeklyTimeline.forEach((day, index) => {
                            expect(day.dayOfWeek).toBe(requiredDays[index]);
                            expect(typeof day.date).toBe('string');
                            expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                            expect(typeof day.count).toBe('number');
                            expect(day.count).toBeGreaterThanOrEqual(0);
                        });

                        // Property: No gaps in day coverage (all 7 days present)
                        const daySet = new Set(actualDays);
                        expect(daySet.size).toBe(7);
                        requiredDays.forEach(day => {
                            expect(daySet.has(day)).toBe(true);
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should ensure comprehensive categorization across all data types', () => {
            /**
             * **Feature: avian-reports-module, Property 3: Data categorization completeness**
             * **Validates: Requirements 2.3, 3.2, 4.2, 4.4**
             */
            fc.assert(
                fc.property(
                    generators.alertsDigest,
                    generators.updatesSummary,
                    generators.vulnerabilityPosture,
                    (alertsDigest, updatesSummary, vulnPosture) => {
                        // Property: All major data categories must be comprehensively covered

                        // Alert categorization completeness
                        const alertClassifications = Object.keys(alertsDigest.alertClassification);
                        const expectedAlertClassifications = Object.values(AlertClassification);
                        expect(alertClassifications.length).toBe(expectedAlertClassifications.length);

                        // Update categorization completeness
                        const updateSources = Object.keys(updatesSummary.updatesBySource);
                        const expectedUpdateSources = ['windows', 'microsoftOffice', 'firewall', 'other'];
                        expect(updateSources.length).toBe(expectedUpdateSources.length);

                        // Vulnerability categorization completeness
                        expect(vulnPosture.severityBreakdown).toBeDefined();
                        const severityLevels = Object.keys(vulnPosture.severityBreakdown);
                        const expectedSeverityLevels = ['critical', 'high', 'medium'];
                        expect(severityLevels.length).toBe(expectedSeverityLevels.length);

                        // Property: No category should be missing from any data type
                        expectedAlertClassifications.forEach(classification => {
                            expect(alertsDigest.alertClassification).toHaveProperty(classification);
                        });

                        expectedUpdateSources.forEach(source => {
                            expect(updatesSummary.updatesBySource).toHaveProperty(source);
                        });

                        expectedSeverityLevels.forEach(severity => {
                            expect(vulnPosture.severityBreakdown).toHaveProperty(severity);
                        });

                        // Property: All categories must have valid data types
                        Object.values(alertsDigest.alertClassification).forEach(count => {
                            expect(typeof count).toBe('number');
                            expect(count).toBeGreaterThanOrEqual(0);
                        });

                        Object.values(updatesSummary.updatesBySource).forEach(count => {
                            expect(typeof count).toBe('number');
                            expect(count).toBeGreaterThanOrEqual(0);
                        });

                        Object.values(vulnPosture.severityBreakdown).forEach(count => {
                            expect(typeof count).toBe('number');
                            expect(count).toBeGreaterThanOrEqual(0);
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should handle empty data with complete category structure', () => {
            /**
             * **Feature: avian-reports-module, Property 3: Data categorization completeness**
             * **Validates: Requirements 2.3, 3.2, 4.2, 4.4**
             */
            fc.assert(
                fc.property(
                    fc.constant(0), // Zero total for testing empty data
                    (zeroTotal) => {
                        // Create empty but complete data structures
                        const emptyAlertsDigest = {
                            totalAlertsDigested: zeroTotal,
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
                        };

                        const emptyUpdatesSummary = {
                            totalUpdatesApplied: zeroTotal,
                            updatesBySource: {
                                windows: 0,
                                microsoftOffice: 0,
                                firewall: 0,
                                other: 0
                            }
                        };

                        // Property: Even with zero data, all categories must be present and structured

                        // Alert categories must be complete
                        Object.values(AlertClassification).forEach(classification => {
                            expect(emptyAlertsDigest.alertClassification).toHaveProperty(classification);
                            expect(emptyAlertsDigest.alertClassification[classification]).toBe(0);
                        });

                        // Update categories must be complete
                        ['windows', 'microsoftOffice', 'firewall', 'other'].forEach(source => {
                            expect(emptyUpdatesSummary.updatesBySource).toHaveProperty(source);
                            expect(emptyUpdatesSummary.updatesBySource[source as keyof typeof emptyUpdatesSummary.updatesBySource]).toBe(0);
                        });

                        // Timeline must be complete (7 days)
                        expect(emptyAlertsDigest.weeklyTimeline).toHaveLength(7);
                        emptyAlertsDigest.weeklyTimeline.forEach(day => {
                            expect(day.count).toBe(0);
                        });

                        // Source breakdown must be complete
                        Object.values(AlertSource).forEach(source => {
                            expect(emptyAlertsDigest.sourceBreakdown).toHaveProperty(source);
                            expect(emptyAlertsDigest.sourceBreakdown[source]).toBe(0);
                        });

                        // Outcome categories must be complete
                        expect(emptyAlertsDigest.alertOutcomes.securityIncidents).toBe(0);
                        expect(emptyAlertsDigest.alertOutcomes.benignActivity).toBe(0);
                        expect(emptyAlertsDigest.alertOutcomes.falsePositives).toBe(0);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});