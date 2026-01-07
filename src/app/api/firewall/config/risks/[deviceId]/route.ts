import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import { firewallDevices } from '@/../database/schemas/firewall';
import { eq } from 'drizzle-orm';
import { getRisksByDevice, getRisksByDeviceAndSeverity, countRisksBySeverity } from '@/lib/firewall-risk-storage';
import { UserRole, RiskSeverity } from '@/types';

/**
 * GET /api/firewall/config/risks/:deviceId - Get configuration risks for a device
 * 
 * Requirements: 15.5 - Configuration API
 * - Retrieve configuration risks for a specific device
 * - Support filtering by severity
 * - Enforce tenant isolation
 * - Return risk summary with counts
 * 
 * Query parameters:
 * - severity: string (optional) - Filter by severity level (critical, high, medium, low)
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

        // Validate deviceId parameter
        const deviceId = params.deviceId;
        if (!deviceId || typeof deviceId !== 'string' || deviceId.trim() === '') {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Device ID is required and must be a non-empty string',
                    },
                },
                { status: 400 }
            );
        }

        // Verify device exists and belongs to user's tenant
        const device = await db
            .select()
            .from(firewallDevices)
            .where(eq(firewallDevices.id, deviceId))
            .limit(1);

        if (device.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Firewall device not found',
                    },
                },
                { status: 404 }
            );
        }

        // Enforce tenant isolation (unless super admin)
        if (user.role !== UserRole.SUPER_ADMIN && device[0].tenantId !== user.tenant_id) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Cannot access device from another tenant',
                    },
                },
                { status: 403 }
            );
        }

        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const severityParam = searchParams.get('severity');

        // Validate severity parameter if provided
        let severity: RiskSeverity | undefined;
        if (severityParam) {
            const validSeverities: RiskSeverity[] = ['critical', 'high', 'medium', 'low'];
            if (!validSeverities.includes(severityParam as RiskSeverity)) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Invalid severity parameter. Must be one of: critical, high, medium, low',
                        },
                    },
                    { status: 400 }
                );
            }
            severity = severityParam as RiskSeverity;
        }

        // Retrieve risks from database
        let risks;
        try {
            if (severity) {
                risks = await getRisksByDeviceAndSeverity(deviceId, severity);
            } else {
                risks = await getRisksByDevice(deviceId);
            }
        } catch (error) {
            console.error('Failed to retrieve risks:', error);
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'QUERY_ERROR',
                        message: 'Failed to retrieve configuration risks',
                        details: error instanceof Error ? error.message : 'Unknown error',
                    },
                },
                { status: 500 }
            );
        }

        // Get risk counts by severity
        let riskCounts;
        try {
            riskCounts = await countRisksBySeverity(deviceId);
        } catch (error) {
            console.error('Failed to count risks:', error);
            // Continue without counts rather than failing the entire request
            riskCounts = {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                total: 0,
            };
        }

        // Format response
        return NextResponse.json(
            {
                success: true,
                data: {
                    deviceId,
                    device: {
                        id: device[0].id,
                        model: device[0].model,
                        firmwareVersion: device[0].firmwareVersion,
                        serialNumber: device[0].serialNumber,
                        managementIp: device[0].managementIp,
                    },
                    riskCounts,
                    risks: risks.map(risk => ({
                        riskId: risk.id,
                        riskCategory: risk.riskCategory,
                        riskType: risk.riskType,
                        severity: risk.severity,
                        description: risk.description,
                        remediation: risk.remediation,
                        detectedAt: risk.detectedAt,
                        snapshotId: risk.snapshotId,
                    })),
                    filters: {
                        severity: severity || null,
                    },
                },
                message: severity
                    ? `Retrieved ${risks.length} ${severity} risk(s) for device`
                    : `Retrieved ${risks.length} risk(s) for device`,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error in GET /api/firewall/config/risks/:deviceId:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve configuration risks',
                },
            },
            { status: 500 }
        );
    }
}
