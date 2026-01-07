import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { ReportSnapshotService } from '@/services/reports/ReportSnapshotService';
import { PDFGenerator } from '@/services/reports/PDFGenerator';
import { UserRole } from '@/types';

/**
 * GET /api/reports/snapshots/[snapshotId]/download - Download PDF from snapshot
 * 
 * Requirements: audit compliance, access control - Re-delivery capability
 * 
 * Access Control: Super Admin and Security Analyst roles only
 * 
 * Path Parameters:
 * - snapshotId: ID of the snapshot to download (required)
 * 
 * Response: PDF file stream for download
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { snapshotId: string } }
) {
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
                        message: 'Access denied. Snapshot download is available to Super Admin and Security Analyst roles only.',
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

        // Validate snapshotId parameter
        const { snapshotId } = params;
        if (!snapshotId) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'snapshotId parameter is required',
                    },
                },
                { status: 400 }
            );
        }

        // Get snapshot
        const snapshotService = new ReportSnapshotService();
        const snapshot = await snapshotService.getSnapshot(snapshotId, user.user_id, tenantResult.tenant.id);

        if (!snapshot) {
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

        // Check if PDF exists for this snapshot
        if (!snapshot.pdfStorageKey) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'PDF_NOT_AVAILABLE',
                        message: 'PDF not available for this snapshot. Please export the report first.',
                    },
                },
                { status: 404 }
            );
        }

        // Get PDF from storage
        const pdfGenerator = new PDFGenerator();
        let pdfBuffer: Buffer;

        try {
            pdfBuffer = await pdfGenerator.getPDFFromStorage(snapshot.pdfStorageKey);
        } catch (storageError) {
            console.error('PDF storage retrieval error:', storageError);
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'PDF_RETRIEVAL_ERROR',
                        message: 'Failed to retrieve PDF from storage',
                    },
                },
                { status: 503 }
            );
        }

        // Validate PDF integrity
        try {
            const validationResult = await pdfGenerator.validatePDFOutput(pdfBuffer);
            if (!validationResult.isValid) {
                console.error('PDF validation failed:', validationResult.errors);
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'PDF_CORRUPTED',
                            message: 'Stored PDF file is corrupted. Please re-export the report.',
                        },
                    },
                    { status: 422 }
                );
            }
        } catch (validationError) {
            console.error('PDF validation error:', validationError);
            // Continue with download even if validation fails (non-critical)
        }

        // Generate filename
        const reportTypeLabel = snapshot.reportType.charAt(0).toUpperCase() + snapshot.reportType.slice(1);
        const dateLabel = snapshot.dateRange.startDate.toISOString().split('T')[0];
        const filename = `AVIAN_${reportTypeLabel}_Report_${dateLabel}_${snapshot.id.slice(0, 8)}.pdf`;

        // Log download for audit trail
        console.log('PDF download:', {
            snapshotId: snapshot.id,
            userId: user.user_id,
            tenantId: snapshot.tenantId,
            reportType: snapshot.reportType,
            downloadedAt: new Date().toISOString(),
            filename,
        });

        // Return PDF as downloadable file
        return new NextResponse(pdfBuffer as BodyInit, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': pdfBuffer.length.toString(),
                'Cache-Control': 'private, no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                // Audit headers
                'X-Snapshot-Id': snapshot.id,
                'X-Report-Type': snapshot.reportType,
                'X-Generated-At': snapshot.generatedAt.toISOString(),
                'X-Downloaded-By': user.user_id,
                'X-Tenant-Id': snapshot.tenantId,
            },
        });

    } catch (error) {
        console.error('Error in GET /api/reports/snapshots/[snapshotId]/download:', error);

        // Handle specific errors
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

            if (error.message.includes('storage')) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'STORAGE_ERROR',
                            message: 'Failed to access PDF storage',
                        },
                    },
                    { status: 503 }
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
                    message: 'Failed to download report PDF',
                },
            },
            { status: 500 }
        );
    }
}