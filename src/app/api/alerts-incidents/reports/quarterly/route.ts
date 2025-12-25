/**
 * API Route: Quarterly Reports for Alerts & Security Incidents Module
 * 
 * Provides endpoints for generating and retrieving quarterly reports with:
 * - Executive risk summary, incident volume trends, and SLA performance analysis
 * - Executive-level dashboards and visualizations
 * - Long-term data retention for compliance
 * 
 * Requirements: 11.3, 11.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { QuarterlyReportingService, QuarterlyReportFilters } from '../../../../../services/alerts-incidents/QuarterlyReportingService';
import { ReportCacheService } from '../../../../../services/alerts-incidents/ReportCacheService';
import { authMiddleware } from '../../../../../middleware/auth.middleware';
import { tenantMiddleware } from '../../../../../middleware/tenant.middleware';
import { logger } from '../../../../../lib/logger';

// Import the quarterly report type
interface QuarterlyReport {
    id: string;
    tenantId: string;
    reportType: 'quarterly';
    dateRange: {
        startDate: Date;
        endDate: Date;
    };
    generatedAt: Date;
    generatedBy: string;
    executiveRiskSummary: {
        overallRiskLevel: string;
    };
    incidentVolumeTrends: {
        quarterlyTotal: number;
    };
    slaPerformanceAnalysis: {
        overallCompliance: number;
    };
}

/**
 * GET /api/alerts-incidents/reports/quarterly
 * 
 * Generate quarterly report for alerts and incidents
 * 
 * Query Parameters:
 * - startDate: ISO date string (required)
 * - endDate: ISO date string (required)
 * - includeArchived: boolean (optional, default: false)
 * - includeHistoricalComparison: boolean (optional, default: true)
 * 
 * Requirements: 11.3, 11.5
 */
