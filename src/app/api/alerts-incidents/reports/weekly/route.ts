/**
 * Weekly Reports API Endpoint for Alerts & Security Incidents Module
 * 
 * Provides REST API for generating and retrieving weekly reports with:
 * - Tenant-scoped data aggregation
 * - Date range filtering
 * - Report scheduling and delivery mechanisms
 * 
 * Requirements: 11.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { WeeklyReportingService, WeeklyReportFilters, AlertsIncidentsWeeklyReport } from '@/services/alerts-incidents/WeeklyReportingService';
import { ReportCacheService } from '@/services/alerts-incidents/ReportCacheService';
import { logger } from '@/lib/logger';

/**
 * GET /api/alerts-incidents/reports/weekly
 * 
 * Generate weekly report for alerts and incidents
 * 
 * Query Parameters:
 * - startDate: ISO date string (required)
 * - endDate: ISO date string (required)
 * - includeResolved: boolean (optional, default: true)
 * - includeDismissed: boolean (optional, default: true)
 */
export async function GET(request: NextRequest) {
    try {
        // Authenticate and get user context
        const authResult = await authMiddleware(request);
        if (!authResult.success || !authResult.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const tenantResult = await tenantMiddleware(request, authResult.user);
        if (!tenantResult.success || !tenantResult.tenant) {
            return NextResponse.json(
                { error: 'Forbidden', message: 'Invalid tenant access' },
                { status: 403 }
            );
        }

        const user = authResult.user;
        const tenant = tenantResult.tenant;

        const { searchParams } = new URL(request.url);
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');
        const includeResolved = searchParams.get('includeResolved') !== 'false';
        const includeDismissed = searchParams.get('includeDismissed') !== 'false';

        // Validate required parameters
        if (!startDateParam || !endDateParam) {
            return NextResponse.json(
                {
                    error: 'Bad Request',
                    message: 'startDate and endDate parameters are required'
                },
                { status: 400 }
            );
        }

        // Parse and validate dates
        let startDate: Date;
        let endDate: Date;

        try {
            startDate = new Date(startDateParam);
            endDate = new Date(endDateParam);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                throw new Error('Invalid date format');
            }
        } catch (error) {
            return NextResponse.json(
                {
                    error: 'Bad Request',
                    message: 'Invalid date format. Use ISO date strings (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)'
                },
                { status: 400 }
            );
        }

        // Create filters
        const filters: WeeklyReportFilters = {
            tenantId: tenant.id,
            startDate,
            endDate,
            includeResolved,
            includeDismissed,
        };

        // Validate inputs
        try {
            WeeklyReportingService.validateReportInputs(filters);
        } catch (validationError) {
            return NextResponse.json(
                {
                    error: 'Bad Request',
                    message: validationError instanceof Error ? validationError.message : 'Invalid input parameters'
                },
                { status: 400 }
            );
        }

        // Check cache first for performance optimization
        const cacheParams = {
            reportType: 'weekly' as const,
            tenantId: tenant.id,
            startDate,
            endDate,
            options: { includeResolved, includeDismissed },
        };

        let report: AlertsIncidentsWeeklyReport | null = null;

        try {
            report = await ReportCacheService.getCachedReport<AlertsIncidentsWeeklyReport>(cacheParams);
        } catch (cacheError) {
            logger.warn('Cache lookup failed, proceeding with report generation', cacheError instanceof Error ? cacheError : new Error(String(cacheError)));
            // Continue with report generation even if cache fails
        }

        if (!report) {
            // Generate report if not cached
            const startTime = Date.now();
            const generatedReport = await WeeklyReportingService.generateWeeklyReport(
                filters,
                user.user_id
            ) as AlertsIncidentsWeeklyReport;
            report = generatedReport;
            const generationTime = Date.now() - startTime;

            // Cache the report for future requests
            const reportSize = JSON.stringify(report).length;
            if (ReportCacheService.shouldCacheReport(reportSize, generationTime)) {
                try {
                    await ReportCacheService.setCachedReport(cacheParams, report);
                } catch (cacheError) {
                    logger.warn('Failed to cache report, but continuing', cacheError instanceof Error ? cacheError : new Error(String(cacheError)));
                    // Don't fail the request if caching fails
                }
            }

            logger.info('Weekly report generated via API (not cached)', {
                reportId: report.id,
                tenantId: tenant.id,
                userId: user.user_id,
                generationTime,
                reportSize,
            });
        } else {
            logger.info('Weekly report served from cache', {
                reportId: report.id,
                tenantId: tenant.id,
                userId: user.user_id,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                alertsDigested: report.alertsDigested,
                alertsEscalated: report.alertsEscalated,
            });

        }

        if (!report) {
            return NextResponse.json(
                {
                    error: 'Internal Server Error',
                    message: 'Failed to generate report'
                },
                { status: 500 }
            );
        }

        return NextResponse.json(report);

    } catch (error) {
        logger.error('Failed to generate weekly report via API', error instanceof Error ? error : new Error(String(error)));

        // Handle specific error types
        if (error instanceof Error) {
            if (error.message.includes('Database connection')) {
                return NextResponse.json(
                    {
                        error: 'Service Unavailable',
                        message: 'Database service is temporarily unavailable'
                    },
                    { status: 503 }
                );
            }

            if (error.message.includes('Tenant ID') || error.message.includes('unauthorized')) {
                return NextResponse.json(
                    {
                        error: 'Forbidden',
                        message: 'Access denied for this tenant'
                    },
                    { status: 403 }
                );
            }
        }

        return NextResponse.json(
            {
                error: 'Internal Server Error',
                message: 'An unexpected error occurred while generating the report'
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/alerts-incidents/reports/weekly
 * 
 * Generate weekly report with custom configuration
 * 
 * Request Body:
 * {
 *   "dateRange": {
 *     "startDate": "2024-01-01T00:00:00.000Z",
 *     "endDate": "2024-01-07T23:59:59.999Z"
 *   },
 *   "options": {
 *     "includeResolved": true,
 *     "includeDismissed": true
 *   },
 *   "delivery": {
 *     "method": "email" | "dashboard" | "both",
 *     "recipients": ["user@example.com"]
 *   }
 * }
 */
export async function POST(request: NextRequest) {
    try {
        // Authenticate and get user context
        const authResult = await authMiddleware(request);
        if (!authResult.success || !authResult.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const tenantResult = await tenantMiddleware(request, authResult.user);
        if (!tenantResult.success || !tenantResult.tenant) {
            return NextResponse.json(
                { error: 'Forbidden', message: 'Invalid tenant access' },
                { status: 403 }
            );
        }

        const user = authResult.user;
        const tenant = tenantResult.tenant;

        // Parse request body
        let body;
        try {
            body = await request.json();
        } catch (error) {
            return NextResponse.json(
                {
                    error: 'Bad Request',
                    message: 'Invalid JSON in request body'
                },
                { status: 400 }
            );
        }

        // Validate required fields
        if (!body.dateRange?.startDate || !body.dateRange?.endDate) {
            return NextResponse.json(
                {
                    error: 'Bad Request',
                    message: 'dateRange with startDate and endDate is required'
                },
                { status: 400 }
            );
        }

        // Parse and validate dates
        let startDate: Date;
        let endDate: Date;

        try {
            startDate = new Date(body.dateRange.startDate);
            endDate = new Date(body.dateRange.endDate);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                throw new Error('Invalid date format');
            }
        } catch (error) {
            return NextResponse.json(
                {
                    error: 'Bad Request',
                    message: 'Invalid date format in dateRange'
                },
                { status: 400 }
            );
        }

        // Create filters
        const filters: WeeklyReportFilters = {
            tenantId: tenant.id,
            startDate,
            endDate,
            includeResolved: body.options?.includeResolved !== false,
            includeDismissed: body.options?.includeDismissed !== false,
        };

        // Validate inputs
        try {
            WeeklyReportingService.validateReportInputs(filters);
        } catch (validationError) {
            return NextResponse.json(
                {
                    error: 'Bad Request',
                    message: validationError instanceof Error ? validationError.message : 'Invalid input parameters'
                },
                { status: 400 }
            );
        }

        // Generate report
        const report = await WeeklyReportingService.generateWeeklyReport(
            filters,
            user.user_id
        ) as AlertsIncidentsWeeklyReport;

        // Handle delivery if specified
        if (body.delivery) {
            try {
                const deliveryConfig = {
                    tenantId: tenant.id,
                    enabled: true,
                    dayOfWeek: 1, // Monday
                    hour: 9, // 9 AM
                    timezone: 'UTC',
                    recipients: body.delivery.recipients || [],
                    deliveryMethod: body.delivery.method || 'dashboard',
                };

                await WeeklyReportingService.deliverWeeklyReport(report, deliveryConfig);
            } catch (deliveryError) {
                logger.error('Failed to deliver weekly report', deliveryError instanceof Error ? deliveryError : new Error(String(deliveryError)), {
                    reportId: report.id,
                    tenantId: tenant.id,
                });

                // Return report even if delivery fails
                return NextResponse.json({
                    ...report,
                    deliveryStatus: 'failed',
                    deliveryError: deliveryError instanceof Error ? deliveryError.message : 'Unknown delivery error'
                });
            }
        }

        logger.info('Weekly report generated and delivered via API', {
            reportId: report.id,
            tenantId: tenant.id,
            userId: user.user_id,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            deliveryMethod: body.delivery?.method,
            recipients: body.delivery?.recipients?.length || 0,
        });

        return NextResponse.json({
            ...report,
            deliveryStatus: body.delivery ? 'success' : 'not_requested'
        });

    } catch (error) {
        logger.error('Failed to generate weekly report via POST API', error instanceof Error ? error : new Error(String(error)));

        // Handle specific error types
        if (error instanceof Error) {
            if (error.message.includes('Database connection')) {
                return NextResponse.json(
                    {
                        error: 'Service Unavailable',
                        message: 'Database service is temporarily unavailable'
                    },
                    { status: 503 }
                );
            }

            if (error.message.includes('Tenant ID') || error.message.includes('unauthorized')) {
                return NextResponse.json(
                    {
                        error: 'Forbidden',
                        message: 'Access denied for this tenant'
                    },
                    { status: 403 }
                );
            }
        }

        return NextResponse.json(
            {
                error: 'Internal Server Error',
                message: 'An unexpected error occurred while generating the report'
            },
            { status: 500 }
        );
    }
}