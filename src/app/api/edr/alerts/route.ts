import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import { edrAlerts } from '../../../../../database/schemas/edr';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

/**
 * GET /api/edr/alerts - List all EDR alerts for tenant
 * 
 * Requirements: 2.4, 9.4, 14.2, 14.5
 * - List alerts filtered by tenant
 * - Support filters (severity, device, status, date range)
 * - Support pagination
 * - Enforce tenant isolation
 */
export async function GET(request: NextRequest) {
    try {
        // Apply authentication middleware FIRST (before any other checks)
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

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const severity = searchParams.get('severity');
        const deviceId = searchParams.get('deviceId');
        const status = searchParams.get('status');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const pageParam = searchParams.get('page') || '1';
        const limitParam = searchParams.get('limit') || '50';

        // Validate pagination parameters
        const page = parseInt(pageParam);
        const limit = parseInt(limitParam);

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

        if (isNaN(limit) || limit < 1 || limit > 100) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Limit must be a number between 1 and 100',
                    },
                },
                { status: 400 }
            );
        }

        // Validate severity parameter if provided
        const validSeverities = ['informational', 'low', 'medium', 'high'];
        if (severity && !validSeverities.includes(severity.toLowerCase())) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `Severity must be one of: ${validSeverities.join(', ')}`,
                    },
                },
                { status: 400 }
            );
        }

        // Validate status parameter if provided
        const validStatuses = ['new', 'in_progress', 'resolved', 'dismissed'];
        if (status && !validStatuses.includes(status.toLowerCase())) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `Status must be one of: ${validStatuses.join(', ')}`,
                    },
                },
                { status: 400 }
            );
        }

        // Validate deviceId parameter if provided (must be valid UUID)
        if (deviceId) {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(deviceId)) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Device ID must be a valid UUID',
                        },
                    },
                    { status: 400 }
                );
            }
        }

        // Validate date parameters if provided
        let startDateTime: Date | null = null;
        let endDateTime: Date | null = null;

        if (startDate) {
            startDateTime = new Date(startDate);
            if (isNaN(startDateTime.getTime())) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Invalid startDate format. Use ISO 8601 format',
                        },
                    },
                    { status: 400 }
                );
            }
        }

        if (endDate) {
            endDateTime = new Date(endDate);
            if (isNaN(endDateTime.getTime())) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Invalid endDate format. Use ISO 8601 format',
                        },
                    },
                    { status: 400 }
                );
            }
        }

        // Validate date range logic
        if (startDateTime && endDateTime && startDateTime > endDateTime) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Start date must be before or equal to end date',
                    },
                },
                { status: 400 }
            );
        }

        // Build query conditions
        const conditions = [eq(edrAlerts.tenantId, user.tenant_id)];

        // Add severity filter
        if (severity) {
            conditions.push(eq(edrAlerts.severity, severity.toLowerCase()));
        }

        // Add device filter
        if (deviceId) {
            conditions.push(eq(edrAlerts.deviceId, deviceId));
        }

        // Add status filter
        if (status) {
            conditions.push(eq(edrAlerts.status, status.toLowerCase()));
        }

        // Add date range filters
        if (startDateTime) {
            conditions.push(gte(edrAlerts.detectedAt, startDateTime));
        }

        if (endDateTime) {
            conditions.push(lte(edrAlerts.detectedAt, endDateTime));
        }

        // Calculate offset
        const offset = (page - 1) * limit;

        // Execute query with filters and pagination
        const alerts = await db
            .select()
            .from(edrAlerts)
            .where(and(...conditions))
            .orderBy(desc(edrAlerts.detectedAt))
            .limit(limit)
            .offset(offset);

        // Get total count for pagination
        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(edrAlerts)
            .where(and(...conditions));

        const total = Number(countResult[0]?.count || 0);

        // Format response
        const alertsResponse = alerts.map((alert) => ({
            id: alert.id,
            tenantId: alert.tenantId,
            deviceId: alert.deviceId,
            microsoftAlertId: alert.microsoftAlertId,
            severity: alert.severity,
            threatType: alert.threatType,
            threatName: alert.threatName,
            status: alert.status,
            description: alert.description,
            detectedAt: alert.detectedAt,
            createdAt: alert.createdAt,
            updatedAt: alert.updatedAt,
        }));

        return NextResponse.json({
            success: true,
            data: alertsResponse,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error in GET /api/edr/alerts:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve EDR alerts',
                },
            },
            { status: 500 }
        );
    }
}
