import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import {
    firewallDevices,
    firewallSecurityPosture,
} from '../../../../../../database/schemas/firewall';
import { eq, and, desc } from 'drizzle-orm';
import { UserRole } from '@/types';

/**
 * GET /api/firewall/posture/:deviceId - Get latest security posture
 * 
 * Requirements: 15.6 - Posture and Health API
 * - Retrieve latest security posture snapshot for a device
 * - Include all security feature states and daily block counts
 * - Enforce tenant isolation
 * - Return 404 if device not found or belongs to different tenant
 * - Return 404 if no posture data exists for device
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

        // Get latest security posture
        const latestPostureResult = await db
            .select()
            .from(firewallSecurityPosture)
            .where(eq(firewallSecurityPosture.deviceId, deviceId))
            .orderBy(desc(firewallSecurityPosture.timestamp))
            .limit(1);

        if (latestPostureResult.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'No security posture data found for this device',
                    },
                },
                { status: 404 }
            );
        }

        const posture = latestPostureResult[0];

        // Format security posture response
        const postureResponse = {
            id: posture.id,
            deviceId: posture.deviceId,
            ipsEnabled: posture.ipsEnabled,
            ipsLicenseStatus: posture.ipsLicenseStatus,
            ipsDailyBlocks: posture.ipsDailyBlocks,
            gavEnabled: posture.gavEnabled,
            gavLicenseStatus: posture.gavLicenseStatus,
            gavDailyBlocks: posture.gavDailyBlocks,
            dpiSslEnabled: posture.dpiSslEnabled,
            dpiSslCertificateStatus: posture.dpiSslCertificateStatus,
            dpiSslDailyBlocks: posture.dpiSslDailyBlocks,
            atpEnabled: posture.atpEnabled,
            atpLicenseStatus: posture.atpLicenseStatus,
            atpDailyVerdicts: posture.atpDailyVerdicts,
            botnetFilterEnabled: posture.botnetFilterEnabled,
            botnetDailyBlocks: posture.botnetDailyBlocks,
            appControlEnabled: posture.appControlEnabled,
            appControlLicenseStatus: posture.appControlLicenseStatus,
            appControlDailyBlocks: posture.appControlDailyBlocks,
            contentFilterEnabled: posture.contentFilterEnabled,
            contentFilterLicenseStatus: posture.contentFilterLicenseStatus,
            contentFilterDailyBlocks: posture.contentFilterDailyBlocks,
            timestamp: posture.timestamp,
        };

        return NextResponse.json({
            success: true,
            data: postureResponse,
        });
    } catch (error) {
        console.error('Error in GET /api/firewall/posture/:deviceId:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve security posture',
                },
            },
            { status: 500 }
        );
    }
}
