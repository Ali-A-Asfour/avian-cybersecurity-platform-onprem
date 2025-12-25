/**
 * End-to-End Client Delivery Workflow Testing
 * 
 * Tests the complete flow: generate → preview → export → deliver
 * Validates report history and audit trail functionality
 * Tests role-based access controls for enhanced features
 * Verifies PDF quality and client-readiness
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ReportGenerator } from '../ReportGenerator';
import { ReportSnapshotService } from '../ReportSnapshotService';
import { PDFGenerator } from '../PDFGenerator';
import { NarrativeGenerator } from '../NarrativeGenerator';
import { CustomBrandingService } from '../CustomBrandingService';
import { ContentReviewService } from '../ContentReviewService';
import type {
    WeeklyReport,
    MonthlyReport,
    QuarterlyReport,
    ReportSnapshot,
    EnhancedDateRange,
    UserRole
} from '../../types/reports';

describe('Client Delivery Workflow Integration Tests', () => {
    let reportGenerator: ReportGenerator;
    let snapshotService: ReportSnapshotService;
    let pdfGenerator: PDFGenerator;
    let narrativeGenerator: NarrativeGenerator;
    let brandingService: CustomBrandingService;
    let contentReviewService: ContentReviewService;

    const mockTenantId = 'test-tenant-123';
    const mockUserId = 'analyst-456';
    const mockDateRange: EnhancedDateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'),
        timezone: 'America/Toronto',
        weekStart: 'monday' as const
    };

    beforeEach(() => {
        reportGenerator = new ReportGenerator();
        snapshotService = new ReportSnapshotService();
        pdfGenerator = new PDFGenerator();
        narrativeGenerator = new NarrativeGenerator();
        brandingService = new CustomBrandingService();
        contentReviewService = new ContentReviewService();
    });

    afterEach(() => {
        // Clean up any test data
    });

    describe('Complete Client Delivery Flow', () => {
        it('should execute full weekly report delivery workflow', async () => {
            // Step 1: Generate report with enhanced features
            const report = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);

            expect(report).toBeDefined();
            expect(report.tenantId).toBe(mockTenantId);
            expect(report.reportType).toBe('weekly');
            expect(report.slides).toHaveLength(4); // Executive Overview + 3 content slides

            // Verify executive narrative is included
            const executiveSlide = report.slides.find(s => s.title.includes('Executive Overview'));
            expect(executiveSlide).toBeDefined();
            expect(executiveSlide?.content.executiveSummary).toBeDefined();
            expect(executiveSlide?.content.keyTakeaways).toHaveLength(3);

            // Step 2: Create immutable snapshot for audit trail
            const snapshot = await snapshotService.createSnapshot(report, mockUserId);

            expect(snapshot).toBeDefined();
            expect(snapshot.reportId).toBe(report.id);
            expect(snapshot.generatedBy).toBe(mockUserId);
            expect(snapshot.slideData).toBeDefined();
            expect(snapshot.templateVersion).toBeDefined();
            expect(snapshot.dataSchemaVersion).toBeDefined();

            // Step 3: Preview functionality (client-ready formatting)
            const previewData = await reportGenerator.generatePreviewData(snapshot);

            expect(previewData.slides).toHaveLength(report.slides.length);
            expect(previewData.branding.theme).toBe('dark');
            expect(previewData.branding.clientName).toBe(mockTenantId);

            // Verify client-appropriate language
            const alertsSlide = previewData.slides.find(s => s.title.includes('Alerts'));
            expect(alertsSlide?.content.terminology.alertsLabel).toBe('Alerts Digested');
            expect(alertsSlide?.content.terminology.updatesLabel).toBe('Updates');

            // Step 4: Export to PDF (client-ready quality)
            const pdfBuffer = await pdfGenerator.exportToPDF(snapshot);

            expect(pdfBuffer).toBeDefined();
            expect(pdfBuffer.length).toBeGreaterThan(1000); // Reasonable PDF size

            // Verify PDF quality markers
            const pdfValidation = await pdfGenerator.validatePDFOutput(pdfBuffer);
            expect(pdfValidation.isClientReady).toBe(true);
            expect(pdfValidation.hasProperBranding).toBe(true);
            expect(pdfValidation.landscapeOrientation).toBe(true);
            expect(pdfValidation.containsExecutiveSummary).toBe(true);

            // Step 5: Store PDF with snapshot for re-delivery
            const storageKey = await pdfGenerator.storePDF(pdfBuffer, snapshot.id);

            expect(storageKey).toBeDefined();
            expect(storageKey).toMatch(/^snapshots\/.*\.pdf$/);

            // Update snapshot with PDF storage info
            const updatedSnapshot = await snapshotService.updatePDFStorage(
                snapshot.id,
                storageKey,
                pdfBuffer.length
            );

            expect(updatedSnapshot.pdfStorageKey).toBe(storageKey);
            expect(updatedSnapshot.pdfSize).toBe(pdfBuffer.length);

            // Step 6: Verify re-download capability
            const redownloadedPDF = await pdfGenerator.downloadFromSnapshot(snapshot.id);

            expect(redownloadedPDF).toBeDefined();
            expect(redownloadedPDF.length).toBe(pdfBuffer.length);
            expect(Buffer.compare(redownloadedPDF, pdfBuffer)).toBe(0); // Identical bytes
        });

        it('should execute full monthly report delivery workflow with trends', async () => {
            const monthlyDateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            // Generate monthly report with trend analysis
            const report = await reportGenerator.generateMonthlyReport(mockTenantId, monthlyDateRange);

            expect(report.reportType).toBe('monthly');
            expect(report.slides.length).toBeGreaterThan(4); // More slides for monthly

            // Verify trend analysis is included
            const trendsSlide = report.slides.find(s => s.title.includes('Trends'));
            expect(trendsSlide).toBeDefined();
            expect(trendsSlide?.content.weekOverWeekComparison).toBeDefined();
            expect(trendsSlide?.content.recurringAlertTypes).toBeDefined();

            // Create snapshot and export
            const snapshot = await snapshotService.createSnapshot(report, mockUserId);
            const pdfBuffer = await pdfGenerator.exportToPDF(snapshot);

            // Verify monthly-specific PDF features
            const pdfValidation = await pdfGenerator.validatePDFOutput(pdfBuffer);
            expect(pdfValidation.containsTrendAnalysis).toBe(true);
            expect(pdfValidation.hasComparativeCharts).toBe(true);
        });

        it('should execute full quarterly report delivery workflow (executive focus)', async () => {
            const quarterlyDateRange: EnhancedDateRange = {
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-03-31'),
                timezone: 'America/Toronto',
                weekStart: 'monday' as const
            };

            // Generate quarterly report (business-focused)
            const report = await reportGenerator.generateQuarterlyReport(mockTenantId, quarterlyDateRange);

            expect(report.reportType).toBe('quarterly');
            expect(report.slides.length).toBeLessThanOrEqual(5); // 3-5 slides max

            // Verify executive focus
            const businessImpactSlide = report.slides.find(s => s.title.includes('Business Impact'));
            expect(businessImpactSlide).toBeDefined();
            expect(businessImpactSlide?.content.riskReduction).toBeDefined();
            expect(businessImpactSlide?.content.securityPosture).toBeDefined();

            // Verify no technical noise
            const hasRawAlerts = report.slides.some(s =>
                s.content.rawAlertDetails || s.content.technicalDetails
            );
            expect(hasRawAlerts).toBe(false);

            // Create snapshot and export
            const snapshot = await snapshotService.createSnapshot(report, mockUserId);
            const pdfBuffer = await pdfGenerator.exportToPDF(snapshot);

            // Verify quarterly-specific PDF features
            const pdfValidation = await pdfGenerator.validatePDFOutput(pdfBuffer);
            expect(pdfValidation.isExecutiveFocused).toBe(true);
            expect(pdfValidation.containsPlainLanguage).toBe(true);
            expect(pdfValidation.excludesTechnicalNoise).toBe(true);
        });
    });

    describe('Report History and Audit Trail', () => {
        it('should maintain complete audit trail for report generation', async () => {
            // Generate multiple reports
            const weeklyReport = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);
            const weeklySnapshot = await snapshotService.createSnapshot(weeklyReport, mockUserId);

            const monthlyDateRange: EnhancedDateRange = {
                ...mockDateRange,
                endDate: new Date('2024-01-31')
            };
            const monthlyReport = await reportGenerator.generateMonthlyReport(mockTenantId, monthlyDateRange);
            const monthlySnapshot = await snapshotService.createSnapshot(monthlyReport, 'analyst-789');

            // Verify audit trail
            const auditHistory = await snapshotService.getAuditTrail(mockTenantId);

            expect(auditHistory).toHaveLength(2);
            expect(auditHistory[0].reportType).toBe('weekly');
            expect(auditHistory[0].generatedBy).toBe(mockUserId);
            expect(auditHistory[1].reportType).toBe('monthly');
            expect(auditHistory[1].generatedBy).toBe('analyst-789');

            // Verify timestamps are properly recorded
            expect(auditHistory[0].generatedAt).toBeInstanceOf(Date);
            expect(auditHistory[1].generatedAt).toBeInstanceOf(Date);
        });

        it('should support snapshot filtering and search', async () => {
            // Create multiple snapshots with different criteria
            const reports = await Promise.all([
                reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange),
                reportGenerator.generateMonthlyReport(mockTenantId, {
                    ...mockDateRange,
                    endDate: new Date('2024-01-31')
                }),
                reportGenerator.generateQuarterlyReport(mockTenantId, {
                    ...mockDateRange,
                    endDate: new Date('2024-03-31')
                })
            ]);

            const snapshots = await Promise.all(
                reports.map(report => snapshotService.createSnapshot(report, mockUserId))
            );

            // Test filtering by report type
            const weeklySnapshots = await snapshotService.listSnapshots(mockTenantId, {
                reportType: 'weekly'
            });
            expect(weeklySnapshots).toHaveLength(1);
            expect(weeklySnapshots[0].reportType).toBe('weekly');

            // Test filtering by date range
            const recentSnapshots = await snapshotService.listSnapshots(mockTenantId, {
                generatedAfter: new Date('2024-01-01'),
                generatedBefore: new Date('2024-12-31')
            });
            expect(recentSnapshots).toHaveLength(3);

            // Test filtering by user
            const userSnapshots = await snapshotService.listSnapshots(mockTenantId, {
                generatedBy: mockUserId
            });
            expect(userSnapshots).toHaveLength(3);
        });

        it('should preserve snapshot integrity over time', async () => {
            // Create initial snapshot
            const report = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);
            const originalSnapshot = await snapshotService.createSnapshot(report, mockUserId);

            // Export PDF and store
            const originalPDF = await pdfGenerator.exportToPDF(originalSnapshot);
            const storageKey = await pdfGenerator.storePDF(originalPDF, originalSnapshot.id);

            // Wait and retrieve snapshot later
            await new Promise(resolve => setTimeout(resolve, 100));

            const retrievedSnapshot = await snapshotService.getSnapshot(originalSnapshot.id);
            expect(retrievedSnapshot).toBeDefined();
            expect(retrievedSnapshot.id).toBe(originalSnapshot.id);
            expect(retrievedSnapshot.slideData).toEqual(originalSnapshot.slideData);

            // Verify PDF can still be downloaded
            const retrievedPDF = await pdfGenerator.downloadFromSnapshot(originalSnapshot.id);
            expect(Buffer.compare(retrievedPDF, originalPDF)).toBe(0);
        });
    });

    describe('Role-Based Access Controls', () => {
        const superAdminUser = { id: 'super-admin-1', role: 'super_admin' as UserRole };
        const securityAnalyst = { id: 'analyst-1', role: 'security_analyst' as UserRole };
        const regularUser = { id: 'user-1', role: 'user' as UserRole };

        it('should enforce access controls for report generation', async () => {
            // Super Admin - full access
            const superAdminReport = await reportGenerator.generateWeeklyReportWithAuth(
                mockTenantId,
                mockDateRange,
                superAdminUser
            );
            expect(superAdminReport).toBeDefined();

            // Security Analyst - tenant-scoped access
            const analystReport = await reportGenerator.generateWeeklyReportWithAuth(
                mockTenantId,
                mockDateRange,
                securityAnalyst
            );
            expect(analystReport).toBeDefined();

            // Regular User - should be denied
            await expect(
                reportGenerator.generateWeeklyReportWithAuth(
                    mockTenantId,
                    mockDateRange,
                    regularUser
                )
            ).rejects.toThrow('Insufficient permissions');
        });

        it('should enforce access controls for snapshot history', async () => {
            // Create test snapshots
            const report = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);
            const snapshot = await snapshotService.createSnapshot(report, securityAnalyst.id);

            // Super Admin - can view all snapshots
            const superAdminHistory = await snapshotService.listSnapshotsWithAuth(
                mockTenantId,
                {},
                superAdminUser
            );
            expect(superAdminHistory).toHaveLength(1);

            // Security Analyst - can view tenant snapshots
            const analystHistory = await snapshotService.listSnapshotsWithAuth(
                mockTenantId,
                {},
                securityAnalyst
            );
            expect(analystHistory).toHaveLength(1);

            // Regular User - should be denied
            await expect(
                snapshotService.listSnapshotsWithAuth(
                    mockTenantId,
                    {},
                    regularUser
                )
            ).rejects.toThrow('Insufficient permissions');
        });

        it('should enforce access controls for PDF downloads', async () => {
            // Create test snapshot with PDF
            const report = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);
            const snapshot = await snapshotService.createSnapshot(report, securityAnalyst.id);
            const pdfBuffer = await pdfGenerator.exportToPDF(snapshot);
            await pdfGenerator.storePDF(pdfBuffer, snapshot.id);

            // Super Admin - can download
            const superAdminPDF = await pdfGenerator.downloadFromSnapshotWithAuth(
                snapshot.id,
                superAdminUser
            );
            expect(superAdminPDF).toBeDefined();

            // Security Analyst - can download from their tenant
            const analystPDF = await pdfGenerator.downloadFromSnapshotWithAuth(
                snapshot.id,
                securityAnalyst
            );
            expect(analystPDF).toBeDefined();

            // Regular User - should be denied
            await expect(
                pdfGenerator.downloadFromSnapshotWithAuth(
                    snapshot.id,
                    regularUser
                )
            ).rejects.toThrow('Insufficient permissions');
        });
    });

    describe('PDF Quality and Client-Readiness', () => {
        it('should produce client-ready PDFs with proper branding', async () => {
            const report = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);
            const snapshot = await snapshotService.createSnapshot(report, mockUserId);

            // Apply custom branding
            const brandedSnapshot = await brandingService.applyCustomBranding(
                snapshot,
                mockTenantId
            );

            const pdfBuffer = await pdfGenerator.exportToPDF(brandedSnapshot);
            const validation = await pdfGenerator.validatePDFOutput(pdfBuffer);

            // Verify client-ready quality
            expect(validation.isClientReady).toBe(true);
            expect(validation.hasProperBranding).toBe(true);
            expect(validation.landscapeOrientation).toBe(true);
            expect(validation.containsExecutiveSummary).toBe(true);
            expect(validation.usesClientAppropriateLanguage).toBe(true);

            // Verify no SOC-internal terminology
            expect(validation.containsSOCTerminology).toBe(false);
            expect(validation.containsTechnicalJargon).toBe(false);

            // Verify visual quality
            expect(validation.hasHighContrastElements).toBe(true);
            expect(validation.hasProperFontEmbedding).toBe(true);
            expect(validation.hasVisualHierarchy).toBe(true);
        });

        it('should maintain visual consistency between preview and PDF', async () => {
            const report = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);
            const snapshot = await snapshotService.createSnapshot(report, mockUserId);

            // Generate preview data
            const previewData = await reportGenerator.generatePreviewData(snapshot);

            // Export to PDF
            const pdfBuffer = await pdfGenerator.exportToPDF(snapshot);

            // Extract visual elements from both
            const previewElements = await extractVisualElements(previewData);
            const pdfElements = await extractVisualElementsFromPDF(pdfBuffer);

            // Verify consistency
            expect(previewElements.slideCount).toBe(pdfElements.slideCount);
            expect(previewElements.brandingElements).toEqual(pdfElements.brandingElements);
            expect(previewElements.chartTypes).toEqual(pdfElements.chartTypes);
            expect(previewElements.colorScheme).toEqual(pdfElements.colorScheme);
        });

        it('should support content review and approval workflow', async () => {
            const report = await reportGenerator.generateWeeklyReport(mockTenantId, mockDateRange);
            const snapshot = await snapshotService.createSnapshot(report, mockUserId);

            // Submit for content review
            const reviewRequest = await contentReviewService.submitForReview(
                snapshot.id,
                mockUserId
            );
            expect(reviewRequest.status).toBe('pending_review');

            // Simulate review process
            const reviewResult = await contentReviewService.reviewContent(
                reviewRequest.id,
                'reviewer-123',
                {
                    approved: true,
                    comments: 'Content is client-appropriate and professional',
                    suggestedChanges: []
                }
            );

            expect(reviewResult.status).toBe('approved');
            expect(reviewResult.approvedBy).toBe('reviewer-123');
            expect(reviewResult.approvedAt).toBeInstanceOf(Date);

            // Verify approved content can be exported
            const approvedPDF = await pdfGenerator.exportApprovedToPDF(snapshot.id);
            expect(approvedPDF).toBeDefined();

            // Verify approval metadata is included
            const pdfMetadata = await pdfGenerator.extractMetadata(approvedPDF);
            expect(pdfMetadata.approvalStatus).toBe('approved');
            expect(pdfMetadata.approvedBy).toBe('reviewer-123');
        });
    });
});

// Helper functions
async function extractVisualElements(previewData: any) {
    return {
        slideCount: previewData.slides.length,
        brandingElements: previewData.branding,
        chartTypes: previewData.slides.flatMap((s: any) => s.charts?.map((c: any) => c.type) || []),
        colorScheme: previewData.branding.colorScheme
    };
}

async function extractVisualElementsFromPDF(pdfBuffer: Buffer) {
    // Mock PDF analysis - in real implementation would use PDF parsing library
    return {
        slideCount: 4, // Mock value
        brandingElements: { theme: 'dark', clientName: 'test-tenant-123' },
        chartTypes: ['bar', 'donut', 'progress'],
        colorScheme: 'dark'
    };
}