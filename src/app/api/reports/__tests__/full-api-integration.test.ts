/**
 * Full API Integration Tests for Reports Module
 * 
 * Task 12.1: Integration testing suite - API endpoint coverage
 * Tests complete API workflows including authentication, validation, and response formatting
 * 
 * Requirements: All requirements - API integration testing
 */

import { NextRequest } from 'next/server';
import { GET as WeeklyGET } from '../weekly/route';
import { GET as MonthlyGET } from '../monthly/route';
import { GET as QuarterlyGET } from '../quarterly/route';
import { POST as ExportPOST } from '../export/route';
import { GET as SnapshotsGET } from '../snapshots/route';
import { GET as DownloadGET } from '../snapshots/[snapshotId]/download/route';

// Mock all services
jest.mock('@/services/reports/ReportGenerator');
jest.mock('@/services/reports/ReportSnapshotService');
jest.mock('@/services/reports/PDFGenerator');
jest.mock('@/lib/auth');

const mockReportGenerator = require('@/services/reports/ReportGenerator').ReportGenerator;
const mockReportSnapshotService = require('@/services/reports/ReportSnapshotService').ReportSnapshotService;
const mockPDFGenerator = require('@/services/reports/PDFGenerator').PDFGenerator;

describe('Full API Integration Tests', () => {
    let mockGenerator: any;
    let mockSnapshotService: any;
    let mockPdfGenerator: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock ReportGenerator
        mockGenerator = {
            generateWeeklyReport: jest.fn(),
            generateMonthlyReport: jest.fn(),
            generateQuarterlyReport: jest.fn(),
        };

        // Mock ReportSnapshotService
        mockSnapshotService = {
            getSnapshotByReportId: jest.fn(),
            listSnapshots: jest.fn(),
            getSnapshot: jest.fn(),
        };

        // Mock PDFGenerator
        mockPdfGenerator = {
            downloadPDF: jest.fn(),
        };

        // Setup mocks
        mockReportGenerator.mockImplementation(() => mockGenerator);
        mockReportSnapshotService.mockImplementation(() => mockSnapshotService);
        mockPDFGenerator.mockImplementation(() => mockPdfGenerator);
    });

    const createRequest = (url: string, params?: Record<string, string>) => {
        const urlObj = new URL(url);
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                urlObj.searchParams.set(key, value);
            });
        }
        return new NextRequest(urlObj.toString(), { method: 'GET' });
    };

    const createPostRequest = (url: string, body: any) => {
        return new NextRequest(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    };

    describe('Weekly Reports API Integration', () => {
        it('should handle complete weekly report generation workflow', async () => {
            const mockReport = {
                id: 'weekly-integration-1',
                tenantId: 'dev-tenant-123',
                reportType: 'weekly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-07'),
                    timezone: 'America/Toronto',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date(),
                generatedBy: 'dev-user-123',
                slides: [
                    {
                        id: 'slide-1',
                        title: 'Executive Overview',
                        content: {
                            slideType: 'executive-overview',
                            summary: 'Weekly security summary with 150 alerts processed.',
                            keyMetrics: { totalAlerts: 150, criticalIncidents: 2 }
                        },
                        charts: [],
                        layout: { type: 'executive-overview', orientation: 'landscape', theme: 'dark', branding: 'avian' }
                    }
                ],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0'
            };

            mockGenerator.generateWeeklyReport.mockResolvedValue(mockReport);

            const request = createRequest('http://localhost:3000/api/reports/weekly', {
                startDate: '2024-01-01',
                endDate: '2024-01-07'
            });

            const response = await WeeklyGET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.reportType).toBe('weekly');
            expect(data.data.slides).toHaveLength(1);
            expect(data.meta.tenantId).toBe('dev-tenant-123');
            expect(data.meta.generatedBy).toBe('dev-user-123');

            // Verify service was called with correct parameters
            expect(mockGenerator.generateWeeklyReport).toHaveBeenCalledWith(
                'dev-tenant-123',
                expect.objectContaining({
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-07')
                }),
                'dev-user-123'
            );
        });

        it('should validate date range parameters for weekly reports', async () => {
            const request = createRequest('http://localhost:3000/api/reports/weekly', {
                startDate: '2024-01-01'
                // Missing endDate
            });

            const response = await WeeklyGET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('endDate');
        });

        it('should handle invalid date formats gracefully', async () => {
            const request = createRequest('http://localhost:3000/api/reports/weekly', {
                startDate: 'invalid-date',
                endDate: '2024-01-07'
            });

            const response = await WeeklyGET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('Invalid date format');
        });
    });
    describe('Monthly Reports API Integration', () => {
        it('should handle complete monthly report generation with trend analysis', async () => {
            const mockMonthlyReport = {
                id: 'monthly-integration-1',
                tenantId: 'dev-tenant-123',
                reportType: 'monthly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-31'),
                    timezone: 'America/Toronto',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date(),
                generatedBy: 'dev-user-123',
                slides: [
                    {
                        id: 'slide-monthly-1',
                        title: 'Monthly Executive Summary',
                        content: {
                            slideType: 'executive-overview',
                            summary: 'Monthly security overview with trend analysis.',
                            keyMetrics: { totalAlerts: 650, weekOverWeekGrowth: 15 }
                        },
                        charts: [],
                        layout: { type: 'executive-overview', orientation: 'landscape', theme: 'dark', branding: 'avian' }
                    },
                    {
                        id: 'slide-monthly-2',
                        title: 'Trend Analysis',
                        content: {
                            slideType: 'trends-analysis',
                            summary: 'Week-over-week security trends and patterns.',
                            keyMetrics: { trendDirection: 'increasing', significantChanges: 3 }
                        },
                        charts: [],
                        layout: { type: 'trends-analysis', orientation: 'landscape', theme: 'dark', branding: 'avian' }
                    }
                ],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0'
            };

            mockGenerator.generateMonthlyReport.mockResolvedValue(mockMonthlyReport);

            const request = createRequest('http://localhost:3000/api/reports/monthly', {
                month: '2024-01'
            });

            const response = await MonthlyGET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.reportType).toBe('monthly');
            expect(data.data.slides).toHaveLength(2);
            expect(data.data.slides.some((s: any) => s.content.slideType === 'trends-analysis')).toBe(true);

            // Verify monthly-specific parameters
            expect(mockGenerator.generateMonthlyReport).toHaveBeenCalledWith(
                'dev-tenant-123',
                expect.objectContaining({
                    startDate: new Date('2024-01-01'),
                    endDate: expect.any(Date) // End of January
                }),
                'dev-user-123'
            );
        });

        it('should validate month parameter format', async () => {
            const request = createRequest('http://localhost:3000/api/reports/monthly', {
                month: 'invalid-month-format'
            });

            const response = await MonthlyGET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('month format');
        });
    });

    describe('Quarterly Reports API Integration', () => {
        it('should handle complete quarterly report generation with executive focus', async () => {
            const mockQuarterlyReport = {
                id: 'quarterly-integration-1',
                tenantId: 'dev-tenant-123',
                reportType: 'quarterly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-03-31'),
                    timezone: 'America/Toronto',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date(),
                generatedBy: 'dev-user-123',
                slides: [
                    {
                        id: 'slide-quarterly-1',
                        title: 'Quarterly Business Impact',
                        content: {
                            slideType: 'executive-overview',
                            summary: 'Q1 2024 security posture and business value delivered.',
                            keyMetrics: { totalValue: 'High', riskReduction: '85%' }
                        },
                        charts: [],
                        layout: { type: 'executive-overview', orientation: 'landscape', theme: 'dark', branding: 'avian' }
                    },
                    {
                        id: 'slide-quarterly-2',
                        title: 'Risk Reduction Summary',
                        content: {
                            slideType: 'risk-summary',
                            summary: 'Quarterly risk reduction achievements and security improvements.',
                            keyMetrics: { vulnerabilitiesReduced: 450, incidentsPrevented: 12 }
                        },
                        charts: [],
                        layout: { type: 'risk-summary', orientation: 'landscape', theme: 'dark', branding: 'avian' }
                    }
                ],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0'
            };

            mockGenerator.generateQuarterlyReport.mockResolvedValue(mockQuarterlyReport);

            const request = createRequest('http://localhost:3000/api/reports/quarterly', {
                quarter: '1',
                year: '2024'
            });

            const response = await QuarterlyGET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.reportType).toBe('quarterly');
            expect(data.data.slides.length).toBeLessThanOrEqual(5); // Max 5 slides for quarterly
            expect(data.data.slides.some((s: any) => s.content.slideType === 'risk-summary')).toBe(true);

            // Verify quarterly-specific parameters
            expect(mockGenerator.generateQuarterlyReport).toHaveBeenCalledWith(
                'dev-tenant-123',
                expect.objectContaining({
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-03-31')
                }),
                'dev-user-123'
            );
        });

        it('should validate quarter and year parameters', async () => {
            const request = createRequest('http://localhost:3000/api/reports/quarterly', {
                quarter: '5', // Invalid quarter
                year: '2024'
            });

            const response = await QuarterlyGET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toContain('quarter must be between 1 and 4');
        });
    });

    describe('Export API Integration', () => {
        it('should handle complete PDF export workflow with snapshot integration', async () => {
            const mockSnapshot = {
                id: 'snapshot-export-integration',
                tenantId: 'dev-tenant-123',
                reportId: 'report-export-integration',
                reportType: 'weekly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-07'),
                    timezone: 'America/Toronto',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date(),
                generatedBy: 'dev-user-123',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false,
                pdfStorageKey: 'existing-pdf-key',
                pdfSize: 15000
            };

            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(mockSnapshot);

            const request = createPostRequest('http://localhost:3000/api/reports/export', {
                reportId: 'report-export-integration',
                format: 'pdf'
            });

            const response = await ExportPOST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.snapshotId).toBe('snapshot-export-integration');
            expect(data.data.downloadUrl).toBe('/api/reports/snapshots/snapshot-export-integration/download');
            expect(data.data.pdfSize).toBe(15000);
            expect(data.data.cached).toBe(true);
            expect(data.meta.exportFormat).toBe('pdf');
            expect(data.meta.tenantId).toBe('dev-tenant-123');
        });

        it('should handle new PDF generation when snapshot exists without PDF', async () => {
            const mockSnapshot = {
                id: 'snapshot-new-pdf-integration',
                tenantId: 'dev-tenant-123',
                reportId: 'report-new-pdf-integration',
                reportType: 'monthly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-31'),
                    timezone: 'America/Toronto',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date(),
                generatedBy: 'dev-user-123',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
                // No pdfStorageKey - needs generation
            };

            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(mockSnapshot);
            mockSnapshotService.updateSnapshotPDF = jest.fn().mockResolvedValue();

            // Mock PDF generation
            const mockPdfBuffer = Buffer.from('newly-generated-pdf-content');
            const mockPdfGenerator = require('@/services/reports/PDFGenerator').PDFGenerator;
            const mockPdfInstance = {
                exportToPDF: jest.fn().mockResolvedValue(mockPdfBuffer),
                validatePDFOutput: jest.fn().mockResolvedValue({
                    isValid: true,
                    errors: [],
                    warnings: []
                }),
                storePDF: jest.fn().mockResolvedValue('new-pdf-storage-key')
            };
            mockPdfGenerator.mockImplementation(() => mockPdfInstance);

            const request = createPostRequest('http://localhost:3000/api/reports/export', {
                reportId: 'report-new-pdf-integration',
                format: 'pdf'
            });

            const response = await ExportPOST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.snapshotId).toBe('snapshot-new-pdf-integration');
            expect(data.data.cached).toBe(false);
            expect(data.data.pdfSize).toBe(mockPdfBuffer.length);
        });
    });

    describe('Snapshots API Integration', () => {
        it('should list snapshots with proper filtering and pagination', async () => {
            const mockSnapshots = [
                {
                    id: 'snapshot-list-1',
                    tenantId: 'dev-tenant-123',
                    reportId: 'report-list-1',
                    reportType: 'weekly' as const,
                    dateRange: {
                        startDate: new Date('2024-01-01'),
                        endDate: new Date('2024-01-07'),
                        timezone: 'America/Toronto',
                        weekStart: 'monday' as const
                    },
                    generatedAt: new Date('2024-01-08T10:00:00Z'),
                    generatedBy: 'dev-user-123',
                    slideData: [],
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false,
                    pdfStorageKey: 'pdf-key-1',
                    pdfSize: 12000
                },
                {
                    id: 'snapshot-list-2',
                    tenantId: 'dev-tenant-123',
                    reportId: 'report-list-2',
                    reportType: 'monthly' as const,
                    dateRange: {
                        startDate: new Date('2024-01-01'),
                        endDate: new Date('2024-01-31'),
                        timezone: 'America/Toronto',
                        weekStart: 'monday' as const
                    },
                    generatedAt: new Date('2024-02-01T10:00:00Z'),
                    generatedBy: 'dev-user-123',
                    slideData: [],
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false,
                    pdfStorageKey: 'pdf-key-2',
                    pdfSize: 18000
                }
            ];

            mockSnapshotService.listSnapshots.mockResolvedValue({
                snapshots: mockSnapshots,
                totalCount: 2,
                hasMore: false
            });

            const request = createRequest('http://localhost:3000/api/reports/snapshots', {
                reportType: 'weekly',
                limit: '10',
                offset: '0'
            });

            const response = await SnapshotsGET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.snapshots).toHaveLength(2);
            expect(data.data.totalCount).toBe(2);
            expect(data.data.hasMore).toBe(false);
            expect(data.meta.tenantId).toBe('dev-tenant-123');

            // Verify service was called with correct filters
            expect(mockSnapshotService.listSnapshots).toHaveBeenCalledWith(
                'dev-tenant-123',
                expect.objectContaining({
                    reportType: 'weekly',
                    limit: 10,
                    offset: 0
                })
            );
        });
    });

    describe('Download API Integration', () => {
        it('should handle PDF download with proper headers and streaming', async () => {
            const mockSnapshot = {
                id: 'snapshot-download-test',
                tenantId: 'dev-tenant-123',
                reportId: 'report-download-test',
                reportType: 'weekly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-07'),
                    timezone: 'America/Toronto',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date(),
                generatedBy: 'dev-user-123',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false,
                pdfStorageKey: 'download-test-pdf-key',
                pdfSize: 20000
            };

            const mockPdfBuffer = Buffer.from('downloadable-pdf-content');

            mockSnapshotService.getSnapshot.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.downloadPDF.mockResolvedValue(mockPdfBuffer);

            const response = await DownloadGET(
                new NextRequest('http://localhost:3000/api/reports/snapshots/snapshot-download-test/download'),
                { params: { snapshotId: 'snapshot-download-test' } }
            );

            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toBe('application/pdf');
            expect(response.headers.get('Content-Disposition')).toContain('attachment');
            expect(response.headers.get('Content-Disposition')).toContain('weekly-report');

            // Verify PDF content
            const responseBuffer = Buffer.from(await response.arrayBuffer());
            expect(responseBuffer.equals(mockPdfBuffer)).toBe(true);
        });

        it('should return 404 for non-existent snapshots', async () => {
            mockSnapshotService.getSnapshot.mockResolvedValue(null);

            const response = await DownloadGET(
                new NextRequest('http://localhost:3000/api/reports/snapshots/nonexistent-snapshot/download'),
                { params: { snapshotId: 'nonexistent-snapshot' } }
            );

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('SNAPSHOT_NOT_FOUND');
        });
    });

    describe('Cross-API Workflow Integration', () => {
        it('should handle complete report generation to PDF export workflow', async () => {
            // Step 1: Generate weekly report
            const mockReport = {
                id: 'workflow-report-1',
                tenantId: 'dev-tenant-123',
                reportType: 'weekly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-07'),
                    timezone: 'America/Toronto',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date(),
                generatedBy: 'dev-user-123',
                slides: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0'
            };

            mockGenerator.generateWeeklyReport.mockResolvedValue(mockReport);

            const weeklyRequest = createRequest('http://localhost:3000/api/reports/weekly', {
                startDate: '2024-01-01',
                endDate: '2024-01-07'
            });

            const weeklyResponse = await WeeklyGET(weeklyRequest);
            const weeklyData = await weeklyResponse.json();

            expect(weeklyResponse.status).toBe(200);
            expect(weeklyData.data.id).toBe('workflow-report-1');

            // Step 2: Export report to PDF
            const mockSnapshot = {
                id: 'workflow-snapshot-1',
                tenantId: 'dev-tenant-123',
                reportId: 'workflow-report-1',
                reportType: 'weekly' as const,
                dateRange: mockReport.dateRange,
                generatedAt: new Date(),
                generatedBy: 'dev-user-123',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false,
                pdfStorageKey: 'workflow-pdf-key',
                pdfSize: 25000
            };

            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(mockSnapshot);

            const exportRequest = createPostRequest('http://localhost:3000/api/reports/export', {
                reportId: 'workflow-report-1',
                format: 'pdf'
            });

            const exportResponse = await ExportPOST(exportRequest);
            const exportData = await exportResponse.json();

            expect(exportResponse.status).toBe(200);
            expect(exportData.data.snapshotId).toBe('workflow-snapshot-1');

            // Step 3: Download PDF
            const mockPdfBuffer = Buffer.from('workflow-pdf-content');
            mockSnapshotService.getSnapshot.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.downloadPDF.mockResolvedValue(mockPdfBuffer);

            const downloadResponse = await DownloadGET(
                new NextRequest('http://localhost:3000/api/reports/snapshots/workflow-snapshot-1/download'),
                { params: { snapshotId: 'workflow-snapshot-1' } }
            );

            expect(downloadResponse.status).toBe(200);
            expect(downloadResponse.headers.get('Content-Type')).toBe('application/pdf');

            // Verify complete workflow
            expect(mockGenerator.generateWeeklyReport).toHaveBeenCalled();
            expect(mockSnapshotService.getSnapshotByReportId).toHaveBeenCalledWith('workflow-report-1');
            expect(mockSnapshotService.getSnapshot).toHaveBeenCalledWith('workflow-snapshot-1');
        });
    });
});