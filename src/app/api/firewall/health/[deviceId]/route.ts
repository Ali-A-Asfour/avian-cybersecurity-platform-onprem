import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import {
    firewallDevices,
    firewallHealthSnapshots,
} from '../../../../../../database/schemas/firewall';
import { eq, and, desc, gte, lte, between } from 'drizzle-orm';
import { UserRole } from '@/types';

/**
 * GET /api/firewall/health/:deviceId - Get health snapshots with date range
 * 
 * Requirements: 15.6 - Posture and Health API
 * - Retrieve health snapshots for a device
 * - Support date range filtering via query parameters
 * - Enforce tenant isolation
 * - Return 404 if device not found or belongs to different tenant
 * - Sort by timestamp descending (newest first)
 * 
 * Query Parameters:
 * - startDate: ISO 8601 date string (optional) - filter snapshots >= this date
 * - endDate: ISO 8601 date string (optional) - filter snapshots <= this date
 * - limit: number (optional, default: 100, max: 1000) - limit number of results
 * 
 * Examples:
 * - /api/firewall/health/123?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z
 * - /api/firewall/health/123?startDate=2024-01-01T00:00:00Z&limit=50
 * - /api/firewall/health/123?limit=10
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ deviceId: string }> }
) {
    try {
    // Await params in Next.js 16
    const { deviceId } = await params;
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
        let limit = 100; // Default limit
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
            if (parsedLimit > 1000) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Limit exceeds maximum allowed value of 1000',
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

        // Build query conditions for health snapshots
        const conditions = [eq(firewallHealthSnapshots.deviceId, deviceId)];

        // Add date range filters
        if (startDate && endDate) {
            conditions.push(
                between(firewallHealthSnapshots.timestamp, startDate, endDate)
            );
        } else {
            if (startDate) {
                conditions.push(gte(firewallHealthSnapshots.timestamp, startDate));
            }
            if (endDate) {
                conditions.push(lte(firewallHealthSnapshots.timestamp, endDate));
            }
        }

        // Query health snapshots with filters
        const healthSnapshotsResult = await db
            .select()
            .from(firewallHealthSnapshots)
            .where(and(...conditions))
            .orderBy(desc(firewallHealthSnapshots.timestamp))
            .limit(limit);

        // Format health snapshots response
        const healthSnapshots = healthSnapshotsResult.map((snapshot) => ({
            id: snapshot.id,
            deviceId: snapshot.deviceId,
            cpuPercent: snapshot.cpuPercent,
            ramPercent: snapshot.ramPercent,
            uptimeSeconds: Number(snapshot.uptimeSeconds),
            wanStatus: snapshot.wanStatus,
            vpnStatus: snapshot.vpnStatus,
            interfaceStatus: snapshot.interfaceStatus,
            wifiStatus: snapshot.wifiStatus,
            haStatus: snapshot.haStatus,
            timestamp: snapshot.timestamp,
        }));

        return NextResponse.json({
            success: true,
            data: {
                deviceId,
                snapshots: healthSnapshots,
                count: healthSnapshots.length,
                filters: {
                    startDate: startDate?.toISOString() || null,
                    endDate: endDate?.toISOString() || null,
                    limit,
                },
            },
        });
    } catch (error) {
        console.error('Error in GET /api/firewall/health/:deviceId:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve health snapshots',
                },
            },
            { status: 500 }
        );
    }
}
