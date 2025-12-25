/**
 * Property-Based Test for Terminology Standardization
 * 
 * **Feature: avian-reports-module, Property 2: Terminology standardization**
 * **Validates: Requirements 2.2, 3.1**
 * 
 * This test verifies that the system consistently applies terminology standardization
 * across all report sections, replacing "Number of Alerts" with "Alerts Digested"
 * and "OS Updates" with "Updates" as specified in the requirements.
 */

import * as fc from 'fast-check';
import { TemplateEngine } from '../TemplateEngine';
import { generators } from './generators';
import { SlideData } from '@/types/reports';

describe('Property 2: Terminology Standardization', () => {
    let templateEngine: TemplateEngine;

    beforeEach(() => {
        templateEngine = new TemplateEngine();
    });

    describe('Alert Terminology Standardization (Requirement 2.2)', () => {
        it('should replace "Number of Alerts" with "Alerts Digested" in any report content', () => {
            /**
             * **Feature: avian-reports-module, Property 2: Terminology standardization**
             * **Validates: Requirements 2.2, 3.1**
             */
            fc.assert(
                fc.property(
                    fc.record({
                        prefix: fc.lorem({ maxCount: 5 }),
                        alertTerm: fc.constantFrom(
                            'Number of Alerts',
                            'Alert Count',
                            'Total Alerts',
                            'Alerts Processed',
                            'Alerts Handled',
                            'Alerts Managed',
                            'Alerts Reviewed'
                        ),
                        suffix: fc.lorem({ maxCount: 5 }),
                        number: fc.nat({ max: 10000 })
                    }),
                    ({ prefix, alertTerm, suffix, number }) => {
                        // Generate content with various alert terminology variations
                        const content = `${prefix} ${number} ${alertTerm} ${suffix}`;

                        // Apply terminology standardization
                        const standardized = templateEngine.applyTerminologyRules(content);

                        // Property: For any report section displaying alerts, 
                        // the system should use "Alerts Digested" instead of other alert terms
                        expect(standardized).not.toContain('Number of Alerts');
                        expect(standardized).not.toContain('Alert Count');
                        expect(standardized).not.toContain('Alerts Processed');
                        expect(standardized).not.toContain('Alerts Handled');
                        expect(standardized).not.toContain('Alerts Managed');
                        expect(standardized).not.toContain('Alerts Reviewed');

                        // Should contain the standardized terminology
                        if (alertTerm === 'Total Alerts') {
                            expect(standardized).toContain('Total Alerts Digested');
                        } else {
                            expect(standardized).toContain('Alerts Digested');
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should standardize alert terminology in slide data structures', () => {
            fc.assert(
                fc.property(
                    generators.baseReport.chain(report =>
                        fc.record({
                            report: fc.constant(report),
                            slideData: fc.record({
                                slideId: fc.uuid(),
                                slideType: fc.constantFrom('executive-overview', 'alerts-digest', 'data-visualization'),
                                title: fc.oneof(
                                    fc.constant('Number of Alerts Report'),
                                    fc.constant('Alert Count Summary'),
                                    fc.constant('Weekly Alerts Processed')
                                ),
                                summary: fc.oneof(
                                    fc.constant('We processed 150 Number of Alerts this week.'),
                                    fc.constant('Alert Count reached 200 incidents.'),
                                    fc.constant('Total Alerts for the period: 75')
                                ),
                                keyPoints: fc.array(fc.oneof(
                                    fc.constant('Blocked 50 Number of Alerts'),
                                    fc.constant('Alert Count increased by 10%'),
                                    fc.constant('Processed 25 Total Alerts')
                                ), { maxLength: 5 }),
                                computedMetrics: fc.dictionary(
                                    fc.string(),
                                    fc.oneof(
                                        fc.constant('Number of Alerts: 150'),
                                        fc.constant('Alert Count: 200'),
                                        fc.constant('Total Alerts: 75')
                                    )
                                ),
                                chartData: fc.array(fc.anything(), { maxLength: 3 }),
                                templateData: fc.dictionary(fc.string(), fc.anything())
                            })
                        })
                    ),
                    ({ report, slideData }) => {
                        // Apply terminology standardization to slide content
                        const standardized = templateEngine.standardizeSlideContent(slideData);

                        // Property: All slide data should use "Alerts Digested" terminology
                        expect(standardized.title).not.toContain('Number of Alerts');
                        expect(standardized.title).not.toContain('Alert Count');
                        expect(standardized.summary).not.toContain('Number of Alerts');
                        expect(standardized.summary).not.toContain('Alert Count');

                        // Check that standardized terminology is present
                        if (slideData.title?.includes('Number of Alerts') || slideData.title?.includes('Alert Count')) {
                            expect(standardized.title).toContain('Alerts Digested');
                        }

                        if (slideData.summary?.includes('Number of Alerts') || slideData.summary?.includes('Alert Count')) {
                            expect(standardized.summary).toContain('Alerts Digested');
                        }

                        // Check key points
                        standardized.keyPoints?.forEach(point => {
                            expect(point).not.toContain('Number of Alerts');
                            expect(point).not.toContain('Alert Count');
                        });

                        // Check computed metrics
                        Object.values(standardized.computedMetrics || {}).forEach(metric => {
                            if (typeof metric === 'string') {
                                expect(metric).not.toContain('Number of Alerts');
                                expect(metric).not.toContain('Alert Count');
                            }
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Update Terminology Standardization (Requirement 3.1)', () => {
        it('should replace "OS Updates" with "Updates" in any report content', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        prefix: fc.lorem({ maxCount: 5 }),
                        updateTerm: fc.constantFrom(
                            'OS Updates',
                            'Operating System Updates',
                            'System Updates',
                            'Software Updates',
                            'Security Updates',
                            'Patch Updates'
                        ),
                        suffix: fc.lorem({ maxCount: 5 }),
                        number: fc.nat({ max: 1000 })
                    }),
                    ({ prefix, updateTerm, suffix, number }) => {
                        // Generate content with various update terminology variations
                        const content = `${prefix} ${number} ${updateTerm} ${suffix}`;

                        // Apply terminology standardization
                        const standardized = templateEngine.applyTerminologyRules(content);

                        // Property: For any report section displaying updates,
                        // the system should use "Updates" instead of other update terms
                        expect(standardized).not.toContain('OS Updates');
                        expect(standardized).not.toContain('Operating System Updates');
                        expect(standardized).not.toContain('System Updates');
                        expect(standardized).not.toContain('Software Updates');
                        expect(standardized).not.toContain('Security Updates');
                        expect(standardized).not.toContain('Patch Updates');

                        // Should contain the standardized terminology
                        expect(standardized).toContain('Updates');
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should standardize update terminology in slide data structures', () => {
            fc.assert(
                fc.property(
                    generators.baseReport.chain(report =>
                        fc.record({
                            report: fc.constant(report),
                            slideData: fc.record({
                                slideId: fc.uuid(),
                                slideType: fc.constantFrom('executive-overview', 'updates-summary', 'data-visualization'),
                                title: fc.oneof(
                                    fc.constant('OS Updates Report'),
                                    fc.constant('System Updates Summary'),
                                    fc.constant('Software Updates Applied')
                                ),
                                summary: fc.oneof(
                                    fc.constant('We applied 25 OS Updates this week.'),
                                    fc.constant('System Updates completed successfully.'),
                                    fc.constant('Security Updates installed on all devices.')
                                ),
                                keyPoints: fc.array(fc.oneof(
                                    fc.constant('Applied 15 OS Updates'),
                                    fc.constant('System Updates increased security'),
                                    fc.constant('Completed 30 Software Updates')
                                ), { maxLength: 5 }),
                                computedMetrics: fc.dictionary(
                                    fc.string(),
                                    fc.oneof(
                                        fc.constant('OS Updates: 25'),
                                        fc.constant('System Updates: 30'),
                                        fc.constant('Software Updates: 15')
                                    )
                                ),
                                chartData: fc.array(fc.anything(), { maxLength: 3 }),
                                templateData: fc.dictionary(fc.string(), fc.anything())
                            })
                        })
                    ),
                    ({ report, slideData }) => {
                        // Apply terminology standardization to slide content
                        const standardized = templateEngine.standardizeSlideContent(slideData);

                        // Property: All slide data should use "Updates" terminology
                        expect(standardized.title).not.toContain('OS Updates');
                        expect(standardized.title).not.toContain('System Updates');
                        expect(standardized.title).not.toContain('Software Updates');
                        expect(standardized.summary).not.toContain('OS Updates');
                        expect(standardized.summary).not.toContain('System Updates');
                        expect(standardized.summary).not.toContain('Software Updates');

                        // Check that standardized terminology is present
                        if (slideData.title?.includes('OS Updates') ||
                            slideData.title?.includes('System Updates') ||
                            slideData.title?.includes('Software Updates')) {
                            expect(standardized.title).toContain('Updates');
                        }

                        if (slideData.summary?.includes('OS Updates') ||
                            slideData.summary?.includes('System Updates') ||
                            slideData.summary?.includes('Software Updates')) {
                            expect(standardized.summary).toContain('Updates');
                        }

                        // Check key points
                        standardized.keyPoints?.forEach(point => {
                            expect(point).not.toContain('OS Updates');
                            expect(point).not.toContain('System Updates');
                            expect(point).not.toContain('Software Updates');
                        });

                        // Check computed metrics
                        Object.values(standardized.computedMetrics || {}).forEach(metric => {
                            if (typeof metric === 'string') {
                                expect(metric).not.toContain('OS Updates');
                                expect(metric).not.toContain('System Updates');
                                expect(metric).not.toContain('Software Updates');
                            }
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Combined Terminology Standardization', () => {
        it('should apply both alert and update terminology standardization simultaneously', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        alertCount: fc.nat({ max: 1000 }),
                        updateCount: fc.nat({ max: 500 }),
                        alertTerm: fc.constantFrom('Number of Alerts', 'Alert Count', 'Alerts Processed'),
                        updateTerm: fc.constantFrom('OS Updates', 'System Updates', 'Software Updates'),
                        template: fc.constantFrom(
                            'This week we processed {alertCount} {alertTerm} and applied {updateCount} {updateTerm}.',
                            'Security summary: {alertCount} {alertTerm} handled, {updateCount} {updateTerm} completed.',
                            'Report shows {alertCount} {alertTerm} and {updateCount} {updateTerm} for the period.'
                        )
                    }),
                    ({ alertCount, updateCount, alertTerm, updateTerm, template }) => {
                        // Generate content with both alert and update terminology
                        const content = template
                            .replace('{alertCount}', alertCount.toString())
                            .replace('{alertTerm}', alertTerm)
                            .replace('{updateCount}', updateCount.toString())
                            .replace('{updateTerm}', updateTerm);

                        // Apply terminology standardization
                        const standardized = templateEngine.applyTerminologyRules(content);

                        // Property: Both alert and update terminology should be standardized
                        // Alert terminology should be standardized
                        expect(standardized).not.toContain('Number of Alerts');
                        expect(standardized).not.toContain('Alert Count');
                        expect(standardized).not.toContain('Alerts Processed');
                        expect(standardized).toContain('Alerts Digested');

                        // Update terminology should be standardized
                        expect(standardized).not.toContain('OS Updates');
                        expect(standardized).not.toContain('System Updates');
                        expect(standardized).not.toContain('Software Updates');
                        expect(standardized).toContain('Updates');

                        // Numbers should be preserved
                        expect(standardized).toContain(alertCount.toString());
                        expect(standardized).toContain(updateCount.toString());
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should maintain terminology consistency across complete report structures', () => {
            fc.assert(
                fc.property(
                    generators.baseReport,
                    (report) => {
                        // Create slide data with mixed terminology
                        const slideDataWithMixedTerminology: SlideData = {
                            slideId: 'test-slide',
                            slideType: 'executive-overview',
                            title: 'Weekly Number of Alerts and OS Updates Report',
                            summary: 'This week we processed 150 Number of Alerts and applied 25 OS Updates to enhance security.',
                            keyPoints: [
                                'Blocked 50 Number of Alerts from phishing attempts',
                                'Applied 15 OS Updates to critical systems',
                                'Alert Count increased by 10% from last week',
                                'System Updates completed successfully'
                            ],
                            computedMetrics: {
                                alerts: 'Number of Alerts: 150',
                                updates: 'OS Updates: 25',
                                alertCount: 'Alert Count: 200'
                            },
                            chartData: [],
                            templateData: {}
                        };

                        // Apply terminology standardization
                        const standardized = templateEngine.standardizeSlideContent(slideDataWithMixedTerminology);

                        // Property: All terminology should be consistently standardized
                        const allTextContent = JSON.stringify(standardized);

                        // No old terminology should remain
                        expect(allTextContent).not.toContain('Number of Alerts');
                        expect(allTextContent).not.toContain('Alert Count');
                        expect(allTextContent).not.toContain('OS Updates');
                        expect(allTextContent).not.toContain('System Updates');

                        // New terminology should be present
                        expect(allTextContent).toContain('Alerts Digested');
                        expect(allTextContent).toContain('Updates');

                        // Specific checks for each field
                        expect(standardized.title).toContain('Alerts Digested');
                        expect(standardized.title).toContain('Updates');
                        expect(standardized.summary).toContain('Alerts Digested');
                        expect(standardized.summary).toContain('Updates');

                        // Check all key points
                        standardized.keyPoints?.forEach(point => {
                            if (point.includes('Digested') || point.includes('Updates')) {
                                expect(point).not.toContain('Number of Alerts');
                                expect(point).not.toContain('Alert Count');
                                expect(point).not.toContain('OS Updates');
                                expect(point).not.toContain('System Updates');
                            }
                        });

                        // Check computed metrics
                        Object.values(standardized.computedMetrics || {}).forEach(metric => {
                            if (typeof metric === 'string' && (metric.includes('Digested') || metric.includes('Updates'))) {
                                expect(metric).not.toContain('Number of Alerts');
                                expect(metric).not.toContain('Alert Count');
                                expect(metric).not.toContain('OS Updates');
                            }
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Terminology Validation', () => {
        it('should detect terminology violations in any content', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        validContent: fc.lorem({ maxCount: 10 }),
                        violationType: fc.constantFrom('alert', 'update', 'both'),
                        alertViolation: fc.constantFrom('Number of Alerts', 'Alert Count'),
                        updateViolation: fc.constantFrom('OS Updates', 'System Updates')
                    }),
                    ({ validContent, violationType, alertViolation, updateViolation }) => {
                        let contentWithViolations = validContent;

                        // Add violations based on type
                        if (violationType === 'alert' || violationType === 'both') {
                            contentWithViolations += ` We processed 100 ${alertViolation}.`;
                        }
                        if (violationType === 'update' || violationType === 'both') {
                            contentWithViolations += ` Applied 25 ${updateViolation}.`;
                        }

                        // Validate terminology consistency
                        const validation = templateEngine.validateTerminologyConsistency(contentWithViolations);

                        // Property: Validation should detect violations when present
                        if (violationType === 'alert') {
                            expect(validation.isConsistent).toBe(false);
                            expect(validation.violations.some(v => v.type === 'alert_terminology')).toBe(true);
                            expect(validation.violations.some(v => v.found === alertViolation)).toBe(true);
                        } else if (violationType === 'update') {
                            expect(validation.isConsistent).toBe(false);
                            expect(validation.violations.some(v => v.type === 'update_terminology')).toBe(true);
                            expect(validation.violations.some(v => v.found === updateViolation)).toBe(true);
                        } else if (violationType === 'both') {
                            expect(validation.isConsistent).toBe(false);
                            expect(validation.violations.some(v => v.type === 'alert_terminology')).toBe(true);
                            expect(validation.violations.some(v => v.type === 'update_terminology')).toBe(true);
                        }

                        // All violations should reference correct requirements
                        validation.violations.forEach(violation => {
                            if (violation.type === 'alert_terminology') {
                                expect(violation.requirement).toBe('2.2');
                                expect(violation.shouldBe).toBe('Alerts Digested');
                            } else if (violation.type === 'update_terminology') {
                                expect(violation.requirement).toBe('3.1');
                                expect(violation.shouldBe).toBe('Updates');
                            }
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});