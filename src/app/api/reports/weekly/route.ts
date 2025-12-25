import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { createReportGenerator } from '@/services/reports/ReportGenerator';
import { EnhancedDateRange, WeeklyReportRequest } from '@/types/reports';
import { UserRole } from '@/types';

/**
 * GET /api/reports/weekly - Generate weekly security report
 * 
 * Requirements: 1.1, 1.3 - Weekly report generation with tenant isolation
 * 
 * Access Control: Super Admin and Security Analyst roles only
 * 
 * Query Parameters:
 * - startDate: Start date in ISO 8601 format (required)
 * - endDate: End date in ISO 8601 format (required)
 * - timezone: IANA timezone (optional, defaults to UTC)
 * 
 * Response: WeeklyReport object with slides and data
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
                        message: 'Access restricted. Executive reports are available to authorized personnel only.',
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
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');
        const timezoneParam = searchParams.get('timezone') || 'UTC';

        // Validate required parameters
        if (!startDateParam || !endDateParam) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Both startDate and endDate parameters are required',
                    },
                },
                { status: 400 }
            );
        }

        // Parse and validate dates
        const startDate = new Date(startDateParam);
        const endDate = new Date(endDateParam);

        if (isNaN(startDate.getTime())) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid startDate format. Must be ISO 8601 format (e.g., 2024-01-01T00:00:00Z)',
                    },
                },
                { status: 400 }
            );
        }

        if (isNaN(endDate.getTime())) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid endDate format. Must be ISO 8601 format (e.g., 2024-01-01T23:59:59Z)',
                    },
                },
                { status: 400 }
            );
        }

        // Validate date range
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

        // Validate date range is not too large (max 7 days for weekly reports)
        const daysDifference = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDifference > 7) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Date range for weekly reports cannot exceed 7 days',
                    },
                },
                { status: 400 }
            );
        }

        // Validate timezone
        try {
            Intl.DateTimeFormat(undefined, { timeZone: timezoneParam });
        } catch (error) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `Invalid timezone: ${timezoneParam}. Must be a valid IANA timezone (e.g., America/Toronto)`,
                    },
                },
                { status: 400 }
            );
        }

        // Create enhanced date range
        const dateRange: EnhancedDateRange = {
            startDate,
            endDate,
            timezone: timezoneParam,
            weekStart: 'monday' // Locked to Monday start for ISO week
        };

        // Generate weekly report
        const reportGenerator = await createReportGenerator();
        const weeklyReport = await reportGenerator.generateWeeklyReport(
            tenantResult.tenant.id,
            dateRange,
            user.user_id
        );

        // Return successful response
        return NextResponse.json({
            success: true,
            data: weeklyReport,
            meta: {
                reportType: 'weekly',
                tenantId: tenantResult.tenant.id,
                dateRange: {
                    startDate: startDateParam,
                    endDate: endDateParam,
                    timezone: timezoneParam,
                },
                generatedAt: new Date().toISOString(),
                generatedBy: user.user_id,
            },
        });

    } catch (error) {
        console.error('Error in GET /api/reports/weekly:', error);

        // Handle specific report generation errors
        if (error instanceof Error) {
            if (error.message.includes('insufficient data')) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'INSUFFICIENT_DATA',
                            message: 'Insufficient data available for the specified date range',
                            details: { originalError: error.message },
                        },
                    },
                    { status: 422 }
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
                    message: 'Failed to generate weekly report',
                },
            },
            { status: 500 }
        );
    }
}