import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import { edrAlerts, edrDevices } from '../../../../../../database/schemas/edr';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/edr/alerts/:id - Get alert details
 * 
 * Requirements: 2.4, 9.4, 14.5
 * - Retrieve alert by ID
 * - Include device information
 * - Enforce tenant isolation
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
    // Await params in Next.js 16
    const { id } = await params;
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

        // Validate alert ID format (must be valid UUID)
        const alertId = id;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(alertId)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Alert ID must be a valid UUID',
                    },
                },
                { status: 400 }
            );
        }

        // Query alert with tenant isolation
        const alertResults = await db
            .select({
                alert: edrAlerts,
                device: edrDevices,
            })
            .from(edrAlerts)
            .leftJoin(edrDevices, eq(edrAlerts.deviceId, edrDevices.id))
            .where(
                and(
                    eq(edrAlerts.id, alertId),
                    eq(edrAlerts.tenantId, user.tenant_id)
                )
            )
            .limit(1);

        // Check if alert exists
        if (alertResults.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Alert not found',
                    },
                },
                { status: 404 }
            );
        }

        const { alert, device } = alertResults[0];

        // Format response with alert and device information
        const response = {
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
            device: device
                ? {
                    id: device.id,
                    deviceName: device.deviceName,
                    operatingSystem: device.operatingSystem,
                    osVersion: device.osVersion,
                    primaryUser: device.primaryUser,
                    riskScore: device.riskScore,
                    lastSeenAt: device.lastSeenAt,
                }
                : null,
        };

        return NextResponse.json({
            success: true,
            data: response,
        });
    } catch (error) {
        console.error('Error in GET /api/edr/alerts/:id:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve alert details',
                },
            },
            { status: 500 }
        );
    }
}
