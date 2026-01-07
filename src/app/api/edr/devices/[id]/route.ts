import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import {
    edrDevices,
    edrAlerts,
    edrVulnerabilities,
    edrDeviceVulnerabilities,
    edrCompliance,
} from '../../../../../../database/schemas/edr';
import { eq, and, desc } from 'drizzle-orm';
import { UserRole } from '@/types';

/**
 * GET /api/edr/devices/:id - Get device details with related data
 * 
 * Requirements: 1.4, 9.4, 9.5, 13.4
 * - Retrieve device metadata
 * - Include related alerts
 * - Include related vulnerabilities
 * - Include compliance status
 * - Include available remote actions
 * - Enforce tenant isolation
 * - Return 404 if device not found or belongs to different tenant
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
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

        const deviceId = params.id;

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
            .from(edrDevices)
            .where(eq(edrDevices.id, deviceId))
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

        // Get related alerts (active alerts only)
        const alertsResult = await db
            .select()
            .from(edrAlerts)
            .where(
                and(
                    eq(edrAlerts.deviceId, deviceId),
                    eq(edrAlerts.status, 'active')
                )
            )
            .orderBy(desc(edrAlerts.detectedAt))
            .limit(50); // Limit to most recent 50 alerts

        // Get related vulnerabilities through junction table
        const vulnerabilitiesResult = await db
            .select({
                id: edrVulnerabilities.id,
                tenantId: edrVulnerabilities.tenantId,
                cveId: edrVulnerabilities.cveId,
                severity: edrVulnerabilities.severity,
                cvssScore: edrVulnerabilities.cvssScore,
                exploitability: edrVulnerabilities.exploitability,
                description: edrVulnerabilities.description,
                createdAt: edrVulnerabilities.createdAt,
                updatedAt: edrVulnerabilities.updatedAt,
                detectedAt: edrDeviceVulnerabilities.detectedAt,
            })
            .from(edrDeviceVulnerabilities)
            .innerJoin(
                edrVulnerabilities,
                eq(edrDeviceVulnerabilities.vulnerabilityId, edrVulnerabilities.id)
            )
            .where(eq(edrDeviceVulnerabilities.deviceId, deviceId))
            .orderBy(desc(edrVulnerabilities.cvssScore))
            .limit(100); // Limit to top 100 vulnerabilities

        // Get compliance status
        const complianceResult = await db
            .select()
            .from(edrCompliance)
            .where(eq(edrCompliance.deviceId, deviceId))
            .limit(1);

        const compliance = complianceResult.length > 0 ? complianceResult[0] : null;

        // Determine available actions based on device state
        const availableActions = [];

        // Isolate action available if device is not already isolated
        if (device.defenderHealthStatus !== 'isolated') {
            availableActions.push({
                type: 'isolate',
                label: 'Isolate Device',
                description: 'Isolate device from network',
            });
        }

        // Unisolate action available if device is isolated
        if (device.defenderHealthStatus === 'isolated') {
            availableActions.push({
                type: 'unisolate',
                label: 'Unisolate Device',
                description: 'Remove device from isolation',
            });
        }

        // Scan action always available
        availableActions.push({
            type: 'scan',
            label: 'Run Antivirus Scan',
            description: 'Run a full antivirus scan on the device',
        });

        // Format device response
        const deviceResponse = {
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
        };

        // Format alerts response
        const alertsResponse = alertsResult.map((alert) => ({
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

        // Format vulnerabilities response
        const vulnerabilitiesResponse = vulnerabilitiesResult.map((vuln) => ({
            id: vuln.id,
            tenantId: vuln.tenantId,
            cveId: vuln.cveId,
            severity: vuln.severity,
            cvssScore: vuln.cvssScore ? Number(vuln.cvssScore) : null,
            exploitability: vuln.exploitability,
            description: vuln.description,
            detectedAt: vuln.detectedAt,
            createdAt: vuln.createdAt,
            updatedAt: vuln.updatedAt,
        }));

        // Format compliance response
        const complianceResponse = compliance
            ? {
                id: compliance.id,
                tenantId: compliance.tenantId,
                deviceId: compliance.deviceId,
                complianceState: compliance.complianceState,
                failedRules: compliance.failedRules,
                securityBaselineStatus: compliance.securityBaselineStatus,
                requiredAppsStatus: compliance.requiredAppsStatus,
                checkedAt: compliance.checkedAt,
                createdAt: compliance.createdAt,
                updatedAt: compliance.updatedAt,
            }
            : null;

        return NextResponse.json({
            success: true,
            data: {
                device: deviceResponse,
                alerts: alertsResponse,
                vulnerabilities: vulnerabilitiesResponse,
                compliance: complianceResponse,
                availableActions,
            },
        });
    } catch (error) {
        console.error('Error in GET /api/edr/devices/:id:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve device details',
                },
            },
            { status: 500 }
        );
    }
}
