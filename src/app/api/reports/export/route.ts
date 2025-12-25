import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { ReportSnapshotService } from '@/services/reports/ReportSnapshotService';
import { PDFGenerator } from '@/services/reports/PDFGenerator';
import { ExportRequest } from '@/types/reports';
import { UserRole } from '@/types';

/**
 * POST /api/reports/export - Export report as PDF with snapshot creation
 * 
 * Requirements: 8.1, 8.5 - PDF export with snapshot integration
 * 
 * Access Control: Super Admin and Security Analyst roles only
 * 
 * Request Body:
 * - reportId: ID of the report to export (required)
 * - format: Export format, currently only 'pdf' (required)
 * 
 * Response: PDF file stream or download URL from snapshot
 */
export async function POST(request: NextRequest) {
    try {
        // Apply authentication middleware
        const authResult = await authMiddleware(request);
        if (!authResult.success || !authResult.user) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: authResult.error || 'Authentication required',
                    },
                },
                { status: 401 }
            );
        }

        const { user } = authResult;

        // Check role-based access (Super Admin or Security Analyst only)
        if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.SECURITY_ANALYST) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Access denied. PDF export is available to Super Admin and Security Analyst roles only.',
                    },
                },
                { status: 403 }
            );
        }

        // Apply tenant middleware
        const tenantResult = await tenantMiddleware(request, user);
        if (!tenantResult.success || !tenantResult.tenant) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'TENANT_ERROR',
                        message: tenantResult.error?.message || 'Tenant validation failed',
                    },
                },
                { status: 403 }
            );
        }

        // Parse request body
        let exportRequest: ExportRequest;
        try {
            exportRequest = await request.json();
        } catch (error) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid JSON in request body',
                    },
                },
                { status: 400 }
            );
        }

        // Validate required fields
        if (!exportRequest.reportId) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'reportId is required',
                    },
                },
                { status: 400 }
            );
        }

        if (!exportRequest.format) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'format is required',
                    },
                },
                { status: 400 }
            );
        }

        // Validate format (currently only PDF supported)
        if (exportRequest.format !== 'pdf') {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Only PDF format is currently supported',
                    },
                },
                { status: 400 }
            );
        }

        // Initialize services
        const snapshotService = new ReportSnapshotService();
        const pdfGenerator = new PDFGenerator();

        // Check if snapshot already exists for this report
        const snapshot = await snapshotService.getSnapshotByReportId(exportRequest.reportId);

        if (!snapshot) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'REPORT_NOT_FOUND',
                        message: 'Report not found or no snapshot available. Please generate the report first.',
                    },
                },
                { status: 404 }
            );
        }

        // Validate tenant access to the snapshot
        if (snapshot.tenantId !== tenantResult.tenant.id && user.role !== UserRole.SUPER_ADMIN) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Access denied to this report snapshot',
                    },
                },
                { status: 403 }
            );
        }

        // Check if PDF already exists for this snapshot
        if (snapshot.pdfStorageKey) {
            // PDF already exists, return download information
            return NextResponse.json({
                success: true,
                data: {
                    snapshotId: snapshot.id,
                    downloadUrl: `/api/reports/snapshots/${snapshot.id}/download`,
                    pdfSize: snapshot.pdfSize,
                    cached: true,
                },
                meta: {
                    exportFormat: 'pdf',
                    tenantId: tenantResult.tenant.id,
                    exportedAt: snapshot.generatedAt.toISOString(),
                    exportedBy: snapshot.generatedBy,
                },
            });
        }

        // Generate PDF from snapshot
        try {
            const pdfBuffer = await pdfGenerator.exportToPDF(snapshot);

            // Validate PDF output
            const validationResult = await pdfGenerator.validatePDFOutput(pdfBuffer);
            if (!validationResult.isValid) {
                throw new Error(`PDF validation failed: ${validationResult.errors.join(', ')}`);
            }

            // Store PDF and update snapshot
            const storageKey = await pdfGenerator.storePDF(pdfBuffer, snapshot.id);

            // Update snapshot with PDF information
            await snapshotService.updateSnapshotPDF(snapshot.id, storageKey, pdfBuffer.length);

            // Return success response with download information
            return NextResponse.json({
                success: true,
                data: {
                    snapshotId: snapshot.id,
                    downloadUrl: `/api/reports/snapshots/${snapshot.id}/download`,
                    pdfSize: pdfBuffer.length,
                    cached: false,
                },
                meta: {
                    exportFormat: 'pdf',
                    tenantId: tenantResult.tenant.id,
                    exportedAt: new Date().toISOString(),
                    exportedBy: user.user_id,
                    processingTime: 'completed',
                },
            });

        } catch (pdfError) {
            console.error('PDF generation error:', pdfError);

            // Handle specific PDF generation errors
            if (pdfError instanceof Error) {
                if (pdfError.message.includes('validation failed')) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: {
                                code: 'PDF_VALIDATION_ERROR',
                                message: 'Generated PDF failed quality validation',
                                details: { originalError: pdfError.message },
                            },
                        },
                        { status: 422 }
                    );
                }

                if (pdfError.message.includes('storage')) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: {
                                code: 'STORAGE_ERROR',
                                message: 'Failed to store PDF file',
                                retryable: true,
                            },
                        },
                        { status: 503 }
                    );
                }

                if (pdfError.message.includes('timeout')) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: {
                                code: 'PDF_TIMEOUT',
                                message: 'PDF generation timed out. Please try again.',
                                retryable: true,
                            },
                        },
                        { status: 504 }
                    );
                }
            }

            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'PDF_GENERATION_ERROR',
                        message: 'Failed to generate PDF',
                        retryable: true,
                    },
                },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error('Error in POST /api/reports/export:', error);

        // Handle general errors
        if (error instanceof Error) {
            if (error.message.includes('snapshot not found')) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'SNAPSHOT_NOT_FOUND',
                            message: 'Report snapshot not found',
                        },
                    },
                    { status: 404 }
                );
            }

            if (error.message.includes('tenant not found')) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'TENANT_NOT_FOUND',
                            message: 'Tenant data not found',
                        },
                    },
                    { status: 404 }
                );
            }
        }

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to export report',
                },
            },
            { status: 500 }
        );
    }
}