export async function GET(request: NextRequest) {
    try {
        // Authenticate and get user context
        const authResult = await authMiddleware(request);
        if (!authResult.success || !authResult.user) {
            return NextResponse.json(
                { error: 'Authentication required', code: 'AUTH_REQUIRED' },
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

        // Validate user has appropriate role for quarterly reports (typically executives/admins)
        if (user.role !== 'super_admin' && user.role !== 'tenant_admin') {
            return NextResponse.json(
                {
                    error: 'Insufficient permissions for quarterly reports',
                    code: 'INSUFFICIENT_PERMISSIONS',
                    details: { requiredRoles: ['super_admin', 'tenant_admin'] }
                },
                { status: 403 }
            );
        }

        // Parse and validate query parameters
        const { searchParams } = new URL(request.url);

        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');
        const includeArchived = searchParams.get('includeArchived') === 'true';
        const includeHistoricalComparison = searchParams.get('includeHistoricalComparison') !== 'false';

        // Validate required parameters
        if (!startDateParam || !endDateParam) {
            return NextResponse.json(
                {
                    error: 'Start date and end date are required',
                    code: 'MISSING_REQUIRED_PARAMS',
                    details: {
                        required: ['startDate', 'endDate'],
                        provided: { startDate: !!startDateParam, endDate: !!endDateParam }
                    }
                },
                { status: 400 }
            );
        }

        // Parse dates
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
                    error: 'Invalid date format. Use ISO date strings (YYYY-MM-DD)',
                    code: 'INVALID_DATE_FORMAT',
                    details: { startDate: startDateParam, endDate: endDateParam }
                },
                { status: 400 }
            );
        }

        // Create report filters
        const filters: QuarterlyReportFilters = {
            tenantId: tenant.id,
            startDate,
            endDate,
            includeArchived,
            includeHistoricalComparison,
        };

        // Validate report inputs
        try {
            QuarterlyReportingService.validateReportInputs(filters);
        } catch (validationError) {
            return NextResponse.json(
                {
                    error: validationError instanceof Error ? validationError.message : 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    details: { filters }
                },
                { status: 400 }
            );
        }

        logger.info('Generating quarterly report', {
            tenantId: tenant.id,
            userId: user.user_id,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            includeArchived,
            includeHistoricalComparison,
        });

        // Check cache first for performance optimization
        const cacheParams = {
            reportType: 'quarterly' as const,
            tenantId: tenant.id,
            startDate,
            endDate,
            options: { includeArchived, includeHistoricalComparison },
        };

        let report: QuarterlyReport | null = null;

        try {
            report = await ReportCacheService.getCachedReport<QuarterlyReport>(cacheParams);
        } catch (cacheError) {
            logger.warn('Cache lookup failed, proceeding with report generation', cacheError instanceof Error ? cacheError : new Error(String(cacheError)));
            // Continue with report generation even if cache fails
        }

        if (!report) {
            // Generate report if not cached
            const startTime = Date.now();
            report = await QuarterlyReportingService.generateQuarterlyReport(
                filters,
                user.user_id
            );
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

            logger.info('Quarterly report generated (not cached)', {
                reportId: report.id,
                tenantId: tenant.id,
                userId: user.user_id,
                generationTime,
                reportSize,
            });
        } else {
            logger.info('Quarterly report served from cache', {
                reportId: report.id,
                tenantId: tenant.id,
                userId: user.user_id,
            });
        }

        logger.info('Quarterly report generated successfully', {
            reportId: report.id,
            tenantId: tenant.id,
            userId: user.user_id,
            riskLevel: report.executiveRiskSummary.overallRiskLevel,
            quarterlyIncidents: report.incidentVolumeTrends.quarterlyTotal,
            slaCompliance: report.slaPerformanceAnalysis.overallCompliance,
        });

        if (!report) {
            return NextResponse.json(
                {
                    error: 'Internal Server Error',
                    message: 'Failed to generate report'
                },
                { status: 500 }
            );
        }

        // Return the report (consistent with weekly/monthly format)
        return NextResponse.json(report);

    } catch (error) {
        logger.error('Failed to generate quarterly report', error instanceof Error ? error : new Error(String(error)), {
            url: request.url,
            method: request.method,
        });

        // Handle specific error types
        if (error instanceof Error) {
            if (error.message.includes('Database connection')) {
                return NextResponse.json(
                    {
                        error: 'Database service temporarily unavailable',
                        code: 'DATABASE_UNAVAILABLE',
                        details: { retryAfter: '30 seconds' }
                    },
                    { status: 503 }
                );
            }

            if (error.message.includes('Tenant ID')) {
                return NextResponse.json(
                    {
                        error: 'Invalid tenant context',
                        code: 'INVALID_TENANT',
                        details: { message: error.message }
                    },
                    { status: 400 }
                );
            }
        }

        // Generic server error
        return NextResponse.json(
            {
                error: 'Internal server error during report generation',
                code: 'REPORT_GENERATION_ERROR',
                details: {
                    message: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date().toISOString()
                }
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/alerts-incidents/reports/quarterly
 * 
 * Schedule quarterly report generation
 * 
 * Request Body:
 * - enabled: boolean (required)
 * - dayOfQuarter: number (1-90, required)
 * - hour: number (0-23, required)
 * - timezone: string (required)
 * - recipients: string[] (required)
 * - deliveryMethod: 'email' | 'dashboard' | 'both' (required)
 * - includeExecutiveSummary: boolean (optional, default: true)
 * - includeDetailedAnalysis: boolean (optional, default: true)
 * 
 * Requirements: 11.5
 */
export async function POST(request: NextRequest) {
    try {
        // Authenticate and get user context
        const authResult = await authMiddleware(request);
        if (!authResult.success || !authResult.user) {
            return NextResponse.json(
                { error: 'Authentication required', code: 'AUTH_REQUIRED' },
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

        // Validate user has appropriate role for scheduling reports (super admin only)
        if (user.role !== 'super_admin') {
            return NextResponse.json(
                {
                    error: 'Insufficient permissions for report scheduling',
                    code: 'INSUFFICIENT_PERMISSIONS',
                    details: { requiredRoles: ['super_admin'] }
                },
                { status: 403 }
            );
        }

        // Parse request body
        let requestBody;
        try {
            requestBody = await request.json();
        } catch (error) {
            return NextResponse.json(
                {
                    error: 'Invalid JSON in request body',
                    code: 'INVALID_JSON',
                    details: { error: error instanceof Error ? error.message : 'Unknown parsing error' }
                },
                { status: 400 }
            );
        }

        // Validate required fields
        const {
            enabled,
            dayOfQuarter,
            hour,
            timezone,
            recipients,
            deliveryMethod,
            includeExecutiveSummary = true,
            includeDetailedAnalysis = true
        } = requestBody;

        const requiredFields = ['enabled', 'dayOfQuarter', 'hour', 'timezone', 'recipients', 'deliveryMethod'];
        const missingFields = requiredFields.filter(field => requestBody[field] === undefined || requestBody[field] === null);

        if (missingFields.length > 0) {
            return NextResponse.json(
                {
                    error: 'Missing required fields',
                    code: 'MISSING_REQUIRED_FIELDS',
                    details: {
                        required: requiredFields,
                        missing: missingFields,
                        provided: Object.keys(requestBody)
                    }
                },
                { status: 400 }
            );
        }

        // Validate field types and values
        const validationErrors: string[] = [];

        if (typeof enabled !== 'boolean') {
            validationErrors.push('enabled must be a boolean');
        }

        if (typeof dayOfQuarter !== 'number' || dayOfQuarter < 1 || dayOfQuarter > 90) {
            validationErrors.push('dayOfQuarter must be a number between 1 and 90');
        }

        if (typeof hour !== 'number' || hour < 0 || hour > 23) {
            validationErrors.push('hour must be a number between 0 and 23');
        }

        if (typeof timezone !== 'string' || timezone.trim().length === 0) {
            validationErrors.push('timezone must be a non-empty string');
        }

        if (!Array.isArray(recipients) || recipients.length === 0) {
            validationErrors.push('recipients must be a non-empty array');
        } else if (!recipients.every(email => typeof email === 'string' && email.includes('@'))) {
            validationErrors.push('all recipients must be valid email addresses');
        }

        if (!['email', 'dashboard', 'both'].includes(deliveryMethod)) {
            validationErrors.push('deliveryMethod must be one of: email, dashboard, both');
        }

        if (typeof includeExecutiveSummary !== 'boolean') {
            validationErrors.push('includeExecutiveSummary must be a boolean');
        }

        if (typeof includeDetailedAnalysis !== 'boolean') {
            validationErrors.push('includeDetailedAnalysis must be a boolean');
        }

        if (validationErrors.length > 0) {
            return NextResponse.json(
                {
                    error: 'Validation errors in request body',
                    code: 'VALIDATION_ERRORS',
                    details: { errors: validationErrors }
                },
                { status: 400 }
            );
        }

        logger.info('Scheduling quarterly report', {
            tenantId: tenant.id,
            userId: user.user_id,
            enabled,
            dayOfQuarter,
            hour,
            timezone,
            recipientCount: recipients.length,
            deliveryMethod,
        });

        // Create schedule configuration
        const scheduleConfig = {
            tenantId: tenant.id,
            enabled,
            dayOfQuarter,
            hour,
            timezone,
            recipients,
            deliveryMethod,
            includeExecutiveSummary,
            includeDetailedAnalysis,
        };

        // Schedule the quarterly report
        await QuarterlyReportingService.scheduleQuarterlyReport(scheduleConfig);

        logger.info('Quarterly report scheduled successfully', {
            tenantId: tenant.id,
            userId: user.user_id,
            enabled,
        });

        // Return success response
        return NextResponse.json({
            success: true,
            message: 'Quarterly report scheduled successfully',
            data: {
                tenantId: tenant.id,
                enabled,
                schedule: {
                    dayOfQuarter,
                    hour,
                    timezone,
                },
                delivery: {
                    method: deliveryMethod,
                    recipientCount: recipients.length,
                    includeExecutiveSummary,
                    includeDetailedAnalysis,
                },
                scheduledAt: new Date().toISOString(),
                scheduledBy: user.user_id,
            }
        });

    } catch (error) {
        logger.error('Failed to schedule quarterly report', error instanceof Error ? error : new Error(String(error)), {
            url: request.url,
            method: request.method,
        });

        // Handle specific error types
        if (error instanceof Error) {
            if (error.message.includes('Database connection')) {
                return NextResponse.json(
                    {
                        error: 'Database service temporarily unavailable',
                        code: 'DATABASE_UNAVAILABLE',
                        details: { retryAfter: '30 seconds' }
                    },
                    { status: 503 }
                );
            }
        }

        // Generic server error
        return NextResponse.json(
            {
                error: 'Internal server error during report scheduling',
                code: 'REPORT_SCHEDULING_ERROR',
                details: {
                    message: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date().toISOString()
                }
            },
            { status: 500 }
        );
    }
}