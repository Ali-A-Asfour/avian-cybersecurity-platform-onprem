/**
 * Integration tests for snapshot-based PDF export flow
 * Tests the new flow: Generate → Snapshot → Export from snapshot
 */

import { PDFGenerator } from '../PDFGenerator';
import { ReportSnapshotService } from '../ReportSnapshotService';
import { ReportSnapshot, SlideData, EnhancedDateRange } from '@/types/reports';
import { TemplateEngine } from '../TemplateEngine';

// Mock dependencies
jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

// Mock the ReportSnapshotService module
jest.mock('../ReportSnapshotService', () => {
    const mockService = {
        createSnapshot: jest.fn(),
        getSnapshot: jest.fn(),
        updatePdfStorage: jest.fn()
    };
    return {
        ReportSnapshotService: jest.fn(() => mockService),
        reportSnapshotService: mockService
    };
});

jest.mock('@/lib/database', () => ({
    db: {
        insert: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([{
                    id: 'test-snapshot-id',
                    tenantId: 'test-tenant',
                    reportId: 'test-report',
                    reportType: 'weekly',
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-07'),
                    timezone: 'America/Toronto',
                    generatedAt: new Date(),
                    generatedBy: 'test-user',
                    slideData: [],
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false
                }])
            })
        }),
        select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue([{
                        id: 'test-user',
                        role: 'super_admin',
                        tenant_id: 'test-tenant',
                        is_active: true
                    }])
                })
            })
        }),
        update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue(undefined)
            })
        })
    },
    withTransaction: jest.fn().mockImplementation((callback) => callback({
        insert: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([{
                    id: 'test-snapshot-id',
                    tenantId: 'test-tenant',
                    reportId: 'test-report',
                    reportType: 'weekly',
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-01-07'),
                    timezone: 'America/Toronto',
                    generatedAt: new Date(),
                    generatedBy: 'test-user',
                    slideData: [],
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0',
                    isArchived: false
                }])
            })
        })
    }))
}));

// Mock Playwright
jest.mock('playwright', () => ({
    chromium: {
        launch: jest.fn().mockResolvedValue({
            newPage: jest.fn().mockResolvedValue({
                setContent: jest.fn(),
                pdf: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
                close: jest.fn(),
                evaluate: jest.fn().mockResolvedValue(undefined),
                waitForTimeout: jest.fn(),
                waitForLoadState: jest.fn(),
                addInitScript: jest.fn()
            }),
            close: jest.fn(),
            version: jest.fn().mockReturnValue('1.0.0')
        })
    }
}));

// Mock file system operations
jest.mock('fs/promises', () => ({
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
    access: jest.fn(),
    stat: jest.fn().mockResolvedValue({ size: 1000 }),
    unlink: jest.fn()
}));

