import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { createReportGenerator } from '@/services/reports/ReportGenerator';
import { EnhancedDateRange, MonthlyReportRequest } from '@/types/reports';
import { UserRole } from '@/types';

/**
 * GET /api/reports/monthly - Generate monthly security report
 * 
 * Requirements: 1.1, 1.3 - Monthly report generation with tenant isolation
 * 
 * Access Control: Super Admin and Security Analyst roles only
 * 
 * Query Parameters:
 * - month: Month in YYYY-MM format (required)
 * - year: Year as number (required)
 * - timezone: IANA timezone (optional, defaults to UTC)
 * 
 * Response: MonthlyReport object with slides, trends, and data
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
        const monthParam = searchParams.get('month');
        const yearParam = searchParams.get('year');
        const timezoneParam = searchParams.get('timezone') || 'UTC';

        // Validate required parameters
        if (!monthParam || !yearParam) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Both month (YYYY-MM) and year parameters are required',
                    },
                },
                { status: 400 }
            );
        }

        // Validate month format (YYYY-MM)
        const monthRegex = /^\d{4}-\d{2}$/;
        if (!monthRegex.test(monthParam)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Month must be in YYYY-MM format (e.g., 2024-01)',
                    },
                },
                { status: 400 }
            );
        }

        // Parse and validate year
        const year = parseInt(yearParam);
        if (isNaN(year) || year < 2020 || year > new Date().getFullYear() + 1) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `Invalid year: ${yearParam}. Must be between 2020 and ${new Date().getFullYear() + 1}`,
                    },
                },
                { status: 400 }
            );
        }

        // Parse month and validate consistency with year parameter
        const [monthYear, monthNumber] = monthParam.split('-');
        if (parseInt(monthYear) !== year) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Year in month parameter must match year parameter',
                    },
                },
                { status: 400 }
            );
        }

        const month = parseInt(monthNumber);
        if (month < 1 || month > 12) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Month must be between 01 and 12',
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

        // Calculate start and end dates for the month
        const startDate = new Date(year, month - 1, 1); // month - 1 because Date constructor uses 0-based months
        const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of the month

        // Validate that the month is not in the future
        const now = new Date();
        if (startDate > now) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Cannot generate reports for future months',
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

        // Generate monthly report
        const reportGenerator = await createReportGenerator();
        const monthlyReport = await reportGenerator.generateMonthlyReport(
            tenantResult.tenant.id,
            dateRange
        );

        // Return successful response
        return NextResponse.json({
            success: true,
            data: monthlyReport,
            meta: {
                reportType: 'monthly',
                tenantId: tenantResult.tenant.id,
                dateRange: {
                    month: monthParam,
                    year: year,
                    timezone: timezoneParam,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                },
                generatedAt: new Date().toISOString(),
                generatedBy: user.user_id,
            },
        });

    } catch (error) {
        console.error('Error in GET /api/reports/monthly:', error);

        // Handle specific report generation errors
        if (error instanceof Error) {
            if (error.message.includes('insufficient data')) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'INSUFFICIENT_DATA',
                            message: 'Insufficient data available for the specified month',
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

            if (error.message.includes('performance')) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'PERFORMANCE_ERROR',
                            message: 'Report generation taking longer than expected. Please try again or contact support.',
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
                    message: 'Failed to generate monthly report',
                },
            },
            { status: 500 }
        );
    }
}