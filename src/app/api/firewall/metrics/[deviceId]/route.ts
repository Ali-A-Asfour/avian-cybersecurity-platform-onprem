import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import {
    firewallDevices,
    firewallMetricsRollup,
} from '../../../../../../database/schemas/firewall';
import { eq, and, desc, gte, lte, between } from 'drizzle-orm';
import { UserRole } from '@/types';

/**
 * GET /api/firewall/metrics/:deviceId - Get daily metrics
 * 
 * Requirements: 15.9 - Metrics API
 * - Retrieve daily metrics rollup records for a device
 * - Support date range filtering via query parameters
 * - Enforce tenant isolation
 * - Return 404 if device not found or belongs to different tenant
 * - Sort by date descending (newest first)
 * 
 * Query Parameters:
 * - startDate: ISO 8601 date string (optional) - filter metrics >= this date
 * - endDate: ISO 8601 date string (optional) - filter metrics <= this date
 * - limit: number (optional, default: 90, max: 365) - limit number of results
 * 
 * Examples:
 * - /api/firewall/metrics/123?startDate=2024-01-01&endDate=2024-01-31
 * - /api/firewall/metrics/123?startDate=2024-01-01&limit=30
 * - /api/firewall/metrics/123?limit=7
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { deviceId: string } }
) {
    try {
        // Check database connection
        if (!db) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'DATABASE_ERROR',
                        message: 'Database connection not available',
                    },
                },
                { status: 503 }
            );
        }

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

        const deviceId = params.deviceId;

        // Validate UUID format
        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(deviceId)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_ID',
                        message: 'Invalid device ID format',
                    },
                },
                { status: 400 }
            );
        }

        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');
        const limitParam = searchParams.get('limit');

        // Validate and parse date parameters
        let startDate: Date | null = null;
        let endDate: Date | null = null;

        if (startDateParam) {
            startDate = new Date(startDateParam);
            if (isNaN(startDate.getTime())) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Invalid startDate format. Must be a valid ISO 8601 date string',
                        },
                    },
                    { status: 400 }
                );
            }
        }

        if (endDateParam) {
            endDate = new Date(endDateParam);
            if (isNaN(endDate.getTime())) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Invalid endDate format. Must be a valid ISO 8601 date string',
                        },
                    },
                    { status: 400 }
                );
            }
        }

        // Validate date range
        if (startDate && endDate && startDate > endDate) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'startDate must be before or equal to endDate',
                    },
                },
                { status: 400 }
            );
        }

        // Validate and parse limit parameter
        let limit = 90; // Default limit (90 days)
        if (limitParam) {
            const parsedLimit = parseInt(limitParam, 10);
            if (isNaN(parsedLimit) || parsedLimit < 1) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Invalid limit. Must be a positive integer',
                        },
                    },
                    { status: 400 }
                );
            }
            if (parsedLimit > 365) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Limit exceeds maximum allowed value of 365',
                        },
                    },
                    { status: 400 }
                );
            }
            limit = parsedLimit;
        }

        // First check if device exists at all
        const deviceCheckResult = await db
            .select()
            .from(firewallDevices)
            .where(eq(firewallDevices.id, deviceId))
            .limit(1);

        if (deviceCheckResult.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Device not found',
                    },
                },
                { status: 404 }
            );
        }

        const device = deviceCheckResult[0];

        // Verify device belongs to user's tenant (unless super admin)
        if (user.role !== UserRole.SUPER_ADMIN && device.tenantId !== user.tenant_id) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Access denied. Device belongs to another tenant',
                    },
                },
                { status: 403 }
            );
        }

        // Build query conditions for metrics rollup
        const conditions = [eq(firewallMetricsRollup.deviceId, deviceId)];

        // Add date range filters
        if (startDate && endDate) {
            // Convert to date strings for comparison (YYYY-MM-DD format)
            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];
            conditions.push(
                between(firewallMetricsRollup.date, startDateStr, endDateStr)
            );
        } else {
            if (startDate) {
                const startDateStr = startDate.toISOString().split('T')[0];
                conditions.push(gte(firewallMetricsRollup.date, startDateStr));
            }
            if (endDate) {
                const endDateStr = endDate.toISOString().split('T')[0];
                conditions.push(lte(firewallMetricsRollup.date, endDateStr));
            }
        }

        // Query metrics rollup with filters
        const metricsResult = await db
            .select()
            .from(firewallMetricsRollup)
            .where(and(...conditions))
            .orderBy(desc(firewallMetricsRollup.date))
            .limit(limit);

        // Format metrics response
        const metrics = metricsResult.map((metric) => ({
            id: metric.id,
            deviceId: metric.deviceId,
            date: metric.date,
            threatsBlocked: metric.threatsBlocked,
            malwareBlocked: metric.malwareBlocked,
            ipsBlocked: metric.ipsBlocked,
            blockedConnections: metric.blockedConnections,
            webFilterHits: metric.webFilterHits,
            bandwidthTotalMb: Number(metric.bandwidthTotalMb),
            activeSessionsCount: metric.activeSessionsCount,
            createdAt: metric.createdAt,
        }));

        return NextResponse.json({
            success: true,
            data: {
                deviceId,
                metrics,
                count: metrics.length,
                filters: {
                    startDate: startDate?.toISOString().split('T')[0] || null,
                    endDate: endDate?.toISOString().split('T')[0] || null,
                    limit,
                },
            },
        });
    } catch (error) {
        console.error('Error in GET /api/firewall/metrics/:deviceId:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve metrics',
                },
            },
            { status: 500 }
        );
    }
}
