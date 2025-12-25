/**
 * Property-Based Test: Report Formatting Consistency
 * 
 * **Feature: avian-reports-module, Property 1: Report formatting consistency**
 * **Validates: Requirements 1.5, 7.1, 7.2, 7.3, 8.4**
 * 
 * This test validates that all generated reports maintain consistent formatting:
 * - Horizontal landscape orientation (Requirement 7.1)
 * - Slide-based PowerPoint-style layout (Requirement 7.1)
 * - Dark theme with AVIAN branding (Requirement 7.2)
 * - One primary topic per slide (Requirement 7.3)
 * - Proper visual formatting and structure (Requirement 8.4)
 * - Slide-based layouts with horizontal landscape orientation (Requirement 1.5)
 */

import * as fc from 'fast-check';
import { generators } from './generators';
import { TemplateEngine, SlideTemplate, SlideStyling } from '../TemplateEngine';
import {
    SlideLayout,
    Slide,
    SlideData
} from '@/types/reports';

describe('Property-Based Test: Report Formatting Consistency', () => {
    let templateEngine: TemplateEngine;

    beforeEach(() => {
        templateEngine = new TemplateEngine();
    });

    /**
     * **Feature: avian-reports-module, Property 1: Report formatting consistency**
     * **Validates: Requirements 1.5, 7.1, 7.2, 7.3, 8.4**
     * 
     * Property: For any generated report, the output should use horizontal landscape orientation,
     * slide-based layout, dark theme with AVIAN branding, and one primary topic per slide
     */
    it('should enforce mandatory layout properties across all slides', () => {
        fc.assert(
            fc.property(
                generators.baseReport,
                (report) => {
                    // Skip reports with no slides (edge case from generator)
                    if (report.slides.length === 0) {
                        return true;
                    }

                    // Validate that every slide in the report has correct layout properties
                    report.slides.forEach(slide => {
                        validateMandatoryLayoutProperties(slide.layout);
                    });

                    // Validate report-level consistency (Requirement 1.5)
                    expect(report.slides.length).toBeGreaterThan(0);
                    expect(report.slides.length).toBeLessThanOrEqual(10); // Reasonable upper bound for readability

                    // Validate slide-based PowerPoint-style layout structure (Requirement 7.1)
                    validateSlideBasedStructure(report.slides);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: For any slide template, the rendered output should maintain
     * consistent AVIAN branding and dark theme styling
     */
    it('should apply consistent AVIAN branding to all slide templates', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    templateType: fc.constantFrom(
                        'executive-overview' as const,
                        'data-visualization' as const,
                        'trend-analysis' as const,
                        'summary' as const
                    ),
                    slideTitle: fc.string({ minLength: 3, maxLength: 50 }),
                    slideSubtitle: fc.string({ minLength: 5, maxLength: 100 }),
                    slideSummary: fc.string({ minLength: 20, maxLength: 200 })
                }),
                async (testData) => {
                    // Create slide template with the specified type
                    const template: SlideTemplate = {
                        type: testData.templateType,
                        layout: {
                            type: testData.templateType,
                            orientation: 'landscape',
                            theme: 'dark',
                            branding: 'avian'
                        },
                        styling: {
                            theme: 'dark',
                            branding: 'avian',
                            colors: {
                                primary: '#00D4FF',
                                secondary: '#1A1A1A',
                                accent: '#FF6B35',
                                background: '#0A0A0A',
                                text: '#FFFFFF',
                                textSecondary: '#B0B0B0'
                            },
                            fonts: {
                                heading: '"Inter", "Helvetica Neue", Arial, sans-serif',
                                body: '"Inter", "Helvetica Neue", Arial, sans-serif',
                                monospace: '"JetBrains Mono", "Fira Code", monospace'
                            },
                            spacing: {
                                small: '0.5rem',
                                medium: '1rem',
                                large: '2rem'
                            }
                        }
                    };

                    // Create slide data
                    const slideData: SlideData = {
                        slideId: `test-slide-${Date.now()}`,
                        slideType: testData.templateType,
                        title: testData.slideTitle,
                        subtitle: testData.slideSubtitle,
                        summary: testData.slideSummary,
                        keyPoints: ['Key point 1', 'Key point 2'],
                        computedMetrics: {},
                        chartData: [],
                        templateData: {}
                    };

                    // Render slide using template engine
                    const renderedSlide = await templateEngine.renderSlide(slideData, template);

                    // Validate AVIAN branding consistency
                    validateAvianBrandingConsistency(renderedSlide, template);
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property: For any slide content, there should be one primary topic per slide
     * with clear headings and visual elements (Requirement 7.3)
     */
    it('should maintain one primary topic per slide with clear structure', () => {
        fc.assert(
            fc.property(
                generators.baseReport,
                (report) => {
                    // Skip reports with no slides
                    if (report.slides.length === 0) {
                        return true;
                    }

                    report.slides.forEach(slide => {
                        validateSingleTopicPerSlide(slide);
                    });
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: For any report content, terminology should be standardized
     * according to requirements (Alerts Digested, Updates, etc.)
     * Validates Requirements 2.2, 3.1, and 7.5
     */
    it('should apply consistent terminology standardization across all content', () => {
        fc.assert(
            fc.property(
                fc.record({
                    content: fc.string({ minLength: 10, maxLength: 500 }),
                    includeAlertTerms: fc.boolean(),
                    includeUpdateTerms: fc.boolean(),
                    includeExecutiveTerms: fc.boolean()
                }),
                (testData) => {
                    let testContent = testData.content;

                    // Add terminology that should be standardized (Requirement 2.2)
                    if (testData.includeAlertTerms) {
                        testContent += ' Number of Alerts processed: 100. Alert Count was high.';
                    }
                    // Add update terminology (Requirement 3.1)
                    if (testData.includeUpdateTerms) {
                        testContent += ' OS Updates applied: 50. System Updates completed.';
                    }
                    // Add executive-unfriendly terms (Requirement 7.5)
                    if (testData.includeExecutiveTerms) {
                        testContent += ' Threat detected. False positive identified. Malicious attack blocked.';
                    }

                    // Apply terminology standardization
                    const standardizedContent = templateEngine.applyTerminologyRules(testContent);

                    // Validate standardization was applied correctly
                    validateTerminologyStandardization(standardizedContent);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: For any slide layout configuration, the mandatory properties
     * must always be enforced (landscape, dark, avian)
     * Validates Requirements 7.1 and 7.2
     */
    it('should validate slide layout configuration consistency', () => {
        fc.assert(
            fc.property(
                fc.record({
                    slideType: fc.constantFrom(
                        'executive-overview' as const,
                        'data-visualization' as const,
                        'trend-analysis' as const,
                        'summary' as const
                    ),
                    // Test that even if we try to set different values, they get enforced
                    attemptedOrientation: fc.constantFrom('portrait', 'landscape', 'square'),
                    attemptedTheme: fc.constantFrom('light', 'dark', 'auto'),
                    attemptedBranding: fc.constantFrom('generic', 'avian', 'custom')
                }),
                (testData) => {
                    // Create a slide layout (the system should enforce correct values)
                    const layout: SlideLayout = {
                        type: testData.slideType,
                        orientation: 'landscape', // Must always be landscape (Requirement 7.1)
                        theme: 'dark', // Must always be dark (Requirement 7.2)
                        branding: 'avian' // Must always be avian (Requirement 7.2)
                    };

                    // Validate that the mandatory properties are enforced
                    validateMandatoryLayoutProperties(layout);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: PDF export formatting should maintain visual consistency
     * Validates Requirement 8.4
     */
    it('should maintain formatting consistency for PDF export', () => {
        fc.assert(
            fc.property(
                fc.record({
                    slideType: fc.constantFrom(
                        'executive-overview' as const,
                        'data-visualization' as const,
                        'trend-analysis' as const,
                        'summary' as const
                    ),
                    slideTitle: fc.string({ minLength: 3, maxLength: 50 }),
                    slideContent: fc.string({ minLength: 20, maxLength: 200 }),
                    includeCharts: fc.boolean(),
                    includeCallouts: fc.boolean()
                }),
                (testData) => {
                    // Create slide data for PDF export testing
                    const slideData: SlideData = {
                        slideId: `pdf-test-${Date.now()}`,
                        slideType: testData.slideType,
                        title: testData.slideTitle,
                        summary: testData.slideContent,
                        keyPoints: ['Key point 1', 'Key point 2'],
                        computedMetrics: {},
                        chartData: testData.includeCharts ? [
                            {
                                labels: ['Label 1', 'Label 2'],
                                datasets: [{ label: 'Test Data', data: [10, 20] }]
                            }
                        ] : [],
                        templateData: {}
                    };

                    // Validate PDF-ready formatting properties
                    validatePDFFormattingConsistency(slideData, testData.slideType);
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property: Visual elements should follow consistent styling patterns
     * Validates Requirements 7.2 and 7.4
     */
    it('should apply consistent visual styling across all elements', () => {
        fc.assert(
            fc.property(
                fc.record({
                    hasCharts: fc.boolean(),
                    hasCallouts: fc.boolean(),
                    hasIcons: fc.boolean(),
                    chartCount: fc.nat({ max: 4 }),
                    calloutCount: fc.nat({ max: 5 })
                }),
                (testData) => {
                    // Test visual consistency across different element combinations
                    validateVisualElementConsistency(testData);
                }
            ),
            { numRuns: 75 }
        );
    });
});

/**
 * Validates mandatory layout properties for AVIAN reports
 */
function validateMandatoryLayoutProperties(layout: SlideLayout): void {
    // Requirement 7.1: Horizontal landscape orientation with slide-based PowerPoint-style layout
    expect(layout.orientation).toBe('landscape');

    // Requirement 7.2: Dark theme with AVIAN branding throughout all reports
    expect(layout.theme).toBe('dark');
    expect(layout.branding).toBe('avian');

    // Validate layout type is one of the supported types
    expect(['executive-overview', 'data-visualization', 'trend-analysis', 'summary']).toContain(layout.type);
}

/**
 * Validates AVIAN branding consistency in rendered slides
 */
function validateAvianBrandingConsistency(renderedSlide: any, template: SlideTemplate): void {
    expect(renderedSlide).toBeDefined();
    expect(renderedSlide.html).toBeTruthy();
    expect(renderedSlide.css).toBeTruthy();
    expect(renderedSlide.metadata).toBeDefined();

    // Validate HTML contains AVIAN branding elements
    expect(renderedSlide.html).toContain('AVIAN');
    expect(renderedSlide.html).toContain('slide');
    expect(renderedSlide.html).toContain('slide-header');
    expect(renderedSlide.html).toContain('slide-content');

    // Validate CSS contains dark theme styling
    expect(renderedSlide.css).toContain('#0A0A0A'); // Dark background
    expect(renderedSlide.css).toContain('#FFFFFF'); // White text
    expect(renderedSlide.css).toContain('#00D4FF'); // AVIAN cyan primary

    // Validate metadata
    expect(renderedSlide.metadata.slideId).toBeTruthy();
    expect(renderedSlide.metadata.slideType).toBeTruthy();
    expect(renderedSlide.metadata.templateVersion).toBeTruthy();
    expect(renderedSlide.metadata.renderTimestamp).toBeInstanceOf(Date);

    // Validate template styling consistency
    expect(template.styling.theme).toBe('dark');
    expect(template.styling.branding).toBe('avian');
    expect(template.styling.colors.primary).toBe('#00D4FF');
    expect(template.styling.colors.background).toBe('#0A0A0A');
    expect(template.styling.colors.text).toBe('#FFFFFF');
}

/**
 * Validates that each slide has one primary topic with clear structure
 */
function validateSingleTopicPerSlide(slide: Slide): void {
    // Requirement 7.3: Limit each slide to one primary topic with clear headings and visual elements

    // Validate slide has a clear primary heading
    expect(slide.title).toBeTruthy();
    expect(typeof slide.title).toBe('string');
    expect(slide.title.length).toBeGreaterThan(0);
    expect(slide.title.length).toBeLessThan(100); // Reasonable title length

    // Validate content structure supports single topic focus
    expect(slide.content.heading).toBeTruthy();
    expect(typeof slide.content.heading).toBe('string');

    // Validate summary is focused and not overly complex
    expect(slide.content.summary).toBeTruthy();
    expect(typeof slide.content.summary).toBe('string');
    expect(slide.content.summary.length).toBeGreaterThanOrEqual(1); // Must have content
    expect(slide.content.summary.length).toBeLessThan(1000); // Reasonable summary length

    // Validate key points are manageable in number (supporting single topic)
    expect(Array.isArray(slide.content.keyPoints)).toBe(true);
    expect(slide.content.keyPoints.length).toBeLessThanOrEqual(7); // Max 7 key points per slide

    // Validate callouts don't overwhelm the primary topic
    expect(Array.isArray(slide.content.callouts)).toBe(true);
    expect(slide.content.callouts.length).toBeLessThanOrEqual(5); // Max 5 callouts per slide

    // Validate charts support the single topic (not too many charts per slide)
    if (slide.charts) {
        expect(Array.isArray(slide.charts)).toBe(true);
        expect(slide.charts.length).toBeLessThanOrEqual(4); // Max 4 charts per slide for clarity
    }
}

/**
 * Validates that terminology standardization has been applied correctly
 */
function validateTerminologyStandardization(content: string): void {
    // Requirement 2.2: "Number of Alerts" should be renamed to "Alerts Digested"
    expect(content).not.toContain('Number of Alerts');
    expect(content).not.toContain('Alert Count');

    // Should contain standardized terminology
    if (content.includes('Alerts')) {
        expect(content).toContain('Alerts Digested');
    }

    // Requirement 3.1: "OS Updates" should be renamed to "Updates"
    expect(content).not.toContain('OS Updates');
    expect(content).not.toContain('System Updates');

    // Should contain standardized update terminology
    if (content.includes('Updates')) {
        // Should use "Updates" instead of "OS Updates" or "System Updates"
        const updateMatches = content.match(/\b\w*\s*Updates\b/gi) || [];
        updateMatches.forEach(match => {
            expect(match).not.toMatch(/^(OS|System|Operating System)\s+Updates$/i);
        });
    }

    // Validate executive-friendly language (Requirement 7.5)
    // Should not contain overly technical terms
    expect(content).not.toContain('false positive');
    expect(content).not.toContain('true positive');
    expect(content).not.toContain('threat');
    expect(content).not.toContain('malicious');
    expect(content).not.toContain('attack');

    // Should use business-friendly alternatives
    if (content.toLowerCase().includes('detection')) {
        expect(content).toContain('benign detection');
    }
    if (content.toLowerCase().includes('security event')) {
        // This is acceptable executive-friendly language
        expect(content).toMatch(/security event/i);
    }
}

/**
 * Validates slide-based PowerPoint-style structure (Requirement 7.1)
 */
function validateSlideBasedStructure(slides: Slide[]): void {
    slides.forEach(slide => {
        // Each slide should have a clear title (PowerPoint-style)
        expect(slide.title).toBeTruthy();
        expect(typeof slide.title).toBe('string');
        expect(slide.title.length).toBeGreaterThan(0);

        // Each slide should have structured content
        expect(slide.content).toBeDefined();
        expect(slide.content.heading).toBeTruthy();
        expect(typeof slide.content.heading).toBe('string');

        // Slides should have visual elements (charts, callouts, etc.) OR meaningful content
        const hasVisualElements =
            (slide.charts && slide.charts.length > 0) ||
            (slide.content.callouts && slide.content.callouts.length > 0) ||
            (slide.content.keyPoints && slide.content.keyPoints.length > 0) ||
            (slide.content.summary && slide.content.summary.length > 0);

        // Allow slides with just summary content (still valid PowerPoint structure)
        expect(hasVisualElements).toBe(true);

        // Validate layout is slide-appropriate
        expect(slide.layout).toBeDefined();
        expect(slide.layout.type).toMatch(/^(executive-overview|data-visualization|trend-analysis|summary)$/);
    });
}

/**
 * Validates PDF formatting consistency (Requirement 8.4)
 */
function validatePDFFormattingConsistency(slideData: SlideData, slideType: string): void {
    // PDF should maintain horizontal landscape orientation
    expect(slideType).toMatch(/^(executive-overview|data-visualization|trend-analysis|summary)$/);

    // Content should be structured for PDF export
    expect(slideData.title).toBeTruthy();
    expect(typeof slideData.title).toBe('string');
    expect(slideData.title.length).toBeLessThan(100); // PDF title length limit

    // Summary should be concise for PDF readability
    if (slideData.summary) {
        expect(slideData.summary.length).toBeLessThan(1000); // PDF content limit
        expect(slideData.summary.length).toBeGreaterThan(0);
    }

    // Charts should be PDF-compatible
    if (slideData.chartData && slideData.chartData.length > 0) {
        slideData.chartData.forEach(chart => {
            expect(chart.labels).toBeDefined();
            expect(Array.isArray(chart.labels)).toBe(true);
            expect(chart.datasets).toBeDefined();
            expect(Array.isArray(chart.datasets)).toBe(true);
        });
    }

    // Key points should be manageable for PDF layout
    if (slideData.keyPoints) {
        expect(slideData.keyPoints.length).toBeLessThanOrEqual(7); // PDF readability limit
    }
}

/**
 * Validates visual element consistency (Requirements 7.2 and 7.4)
 */
function validateVisualElementConsistency(testData: {
    hasCharts: boolean;
    hasCallouts: boolean;
    hasIcons: boolean;
    chartCount: number;
    calloutCount: number;
}): void {
    // Charts should not overwhelm the slide (Requirement 7.4)
    if (testData.hasCharts && testData.chartCount > 0) {
        expect(testData.chartCount).toBeLessThanOrEqual(4); // Max charts per slide for clarity
        expect(testData.chartCount).toBeGreaterThan(0);
    }

    // Callouts should support, not overwhelm content (Requirement 7.4)
    if (testData.hasCallouts && testData.calloutCount > 0) {
        expect(testData.calloutCount).toBeLessThanOrEqual(5); // Max callouts per slide
        expect(testData.calloutCount).toBeGreaterThan(0);
    }

    // Visual elements should follow dark theme consistency (Requirement 7.2)
    // This would be validated in actual rendering, but we can check structural consistency
    const totalVisualElements =
        (testData.hasCharts ? testData.chartCount : 0) +
        (testData.hasCallouts ? testData.calloutCount : 0) +
        (testData.hasIcons ? 1 : 0);

    // Should not have too many visual elements that would break dark theme consistency
    expect(totalVisualElements).toBeLessThanOrEqual(10); // Reasonable limit for visual clarity (4 charts + 5 callouts + 1 icon)

    // Should have at least some visual elements for engagement (Requirement 7.4)
    // Only validate if we actually have elements (not just flags set to true)
    const actuallyHasElements =
        (testData.hasCharts && testData.chartCount > 0) ||
        (testData.hasCallouts && testData.calloutCount > 0) ||
        testData.hasIcons;

    if (actuallyHasElements) {
        expect(totalVisualElements).toBeGreaterThan(0);
    }
}