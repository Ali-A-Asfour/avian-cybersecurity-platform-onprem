import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { ReportSnapshotService } from '@/services/reports/ReportSnapshotService';
import { SnapshotFilters, EnhancedDateRange } from '@/types/reports';
import { UserRole } from '@/types';

/**
 * GET /api/reports/snapshots - List report snapshots with role-based access
 * 
 * Requirements: audit compliance, access control
 * 
 * Access Control: Super Admin and Security Analyst roles only
 * 
 * Query Parameters:
 * - reportType: Filter by report type (weekly, monthly, quarterly) (optional)
 * - startDate: Filter by start date (ISO 8601 format) (optional)
 * - endDate: Filter by end date (ISO 8601 format) (optional)
 * - generatedBy: Filter by user ID who generated the report (optional)
 * - isArchived: Filter by archived status (true/false) (optional)
 * - page: Page number for pagination (default: 1) (optional)
 * - pageSize: Number of results per page (default: 20, max: 100) (optional)
 * 
 * Response: List of snapshots with audit trail information
 */
export async function GET(request: NextRequest) {
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
                        message: 'Access denied. Snapshot access is available to Super Admin and Security Analyst roles only.',
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

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const reportType = searchParams.get('reportType') as 'weekly' | 'monthly' | 'quarterly' | null;
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');
        const generatedBy = searchParams.get('generatedBy');
        const isArchivedParam = searchParams.get('isArchived');
        const pageParam = searchParams.get('page') || '1';
        const pageSizeParam = searchParams.get('pageSize') || '20';

        // Validate reportType if provided
        if (reportType && !['weekly', 'monthly', 'quarterly'].includes(reportType)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'reportType must be one of: weekly, monthly, quarterly',
                    },
                },
                { status: 400 }
            );
        }

        // Parse and validate pagination parameters
        const page = parseInt(pageParam);
        const pageSize = parseInt(pageSizeParam);

        if (isNaN(page) || page < 1) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Page must be a positive number',
                    },
                },
                { status: 400 }
            );
        }

        if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Page size must be between 1 and 100',
                    },
                },
                { status: 400 }
            );
        }

        // Parse date parameters
        let dateRange: EnhancedDateRange | undefined;
        if (startDateParam || endDateParam) {
            if (!startDateParam || !endDateParam) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Both startDate and endDate must be provided when filtering by date range',
                        },
                    },
                    { status: 400 }
                );
            }

            const startDate = new Date(startDateParam);
            const endDate = new Date(endDateParam);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Invalid date format. Must be ISO 8601 format (e.g., 2024-01-01T00:00:00Z)',
                        },
                    },
                    { status: 400 }
                );
            }

            if (startDate >= endDate) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'startDate must be before endDate',
                        },
                    },
                    { status: 400 }
                );
            }

            dateRange = {
                startDate,
                endDate,
                timezone: 'UTC',
                weekStart: 'monday'
            };
        }

        // Parse isArchived parameter
        let isArchived: boolean | undefined;
        if (isArchivedParam !== null) {
            if (isArchivedParam === 'true') {
                isArchived = true;
            } else if (isArchivedParam === 'false') {
                isArchived = false;
            } else {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'isArchived parameter must be "true" or "false"',
                        },
                    },
                    { status: 400 }
                );
            }
        }

        // Build filters
        const filters: SnapshotFilters = {};
        if (reportType) filters.reportType = reportType;
        if (dateRange) filters.dateRange = dateRange;
        if (generatedBy) filters.generatedBy = generatedBy;
        if (isArchived !== undefined) filters.isArchived = isArchived;

        // Get snapshots using ReportSnapshotService
        const snapshotService = new ReportSnapshotService();

        // For non-super-admin users, filter by their tenant
        const tenantId = user.role === UserRole.SUPER_ADMIN ? undefined : tenantResult.tenant.id;

        const snapshotList = await snapshotService.listSnapshots(
            tenantId,
            filters,
            page,
            pageSize
        );

        // Return snapshots with audit trail information
        return NextResponse.json({
            success: true,
            data: snapshotList.snapshots,
            meta: {
                totalCount: snapshotList.totalCount,
                page,
                pageSize,
                totalPages: Math.ceil(snapshotList.totalCount / pageSize),
                filters: {
                    reportType: reportType || null,
                    dateRange: dateRange ? {
                        startDate: startDateParam,
                        endDate: endDateParam,
                    } : null,
                    generatedBy: generatedBy || null,
                    isArchived: isArchived !== undefined ? isArchived : null,
                },
                accessLevel: user.role,
                tenantScope: user.role === UserRole.SUPER_ADMIN ? 'all' : tenantResult.tenant.id,
            },
        });

    } catch (error) {
        console.error('Error in GET /api/reports/snapshots:', error);

        // Handle specific errors
        if (error instanceof Error) {
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

            if (error.message.includes('database')) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'DATABASE_ERROR',
                            message: 'Failed to retrieve snapshots from database',
                        },
                    },
                    { status: 503 }
                );
            }
        }

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve report snapshots',
                },
            },
            { status: 500 }
        );
    }
}