import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import {
    firewallDevices,
    firewallHealthSnapshots,
    firewallSecurityPosture,
} from '../../../../../../database/schemas/firewall';
import { eq, and, desc } from 'drizzle-orm';
import { UserRole } from '@/types';
import { UpdateDeviceRequest, FirewallDevice } from '@/types/firewall';
import { FirewallEncryption } from '@/lib/firewall-encryption';

/**
 * GET /api/firewall/devices/:id - Get device details with latest snapshot
 * 
 * Requirements: 15.3 - Device Management API
 * - Retrieve device metadata
 * - Include latest health snapshot
 * - Include latest security posture
 * - Enforce tenant isolation
 * - Return 404 if device not found or belongs to different tenant
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
    // Await params in Next.js 16
    const { id } = await params;
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

        const deviceId = id;

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

        // Get latest health snapshot
        const latestHealthResult = await db
            .select()
            .from(firewallHealthSnapshots)
            .where(eq(firewallHealthSnapshots.deviceId, deviceId))
            .orderBy(desc(firewallHealthSnapshots.timestamp))
            .limit(1);

        const latestHealth = latestHealthResult.length > 0 ? latestHealthResult[0] : null;

        // Get latest security posture
        const latestPostureResult = await db
            .select()
            .from(firewallSecurityPosture)
            .where(eq(firewallSecurityPosture.deviceId, deviceId))
            .orderBy(desc(firewallSecurityPosture.timestamp))
            .limit(1);

        const latestPosture =
            latestPostureResult.length > 0 ? latestPostureResult[0] : null;

        // Format response - never return encrypted password
        const deviceResponse = {
            id: device.id,
            tenantId: device.tenantId,
            model: device.model,
            firmwareVersion: device.firmwareVersion,
            serialNumber: device.serialNumber,
            managementIp: device.managementIp,
            apiUsername: device.apiUsername,
            apiPasswordEncrypted: null, // Never return encrypted password
            uptimeSeconds: Number(device.uptimeSeconds),
            lastSeenAt: device.lastSeenAt,
            status: device.status,
            createdAt: device.createdAt,
            updatedAt: device.updatedAt,
        };

        // Format health snapshot if exists
        const healthResponse = latestHealth
            ? {
                id: latestHealth.id,
                deviceId: latestHealth.deviceId,
                cpuPercent: latestHealth.cpuPercent,
                ramPercent: latestHealth.ramPercent,
                uptimeSeconds: Number(latestHealth.uptimeSeconds),
                wanStatus: latestHealth.wanStatus,
                vpnStatus: latestHealth.vpnStatus,
                interfaceStatus: latestHealth.interfaceStatus,
                wifiStatus: latestHealth.wifiStatus,
                haStatus: latestHealth.haStatus,
                timestamp: latestHealth.timestamp,
            }
            : null;

        // Format security posture if exists
        const postureResponse = latestPosture
            ? {
                id: latestPosture.id,
                deviceId: latestPosture.deviceId,
                ipsEnabled: latestPosture.ipsEnabled,
                ipsLicenseStatus: latestPosture.ipsLicenseStatus,
                ipsDailyBlocks: latestPosture.ipsDailyBlocks,
                gavEnabled: latestPosture.gavEnabled,
                gavLicenseStatus: latestPosture.gavLicenseStatus,
                gavDailyBlocks: latestPosture.gavDailyBlocks,
                dpiSslEnabled: latestPosture.dpiSslEnabled,
                dpiSslCertificateStatus: latestPosture.dpiSslCertificateStatus,
                dpiSslDailyBlocks: latestPosture.dpiSslDailyBlocks,
                atpEnabled: latestPosture.atpEnabled,
                atpLicenseStatus: latestPosture.atpLicenseStatus,
                atpDailyVerdicts: latestPosture.atpDailyVerdicts,
                botnetFilterEnabled: latestPosture.botnetFilterEnabled,
                botnetDailyBlocks: latestPosture.botnetDailyBlocks,
                appControlEnabled: latestPosture.appControlEnabled,
                appControlLicenseStatus: latestPosture.appControlLicenseStatus,
                appControlDailyBlocks: latestPosture.appControlDailyBlocks,
                contentFilterEnabled: latestPosture.contentFilterEnabled,
                contentFilterLicenseStatus: latestPosture.contentFilterLicenseStatus,
                contentFilterDailyBlocks: latestPosture.contentFilterDailyBlocks,
                timestamp: latestPosture.timestamp,
            }
            : null;

        return NextResponse.json({
            success: true,
            data: {
                device: deviceResponse,
                health: healthResponse,
                posture: postureResponse,
            },
        });
    } catch (error) {
        console.error('Error in GET /api/firewall/devices/:id:', error);
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

/**
 * PUT /api/firewall/devices/:id - Update device
 * 
 * Requirements: 15.1 - Device Management API
 * - Update device metadata and credentials
 * - Encrypt API password if provided
 * - Validate input data
 * - Enforce tenant isolation
 * - Only Super Admins and Tenant Admins can update devices
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
    // Await params in Next.js 16
    const { id } = await params;
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

        // Only Super Admins and Tenant Admins can update devices
        if (!['super_admin', 'tenant_admin'].includes(user.role)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INSUFFICIENT_PERMISSIONS',
                        message: 'Only administrators can update firewall devices',
                    },
                },
                { status: 403 }
            );
        }

        const deviceId = id;

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

        // Parse request body
        let body: UpdateDeviceRequest;
        try {
    // Await params in Next.js 16
    const { id } = await params;
            body = await request.json();
        } catch (error) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid JSON in request body',
                    },
                },
                { status: 400 }
            );
        }

        // Validate at least one field is provided
        if (
            body.model === undefined &&
            body.firmwareVersion === undefined &&
            body.serialNumber === undefined &&
            body.managementIp === undefined &&
            body.apiUsername === undefined &&
            body.apiPassword === undefined &&
            body.status === undefined
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'At least one field must be provided for update',
                    },
                },
                { status: 400 }
            );
        }

        // Validate string field types and lengths if provided
        if (body.model !== undefined && body.model !== null && (typeof body.model !== 'string' || body.model.length > 100)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Model must be a string with maximum length of 100 characters',
                    },
                },
                { status: 400 }
            );
        }

        if (body.firmwareVersion !== undefined && body.firmwareVersion !== null && (typeof body.firmwareVersion !== 'string' || body.firmwareVersion.length > 50)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Firmware version must be a string with maximum length of 50 characters',
                    },
                },
                { status: 400 }
            );
        }

        if (body.serialNumber !== undefined && body.serialNumber !== null && (typeof body.serialNumber !== 'string' || body.serialNumber.length > 100)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Serial number must be a string with maximum length of 100 characters',
                    },
                },
                { status: 400 }
            );
        }

        if (body.apiUsername !== undefined && body.apiUsername !== null && (typeof body.apiUsername !== 'string' || body.apiUsername.trim() === '' || body.apiUsername.length > 255)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'API username must be a non-empty string with maximum length of 255 characters',
                    },
                },
                { status: 400 }
            );
        }

        if (body.apiPassword !== undefined && body.apiPassword !== null && (typeof body.apiPassword !== 'string' || body.apiPassword.trim() === '')) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'API password must be a non-empty string',
                    },
                },
                { status: 400 }
            );
        }

        // Trim whitespace from string fields
        if (body.model) body.model = body.model.trim();
        if (body.firmwareVersion) body.firmwareVersion = body.firmwareVersion.trim();
        if (body.serialNumber) body.serialNumber = body.serialNumber.trim();
        if (body.managementIp) body.managementIp = body.managementIp.trim();
        if (body.apiUsername) body.apiUsername = body.apiUsername.trim();
        if (body.apiPassword) body.apiPassword = body.apiPassword.trim();

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

        const existingDevice = deviceCheckResult[0];

        // Verify device belongs to user's tenant (unless super admin)
        if (user.role !== UserRole.SUPER_ADMIN && existingDevice.tenantId !== user.tenant_id) {
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

        // Validate management IP format if provided
        if (body.managementIp !== undefined && body.managementIp !== null) {
            if (typeof body.managementIp !== 'string' || body.managementIp === '') {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Management IP must be a non-empty string',
                        },
                    },
                    { status: 400 }
                );
            }

            const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
            const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;
            if (!ipv4Regex.test(body.managementIp) && !ipv6Regex.test(body.managementIp)) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Invalid management IP address format. Must be a valid IPv4 or IPv6 address',
                        },
                    },
                    { status: 400 }
                );
            }

            // Validate IPv4 octets are in valid range (0-255)
            if (ipv4Regex.test(body.managementIp)) {
                const octets = body.managementIp.split('.').map(Number);
                if (octets.some(octet => octet < 0 || octet > 255)) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: {
                                code: 'VALIDATION_ERROR',
                                message: 'Invalid IPv4 address. Octets must be between 0 and 255',
                            },
                        },
                        { status: 400 }
                    );
                }
            }

            // Check if new management IP conflicts with another device in same tenant
            if (body.managementIp !== existingDevice.managementIp) {
                const conflictingDevice = await db
                    .select()
                    .from(firewallDevices)
                    .where(
                        and(
                            eq(firewallDevices.managementIp, body.managementIp),
                            eq(firewallDevices.tenantId, existingDevice.tenantId)
                        )
                    )
                    .limit(1);

                if (conflictingDevice.length > 0 && conflictingDevice[0].id !== deviceId) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: {
                                code: 'DUPLICATE_DEVICE',
                                message: `Device with management IP ${body.managementIp} already exists for this tenant`,
                            },
                        },
                        { status: 409 }
                    );
                }
            }
        }

        // Validate status if provided
        if (body.status && !['active', 'inactive', 'offline'].includes(body.status)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid status. Must be one of: active, inactive, offline',
                    },
                },
                { status: 400 }
            );
        }

        // Check if new serial number conflicts with another device
        if (body.serialNumber && body.serialNumber !== existingDevice.serialNumber) {
            const conflictingDevice = await db
                .select()
                .from(firewallDevices)
                .where(eq(firewallDevices.serialNumber, body.serialNumber))
                .limit(1);

            if (conflictingDevice.length > 0 && conflictingDevice[0].id !== deviceId) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'DUPLICATE_DEVICE',
                            message: `Device with serial number ${body.serialNumber} already exists`,
                        },
                    },
                    { status: 409 }
                );
            }
        }

        // Prepare update data
        const updateData: any = {
            updatedAt: new Date(),
        };

        if (body.model !== undefined) updateData.model = body.model;
        if (body.firmwareVersion !== undefined) updateData.firmwareVersion = body.firmwareVersion;
        if (body.serialNumber !== undefined) updateData.serialNumber = body.serialNumber;
        if (body.managementIp !== undefined) updateData.managementIp = body.managementIp;
        if (body.apiUsername !== undefined) updateData.apiUsername = body.apiUsername;
        if (body.status !== undefined) updateData.status = body.status;

        // Encrypt API password if provided
        if (body.apiPassword) {
            try {
    // Await params in Next.js 16
    const { id } = await params;
                updateData.apiPasswordEncrypted = await FirewallEncryption.encryptPassword(
                    body.apiPassword
                );
            } catch (error) {
                console.error('Failed to encrypt API password:', error);
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'ENCRYPTION_ERROR',
                            message: 'Failed to encrypt API credentials',
                        },
                    },
                    { status: 500 }
                );
            }
        }

        // Update device
        const updatedDevice = await db
            .update(firewallDevices)
            .set(updateData)
            .where(eq(firewallDevices.id, deviceId))
            .returning();

        if (updatedDevice.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'UPDATE_FAILED',
                        message: 'Failed to update device',
                    },
                },
                { status: 500 }
            );
        }

        // Return updated device without encrypted password
        const deviceResponse: FirewallDevice = {
            id: updatedDevice[0].id,
            tenantId: updatedDevice[0].tenantId,
            model: updatedDevice[0].model,
            firmwareVersion: updatedDevice[0].firmwareVersion,
            serialNumber: updatedDevice[0].serialNumber,
            managementIp: updatedDevice[0].managementIp,
            apiUsername: updatedDevice[0].apiUsername,
            apiPasswordEncrypted: null, // Never return encrypted password in API response
            uptimeSeconds: Number(updatedDevice[0].uptimeSeconds),
            lastSeenAt: updatedDevice[0].lastSeenAt,
            status: updatedDevice[0].status as 'active' | 'inactive' | 'offline',
            createdAt: updatedDevice[0].createdAt,
            updatedAt: updatedDevice[0].updatedAt,
        };

        return NextResponse.json(
            {
                success: true,
                data: deviceResponse,
                message: 'Firewall device updated successfully',
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error in PUT /api/firewall/devices/:id:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to update firewall device',
                },
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/firewall/devices/:id - Delete device
 * 
 * Requirements: 15.1 - Device Management API
 * - Delete device and all associated data (cascading)
 * - Enforce tenant isolation
 * - Only Super Admins and Tenant Admins can delete devices
 * - Stop polling for the device
 * - Return 404 if device not found
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
    // Await params in Next.js 16
    const { id } = await params;
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

        // Only Super Admins and Tenant Admins can delete devices
        if (!['super_admin', 'tenant_admin'].includes(user.role)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INSUFFICIENT_PERMISSIONS',
                        message: 'Only administrators can delete firewall devices',
                    },
                },
                { status: 403 }
            );
        }

        const deviceId = id;

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

        // Delete device (cascading deletes will handle related records)
        // The database schema has ON DELETE CASCADE for:
        // - firewall_health_snapshots
        // - firewall_security_posture
        // - firewall_licenses
        // - firewall_config_risks
        // - firewall_metrics_rollup
        // - firewall_alerts (device_id is nullable, but will be cleaned up)
        const deletedDevice = await db
            .delete(firewallDevices)
            .where(eq(firewallDevices.id, deviceId))
            .returning();

        if (deletedDevice.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'DELETE_FAILED',
                        message: 'Failed to delete device',
                    },
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: 'Firewall device deleted successfully',
                data: {
                    id: device.id,
                    serialNumber: device.serialNumber,
                    managementIp: device.managementIp,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error in DELETE /api/firewall/devices/:id:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to delete firewall device',
                },
            },
            { status: 500 }
        );
    }
}
