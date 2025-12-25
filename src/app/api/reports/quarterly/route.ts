import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { createReportGenerator } from '@/services/reports/ReportGenerator';
import { EnhancedDateRange, QuarterlyReportRequest } from '@/types/reports';
import { UserRole } from '@/types';

/**
 * GET /api/reports/quarterly - Generate quarterly security report
 * 
 * Requirements: 1.1, 1.3 - Quarterly report generation with tenant isolation
 * 
 * Access Control: Super Admin and Security Analyst roles only
 * 
 * Query Parameters:
 * - quarter: Quarter number (1, 2, 3, or 4) (required)
 * - year: Year as number (required)
 * - timezone: IANA timezone (optional, defaults to UTC)
 * 
 * Response: QuarterlyReport object with business-focused slides and executive summary
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
        const quarterParam = searchParams.get('quarter');
        const yearParam = searchParams.get('year');
        const timezoneParam = searchParams.get('timezone') || 'UTC';

        // Validate required parameters
        if (!quarterParam || !yearParam) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Both quarter (1-4) and year parameters are required',
                    },
                },
                { status: 400 }
            );
        }

        // Parse and validate quarter
        const quarter = parseInt(quarterParam);
        if (isNaN(quarter) || quarter < 1 || quarter > 4) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Quarter must be 1, 2, 3, or 4',
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

        // Calculate start and end dates for the quarter
        const quarterStartMonth = (quarter - 1) * 3; // Q1: 0 (Jan), Q2: 3 (Apr), Q3: 6 (Jul), Q4: 9 (Oct)
        const startDate = new Date(year, quarterStartMonth, 1);
        const endDate = new Date(year, quarterStartMonth + 3, 0, 23, 59, 59, 999); // Last day of quarter

        // Validate that the quarter is not in the future
        const now = new Date();
        if (startDate > now) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Cannot generate reports for future quarters',
                    },
                },
                { status: 400 }
            );
        }

        // Performance optimization: Check if this is a large dataset request
        const quarterLength = endDate.getTime() - startDate.getTime();
        const isLargeDataset = quarterLength > (90 * 24 * 60 * 60 * 1000); // More than 90 days

        if (isLargeDataset) {
            // Add performance headers for large datasets
            const response = NextResponse.json({
                success: true,
                message: 'Large dataset detected. Report generation may take longer than usual.',
                estimatedTime: '30-60 seconds',
            });
            response.headers.set('X-Processing-Time-Estimate', '30-60');
            response.headers.set('X-Dataset-Size', 'large');
        }

        // Create enhanced date range
        const dateRange: EnhancedDateRange = {
            startDate,
            endDate,
            timezone: timezoneParam,
            weekStart: 'monday' // Locked to Monday start for ISO week
        };

        // Generate quarterly report with performance optimization
        const reportGenerator = await createReportGenerator();

        // Set timeout for large datasets
        const timeoutMs = isLargeDataset ? 120000 : 60000; // 2 minutes for large datasets, 1 minute for normal

        const quarterlyReportPromise = reportGenerator.generateQuarterlyReport(
            tenantResult.tenant.id,
            dateRange
        );

        // Add timeout wrapper
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Report generation timeout')), timeoutMs);
        });

        const quarterlyReport = await Promise.race([
            quarterlyReportPromise,
            timeoutPromise
        ]);

        // Return successful response
        return NextResponse.json({
            success: true,
            data: quarterlyReport,
            meta: {
                reportType: 'quarterly',
                tenantId: tenantResult.tenant.id,
                dateRange: {
                    quarter: quarter,
                    year: year,
                    timezone: timezoneParam,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString(),
                },
                generatedAt: new Date().toISOString(),
                generatedBy: user.user_id,
                performance: {
                    datasetSize: isLargeDataset ? 'large' : 'normal',
                    processingTime: isLargeDataset ? 'extended' : 'standard',
                },
            },
        });

    } catch (error) {
        console.error('Error in GET /api/reports/quarterly:', error);

        // Handle specific report generation errors
        if (error instanceof Error) {
            if (error.message.includes('timeout')) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'TIMEOUT_ERROR',
                            message: 'Report generation timed out due to large dataset. Please try again or contact support for assistance.',
                            retryable: true,
                        },
                    },
                    { status: 504 }
                );
            }

            if (error.message.includes('insufficient data')) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'INSUFFICIENT_DATA',
                            message: 'Insufficient data available for the specified quarter',
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

            if (error.message.includes('performance') || error.message.includes('memory')) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'PERFORMANCE_ERROR',
                            message: 'Report generation requires more resources than available. Please try again during off-peak hours or contact support.',
                            retryable: true,
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
                    message: 'Failed to generate quarterly report',
                },
            },
            { status: 500 }
        );
    }
}