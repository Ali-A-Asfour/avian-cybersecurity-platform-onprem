/**
 * Integration tests for POST /api/reports/export endpoint
 * 
 * Requirements: 8.1, 8.5 - PDF export with snapshot integration
 * 
 * Note: These tests run in development mode with BYPASS_AUTH=true,
 * so authentication and tenant validation are automatically successful.
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock the services
jest.mock('@/services/reports/ReportSnapshotService');
jest.mock('@/services/reports/PDFGenerator');

const mockReportSnapshotService = require('@/services/reports/ReportSnapshotService').ReportSnapshotService;
const mockPDFGenerator = require('@/services/reports/PDFGenerator').PDFGenerator;

describe('POST /api/reports/export - Integration Tests', () => {
    let mockSnapshotService: any;
    let mockPdfGenerator: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock ReportSnapshotService
        mockSnapshotService = {
            getSnapshotByReportId: jest.fn(),
            updateSnapshotPDF: jest.fn(),
        };

        // Mock PDFGenerator
        mockPdfGenerator = {
            exportToPDF: jest.fn(),
            validatePDFOutput: jest.fn(),
            storePDF: jest.fn(),
        };

        // Setup mocks
        mockReportSnapshotService.mockImplementation(() => mockSnapshotService);
        mockPDFGenerator.mockImplementation(() => mockPdfGenerator);
    });

    const createRequest = (body: any) => {
        return new NextRequest('http://localhost:3000/api/reports/export', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
    };

    describe('Core Functionality', () => {
        it('should successfully export cached PDF when snapshot exists with PDF', async () => {
            const mockSnapshot = {
                id: 'snapshot-123',
                tenantId: 'dev-tenant-123',
                reportId: 'report-123',
                reportType: 'weekly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-07'),
                    timezone: 'UTC',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date('2024-01-01T10:00:00Z'),
                generatedBy: 'dev-user-123',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false,
                pdfStorageKey: 'existing-pdf-key',
                pdfSize: 12345
            };

            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(mockSnapshot);

            const request = createRequest({
                reportId: 'report-123',
                format: 'pdf'
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.snapshotId).toBe('snapshot-123');
            expect(data.data.downloadUrl).toBe('/api/reports/snapshots/snapshot-123/download');
            expect(data.data.pdfSize).toBe(12345);
            expect(data.data.cached).toBe(true);
            expect(data.meta.exportFormat).toBe('pdf');
            expect(data.meta.tenantId).toBe('dev-tenant-123');
        });

        it('should successfully generate new PDF when snapshot exists without PDF', async () => {
            const mockSnapshot = {
                id: 'snapshot-456',
                tenantId: 'dev-tenant-123',
                reportId: 'report-456',
                reportType: 'monthly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-31'),
                    timezone: 'UTC',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date('2024-01-01T10:00:00Z'),
                generatedBy: 'dev-user-123',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
                // No pdfStorageKey - needs generation
            };

            const mockPdfBuffer = Buffer.from('mock-pdf-content');
            const mockStorageKey = 'reports/pdfs/snapshot-456/2024-01-01.pdf';

            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.exportToPDF.mockResolvedValue(mockPdfBuffer);
            mockPdfGenerator.validatePDFOutput.mockResolvedValue({
                isValid: true,
                errors: [],
                warnings: []
            });
            mockPdfGenerator.storePDF.mockResolvedValue(mockStorageKey);
            mockSnapshotService.updateSnapshotPDF.mockResolvedValue();

            const request = createRequest({
                reportId: 'report-456',
                format: 'pdf'
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.snapshotId).toBe('snapshot-456');
            expect(data.data.downloadUrl).toBe('/api/reports/snapshots/snapshot-456/download');
            expect(data.data.pdfSize).toBe(mockPdfBuffer.length);
            expect(data.data.cached).toBe(false);
            expect(data.meta.exportFormat).toBe('pdf');
            expect(data.meta.tenantId).toBe('dev-tenant-123');

            // Verify PDF generation workflow
            expect(mockPdfGenerator.exportToPDF).toHaveBeenCalledWith(mockSnapshot);
            expect(mockPdfGenerator.validatePDFOutput).toHaveBeenCalledWith(mockPdfBuffer);
            expect(mockPdfGenerator.storePDF).toHaveBeenCalledWith(mockPdfBuffer, 'snapshot-456');
            expect(mockSnapshotService.updateSnapshotPDF).toHaveBeenCalledWith(
                'snapshot-456',
                mockStorageKey,
                mockPdfBuffer.length
            );
        });

        it('should return 404 when report snapshot does not exist', async () => {
            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(null);

            const request = createRequest({
                reportId: 'nonexistent-report',
                format: 'pdf'
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('REPORT_NOT_FOUND');
            expect(data.error.message).toBe('Report not found or no snapshot available. Please generate the report first.');
        });

        it('should validate request format and return 400 for invalid format', async () => {
            const request = createRequest({
                reportId: 'report-123',
                format: 'docx' // Invalid format
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('Only PDF format is currently supported');
        });

        it('should validate required fields and return 400 when reportId is missing', async () => {
            const request = createRequest({
                format: 'pdf'
                // Missing reportId
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('reportId is required');
        });

        it('should validate required fields and return 400 when format is missing', async () => {
            const request = createRequest({
                reportId: 'report-123'
                // Missing format
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('format is required');
        });
    });

    describe('Error Handling', () => {
        it('should handle PDF validation failures gracefully', async () => {
            const mockSnapshot = {
                id: 'snapshot-789',
                tenantId: 'dev-tenant-123',
                reportId: 'report-789',
                reportType: 'quarterly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-03-31'),
                    timezone: 'UTC',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date(),
                generatedBy: 'dev-user-123',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            };

            const mockPdfBuffer = Buffer.from('invalid-pdf-content');

            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.exportToPDF.mockResolvedValue(mockPdfBuffer);
            mockPdfGenerator.validatePDFOutput.mockResolvedValue({
                isValid: false,
                errors: ['Invalid PDF structure'],
                warnings: []
            });

            const request = createRequest({
                reportId: 'report-789',
                format: 'pdf'
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(422);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('PDF_VALIDATION_ERROR');
            expect(data.error.message).toBe('Generated PDF failed quality validation');
        });

        it('should handle PDF generation errors gracefully', async () => {
            const mockSnapshot = {
                id: 'snapshot-error',
                tenantId: 'dev-tenant-123',
                reportId: 'report-error',
                reportType: 'weekly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-07'),
                    timezone: 'UTC',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date(),
                generatedBy: 'dev-user-123',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            };

            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.exportToPDF.mockRejectedValue(new Error('PDF generation failed'));

            const request = createRequest({
                reportId: 'report-error',
                format: 'pdf'
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('PDF_GENERATION_ERROR');
            expect(data.error.message).toBe('Failed to generate PDF');
            expect(data.error.retryable).toBe(true);
        });
    });

    describe('Response Format Validation', () => {
        it('should return properly formatted response for cached PDF', async () => {
            const mockSnapshot = {
                id: 'snapshot-format-test',
                tenantId: 'dev-tenant-123',
                reportId: 'report-format-test',
                reportType: 'weekly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-07'),
                    timezone: 'America/Toronto',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date('2024-01-01T15:30:00Z'),
                generatedBy: 'test-user-456',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false,
                pdfStorageKey: 'test-pdf-key',
                pdfSize: 98765
            };

            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(mockSnapshot);

            const request = createRequest({
                reportId: 'report-format-test',
                format: 'pdf'
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toMatchObject({
                success: true,
                data: {
                    snapshotId: 'snapshot-format-test',
                    downloadUrl: '/api/reports/snapshots/snapshot-format-test/download',
                    pdfSize: 98765,
                    cached: true
                },
                meta: {
                    exportFormat: 'pdf',
                    tenantId: 'dev-tenant-123',
                    exportedAt: '2024-01-01T15:30:00.000Z',
                    exportedBy: 'test-user-456'
                }
            });
        });

        it('should return properly formatted response for new PDF generation', async () => {
            const mockSnapshot = {
                id: 'snapshot-new-pdf',
                tenantId: 'dev-tenant-123',
                reportId: 'report-new-pdf',
                reportType: 'monthly' as const,
                dateRange: {
                    startDate: new Date('2024-02-01'),
                    endDate: new Date('2024-02-29'),
                    timezone: 'UTC',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date(),
                generatedBy: 'dev-user-123',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            };

            const mockPdfBuffer = Buffer.from('fresh-pdf-content');
            const mockStorageKey = 'reports/pdfs/snapshot-new-pdf/2024-02-01.pdf';

            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.exportToPDF.mockResolvedValue(mockPdfBuffer);
            mockPdfGenerator.validatePDFOutput.mockResolvedValue({
                isValid: true,
                errors: [],
                warnings: []
            });
            mockPdfGenerator.storePDF.mockResolvedValue(mockStorageKey);
            mockSnapshotService.updateSnapshotPDF.mockResolvedValue();

            const request = createRequest({
                reportId: 'report-new-pdf',
                format: 'pdf'
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.snapshotId).toBe('snapshot-new-pdf');
            expect(data.data.downloadUrl).toBe('/api/reports/snapshots/snapshot-new-pdf/download');
            expect(data.data.pdfSize).toBe(mockPdfBuffer.length);
            expect(data.data.cached).toBe(false);
            expect(data.meta.exportFormat).toBe('pdf');
            expect(data.meta.tenantId).toBe('dev-tenant-123');
            expect(data.meta.exportedBy).toBe('dev-user-123');
            expect(data.meta.processingTime).toBe('completed');
        });
    });
});