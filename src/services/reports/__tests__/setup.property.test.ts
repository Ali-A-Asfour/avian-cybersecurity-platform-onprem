/**
 * Property-Based Testing Setup Verification
 * 
 * This test file verifies that the property-based testing framework
 * is correctly configured for the AVIAN Reports Module.
 */

import * as fc from 'fast-check';
import { generators } from './generators';
import { AlertClassification, AlertSource } from '@/types/reports';

describe('Reports Module PBT Setup', () => {
    describe('Generator Validation', () => {
        it('should generate valid tenant IDs', () => {
            fc.assert(
                fc.property(generators.tenantId, (tenantId) => {
                    expect(typeof tenantId).toBe('string');
                    expect(tenantId.length).toBeGreaterThan(0);
                    // UUID format validation
                    expect(tenantId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
                }),
                { numRuns: 100 }
            );
        });

        it('should generate valid alert classifications', () => {
            fc.assert(
                fc.property(generators.alertClassification, (classification) => {
                    expect(Object.values(AlertClassification)).toContain(classification);
                }),
                { numRuns: 100 }
            );
        });

        it('should generate valid alert sources', () => {
            fc.assert(
                fc.property(generators.alertSource, (source) => {
                    expect(Object.values(AlertSource)).toContain(source);
                }),
                { numRuns: 100 }
            );
        });

        it('should generate valid enhanced date ranges', () => {
            fc.assert(
                fc.property(generators.enhancedDateRange, (dateRange) => {
                    expect(dateRange.startDate).toBeInstanceOf(Date);
                    expect(dateRange.endDate).toBeInstanceOf(Date);
                    expect(dateRange.startDate.getTime()).toBeLessThanOrEqual(dateRange.endDate.getTime());
                    expect(dateRange.weekStart).toBe('monday');
                    expect(typeof dateRange.timezone).toBe('string');
                    expect(dateRange.timezone.length).toBeGreaterThan(0);
                }),
                { numRuns: 100 }
            );
        });

        it('should generate weekly timelines with exactly 7 days', () => {
            fc.assert(
                fc.property(generators.weeklyTimeline, (timeline) => {
                    expect(timeline).toHaveLength(7);
                    timeline.forEach(day => {
                        expect(typeof day.date).toBe('string');
                        expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                        expect(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
                            .toContain(day.dayOfWeek);
                        expect(typeof day.count).toBe('number');
                        expect(day.count).toBeGreaterThanOrEqual(0);
                    });
                }),
                { numRuns: 100 }
            );
        });
    });

    describe('Mathematical Consistency Generators', () => {
        it('should generate mathematically consistent alerts digest', () => {
            fc.assert(
                fc.property(generators.consistentAlertsDigest, (digest) => {
                    // Sum of classifications should equal total
                    const classificationSum = Object.values(digest.alertClassification)
                        .reduce((sum, count) => sum + count, 0);
                    expect(classificationSum).toBe(digest.totalAlertsDigested);

                    // Sum of outcomes should equal total
                    const outcomesSum = digest.alertOutcomes.securityIncidents +
                        digest.alertOutcomes.benignActivity +
                        digest.alertOutcomes.falsePositives;
                    expect(outcomesSum).toBe(digest.totalAlertsDigested);

                    // Sum of weekly timeline should equal total
                    const timelineSum = digest.weeklyTimeline
                        .reduce((sum, day) => sum + day.count, 0);
                    expect(timelineSum).toBe(digest.totalAlertsDigested);

                    // Sum of source breakdown should equal total
                    const sourceSum = Object.values(digest.sourceBreakdown)
                        .reduce((sum, count) => sum + count, 0);
                    expect(sourceSum).toBe(digest.totalAlertsDigested);
                }),
                { numRuns: 100 }
            );
        });

        it('should generate mathematically consistent updates summary', () => {
            fc.assert(
                fc.property(generators.consistentUpdatesSummary, (summary) => {
                    // Sum of updates by source should equal total
                    const sourceSum = summary.updatesBySource.windows +
                        summary.updatesBySource.microsoftOffice +
                        summary.updatesBySource.firewall +
                        summary.updatesBySource.other;
                    expect(sourceSum).toBe(summary.totalUpdatesApplied);
                }),
                { numRuns: 100 }
            );
        });
    });

    describe('Report Structure Validation', () => {
        it('should generate valid report snapshots', () => {
            fc.assert(
                fc.property(generators.reportSnapshot, (snapshot) => {
                    expect(typeof snapshot.id).toBe('string');
                    expect(typeof snapshot.tenantId).toBe('string');
                    expect(typeof snapshot.reportId).toBe('string');
                    expect(['weekly', 'monthly', 'quarterly']).toContain(snapshot.reportType);
                    expect(snapshot.generatedAt).toBeInstanceOf(Date);
                    expect(typeof snapshot.generatedBy).toBe('string');
                    expect(Array.isArray(snapshot.slideData)).toBe(true);
                    expect(typeof snapshot.templateVersion).toBe('string');
                    expect(typeof snapshot.dataSchemaVersion).toBe('string');
                    expect(typeof snapshot.isArchived).toBe('boolean');
                }),
                { numRuns: 100 }
            );
        });

        it('should generate valid base reports', () => {
            fc.assert(
                fc.property(generators.baseReport, (report) => {
                    expect(typeof report.id).toBe('string');
                    expect(typeof report.tenantId).toBe('string');
                    expect(['weekly', 'monthly', 'quarterly']).toContain(report.reportType);
                    expect(report.generatedAt).toBeInstanceOf(Date);
                    expect(typeof report.generatedBy).toBe('string');
                    expect(Array.isArray(report.slides)).toBe(true);
                    expect(typeof report.templateVersion).toBe('string');
                    expect(typeof report.dataSchemaVersion).toBe('string');

                    // Validate slide structure
                    report.slides.forEach(slide => {
                        expect(typeof slide.id).toBe('string');
                        expect(typeof slide.title).toBe('string');
                        expect(typeof slide.content).toBe('object');
                        expect(Array.isArray(slide.charts)).toBe(true);
                        expect(typeof slide.layout).toBe('object');
                        expect(slide.layout.orientation).toBe('landscape');
                        expect(slide.layout.theme).toBe('dark');
                        expect(slide.layout.branding).toBe('avian');
                    });
                }),
                { numRuns: 100 }
            );
        });
    });
});

/**
 * Example Property-Based Test for Future Reference
 * 
 * This demonstrates the expected format for PBT tests in the reports module.
 * Each test should include the feature annotation as specified in the design document.
 */
describe('Example Property-Based Test Format', () => {
    it('should demonstrate proper PBT test annotation', () => {
        /**
         * **Feature: avian-reports-module, Property 6: Mathematical consistency**
         * **Validates: Requirements 2.4, 3.3**
         */
        fc.assert(
            fc.property(generators.consistentAlertsDigest, (digest) => {
                // Property: For any report with categorized data, mathematical relationships must hold
                const classificationSum = Object.values(digest.alertClassification)
                    .reduce((sum, count) => sum + count, 0);
                const outcomesSum = digest.alertOutcomes.securityIncidents +
                    digest.alertOutcomes.benignActivity +
                    digest.alertOutcomes.falsePositives;

                expect(classificationSum).toBe(digest.totalAlertsDigested);
                expect(outcomesSum).toBe(digest.totalAlertsDigested);

                // Outcome categories must be mutually exclusive (no overlap)
                expect(digest.alertOutcomes.securityIncidents).toBeGreaterThanOrEqual(0);
                expect(digest.alertOutcomes.benignActivity).toBeGreaterThanOrEqual(0);
                expect(digest.alertOutcomes.falsePositives).toBeGreaterThanOrEqual(0);
            }),
            { numRuns: 100 }
        );
    });
});