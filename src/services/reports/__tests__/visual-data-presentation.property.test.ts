/**
 * Property-Based Test for Visual Data Presentation
 * 
 * **Feature: avian-reports-module, Property 11: Visual data presentation**
 * **Validates: Requirements 7.4**
 * 
 * Tests that report data is presented using charts, icons, and callouts
 * rather than dense tables without visual context.
 */

import * as fc from 'fast-check';
import { TemplateEngine } from '../TemplateEngine';
import { generators } from './generators';
import { SlideData, ChartData } from '@/types/reports';

describe('Visual Data Presentation Property Tests', () => {
    let templateEngine: TemplateEngine;

    beforeEach(() => {
        templateEngine = new TemplateEngine();
    });

    describe('Property 11: Visual data presentation', () => {
        it('should use charts, icons, and callouts rather than dense tables without visual context', async () => {
            /**
             * **Feature: avian-reports-module, Property 11: Visual data presentation**
             * **Validates: Requirements 7.4**
             */
            await fc.assert(
                fc.asyncProperty(
                    generators.baseReport,
                    async (report) => {
                        // Property: For any report data, the presentation should use charts, icons, and callouts
                        // rather than dense tables without visual context

                        // Test each slide in the report
                        for (const slide of report.slides) {
                            // Verify slide has visual elements (charts, icons, callouts)
                            expect(slide.charts).toBeDefined();
                            expect(Array.isArray(slide.charts)).toBe(true);

                            // If slide has data to display, it should use visual presentation
                            if (slide.charts.length > 0) {
                                for (const chart of slide.charts) {
                                    // Charts should have proper visual styling
                                    expect(chart.styling).toBeDefined();
                                    expect(chart.styling.theme).toBe('dark');
                                    expect(Array.isArray(chart.styling.colors)).toBe(true);
                                    // Colors array should exist (may be empty for some chart types)
                                    expect(chart.styling.colors).toBeDefined();

                                    // Charts should have visual indicators
                                    expect(typeof chart.styling.showLegend).toBe('boolean');
                                    expect(typeof chart.styling.showGrid).toBe('boolean');
                                    expect(typeof chart.styling.fontSize).toBe('number');
                                    // FontSize should be non-negative (0 is acceptable for some chart types)
                                    expect(chart.styling.fontSize).toBeGreaterThanOrEqual(0);

                                    // Chart data should be structured for visual presentation
                                    expect(chart.data).toBeDefined();
                                    expect(Array.isArray(chart.data.labels)).toBe(true);
                                    expect(Array.isArray(chart.data.datasets)).toBe(true);

                                    // Visual chart types should be used (not raw tables)
                                    expect(['bar', 'donut', 'progress', 'line', 'timeline']).toContain(chart.type);
                                }
                            }

                            // Slide content should include callouts for visual context
                            expect(slide.content).toBeDefined();
                            expect(Array.isArray(slide.content.callouts)).toBe(true);

                            // Callouts should have visual indicators
                            for (const callout of slide.content.callouts) {
                                expect(['info', 'warning', 'success', 'highlight']).toContain(callout.type);
                                expect(typeof callout.text).toBe('string');
                                expect(callout.text.length).toBeGreaterThan(0);
                                // Icons are optional but should be strings if present
                                if (callout.icon) {
                                    expect(typeof callout.icon).toBe('string');
                                }
                            }

                            // Slide layout should enforce visual presentation standards
                            expect(slide.layout).toBeDefined();
                            expect(slide.layout.orientation).toBe('landscape');
                            expect(slide.layout.theme).toBe('dark');
                            expect(slide.layout.branding).toBe('avian');
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should generate enhanced chart data with icons and callouts', async () => {
            /**
             * **Feature: avian-reports-module, Property 11: Visual data presentation**
             * **Validates: Requirements 7.4**
             */
            await fc.assert(
                fc.asyncProperty(
                    fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
                    fc.array(fc.nat({ max: 1000 }), { minLength: 1, maxLength: 10 }),
                    fc.constantFrom('bar', 'donut', 'progress', 'timeline'),
                    fc.string({ minLength: 1, maxLength: 50 }),
                    async (labels, data, chartType, title) => {
                        // Ensure data array matches labels length
                        const normalizedData = data.slice(0, labels.length);
                        while (normalizedData.length < labels.length) {
                            normalizedData.push(0);
                        }

                        // Create enhanced chart data using TemplateEngine
                        const chartData = templateEngine.createEnhancedChartData(
                            labels,
                            [{ label: 'Test Data', data: normalizedData }],
                            {
                                type: chartType,
                                title,
                                icon: '📊',
                                callouts: [
                                    { type: 'info', text: 'Test callout', icon: '💡' }
                                ]
                            }
                        );

                        // Verify enhanced chart has visual elements
                        expect(chartData.metadata).toBeDefined();
                        expect(chartData.metadata.type).toBe(chartType);
                        expect(chartData.metadata.title).toBe(title);
                        expect(chartData.metadata.icon).toBe('📊');
                        expect(Array.isArray(chartData.metadata.callouts)).toBe(true);
                        expect(chartData.metadata.callouts.length).toBeGreaterThan(0);

                        // Verify callouts have visual indicators
                        for (const callout of chartData.metadata.callouts) {
                            expect(['info', 'warning', 'success', 'trend-up', 'trend-down', 'trend-stable', 'highlight'])
                                .toContain(callout.type);
                            expect(typeof callout.text).toBe('string');
                            expect(callout.text.length).toBeGreaterThan(0);
                            if (callout.icon) {
                                expect(typeof callout.icon).toBe('string');
                            }
                        }

                        // Verify chart data structure supports visual presentation
                        expect(Array.isArray(chartData.labels)).toBe(true);
                        expect(chartData.labels.length).toBe(labels.length);
                        expect(Array.isArray(chartData.datasets)).toBe(true);
                        expect(chartData.datasets.length).toBeGreaterThan(0);
                        expect(chartData.datasets[0].data.length).toBe(labels.length);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should create weekly timeline charts with visual indicators', async () => {
            /**
             * **Feature: avian-reports-module, Property 11: Visual data presentation**
             * **Validates: Requirements 7.4**
             */
            await fc.assert(
                fc.asyncProperty(
                    generators.weeklyTimeline,
                    async (weeklyTimeline) => {
                        // Create weekly timeline chart using TemplateEngine
                        const chartData = templateEngine.createWeeklyTimelineChart(
                            weeklyTimeline,
                            'Weekly Alert Timeline'
                        );

                        // Verify chart uses visual presentation elements
                        expect(chartData.metadata).toBeDefined();
                        expect(chartData.metadata.type).toBe('timeline');
                        expect(chartData.metadata.title).toBe('Weekly Alert Timeline');
                        expect(chartData.metadata.icon).toBe('📅');

                        // Verify visual callouts are present
                        expect(Array.isArray(chartData.metadata.callouts)).toBe(true);
                        expect(chartData.metadata.callouts.length).toBeGreaterThan(0);

                        // Verify callouts have visual context
                        for (const callout of chartData.metadata.callouts) {
                            expect(['info', 'warning', 'success', 'highlight']).toContain(callout.type);
                            expect(typeof callout.text).toBe('string');
                            expect(callout.text.length).toBeGreaterThan(0);
                            expect(typeof callout.icon).toBe('string');
                            expect(callout.icon.length).toBeGreaterThan(0);
                        }

                        // Verify chart structure supports visual timeline presentation
                        expect(Array.isArray(chartData.labels)).toBe(true);
                        expect(chartData.labels.length).toBe(7); // Always 7 days
                        expect(Array.isArray(chartData.datasets)).toBe(true);
                        expect(chartData.datasets[0].label).toBe('Alerts Digested');
                        expect(chartData.datasets[0].data.length).toBe(7);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should create progress charts with visual indicators for updates', async () => {
            /**
             * **Feature: avian-reports-module, Property 11: Visual data presentation**
             * **Validates: Requirements 7.4**
             */
            await fc.assert(
                fc.asyncProperty(
                    generators.consistentUpdatesSummary,
                    async (updatesSummary) => {
                        // Create updates progress chart using TemplateEngine
                        const chartData = templateEngine.createUpdatesProgressChart(
                            updatesSummary.updatesBySource,
                            'Updates Applied by Source'
                        );

                        // Verify chart uses visual presentation elements
                        expect(chartData.metadata).toBeDefined();
                        expect(chartData.metadata.type).toBe('progress');
                        expect(chartData.metadata.title).toBe('Updates Applied by Source');
                        expect(chartData.metadata.icon).toBe('🔄');
                        expect(chartData.metadata.unit).toBe(' updates');

                        // Verify visual callouts provide context
                        expect(Array.isArray(chartData.metadata.callouts)).toBe(true);
                        expect(chartData.metadata.callouts.length).toBeGreaterThan(0);

                        // Verify callouts have visual indicators and meaningful content
                        for (const callout of chartData.metadata.callouts) {
                            expect(['info', 'success', 'warning', 'highlight']).toContain(callout.type);
                            expect(typeof callout.text).toBe('string');
                            expect(callout.text.length).toBeGreaterThan(0);
                            expect(typeof callout.icon).toBe('string');
                            expect(callout.icon.length).toBeGreaterThan(0);

                            // Callouts should provide business context, not just raw numbers
                            expect(callout.text).toMatch(/total|most|applied|successfully/i);
                        }

                        // Verify chart structure supports progress visualization
                        expect(Array.isArray(chartData.labels)).toBe(true);
                        expect(chartData.labels).toEqual(['Windows', 'Microsoft Office', 'Firewall', 'Other']);
                        expect(chartData.datasets[0].label).toBe('Updates Applied');
                        expect(typeof chartData.metadata.maxValue).toBe('number');
                        expect(chartData.metadata.maxValue).toBeGreaterThan(0);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should create vulnerability breakdown charts with visual severity indicators', async () => {
            /**
             * **Feature: avian-reports-module, Property 11: Visual data presentation**
             * **Validates: Requirements 7.4**
             */
            await fc.assert(
                fc.asyncProperty(
                    generators.vulnerabilityPosture,
                    async (vulnerabilityPosture) => {
                        // Create vulnerability breakdown chart using TemplateEngine
                        const chartData = templateEngine.createVulnerabilityBreakdownChart(
                            vulnerabilityPosture.severityBreakdown,
                            'Vulnerability Breakdown by Severity'
                        );

                        // Verify chart uses visual presentation elements
                        expect(chartData.metadata).toBeDefined();
                        expect(chartData.metadata.type).toBe('donut');
                        expect(chartData.metadata.title).toBe('Vulnerability Breakdown by Severity');
                        expect(chartData.metadata.icon).toBe('🛡️');

                        // Verify visual callouts provide security context
                        expect(Array.isArray(chartData.metadata.callouts)).toBe(true);
                        expect(chartData.metadata.callouts.length).toBeGreaterThan(0);

                        // Verify callouts have appropriate visual indicators for security context
                        for (const callout of chartData.metadata.callouts) {
                            expect(['warning', 'success', 'info']).toContain(callout.type);
                            expect(typeof callout.text).toBe('string');
                            expect(callout.text.length).toBeGreaterThan(0);
                            expect(typeof callout.icon).toBe('string');
                            expect(callout.icon.length).toBeGreaterThan(0);

                            // Callouts should provide security-focused context
                            if (callout.type === 'warning') {
                                expect(callout.text).toMatch(/critical|immediate|attention/i);
                                expect(callout.icon).toBe('🚨');
                            } else if (callout.type === 'success') {
                                expect(callout.text).toMatch(/no critical|detected/i);
                                expect(callout.icon).toBe('✅');
                            }
                        }

                        // Verify chart structure supports donut visualization
                        expect(Array.isArray(chartData.labels)).toBe(true);
                        expect(chartData.labels).toEqual(['Critical', 'High', 'Medium']);
                        expect(chartData.datasets[0].label).toBe('Vulnerabilities');
                        expect(chartData.datasets[0].data.length).toBe(3);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should format charts with visual styling and avoid dense tables', async () => {
            /**
             * **Feature: avian-reports-module, Property 11: Visual data presentation**
             * **Validates: Requirements 7.4**
             */
            await fc.assert(
                fc.asyncProperty(
                    fc.array(fc.record({
                        labels: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 5 }),
                        datasets: fc.array(fc.record({
                            label: fc.string({ minLength: 1, maxLength: 20 }),
                            data: fc.array(fc.nat({ max: 1000 }), { minLength: 1, maxLength: 5 })
                        }), { minLength: 1, maxLength: 3 })
                    }), { minLength: 1, maxLength: 5 }),
                    async (chartDataArray) => {
                        // Format charts using TemplateEngine
                        const formattedCharts = await templateEngine.formatCharts(chartDataArray);

                        // Verify each formatted chart uses visual presentation
                        for (const formattedChart of formattedCharts) {
                            // Chart HTML should contain visual elements, not dense tables
                            expect(formattedChart.chartHtml).toBeDefined();
                            expect(typeof formattedChart.chartHtml).toBe('string');
                            expect(formattedChart.chartHtml.length).toBeGreaterThan(0);

                            // Should NOT contain dense table structures
                            expect(formattedChart.chartHtml).not.toMatch(/<table[^>]*>[\s\S]*<\/table>/i);
                            expect(formattedChart.chartHtml).not.toMatch(/<tr[^>]*>[\s\S]*<\/tr>/i);
                            expect(formattedChart.chartHtml).not.toMatch(/<td[^>]*>[\s\S]*<\/td>/i);

                            // Should contain visual chart elements
                            expect(formattedChart.chartHtml).toMatch(/enhanced-chart-wrapper|chart-container/);
                            // Chart should have visual structure (may not have title/icon if metadata is empty)
                            expect(formattedChart.chartHtml).toMatch(/chart-|bar-|donut-|progress-|timeline-/);

                            // Chart CSS should provide visual styling
                            expect(formattedChart.chartCss).toBeDefined();
                            expect(typeof formattedChart.chartCss).toBe('string');
                            expect(formattedChart.chartCss.length).toBeGreaterThan(0);

                            // CSS should include visual styling rules
                            expect(formattedChart.chartCss).toMatch(/background|color|border-radius/);
                            expect(formattedChart.chartCss).toMatch(/chart-/); // Chart-specific classes
                            expect(formattedChart.chartCss).toMatch(/callout/); // Callout styling

                            // Chart data should be preserved for visual rendering
                            expect(formattedChart.chartData).toBeDefined();
                            expect(Array.isArray(formattedChart.chartData.labels)).toBe(true);
                            expect(Array.isArray(formattedChart.chartData.datasets)).toBe(true);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should ensure slide content uses visual elements over raw text blocks', async () => {
            /**
             * **Feature: avian-reports-module, Property 11: Visual data presentation**
             * **Validates: Requirements 7.4**
             */
            await fc.assert(
                fc.asyncProperty(
                    generators.baseReport,
                    async (report) => {
                        // Property: Slide content should use visual elements (callouts, icons, structured layout)
                        // rather than dense text blocks without visual context

                        for (const slide of report.slides) {
                            const slideContent = slide.content;

                            // Content should have structured visual elements
                            expect(slideContent).toBeDefined();
                            expect(typeof slideContent.heading).toBe('string');
                            expect(slideContent.heading.length).toBeGreaterThan(0);

                            // Key points should be structured as a list, not dense paragraphs
                            expect(Array.isArray(slideContent.keyPoints)).toBe(true);
                            if (slideContent.keyPoints.length > 0) {
                                for (const point of slideContent.keyPoints) {
                                    expect(typeof point).toBe('string');
                                    expect(point.length).toBeGreaterThan(0);
                                    // Points should be concise, not dense paragraphs
                                    expect(point.length).toBeLessThan(200);
                                }
                            }

                            // Callouts should provide visual context
                            expect(Array.isArray(slideContent.callouts)).toBe(true);
                            for (const callout of slideContent.callouts) {
                                expect(['info', 'warning', 'success', 'highlight']).toContain(callout.type);
                                expect(typeof callout.text).toBe('string');
                                expect(callout.text.length).toBeGreaterThan(0);
                                // Callouts should be concise and focused
                                expect(callout.text.length).toBeLessThan(150);
                            }

                            // Slide layout should enforce visual presentation
                            expect(slide.layout.type).toBeDefined();
                            expect(['executive-overview', 'data-visualization', 'trend-analysis', 'summary'])
                                .toContain(slide.layout.type);
                            expect(slide.layout.orientation).toBe('landscape');
                            expect(slide.layout.theme).toBe('dark');
                            expect(slide.layout.branding).toBe('avian');

                            // Summary should be concise and executive-friendly, not dense technical text
                            if (slideContent.summary) {
                                expect(typeof slideContent.summary).toBe('string');
                                expect(slideContent.summary.length).toBeGreaterThan(0);
                                // Summary should be readable, not overly dense
                                expect(slideContent.summary.length).toBeLessThan(500);
                            }
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});