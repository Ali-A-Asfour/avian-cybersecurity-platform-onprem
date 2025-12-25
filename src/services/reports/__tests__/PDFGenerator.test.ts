/**
 * PDF Generator Service Tests
 * 
 * Tests for PDF generation, validation, and storage functionality.
 * Validates Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { PDFGenerator } from '../PDFGenerator';
import { ReportSnapshot, SlideData } from '@/types/reports';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock logger
jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

// Mock TemplateEngine
jest.mock('../TemplateEngine', () => ({
    TemplateEngine: jest.fn().mockImplementation(() => ({
        renderSlide: jest.fn().mockResolvedValue({
            html: '<div class="slide"><h1>Test Slide</h1><p>Test content</p></div>',
            css: '.slide { background: #0A0A0A; color: #FFFFFF; }',
            metadata: {
                slideId: 'test-slide',
                slideType: 'summary',
                templateVersion: '1.0.0',
                renderTimestamp: new Date()
            }
        })
    }))
}));

// Mock ReportSnapshotService
jest.mock('../ReportSnapshotService', () => {
    const mockService = {
        updatePdfStorage: jest.fn().mockResolvedValue(undefined),
        getSnapshot: jest.fn().mockResolvedValue({
            id: 'test-snapshot-123',
            pdfStorageKey: 'reports/pdfs/test.pdf',
            pdfSize: 1000,
            generatedAt: new Date(),
            templateVersion: '1.0.0',
            dataSchemaVersion: '1.0.0'
        })
    };
    return {
        ReportSnapshotService: jest.fn().mockImplementation(() => mockService),
        reportSnapshotService: mockService
    };
});

// Mock Playwright
jest.mock('playwright', () => ({
    chromium: {
        launch: jest.fn().mockResolvedValue({
            newPage: jest.fn().mockResolvedValue({
                setContent: jest.fn().mockResolvedValue(undefined),
                waitForTimeout: jest.fn().mockResolvedValue(undefined),
                pdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n179\n%%EOF')),
                close: jest.fn().mockResolvedValue(undefined)
            }),
            close: jest.fn().mockResolvedValue(undefined),
            version: jest.fn().mockReturnValue('1.0.0')
        })
    }
}));

describe('PDFGenerator', () => {
    let pdfGenerator: PDFGenerator;
    let mockSnapshot: ReportSnapshot;

    beforeEach(() => {
        pdfGenerator = new PDFGenerator();

        mockSnapshot = {
            id: 'test-snapshot-123',
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
            slideData: [
                {
                    slideId: 'slide-1',
                    slideType: 'executive-overview',
                    title: 'Executive Overview',
                    subtitle: 'Weekly Security Report',
                    summary: 'This week we successfully digested 45 security alerts and applied 12 updates.',
                    keyPoints: [
                        'Zero critical security incidents',
                        'All systems updated and secure',
                        'Excellent security posture maintained'
                    ],
                    computedMetrics: {
                        totalAlerts: 45,
                        criticalAlerts: 0,
                        updatesApplied: 12
                    },
                    chartData: [],
                    templateData: {}
                }
            ] as SlideData[],
            templateVersion: '1.0.0',
            dataSchemaVersion: '1.0.0',
            isArchived: false
        };
    });

    afterEach(async () => {
        await pdfGenerator.cleanup();
    });

    describe('PDF Generation', () => {
        it('should generate a PDF from snapshot data', async () => {
            const pdf = await pdfGenerator.exportToPDF(mockSnapshot);

            expect(pdf).toBeInstanceOf(Buffer);
            expect(pdf.length).toBeGreaterThan(0);

            // Check PDF header
            const pdfHeader = pdf.subarray(0, 8).toString('ascii');
            expect(pdfHeader).toMatch(/^%PDF-/);
        });

        it('should generate PDF with landscape orientation', async () => {
            const pdf = await pdfGenerator.exportToPDF(mockSnapshot, {
                orientation: 'landscape'
            });

            expect(pdf).toBeInstanceOf(Buffer);
            expect(pdf.length).toBeGreaterThan(0);
        });

        it('should include metadata in generated PDF', async () => {
            const metadata = {
                title: 'Test Security Report',
                author: 'AVIAN Platform',
                subject: 'Weekly Security Summary'
            };

            const pdf = await pdfGenerator.exportToPDF(mockSnapshot, {}, metadata);
            expect(pdf).toBeInstanceOf(Buffer);
        });
    });

    describe('PDF Validation', () => {
        it('should validate a properly formatted PDF', async () => {
            const validPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n/Title (Test Report)\n/Author (AVIAN)\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 792 612]\n>>\nendobj\n4 0 obj\n<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\nendobj\n5 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000108 00000 n \n0000000154 00000 n \n0000000211 00000 n \n0000000279 00000 n \ntrailer\n<<\n/Size 6\n/Root 1 0 R\n>>\nstartxref\n350\n%%EOF');

            const validation = await pdfGenerator.validatePDFOutput(validPdf);

            // Log validation result for debugging
            if (!validation.isValid) {
                console.log('Validation errors:', validation.errors);
                console.log('Validation warnings:', validation.warnings);
            }

            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        it('should detect invalid PDF structure', async () => {
            const invalidPdf = Buffer.from('Not a PDF file');

            const validation = await pdfGenerator.validatePDFOutput(invalidPdf);

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('Invalid PDF header - file may be corrupted');
        });

        it('should detect empty PDF buffer', async () => {
            const emptyPdf = Buffer.alloc(0);

            const validation = await pdfGenerator.validatePDFOutput(emptyPdf);

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('PDF buffer is empty or null');
        });

        it('should warn about missing fonts', async () => {
            const pdfWithoutFonts = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n179\n%%EOF');

            const validation = await pdfGenerator.validatePDFOutput(pdfWithoutFonts);

            expect(validation.warnings).toContain('PDF does not contain embedded fonts - rendering may vary across systems');
        });
    });

    describe('PDF Storage', () => {
        it('should store PDF and return storage key', async () => {
            const testPdf = Buffer.from('%PDF-1.4\ntest content\n%%EOF');
            const snapshotId = 'test-snapshot-456';

            const storageKey = await pdfGenerator.storePDF(testPdf, snapshotId);

            expect(storageKey).toMatch(/^reports\/pdfs\/report-test-snapshot-456-.*\.pdf$/);

            // Verify file was created
            const filePath = path.join(process.cwd(), 'storage', storageKey);
            const exists = await fs.access(filePath).then(() => true).catch(() => false);
            expect(exists).toBe(true);

            // Clean up
            await fs.unlink(filePath).catch(() => { });
        });

        it('should retrieve stored PDF', async () => {
            const testPdf = Buffer.from('%PDF-1.4\ntest content for retrieval\n%%EOF');
            const snapshotId = 'test-snapshot-789';

            // Store PDF first
            const storageKey = await pdfGenerator.storePDF(testPdf, snapshotId);

            // Retrieve PDF
            const retrievedPdf = await pdfGenerator.retrievePDF(storageKey);

            expect(retrievedPdf).toEqual(testPdf);

            // Clean up
            await pdfGenerator.deletePDF(storageKey);
        });

        it('should handle missing PDF file gracefully', async () => {
            const nonExistentKey = 'reports/pdfs/non-existent-file.pdf';

            await expect(pdfGenerator.retrievePDF(nonExistentKey))
                .rejects.toThrow('PDF file not found');
        });
    });

    describe('File Integrity', () => {
        it('should generate consistent checksums', () => {
            const testData = Buffer.from('test data for checksum');

            const checksum1 = pdfGenerator.generateFileChecksum(testData);
            const checksum2 = pdfGenerator.generateFileChecksum(testData);

            expect(checksum1).toBe(checksum2);
            expect(checksum1).toHaveLength(64); // SHA-256 hex string
        });

        it('should verify file integrity correctly', () => {
            const testData = Buffer.from('test data for integrity check');
            const checksum = pdfGenerator.generateFileChecksum(testData);

            const isValid = pdfGenerator.verifyFileIntegrity(testData, checksum);
            expect(isValid).toBe(true);

            const isInvalid = pdfGenerator.verifyFileIntegrity(testData, 'wrong-checksum');
            expect(isInvalid).toBe(false);
        });
    });

    describe('Download Response', () => {
        it('should create proper download response', () => {
            const testPdf = Buffer.from('%PDF-1.4\ntest content\n%%EOF');
            const filename = 'test-report.pdf';

            const response = pdfGenerator.createDownloadResponse(testPdf, filename);

            expect(response.buffer).toBe(testPdf);
            expect(response.headers['Content-Type']).toBe('application/pdf');
            expect(response.headers['Content-Disposition']).toBe(`attachment; filename="${filename}"`);
            expect(response.headers['Content-Length']).toBe(testPdf.length.toString());
            expect(response.metadata.size).toBe(testPdf.length);
            expect(response.metadata.mimeType).toBe('application/pdf');
            expect(response.metadata.checksum).toHaveLength(64);
        });
    });

    describe('Sharing Metadata', () => {
        it('should create sharing metadata with expiration', () => {
            const snapshotId = 'test-snapshot';
            const storageKey = 'reports/pdfs/test.pdf';
            const expirationHours = 48;

            const sharing = pdfGenerator.createSharingMetadata(snapshotId, storageKey, expirationHours);

            expect(sharing.shareId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
            expect(sharing.expiresAt.getTime()).toBeGreaterThan(Date.now());
            expect(sharing.accessUrl).toBe(`/api/reports/download/${sharing.shareId}`);
            expect(sharing.securityToken).toHaveLength(32);
        });
    });

    describe('Integrated Export Flow', () => {
        it('should complete full export workflow successfully', async () => {
            const result = await pdfGenerator.exportClientReadyPDF(mockSnapshot, 'test-user', {
                validateQuality: true,
                enableSharing: true,
                sharingExpirationHours: 24
            });

            // Debug logging
            if (!result.success) {
                console.log('Export failed. Errors:', result.errors);
                console.log('Validation:', result.validation);
            }

            expect(result.success).toBe(true);
            expect(result.pdf).toBeInstanceOf(Buffer);
            expect(result.storageKey).toMatch(/^reports\/pdfs\/report-.*\.pdf$/);
            expect(result.validation?.isValid).toBe(true);
            expect(result.sharing?.shareId).toBeDefined();
            expect(result.metadata.snapshotId).toBe(mockSnapshot.id);
            expect(result.metadata.checksum).toHaveLength(64);

            // Clean up
            if (result.storageKey) {
                await pdfGenerator.deletePDF(result.storageKey);
            }
        });

        it('should handle validation failures gracefully', async () => {
            // Mock PDF generation to return invalid PDF
            const originalExportToPDF = pdfGenerator.exportToPDF;
            pdfGenerator.exportToPDF = jest.fn().mockResolvedValue(Buffer.from('invalid'));

            const result = await pdfGenerator.exportClientReadyPDF(mockSnapshot, 'test-user', {
                validateQuality: true
            });

            expect(result.success).toBe(false);
            expect(result.validation?.isValid).toBe(false);
            expect(result.errors).toBeDefined();

            // Restore original method
            pdfGenerator.exportToPDF = originalExportToPDF;
        });
    });
});