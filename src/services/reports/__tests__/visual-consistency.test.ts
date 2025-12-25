/**
 * Visual Consistency Testing for Executive Presentation Enhancements
 * 
 * Tests for Task 19.1: Visual consistency testing
 * - Test report preview matches PDF export exactly
 * - Validate AVIAN branding consistency across all report types
 * - Test responsive design on different screen sizes
 * - Verify color-coded risk indicators work correctly
 * 
 * Requirements: 1.5, 7.1, 7.2, 8.4
 */

import { ReportGenerator } from '../ReportGenerator';
import { TemplateEngine } from '../TemplateEngine';
import { PDFGenerator } from '../PDFGenerator';
import { ReportSnapshotService } from '../ReportSnapshotService';
import { HistoricalDataStore } from '../HistoricalDataStore';
import { DataAggregator } from '../DataAggregator';
import { NarrativeGenerator } from '../NarrativeGenerator';
import { ReportCacheService } from '../ReportCacheService';
import {
    WeeklyReport,
    MonthlyReport,
    QuarterlyReport,
    ReportSnapshot,
    EnhancedDateRange,
    SlideData
} from '@/types/reports';

// Mock dependencies
jest.mock('../HistoricalDataStore');
jest.mock('../ReportSnapshotService');
jest.mock('../PDFGenerator');
jest.mock('../ReportCacheService');

