/**
 * Tests for GET /api/reports/snapshots/[snapshotId]/download endpoint
 * 
 * Requirements: audit compliance, access control - Re-delivery capability
 * 
 * Tests role-based access control (Super Admin, Security Analyst only),
 * PDF download from snapshots, and audit trail logging.
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';
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

describe('GET /api/reports/snapshots/[snapshotId]/download', () => {
    let mockSnapshotService: jest.Mocked<ReportSnapshotService>;
    let mockPdfGenerator: jest.Mocked<PDFGenerator>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock services
        mockSnapshotService = {
            getSnapshot: jest.fn(),
        } as any;

        mockPdfGenerator = {
            getPDFFromStorage: jest.fn(),
            validatePDFOutput: jest.fn(),
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

    const createMockRequest = () => {
        return {
            url: 'http://localhost/api/reports/snapshots/snapshot-123/download',
        } as NextRequest;
    };

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
        pdfStorageKey: 'reports/pdfs/snapshot-123.pdf',
        pdfSize: 12345
    };

    describe('Authentication and Authorization', () => {
        it('should return 401 when authentication fails', async () => {
            mockAuthMiddleware.mockResolvedValue({
                success: false,
                error: 'Invalid token'
            });

            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: 'snapshot-123' } });
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

            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: 'snapshot-123' } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');
            expect(data.error.message).toBe('Access denied. Snapshot download is available to Super Admin and Security Analyst roles only.');
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

            mockSnapshotService.getSnapshot.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.getPDFFromStorage.mockResolvedValue(Buffer.from('mock-pdf-content'));
            mockPdfGenerator.validatePDFOutput.mockResolvedValue({
                isValid: true,
                errors: [],
                warnings: []
            });

            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: 'snapshot-123' } });

            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toBe('application/pdf');
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

            mockSnapshotService.getSnapshot.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.getPDFFromStorage.mockResolvedValue(Buffer.from('mock-pdf-content'));
            mockPdfGenerator.validatePDFOutput.mockResolvedValue({
                isValid: true,
                errors: [],
                warnings: []
            });

            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: 'snapshot-123' } });

            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toBe('application/pdf');
        });

        it('should return 403 when tenant validation fails', async () => {
            mockTenantMiddleware.mockResolvedValue({
                success: false,
                error: { message: 'Tenant not found' }
            });

            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: 'snapshot-123' } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_ERROR');
        });
    });

    describe('Parameter Validation', () => {
        it('should return 400 when snapshotId is missing', async () => {
            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: '' } });
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(data.error.message).toBe('snapshotId parameter is required');
        });
    });

    describe('Snapshot Access Control', () => {
        it('should return 404 when snapshot does not exist', async () => {
            mockSnapshotService.getSnapshot.mockResolvedValue(null);

            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: 'nonexistent-snapshot' } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('SNAPSHOT_NOT_FOUND');
            expect(data.error.message).toBe('Report snapshot not found');
        });

        it('should return 403 when user cannot access snapshot from different tenant', async () => {
            const differentTenantSnapshot = {
                ...mockSnapshot,
                tenantId: 'different-tenant'
            };

            mockSnapshotService.getSnapshot.mockResolvedValue(differentTenantSnapshot);

            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: 'snapshot-123' } });
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('FORBIDDEN');
            expect(data.error.message).toBe('Access denied to this report snapshot');
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

            const differentTenantSnapshot = {
                ...mockSnapshot,
                tenantId: 'different-tenant'
            };

            mockSnapshotService.getSnapshot.mockResolvedValue(differentTenantSnapshot);
            mockPdfGenerator.getPDFFromStorage.mockResolvedValue(Buffer.from('mock-pdf-content'));
            mockPdfGenerator.validatePDFOutput.mockResolvedValue({
                isValid: true,
                errors: [],
                warnings: []
            });

            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: 'snapshot-123' } });

            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toBe('application/pdf');
        });
    });

    describe('PDF Availability and Retrieval', () => {
        it('should return 404 when PDF is not available for snapshot', async () => {
            const snapshotWithoutPdf = {
                ...mockSnapshot,
                pdfStorageKey: undefined,
                pdfSize: undefined
            };

            mockSnapshotService.getSnapshot.mockResolvedValue(snapshotWithoutPdf);

            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: 'snapshot-123' } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('PDF_NOT_AVAILABLE');
            expect(data.error.message).toBe('PDF not available for this snapshot. Please export the report first.');
        });

        it('should return 503 when PDF retrieval from storage fails', async () => {
            mockSnapshotService.getSnapshot.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.getPDFFromStorage.mockRejectedValue(new Error('Storage error'));

            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: 'snapshot-123' } });
            const data = await response.json();

            expect(response.status).toBe(503);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('PDF_RETRIEVAL_ERROR');
            expect(data.error.message).toBe('Failed to retrieve PDF from storage');
        });

        it('should return 422 when PDF validation fails', async () => {
            const mockPdfBuffer = Buffer.from('corrupted-pdf-content');

            mockSnapshotService.getSnapshot.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.getPDFFromStorage.mockResolvedValue(mockPdfBuffer);
            mockPdfGenerator.validatePDFOutput.mockResolvedValue({
                isValid: false,
                errors: ['Invalid PDF structure'],
                warnings: []
            });

            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: 'snapshot-123' } });
            const data = await response.json();

            expect(response.status).toBe(422);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('PDF_CORRUPTED');
            expect(data.error.message).toBe('Stored PDF file is corrupted. Please re-export the report.');
        });

        it('should continue with download even if validation fails', async () => {
            const mockPdfBuffer = Buffer.from('mock-pdf-content');

            mockSnapshotService.getSnapshot.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.getPDFFromStorage.mockResolvedValue(mockPdfBuffer);
            mockPdfGenerator.validatePDFOutput.mockRejectedValue(new Error('Validation error'));

            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: 'snapshot-123' } });

            // Should still return PDF even if validation fails (non-critical)
            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toBe('application/pdf');
        });
    });

    describe('Successful PDF Download', () => {
        it('should return PDF with correct headers and filename', async () => {
            const mockPdfBuffer = Buffer.from('mock-pdf-content');

            mockSnapshotService.getSnapshot.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.getPDFFromStorage.mockResolvedValue(mockPdfBuffer);
            mockPdfGenerator.validatePDFOutput.mockResolvedValue({
                isValid: true,
                errors: [],
                warnings: []
            });

            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: 'snapshot-123' } });

            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toBe('application/pdf');
            expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="AVIAN_Weekly_Report_2024-01-01_snapshot-.pdf"');
            expect(response.headers.get('Content-Length')).toBe(mockPdfBuffer.length.toString());
            expect(response.headers.get('Cache-Control')).toBe('private, no-cache, no-store, must-revalidate');
            expect(response.headers.get('Pragma')).toBe('no-cache');
            expect(response.headers.get('Expires')).toBe('0');
        });

        it('should include audit headers', async () => {
            const mockPdfBuffer = Buffer.from('mock-pdf-content');

            mockSnapshotService.getSnapshot.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.getPDFFromStorage.mockResolvedValue(mockPdfBuffer);
            mockPdfGenerator.validatePDFOutput.mockResolvedValue({
                isValid: true,
                errors: [],
                warnings: []
            });

            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: 'snapshot-123' } });

            expect(response.status).toBe(200);
            expect(response.headers.get('X-Snapshot-Id')).toBe('snapshot-123');
            expect(response.headers.get('X-Report-Type')).toBe('weekly');
            expect(response.headers.get('X-Generated-At')).toBe('2024-01-01T10:00:00.000Z');
            expect(response.headers.get('X-Downloaded-By')).toBe('user-123');
            expect(response.headers.get('X-Tenant-Id')).toBe('tenant-123');
        });

        it('should generate correct filename for different report types', async () => {
            const monthlySnapshot = {
                ...mockSnapshot,
                reportType: 'monthly' as const,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-31'),
                    timezone: 'UTC',
                    weekStart: 'monday' as const
                }
            };

            const mockPdfBuffer = Buffer.from('mock-pdf-content');

            mockSnapshotService.getSnapshot.mockResolvedValue(monthlySnapshot);
            mockPdfGenerator.getPDFFromStorage.mockResolvedValue(mockPdfBuffer);
            mockPdfGenerator.validatePDFOutput.mockResolvedValue({
                isValid: true,
                errors: [],
                warnings: []
            });

            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: 'snapshot-123' } });

            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="AVIAN_Monthly_Report_2024-01-01_snapshot-.pdf"');
        });

        it('should call getSnapshot with correct parameters', async () => {
            const mockPdfBuffer = Buffer.from('mock-pdf-content');

            mockSnapshotService.getSnapshot.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.getPDFFromStorage.mockResolvedValue(mockPdfBuffer);
            mockPdfGenerator.validatePDFOutput.mockResolvedValue({
                isValid: true,
                errors: [],
                warnings: []
            });

            const request = createMockRequest();
            await GET(request, { params: { snapshotId: 'snapshot-123' } });

            expect(mockSnapshotService.getSnapshot).toHaveBeenCalledWith(
                'snapshot-123',
                'user-123',
                'tenant-123'
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle snapshot service errors', async () => {
            mockSnapshotService.getSnapshot.mockRejectedValue(new Error('snapshot not found'));

            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: 'snapshot-123' } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('SNAPSHOT_NOT_FOUND');
            expect(data.error.message).toBe('Report snapshot not found');
        });

        it('should handle storage errors', async () => {
            mockSnapshotService.getSnapshot.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.getPDFFromStorage.mockRejectedValue(new Error('storage connection failed'));

            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: 'snapshot-123' } });
            const data = await response.json();

            expect(response.status).toBe(503);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('STORAGE_ERROR');
            expect(data.error.message).toBe('Failed to access PDF storage');
        });

        it('should handle tenant not found errors', async () => {
            mockSnapshotService.getSnapshot.mockRejectedValue(new Error('tenant not found'));

            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: 'snapshot-123' } });
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('TENANT_NOT_FOUND');
            expect(data.error.message).toBe('Tenant data not found');
        });

        it('should handle generic errors', async () => {
            mockSnapshotService.getSnapshot.mockRejectedValue(new Error('Unexpected error'));

            const request = createMockRequest();
            const response = await GET(request, { params: { snapshotId: 'snapshot-123' } });
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toBe('Failed to download report PDF');
        });
    });

    describe('Audit Logging', () => {
        it('should log successful downloads', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const mockPdfBuffer = Buffer.from('mock-pdf-content');

            mockSnapshotService.getSnapshot.mockResolvedValue(mockSnapshot);
            mockPdfGenerator.getPDFFromStorage.mockResolvedValue(mockPdfBuffer);
            mockPdfGenerator.validatePDFOutput.mockResolvedValue({
                isValid: true,
                errors: [],
                warnings: []
            });

            const request = createMockRequest();
            await GET(request, { params: { snapshotId: 'snapshot-123' } });

            expect(consoleSpy).toHaveBeenCalledWith('PDF download:', expect.objectContaining({
                snapshotId: 'snapshot-123',
                userId: 'user-123',
                tenantId: 'tenant-123',
                reportType: 'weekly',
                downloadedAt: expect.any(String),
                filename: expect.stringContaining('AVIAN_Weekly_Report')
            }));

            consoleSpy.mockRestore();
        });
    });
});