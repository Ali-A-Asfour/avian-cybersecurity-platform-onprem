/**
 * Tests for POST /api/reports/export endpoint
 * 
 * Requirements: 8.1, 8.5 - PDF export with snapshot integration
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { ReportSnapshotService } from '@/services/reports/ReportSnapshotService';
import { PDFGenerator } from '@/services/reports/PDFGenerator';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { UserRole } from '@/types';

// Mock dependencies
jest.mock('@/middleware/auth.middleware');
jest.mock('@/middleware/tenant.middleware');
jest.mock('@/services/reports/ReportSnapshotService');
jest.mock('@/services/reports/PDFGenerator');

const mockAuthMiddleware = authMiddleware as jest.MockedFunction<typeof authMiddleware>;
const mockTenantMiddleware = tenantMiddleware as jest.MockedFunction<typeof tenantMiddleware>;
const mockReportSnapshotService = ReportSnapshotService as jest.MockedClass<typeof ReportSnapshotService>;
const mockPDFGenerator = PDFGenerator as jest.MockedClass<typeof PDFGenerator>;

// Mock environment to disable development bypass
const originalEnv = process.env;
beforeAll(() => {
    process.env = {
        ...originalEnv,
        NODE_ENV: 'test',
        BYPASS_AUTH: 'false'
    };
});

afterAll(() => {
    process.env = originalEnv;
});

describe('POST /api/reports/export', () => {
    let mockRequest: NextRequest;
    let mockSnapshotService: jest.Mocked<ReportSnapshotService>;
    let mockPdfGenerator: jest.Mocked<PDFGenerator>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock services
        mockSnapshotService = {
            getSnapshotByReportId: jest.fn(),
            updateSnapshotPDF: jest.fn(),
        } as any;

        mockPdfGenerator = {
            exportToPDF: jest.fn(),
            validatePDFOutput: jest.fn(),
            storePDF: jest.fn(),
        } as any;

        mockReportSnapshotService.mockImplementation(() => mockSnapshotService);
        mockPDFGenerator.mockImplementation(() => mockPdfGenerator);

        // Mock successful auth
        mockAuthMiddleware.mockResolvedValue({
            success: true,
            user: {
                user_id: 'user-123',
                role: UserRole.SECURITY_ANALYST,
                tenant_id: 'tenant-123'
            }
        });

        // Mock successful tenant
        mockTenantMiddleware.mockResolvedValue({
            success: true,
            tenant: {
                id: 'tenant-123',
                name: 'Test Tenant'
            }
        });
    });

    const createMockRequest = (body: any) => {
        return {
            json: jest.fn().mockResolvedValue(body),
        } as unknown as NextRequest;
    };

    describe('Authentication and Authorization', () => {
        it('should return 401 when authentication fails', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: false,
                error: 'Invalid token'
            });

            mockRequest = createMockRequest({
                reportId: 'report-123',
                format: 'pdf'
            });

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 403 when user role is not authorized', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: {
                    user_id: 'user-123',
                    role: 'regular_user' as UserRole,
                    tenant_id: 'tenant-123'
                }
            });

            mockRequest = createMockRequest({
                reportId: 'report-123',
                format: 'pdf'
            });

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');
        });

        it('should allow Super Admin access', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: {
                    user_id: 'admin-123',
                    role: UserRole.SUPER_ADMIN,
                    tenant_id: 'tenant-123'
                }
            });

            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(null);

            mockRequest = createMockRequest({
                reportId: 'report-123',
                format: 'pdf'
            });

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(404); // Report not found, but auth passed
            expect(data.error.code).toBe('REPORT_NOT_FOUND');
        });

        it('should allow Security Analyst access', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: {
                    user_id: 'analyst-123',
                    role: UserRole.SECURITY_ANALYST,
                    tenant_id: 'tenant-123'
                }
            });

            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(null);

            mockRequest = createMockRequest({
                reportId: 'report-123',
                format: 'pdf'
            });

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(404); // Report not found, but auth passed
            expect(data.error.code).toBe('REPORT_NOT_FOUND');
        });
    });

    describe('Request Validation', () => {
        it('should return 400 for invalid JSON', async () => {
            mockRequest = {
                json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
            } as unknown as NextRequest;

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('Invalid JSON in request body');
        });

        it('should return 400 when reportId is missing', async () => {
            mockRequest = createMockRequest({
                format: 'pdf'
            });

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('reportId is required');
        });

        it('should return 400 when format is missing', async () => {
            mockRequest = createMockRequest({
                reportId: 'report-123'
            });

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('format is required');
        });

        it('should return 400 for unsupported format', async () => {
            mockRequest = createMockRequest({
                reportId: 'report-123',
                format: 'docx'
            });

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('Only PDF format is currently supported');
        });
    });

    describe('Snapshot Handling', () => {
        it('should return 404 when snapshot does not exist', async () => {
            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(null);

            mockRequest = createMockRequest({
                reportId: 'report-123',
                format: 'pdf'
            });

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('REPORT_NOT_FOUND');
        });

        it('should return 403 when user cannot access snapshot from different tenant', async () => {
            const mockSnapshot = {
                id: 'snapshot-123',
                tenantId: 'different-tenant',
                reportId: 'report-123',
                reportType: 'weekly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-07'),
                    timezone: 'UTC',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date(),
                generatedBy: 'user-123',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            };

            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(mockSnapshot);

            mockRequest = createMockRequest({
                reportId: 'report-123',
                format: 'pdf'
            });

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');
        });

        it('should allow Super Admin to access snapshots from any tenant', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: true,
                user: {
                    user_id: 'admin-123',
                    role: UserRole.SUPER_ADMIN,
                    tenant_id: 'tenant-123'
                }
            });

            const mockSnapshot = {
                id: 'snapshot-123',
                tenantId: 'different-tenant',
                reportId: 'report-123',
                reportType: 'weekly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-07'),
                    timezone: 'UTC',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date(),
                generatedBy: 'user-123',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false,
                pdfStorageKey: 'existing-pdf-key',
                pdfSize: 12345
            };

            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(mockSnapshot);

            mockRequest = createMockRequest({
                reportId: 'report-123',
                format: 'pdf'
            });

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.cached).toBe(true);
        });
    });

    describe('PDF Export - Cached PDF', () => {
        it('should return cached PDF when already exists', async () => {
            const mockSnapshot = {
                id: 'snapshot-123',
                tenantId: 'tenant-123',
                reportId: 'report-123',
                reportType: 'weekly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-07'),
                    timezone: 'UTC',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date('2024-01-01T10:00:00Z'),
                generatedBy: 'user-123',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false,
                pdfStorageKey: 'existing-pdf-key',
                pdfSize: 12345
            };

            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(mockSnapshot);

            mockRequest = createMockRequest({
                reportId: 'report-123',
                format: 'pdf'
            });

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.snapshotId).toBe('snapshot-123');
            expect(data.data.downloadUrl).toBe('/api/reports/snapshots/snapshot-123/download');
            expect(data.data.pdfSize).toBe(12345);
            expect(data.data.cached).toBe(true);
            expect(data.meta.exportFormat).toBe('pdf');
            expect(data.meta.tenantId).toBe('tenant-123');
        });
    });

    describe('PDF Export - New PDF Generation', () => {
        it('should generate new PDF when not cached', async () => {
            const mockSnapshot = {
                id: 'snapshot-123',
                tenantId: 'tenant-123',
                reportId: 'report-123',
                reportType: 'weekly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-07'),
                    timezone: 'UTC',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date('2024-01-01T10:00:00Z'),
                generatedBy: 'user-123',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
                // No pdfStorageKey - needs generation
            };

            const mockPdfBuffer = Buffer.from('mock-pdf-content');
            const mockStorageKey = 'reports/pdfs/snapshot-123/2024-01-01.pdf';

            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.exportToPDF.mockResolvedValue(mockPdfBuffer);
            mockPdfGenerator.validatePDFOutput.mockResolvedValue({
                isValid: true,
                errors: [],
                warnings: []
            });
            mockPdfGenerator.storePDF.mockResolvedValue(mockStorageKey);
            mockSnapshotService.updateSnapshotPDF.mockResolvedValue();

            mockRequest = createMockRequest({
                reportId: 'report-123',
                format: 'pdf'
            });

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.snapshotId).toBe('snapshot-123');
            expect(data.data.downloadUrl).toBe('/api/reports/snapshots/snapshot-123/download');
            expect(data.data.pdfSize).toBe(mockPdfBuffer.length);
            expect(data.data.cached).toBe(false);

            // Verify PDF generation workflow
            expect(mockPdfGenerator.exportToPDF).toHaveBeenCalledWith(mockSnapshot);
            expect(mockPdfGenerator.validatePDFOutput).toHaveBeenCalledWith(mockPdfBuffer);
            expect(mockPdfGenerator.storePDF).toHaveBeenCalledWith(mockPdfBuffer, 'snapshot-123');
            expect(mockSnapshotService.updateSnapshotPDF).toHaveBeenCalledWith(
                'snapshot-123',
                mockStorageKey,
                mockPdfBuffer.length
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle PDF validation errors', async () => {
            const mockSnapshot = {
                id: 'snapshot-123',
                tenantId: 'tenant-123',
                reportId: 'report-123',
                reportType: 'weekly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-07'),
                    timezone: 'UTC',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date(),
                generatedBy: 'user-123',
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

            mockRequest = createMockRequest({
                reportId: 'report-123',
                format: 'pdf'
            });

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(422);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('PDF_VALIDATION_ERROR');
        });

        it('should handle PDF generation errors', async () => {
            const mockSnapshot = {
                id: 'snapshot-123',
                tenantId: 'tenant-123',
                reportId: 'report-123',
                reportType: 'weekly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-07'),
                    timezone: 'UTC',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date(),
                generatedBy: 'user-123',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            };

            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.exportToPDF.mockRejectedValue(new Error('PDF generation failed'));

            mockRequest = createMockRequest({
                reportId: 'report-123',
                format: 'pdf'
            });

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('PDF_GENERATION_ERROR');
            expect(data.error.retryable).toBe(true);
        });

        it('should handle storage errors', async () => {
            const mockSnapshot = {
                id: 'snapshot-123',
                tenantId: 'tenant-123',
                reportId: 'report-123',
                reportType: 'weekly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-07'),
                    timezone: 'UTC',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date(),
                generatedBy: 'user-123',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            };

            const mockPdfBuffer = Buffer.from('mock-pdf-content');

            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.exportToPDF.mockResolvedValue(mockPdfBuffer);
            mockPdfGenerator.validatePDFOutput.mockResolvedValue({
                isValid: true,
                errors: [],
                warnings: []
            });
            mockPdfGenerator.storePDF.mockRejectedValue(new Error('Storage failed'));

            mockRequest = createMockRequest({
                reportId: 'report-123',
                format: 'pdf'
            });

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(503);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('STORAGE_ERROR');
            expect(data.error.retryable).toBe(true);
        });

        it('should handle timeout errors', async () => {
            const mockSnapshot = {
                id: 'snapshot-123',
                tenantId: 'tenant-123',
                reportId: 'report-123',
                reportType: 'weekly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-07'),
                    timezone: 'UTC',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date(),
                generatedBy: 'user-123',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            };

            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.exportToPDF.mockRejectedValue(new Error('PDF generation timeout'));

            mockRequest = createMockRequest({
                reportId: 'report-123',
                format: 'pdf'
            });

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(504);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('PDF_TIMEOUT');
            expect(data.error.retryable).toBe(true);
        });

        it('should handle tenant validation errors', async () => {
            mockTenantMiddleware.mockResolvedValue({
                success: false,
                error: { message: 'Tenant not found' }
            });

            mockRequest = createMockRequest({
                reportId: 'report-123',
                format: 'pdf'
            });

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });
    });

    describe('Response Format', () => {
        it('should return correct response format for cached PDF', async () => {
            const mockSnapshot = {
                id: 'snapshot-123',
                tenantId: 'tenant-123',
                reportId: 'report-123',
                reportType: 'monthly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-31'),
                    timezone: 'America/Toronto',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date('2024-01-01T10:00:00Z'),
                generatedBy: 'user-456',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false,
                pdfStorageKey: 'existing-pdf-key',
                pdfSize: 54321
            };

            mockSnapshotService.getSnapshotByReportId.mockResolvedValue(mockSnapshot);

            mockRequest = createMockRequest({
                reportId: 'report-123',
                format: 'pdf'
            });

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual({
                success: true,
                data: {
                    snapshotId: 'snapshot-123',
                    downloadUrl: '/api/reports/snapshots/snapshot-123/download',
                    pdfSize: 54321,
                    cached: true
                },
                meta: {
                    exportFormat: 'pdf',
                    tenantId: 'tenant-123',
                    exportedAt: '2024-01-01T10:00:00.000Z',
                    exportedBy: 'user-456'
                }
            });
        });

        it('should return correct response format for new PDF', async () => {
            const mockSnapshot = {
                id: 'snapshot-456',
                tenantId: 'tenant-123',
                reportId: 'report-456',
                reportType: 'quarterly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-03-31'),
                    timezone: 'UTC',
                    weekStart: 'monday' as const
                },
                generatedAt: new Date(),
                generatedBy: 'user-123',
                slideData: [],
                templateVersion: '1.0.0',
                dataSchemaVersion: '1.0.0',
                isArchived: false
            };

            const mockPdfBuffer = Buffer.from('new-pdf-content');
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

            mockRequest = createMockRequest({
                reportId: 'report-456',
                format: 'pdf'
            });

            const response = await POST(mockRequest);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.snapshotId).toBe('snapshot-456');
            expect(data.data.downloadUrl).toBe('/api/reports/snapshots/snapshot-456/download');
            expect(data.data.pdfSize).toBe(mockPdfBuffer.length);
            expect(data.data.cached).toBe(false);
            expect(data.meta.exportFormat).toBe('pdf');
            expect(data.meta.tenantId).toBe('tenant-123');
            expect(data.meta.exportedBy).toBe('user-123');
            expect(data.meta.processingTime).toBe('completed');
        });
    });
});