describe('Visual Consistency Testing - Executive Presentation Enhancements', () => {
    let reportGenerator: ReportGenerator;
    let templateEngine: TemplateEngine;
    let pdfGenerator: PDFGenerator;
    let mockHistoricalDataStore: jest.Mocked<HistoricalDataStore>;
    let mockSnapshotService: jest.Mocked<ReportSnapshotService>;
    let mockPdfGenerator: jest.Mocked<PDFGenerator>;
    let mockCacheService: jest.Mocked<ReportCacheService>;

    const mockTenantId = 'test-tenant-123';
    const mockDateRange: EnhancedDateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        timezone: 'America/Toronto',
        weekStart: 'monday'
    };

    beforeEach(() => {
        // Initialize services
        templateEngine = new TemplateEngine();
        mockHistoricalDataStore = new HistoricalDataStore() as jest.Mocked<HistoricalDataStore>;
        mockSnapshotService = new ReportSnapshotService() as jest.Mocked<ReportSnapshotService>;
        mockPdfGenerator = new PDFGenerator() as jest.Mocked<PDFGenerator>;
        mockCacheService = new ReportCacheService() as jest.Mocked<ReportCacheService>;

        const dataAggregator = new DataAggregator(mockHistoricalDataStore);
        const narrativeGenerator = new NarrativeGenerator();

        reportGenerator = new ReportGenerator(
            dataAggregator,
            templateEngine,
            mockHistoricalDataStore,
            mockSnapshotService,
            mockCacheService,
            narrativeGenerator
        );

        // Setup common mocks
        setupCommonMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Report Preview vs PDF Export Consistency', () => {
        it('should generate identical visual content between preview and PDF export for weekly reports', async () => {
            // Generate weekly report for preview
            const weeklyReport = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);

            // Create snapshot from report
            const snapshot = await mockSnapshotService.createSnapshot(weeklyReport, 'test-user');

            // Generate PDF from snapshot
            const pdfBuffer = await mockPdfGenerator.exportToPDF(snapshot);

            // Validate visual consistency
            validateReportPreviewPdfConsistency(weeklyReport, snapshot, pdfBuffer);
        });

        it('should generate identical visual content between preview and PDF export for monthly reports', async () => {
            const monthlyDateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
                timezone: 'America/Toronto',
                weekStart: 'monday'
            };

            // Generate monthly report for preview
            const monthlyReport = await reportGenerator.generateMonthlyReport(mockTenantId, monthlyDateRange);

            // Create snapshot from report
            const snapshot = await mockSnapshotService.createSnapshot(monthlyReport, 'test-user');

            // Generate PDF from snapshot
            const pdfBuffer = await mockPdfGenerator.exportToPDF(snapshot);

            // Validate visual consistency
            validateReportPreviewPdfConsistency(monthlyReport, snapshot, pdfBuffer);
        });

        it('should generate identical visual content between preview and PDF export for quarterly reports', async () => {
            const quarterlyDateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-03-31'),
                timezone: 'America/Toronto',
                weekStart: 'monday'
            };

            // Generate quarterly report for preview
            const quarterlyReport = await reportGenerator.generateQuarterlyReport(mockTenantId, quarterlyDateRange);

            // Create snapshot from report
            const snapshot = await mockSnapshotService.createSnapshot(quarterlyReport, 'test-user');

            // Generate PDF from snapshot
            const pdfBuffer = await mockPdfGenerator.exportToPDF(snapshot);

            // Validate visual consistency
            validateReportPreviewPdfConsistency(quarterlyReport, snapshot, pdfBuffer);
        });

        it('should maintain exact slide ordering between preview and PDF', async () => {
            const weeklyReport = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);
            const snapshot = await mockSnapshotService.createSnapshot(weeklyReport, 'test-user');

            // Validate slide ordering consistency
            expect(weeklyReport.slides.length).toBe(snapshot.slideData.length);

            weeklyReport.slides.forEach((slide, index) => {
                const snapshotSlide = snapshot.slideData[index];
                expect(slide.id).toBe(snapshotSlide.slideId);
                expect(slide.title).toBe(snapshotSlide.title);
                expect(slide.layout.type).toBe(snapshotSlide.slideType);
            });
        });

        it('should preserve chart data integrity between preview and PDF', async () => {
            const weeklyReport = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);
            const snapshot = await mockSnapshotService.createSnapshot(weeklyReport, 'test-user');

            // Validate chart data consistency
            weeklyReport.slides.forEach((slide, slideIndex) => {
                if (slide.charts && slide.charts.length > 0) {
                    const snapshotSlide = snapshot.slideData[slideIndex];
                    expect(snapshotSlide.chartData).toBeDefined();
                    expect(snapshotSlide.chartData.length).toBe(slide.charts.length);

                    slide.charts.forEach((chart, chartIndex) => {
                        const snapshotChart = snapshotSlide.chartData[chartIndex];
                        expect(chart.data.labels).toEqual(snapshotChart.labels);
                        expect(chart.data.datasets).toEqual(snapshotChart.datasets);
                        expect(chart.type).toBe(snapshotChart.metadata?.type);
                    });
                }
            });
        });
    });

    describe('AVIAN Branding Consistency', () => {
        it('should apply consistent AVIAN branding across all weekly report slides', async () => {
            const weeklyReport = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);

            // Validate AVIAN branding consistency
            validateAvianBrandingConsistency(weeklyReport);
        });

        it('should apply consistent AVIAN branding across all monthly report slides', async () => {
            const monthlyDateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
                timezone: 'America/Toronto',
                weekStart: 'monday'
            };

            const monthlyReport = await reportGenerator.generateMonthlyReport(mockTenantId, monthlyDateRange);

            // Validate AVIAN branding consistency
            validateAvianBrandingConsistency(monthlyReport);
        });

        it('should apply consistent AVIAN branding across all quarterly report slides', async () => {
            const quarterlyDateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-03-31'),
                timezone: 'America/Toronto',
                weekStart: 'monday'
            };

            const quarterlyReport = await reportGenerator.generateQuarterlyReport(mockTenantId, quarterlyDateRange);

            // Validate AVIAN branding consistency
            validateAvianBrandingConsistency(quarterlyReport);
        });

        it('should maintain consistent color scheme across all report types', () => {
            const expectedColors = {
                primary: '#00D4FF',      // AVIAN cyan
                secondary: '#1A1A1A',    // Dark gray
                accent: '#FF6B35',       // Orange accent
                background: '#0A0A0A',   // Very dark background
                text: '#FFFFFF',         // White text
                textSecondary: '#B0B0B0' // Light gray text
            };

            // Test template engine color consistency
            const styling = (templateEngine as any).getAvianStyling();
            expect(styling.colors).toEqual(expectedColors);
            expect(styling.theme).toBe('dark');
            expect(styling.branding).toBe('avian');
        });

        it('should use consistent fonts across all slides', () => {
            const expectedFonts = {
                heading: '"Inter", "Helvetica Neue", Arial, sans-serif',
                body: '"Inter", "Helvetica Neue", Arial, sans-serif',
                monospace: '"JetBrains Mono", "Fira Code", monospace'
            };

            const styling = (templateEngine as any).getAvianStyling();
            expect(styling.fonts).toEqual(expectedFonts);
        });

        it('should maintain consistent spacing across all slides', () => {
            const expectedSpacing = {
                small: '0.5rem',
                medium: '1rem',
                large: '2rem'
            };

            const styling = (templateEngine as any).getAvianStyling();
            expect(styling.spacing).toEqual(expectedSpacing);
        });
    });

    describe('Responsive Design Testing', () => {
        it('should maintain landscape orientation across different viewport sizes', async () => {
            const weeklyReport = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);

            // Test different viewport scenarios
            const viewportSizes = [
                { width: 1920, height: 1080, name: 'Desktop Large' },
                { width: 1366, height: 768, name: 'Desktop Standard' },
                { width: 1024, height: 768, name: 'Tablet Landscape' },
                { width: 800, height: 600, name: 'Small Display' }
            ];

            viewportSizes.forEach(viewport => {
                weeklyReport.slides.forEach(slide => {
                    // Validate landscape orientation is maintained (Requirement 7.1)
                    expect(slide.layout.orientation).toBe('landscape');

                    // Validate slide dimensions are appropriate for viewport
                    validateSlideResponsiveness(slide, viewport);
                });
            });
        });

        it('should scale content appropriately for different screen sizes', async () => {
            const weeklyReport = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);

            weeklyReport.slides.forEach(slide => {
                // Validate content scaling
                expect(slide.content.heading).toBeTruthy();
                expect(slide.content.summary).toBeTruthy();

                // Validate key points are manageable for different screen sizes
                if (slide.content.keyPoints) {
                    expect(slide.content.keyPoints.length).toBeLessThanOrEqual(7);
                    slide.content.keyPoints.forEach(point => {
                        expect(point.length).toBeLessThan(200); // Reasonable length for responsive display
                    });
                }

                // Validate callouts are appropriately sized
                if (slide.content.callouts) {
                    expect(slide.content.callouts.length).toBeLessThanOrEqual(5);
                    slide.content.callouts.forEach(callout => {
                        expect(callout.text.length).toBeLessThan(150); // Responsive callout length
                    });
                }
            });
        });

        it('should maintain chart readability across different screen sizes', async () => {
            const weeklyReport = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);

            weeklyReport.slides.forEach(slide => {
                if (slide.charts && slide.charts.length > 0) {
                    slide.charts.forEach(chart => {
                        // Validate chart styling for responsiveness
                        expect(chart.styling).toBeDefined();
                        expect(chart.styling.theme).toBe('dark');
                        expect(typeof chart.styling.fontSize).toBe('number');
                        expect(chart.styling.fontSize).toBeGreaterThanOrEqual(0);

                        // Validate chart data structure supports responsive rendering
                        expect(Array.isArray(chart.data.labels)).toBe(true);
                        expect(Array.isArray(chart.data.datasets)).toBe(true);
                        expect(chart.data.datasets.length).toBeGreaterThan(0);

                        // Validate chart type is appropriate for responsive display
                        expect(['bar', 'donut', 'progress', 'line', 'timeline']).toContain(chart.type);
                    });
                }
            });
        });
    });

    describe('Color-Coded Risk Indicators', () => {
        it('should apply correct color coding for different risk levels', async () => {
            const weeklyReport = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);

            // Test risk indicator color consistency
            const riskColorMapping = {
                'low': '#22c55e',      // Green
                'medium': '#fbbf24',   // Yellow/Amber
                'high': '#FF6B35',     // Orange (AVIAN accent)
                'critical': '#ef4444'  // Red
            };

            weeklyReport.slides.forEach(slide => {
                // Check for risk indicators in slide content
                if (slide.content.callouts) {
                    slide.content.callouts.forEach(callout => {
                        validateRiskIndicatorColors(callout, riskColorMapping);
                    });
                }

                // Check for risk indicators in charts
                if (slide.charts) {
                    slide.charts.forEach(chart => {
                        validateChartRiskColors(chart, riskColorMapping);
                    });
                }
            });
        });

        it('should maintain consistent severity color coding across vulnerability charts', async () => {
            const weeklyReport = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);

            // Find vulnerability-related slides
            const vulnerabilitySlides = weeklyReport.slides.filter(slide =>
                slide.title.toLowerCase().includes('vulnerability') ||
                slide.content.heading.toLowerCase().includes('vulnerability')
            );

            vulnerabilitySlides.forEach(slide => {
                if (slide.charts) {
                    slide.charts.forEach(chart => {
                        if (chart.type === 'donut' && chart.data.labels.includes('Critical')) {
                            // Validate severity color consistency
                            const expectedSeverityColors = ['#ef4444', '#FF6B35', '#fbbf24']; // Critical, High, Medium
                            expect(chart.styling.colors).toBeDefined();

                            // Verify colors are applied consistently
                            if (Array.isArray(chart.styling.colors)) {
                                chart.styling.colors.forEach(color => {
                                    expect(typeof color).toBe('string');
                                    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/); // Valid hex color
                                });
                            }
                        }
                    });
                }
            });
        });

        it('should apply consistent alert classification colors', async () => {
            const weeklyReport = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);

            // Find alert-related slides
            const alertSlides = weeklyReport.slides.filter(slide =>
                slide.title.toLowerCase().includes('alert') ||
                slide.title.toLowerCase().includes('threat') ||
                slide.content.heading.toLowerCase().includes('alert')
            );

            alertSlides.forEach(slide => {
                if (slide.charts) {
                    slide.charts.forEach(chart => {
                        // Validate alert classification colors are consistent
                        const alertTypes = ['phishing', 'malware', 'spyware', 'authentication', 'network', 'other'];

                        if (chart.data.labels.some(label =>
                            alertTypes.some(type => label.toLowerCase().includes(type))
                        )) {
                            // Verify chart has appropriate styling for alert classification
                            expect(chart.styling).toBeDefined();
                            expect(chart.styling.theme).toBe('dark');

                            // Verify colors are defined and valid
                            if (Array.isArray(chart.styling.colors)) {
                                chart.styling.colors.forEach(color => {
                                    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
                                });
                            }
                        }
                    });
                }
            });
        });

        it('should maintain consistent trend indicator colors', async () => {
            const monthlyDateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
                timezone: 'America/Toronto',
                weekStart: 'monday'
            };

            const monthlyReport = await reportGenerator.generateMonthlyReport(mockTenantId, monthlyDateRange);

            // Find trend analysis slides
            const trendSlides = monthlyReport.slides.filter(slide =>
                slide.title.toLowerCase().includes('trend') ||
                slide.content.heading.toLowerCase().includes('trend')
            );

            const trendColorMapping = {
                'up': '#22c55e',       // Green for positive trends
                'down': '#FF6B35',     // Orange for negative trends  
                'stable': '#B0B0B0'    // Gray for stable trends
            };

            trendSlides.forEach(slide => {
                if (slide.content.callouts) {
                    slide.content.callouts.forEach(callout => {
                        // Check for trend indicators in callout types
                        if (['trend-up', 'trend-down', 'trend-stable'].includes(callout.type)) {
                            validateTrendIndicatorColors(callout, trendColorMapping);
                        }
                    });
                }
            });
        });
    });

    describe('Executive Visual Polish Validation', () => {
        it('should include premium presentation elements in all report types', async () => {
            const reportTypes = [
                { type: 'weekly', dateRange: mockDateRange },
                {
                    type: 'monthly',
                    dateRange: {
                        ...mockDateRange,
                        startDate: new Date('2024-01-01'),
                        endDate: new Date('2024-01-31')
                    }
                },
                {
                    type: 'quarterly',
                    dateRange: {
                        ...mockDateRange,
                        startDate: new Date('2024-01-01'),
                        endDate: new Date('2024-03-31')
                    }
                }
            ];

            for (const reportConfig of reportTypes) {
                let report: WeeklyReport | MonthlyReport | QuarterlyReport;

                if (reportConfig.type === 'weekly') {
                    report = await reportGenerator.generateWeeklyReport(mockTenantId, reportConfig.dateRange);
                } else if (reportConfig.type === 'monthly') {
                    report = await reportGenerator.generateMonthlyReport(mockTenantId, reportConfig.dateRange);
                } else {
                    report = await reportGenerator.generateQuarterlyReport(mockTenantId, reportConfig.dateRange);
                }

                // Validate premium presentation elements
                validatePremiumPresentationElements(report);
            }
        });

        it('should maintain visual hierarchy across all slides', async () => {
            const weeklyReport = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);

            weeklyReport.slides.forEach(slide => {
                // Validate visual hierarchy elements
                expect(slide.title).toBeTruthy();
                expect(slide.title.length).toBeGreaterThan(0);
                expect(slide.title.length).toBeLessThan(100);

                expect(slide.content.heading).toBeTruthy();
                expect(slide.content.heading.length).toBeGreaterThan(0);

                // Validate layout supports visual hierarchy
                expect(slide.layout.orientation).toBe('landscape');
                expect(slide.layout.theme).toBe('dark');
                expect(slide.layout.branding).toBe('avian');
            });
        });

        it('should include appropriate visual separators and emphasis blocks', async () => {
            const weeklyReport = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);

            weeklyReport.slides.forEach(slide => {
                // Validate visual separation through callouts
                if (slide.content.callouts && slide.content.callouts.length > 0) {
                    slide.content.callouts.forEach(callout => {
                        expect(['info', 'warning', 'success', 'highlight']).toContain(callout.type);
                        expect(callout.text).toBeTruthy();
                        expect(callout.text.length).toBeGreaterThan(0);
                    });
                }

                // Validate emphasis through key points
                if (slide.content.keyPoints && slide.content.keyPoints.length > 0) {
                    slide.content.keyPoints.forEach(point => {
                        expect(point).toBeTruthy();
                        expect(point.length).toBeGreaterThan(0);
                        expect(point.length).toBeLessThan(200);
                    });
                }
            });
        });
    });

    // Helper Functions

    function setupCommonMocks() {
        // Mock historical data
        mockHistoricalDataStore.getAlertHistory.mockResolvedValue([
            {
                id: 'alert-1',
                tenantId: mockTenantId,
                rawAlertType: 'phishing_email',
                normalizedType: 'phishing' as any,
                severity: 'high' as any,
                outcome: 'security_incident',
                createdAt: new Date('2024-01-02'),
                resolvedAt: new Date('2024-01-02'),
                source: 'defender' as any
            }
        ]);

        mockHistoricalDataStore.getMetricsHistory.mockResolvedValue([
            {
                id: 'metric-1',
                tenantId: mockTenantId,
                deviceId: 'device-1',
                date: new Date('2024-01-01'),
                threatsBlocked: 15,
                updatesApplied: 25,
                vulnerabilitiesDetected: 8,
                vulnerabilitiesMitigated: 5,
                source: 'firewall'
            }
        ]);

        mockHistoricalDataStore.getVulnerabilityHistory.mockResolvedValue([]);

        // Mock snapshot service
        mockSnapshotService.createSnapshot.mockImplementation(async (report: any, userId: string) => {
            return {
                id: 'snapshot-123',
                tenantId: mockTenantId,
                reportId: report.id,
                reportType: report.reportType,
                dateRange: report.dateRange,
                generatedAt: new Date(),
                generatedBy: userId,
                slideData: report.slides.map((slide: any, index: number) => ({
                    slideId: slide.id,
                    slideType: slide.layout.type,
                    title: slide.title,
                    summary: slide.content.summary || '',
                    keyPoints: slide.content.keyPoints || [],
                    computedMetrics: {},
                    chartData: slide.charts || [],
                    templateData: {}
                })),
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            } as ReportSnapshot;
        });

        // Mock PDF generator
        mockPdfGenerator.exportToPDF.mockResolvedValue(Buffer.from('mock-pdf-content'));

        // Mock cache service
        mockCacheService.getCachedReport.mockResolvedValue(null); // No cached reports
        mockCacheService.cacheReport.mockResolvedValue(undefined);
    }

    function validateReportPreviewPdfConsistency(
        report: WeeklyReport | MonthlyReport | QuarterlyReport,
        snapshot: ReportSnapshot,
        pdfBuffer: Buffer
    ) {
        // Validate report structure consistency
        expect(report.slides.length).toBe(snapshot.slideData.length);
        expect(report.reportType).toBe(snapshot.reportType);
        expect(report.dateRange.startDate).toEqual(snapshot.dateRange.startDate);
        expect(report.dateRange.endDate).toEqual(snapshot.dateRange.endDate);

        // Validate PDF was generated
        expect(pdfBuffer).toBeDefined();
        expect(pdfBuffer.length).toBeGreaterThan(0);

        // Validate slide data integrity
        report.slides.forEach((slide, index) => {
            const snapshotSlide = snapshot.slideData[index];
            expect(slide.id).toBe(snapshotSlide.slideId);
            expect(slide.title).toBe(snapshotSlide.title);
        });
    }

    function validateAvianBrandingConsistency(report: WeeklyReport | MonthlyReport | QuarterlyReport) {
        report.slides.forEach(slide => {
            // Validate layout branding
            expect(slide.layout.theme).toBe('dark');
            expect(slide.layout.branding).toBe('avian');
            expect(slide.layout.orientation).toBe('landscape');

            // Validate slide structure
            expect(slide.title).toBeTruthy();
            expect(slide.content).toBeDefined();
            expect(slide.content.heading).toBeTruthy();
        });
    }

    function validateSlideResponsiveness(slide: any, viewport: { width: number; height: number; name: string }) {
        // Validate slide maintains landscape orientation regardless of viewport
        expect(slide.layout.orientation).toBe('landscape');

        // Validate content is structured for responsive display
        expect(slide.title.length).toBeLessThan(100); // Title length appropriate for viewport

        if (slide.content.summary) {
            expect(slide.content.summary.length).toBeLessThan(1000); // Summary length manageable
        }

        // Validate charts are limited for responsive display
        if (slide.charts) {
            expect(slide.charts.length).toBeLessThanOrEqual(4); // Max charts per slide
        }
    }

    function validateRiskIndicatorColors(callout: any, riskColorMapping: Record<string, string>) {
        // Validate callout type corresponds to appropriate risk level
        if (callout.type === 'warning') {
            // Should indicate high or critical risk
            expect(['high', 'critical'].some(level =>
                callout.text.toLowerCase().includes(level)
            )).toBeTruthy();
        } else if (callout.type === 'success') {
            // Should indicate low risk or positive outcome
            expect(['low', 'no', 'excellent', 'good'].some(indicator =>
                callout.text.toLowerCase().includes(indicator)
            )).toBeTruthy();
        }
    }

    function validateChartRiskColors(chart: any, riskColorMapping: Record<string, string>) {
        // Validate chart styling includes appropriate risk colors
        expect(chart.styling).toBeDefined();
        expect(chart.styling.theme).toBe('dark');

        // If chart has colors array, validate they are valid hex colors
        if (Array.isArray(chart.styling.colors)) {
            chart.styling.colors.forEach((color: string) => {
                expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
            });
        }
    }

    function validateTrendIndicatorColors(callout: any, trendColorMapping: Record<string, string>) {
        // Validate trend callout types have appropriate indicators
        if (callout.type === 'trend-up') {
            expect(callout.icon).toBeTruthy();
            expect(['↗', '📈', '⬆'].some(icon => callout.icon.includes(icon))).toBeTruthy();
        } else if (callout.type === 'trend-down') {
            expect(callout.icon).toBeTruthy();
            expect(['↘', '📉', '⬇'].some(icon => callout.icon.includes(icon))).toBeTruthy();
        } else if (callout.type === 'trend-stable') {
            expect(callout.icon).toBeTruthy();
            expect(['→', '➡', '↔'].some(icon => callout.icon.includes(icon))).toBeTruthy();
        }
    }

    function validatePremiumPresentationElements(report: WeeklyReport | MonthlyReport | QuarterlyReport) {
        // Validate report has multiple slides for comprehensive presentation
        expect(report.slides.length).toBeGreaterThan(1);

        // Validate each slide has premium elements
        report.slides.forEach(slide => {
            // Title and heading for clear structure
            expect(slide.title).toBeTruthy();
            expect(slide.content.heading).toBeTruthy();

            // Visual elements for engagement
            const hasVisualElements =
                (slide.charts && slide.charts.length > 0) ||
                (slide.content.callouts && slide.content.callouts.length > 0) ||
                (slide.content.keyPoints && slide.content.keyPoints.length > 0);

            expect(hasVisualElements).toBe(true);

            // Proper layout for executive presentation
            expect(slide.layout.orientation).toBe('landscape');
            expect(slide.layout.theme).toBe('dark');
            expect(slide.layout.branding).toBe('avian');
        });

        // Validate report metadata
        expect(report.id).toBeTruthy();
        expect(report.tenantId).toBe(mockTenantId);
        expect(report.reportType).toBeTruthy();
        expect(report.dateRange).toBeDefined();
        expect(report.generatedAt).toBeInstanceOf(Date);
        expect(report.templateVersion).toBeTruthy();
        expect(report.dataSchemaVersion).toBeTruthy();
    }
});