describe('Snapshot Integration Tests', () => {
    let pdfGenerator: PDFGenerator;
    let mockSnapshotService: any;
    let mockSnapshot: ReportSnapshot;
    let mockSlideData: SlideData[];

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Initialize services
        const templateEngine = new TemplateEngine();
        pdfGenerator = new PDFGenerator(templateEngine);

        // Get the mocked snapshot service
        const { reportSnapshotService } = require('../ReportSnapshotService');
        mockSnapshotService = reportSnapshotService;

        // Mock slide data
        mockSlideData = [
            {
                slideId: 'slide-1',
                slideType: 'executive-overview',
                title: 'Executive Overview',
                subtitle: 'Weekly Security Report',
                summary: 'This week we processed 150 alerts and applied 25 updates.',
                keyPoints: ['150 alerts processed', '25 updates applied', 'No critical incidents'],
                charts: [],
                computedMetrics: {
                    totalAlerts: 150,
                    totalUpdates: 25,
                    criticalIncidents: 0
                },
                chartData: [],
                templateData: {
                    layout: {
                        type: 'executive-overview' as const,
                        orientation: 'landscape' as const,
                        theme: 'dark' as const,
                        branding: 'avian' as const
                    }
                }
            }
        ];

        // Mock snapshot
        mockSnapshot = {
            id: 'test-snapshot-id',
            tenantId: 'test-tenant',
            reportId: 'test-report',
            reportType: 'weekly',
            dateRange: {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-07'),
                timezone: 'America/Toronto',
                weekStart: 'monday'
            },
            generatedAt: new Date(),
            generatedBy: 'test-user',
            slideData: mockSlideData,
            templateVersion: '1.0.0',
            dataSchemaVersion: '1.0.0',
            isArchived: false
        };
    });

    afterEach(async () => {
        await pdfGenerator.closeBrowser();
    });

    describe('Generate → Snapshot → Export Flow', () => {
        it('should create snapshot and export PDF successfully', async () => {
            // Mock the snapshot service methods
            mockSnapshotService.createSnapshot.mockResolvedValue(mockSnapshot);
            mockSnapshotService.updatePdfStorage.mockResolvedValue();

            // Test the new integrated flow
            const result = await pdfGenerator.generateReportAndSnapshot(
                {
                    tenantId: 'test-tenant',
                    reportId: 'test-report',
                    reportType: 'weekly',
                    dateRange: mockSnapshot.dateRange,
                    slideData: mockSlideData,
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0'
                },
                'test-user',
                {
                    validateQuality: false, // Disable validation for simpler test
                    enableSharing: false
                }
            );

            expect(result.success).toBe(true);
            expect(result.snapshot).toBeDefined();
            expect(result.pdf).toBeInstanceOf(Buffer);
            expect(result.storageKey).toBeDefined();
            expect(result.metadata.snapshotId).toBe('test-snapshot-id');
        });

        it('should handle validation failures gracefully', async () => {
            // Mock the snapshot service methods
            mockSnapshotService.createSnapshot.mockResolvedValue(mockSnapshot);
            mockSnapshotService.updatePdfStorage.mockResolvedValue();

            // Mock PDF generation to return invalid PDF
            const originalExportToPDF = pdfGenerator.exportToPDF;
            pdfGenerator.exportToPDF = jest.fn().mockResolvedValue(Buffer.from('invalid'));

            const result = await pdfGenerator.generateReportAndSnapshot(
                {
                    tenantId: 'test-tenant',
                    reportId: 'test-report',
                    reportType: 'weekly',
                    dateRange: mockSnapshot.dateRange,
                    slideData: mockSlideData,
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0'
                },
                'test-user',
                {
                    validateQuality: true
                }
            );

            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors!.length).toBeGreaterThan(0);

            // Restore original method
            pdfGenerator.exportToPDF = originalExportToPDF;
        });
    });

    describe('Snapshot-based Re-download', () => {
        it('should re-download PDF from existing snapshot', async () => {
            // Mock snapshot with existing PDF
            const snapshotWithPDF = {
                ...mockSnapshot,
                pdfStorageKey: 'reports/pdfs/test-file.pdf',
                pdfSize: 1000
            };

            // Mock snapshot service to return snapshot with PDF
            mockSnapshotService.getSnapshot.mockResolvedValue(snapshotWithPDF);

            const result = await pdfGenerator.redownloadFromSnapshot(
                'test-snapshot-id',
                'test-tenant',
                'test-user'
            );

            expect(result.pdf).toBeInstanceOf(Buffer);
            expect(result.metadata.snapshotId).toBe('test-snapshot-id');
            expect(result.metadata.templateVersion).toBe('1.0.0');
        });

        it('should handle missing PDF gracefully', async () => {
            // Mock snapshot service to return snapshot without PDF
            mockSnapshotService.getSnapshot.mockResolvedValue(mockSnapshot);

            await expect(
                pdfGenerator.redownloadFromSnapshot('test-snapshot-id', 'test-tenant', 'test-user')
            ).rejects.toThrow('No PDF available for this snapshot');
        });

        it('should handle missing snapshot gracefully', async () => {
            // Mock snapshot service to return null
            mockSnapshotService.getSnapshot.mockResolvedValue(null);

            await expect(
                pdfGenerator.redownloadFromSnapshot('test-snapshot-id', 'test-tenant', 'test-user')
            ).rejects.toThrow('PDF re-download failed: Snapshot not found or access denied');
        });
    });

    describe('Storage Integration', () => {
        it('should store PDF to file system when S3 is not configured', async () => {
            // Ensure S3 environment variables are not set
            delete process.env.AWS_S3_BUCKET;
            delete process.env.AWS_REGION;

            const storageKey = await pdfGenerator.storePDF(
                Buffer.from('test-pdf-content'),
                'test-snapshot-id'
            );

            expect(storageKey).toContain('reports/pdfs/');
            expect(storageKey).toContain('test-snapshot-id');
        });

        it('should retrieve PDF from file system', async () => {
            const storageKey = 'reports/pdfs/test-file.pdf';

            const pdf = await pdfGenerator.retrievePDF(storageKey);

            expect(pdf).toBeInstanceOf(Buffer);
        });

        it('should handle storage errors gracefully', async () => {
            // Mock file system error
            const fs = require('fs/promises');
            fs.writeFile.mockRejectedValue(new Error('Disk full'));

            await expect(
                pdfGenerator.storePDF(Buffer.from('test-content'), 'test-snapshot-id')
            ).rejects.toThrow('PDF storage failed');
        });
    });

    describe('PDF Quality Validation', () => {
        it('should validate PDF structure and quality', async () => {
            const mockPDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n179\n%%EOF');

            const validation = await pdfGenerator.validatePDFOutput(mockPDF);

            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        it('should detect invalid PDF structure', async () => {
            const invalidPDF = Buffer.from('not a pdf');

            const validation = await pdfGenerator.validatePDFOutput(invalidPDF);

            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });
    });

    describe('Audit Compliance', () => {
        it('should maintain audit trail through snapshot system', async () => {
            mockSnapshotService.createSnapshot.mockResolvedValue(mockSnapshot);
            mockSnapshotService.updatePdfStorage.mockResolvedValue();

            await pdfGenerator.generateReportAndSnapshot(
                {
                    tenantId: 'test-tenant',
                    reportId: 'test-report',
                    reportType: 'weekly',
                    dateRange: mockSnapshot.dateRange,
                    slideData: mockSlideData,
                    templateVersion: '1.0.0',
                    dataSchemaVersion: '1.0.0'
                },
                'test-user',
                {
                    validateQuality: false,
                    ipAddress: '192.168.1.1',
                    userAgent: 'Mozilla/5.0'
                }
            );

            expect(mockSnapshotService.createSnapshot).toHaveBeenCalledWith(
                expect.objectContaining({
                    tenantId: 'test-tenant',
                    reportId: 'test-report',
                    reportType: 'weekly'
                }),
                'test-user',
                '192.168.1.1',
                'Mozilla/5.0'
            );
        });

        it('should generate consistent checksums for reproducibility', async () => {
            const pdf1 = Buffer.from('identical content');
            const pdf2 = Buffer.from('identical content');

            const checksum1 = pdfGenerator.generateFileChecksum(pdf1);
            const checksum2 = pdfGenerator.generateFileChecksum(pdf2);

            expect(checksum1).toBe(checksum2);
        });

        it('should verify file integrity', async () => {
            const pdf = Buffer.from('test content');
            const checksum = pdfGenerator.generateFileChecksum(pdf);

            const isValid = pdfGenerator.verifyFileIntegrity(pdf, checksum);

            expect(isValid).toBe(true);
        });
    });
});