import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import {
    edrVulnerabilities,
    edrDeviceVulnerabilities,
    edrDevices,
} from '../../../../../../../database/schemas/edr';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/edr/vulnerabilities/:cveId/devices - Get devices affected by a vulnerability
 * 
 * Requirements: 3.4, 9.4, 15.4
 * - Return list of devices affected by the vulnerability
 * - Enforce tenant isolation
 * - Validate CVE ID format
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ cveId: string }> }
) {
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

        // Get CVE ID from params
        const { cveId } = params;

        // Validate CVE ID format (CVE-YYYY-NNNNN or CVE-YYYY-NNNNNN or CVE-YYYY-NNNNNNN)
        const cveRegex = /^CVE-\d{4}-\d{4,7}$/i;
        if (!cveRegex.test(cveId)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid CVE ID format. Expected format: CVE-YYYY-NNNNN',
                    },
                },
                { status: 400 }
            );
        }

        // Find the vulnerability for this tenant
        const vulnerability = await db
            .select()
            .from(edrVulnerabilities)
            .where(
                and(
                    eq(edrVulnerabilities.tenantId, user.tenant_id),
                    eq(edrVulnerabilities.cveId, cveId.toUpperCase())
                )
            )
            .limit(1);

        if (!vulnerability || vulnerability.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Vulnerability not found',
                    },
                },
                { status: 404 }
            );
        }

        const vulnerabilityId = vulnerability[0].id;

        // Get all devices affected by this vulnerability
        const affectedDevices = await db
            .select({
                id: edrDevices.id,
                tenantId: edrDevices.tenantId,
                microsoftDeviceId: edrDevices.microsoftDeviceId,
                deviceName: edrDevices.deviceName,
                operatingSystem: edrDevices.operatingSystem,
                osVersion: edrDevices.osVersion,
                primaryUser: edrDevices.primaryUser,
                defenderHealthStatus: edrDevices.defenderHealthStatus,
                riskScore: edrDevices.riskScore,
                exposureLevel: edrDevices.exposureLevel,
                intuneComplianceState: edrDevices.intuneComplianceState,
                intuneEnrollmentStatus: edrDevices.intuneEnrollmentStatus,
                lastSeenAt: edrDevices.lastSeenAt,
                createdAt: edrDevices.createdAt,
                updatedAt: edrDevices.updatedAt,
                detectedAt: edrDeviceVulnerabilities.detectedAt,
            })
            .from(edrDeviceVulnerabilities)
            .innerJoin(
                edrDevices,
                eq(edrDeviceVulnerabilities.deviceId, edrDevices.id)
            )
            .where(
                and(
                    eq(edrDeviceVulnerabilities.vulnerabilityId, vulnerabilityId),
                    eq(edrDevices.tenantId, user.tenant_id)
                )
            );

        // Format response
        const devicesResponse = affectedDevices.map((device) => ({
            id: device.id,
            tenantId: device.tenantId,
            microsoftDeviceId: device.microsoftDeviceId,
            deviceName: device.deviceName,
            operatingSystem: device.operatingSystem,
            osVersion: device.osVersion,
            primaryUser: device.primaryUser,
            defenderHealthStatus: device.defenderHealthStatus,
            riskScore: device.riskScore,
            exposureLevel: device.exposureLevel,
            intuneComplianceState: device.intuneComplianceState,
            intuneEnrollmentStatus: device.intuneEnrollmentStatus,
            lastSeenAt: device.lastSeenAt,
            createdAt: device.createdAt,
            updatedAt: device.updatedAt,
            vulnerabilityDetectedAt: device.detectedAt,
        }));

        return NextResponse.json({
            success: true,
            data: {
                vulnerability: {
                    id: vulnerability[0].id,
                    cveId: vulnerability[0].cveId,
                    severity: vulnerability[0].severity,
                    cvssScore: vulnerability[0].cvssScore
                        ? parseFloat(vulnerability[0].cvssScore)
                        : null,
                    exploitability: vulnerability[0].exploitability,
                    description: vulnerability[0].description,
                },
                devices: devicesResponse,
                meta: {
                    total: devicesResponse.length,
                },
            },
        });
    } catch (error) {
        console.error('Error in GET /api/edr/vulnerabilities/:cveId/devices:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve affected devices',
                },
            },
            { status: 500 }
        );
    }
}
