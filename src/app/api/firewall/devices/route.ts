import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import { firewallDevices } from '../../../../../database/schemas/firewall';
import { FirewallEncryption } from '@/lib/firewall-encryption';
import { eq, and } from 'drizzle-orm';
import { RegisterDeviceRequest, FirewallDevice } from '@/types/firewall';
import { UserRole } from '@/types';

/**
 * POST /api/firewall/devices - Register a new firewall device
 * 
 * Requirements: 15.1 - Device Management API
 * - Register device with tenant association
 * - Encrypt API credentials before storage
 * - Validate input data
 * - Enforce authentication and tenant isolation
 * - Only Super Admins and Tenant Admins can register devices
 */
export async function POST(request: NextRequest) {
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

        // Only Super Admins and Tenant Admins can register devices
        if (!['super_admin', 'tenant_admin'].includes(user.role)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INSUFFICIENT_PERMISSIONS',
                        message: 'Only administrators can register firewall devices',
                    },
                },
                { status: 403 }
            );
        }

        // Parse request body
        let body: RegisterDeviceRequest;
        try {
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

        // Validate required fields
        if (!body.managementIp || typeof body.managementIp !== 'string' || body.managementIp.trim() === '') {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Management IP is required and must be a non-empty string',
                    },
                },
                { status: 400 }
            );
        }

        if (!body.apiUsername || typeof body.apiUsername !== 'string' || body.apiUsername.trim() === '') {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'API username is required and must be a non-empty string',
                    },
                },
                { status: 400 }
            );
        }

        if (!body.apiPassword || typeof body.apiPassword !== 'string' || body.apiPassword.trim() === '') {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'API password is required and must be a non-empty string',
                    },
                },
                { status: 400 }
            );
        }

        // Validate optional string fields if provided
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

        // Trim whitespace from string fields
        body.managementIp = body.managementIp.trim();
        body.apiUsername = body.apiUsername.trim();
        body.apiPassword = body.apiPassword.trim();
        if (body.model) body.model = body.model.trim();
        if (body.firmwareVersion) body.firmwareVersion = body.firmwareVersion.trim();
        if (body.serialNumber) body.serialNumber = body.serialNumber.trim();

        // Validate management IP format (basic IPv4/IPv6 validation)
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

        // Validate tenant ID matches user's tenant (unless super admin)
        const targetTenantId = body.tenantId || user.tenant_id;
        if (user.role !== UserRole.SUPER_ADMIN && targetTenantId !== user.tenant_id) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Cannot register device for another tenant',
                    },
                },
                { status: 403 }
            );
        }

        // Check if device with same serial number already exists
        if (body.serialNumber) {
            const existingDevice = await db
                .select()
                .from(firewallDevices)
                .where(eq(firewallDevices.serialNumber, body.serialNumber))
                .limit(1);

            if (existingDevice.length > 0) {
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

        // Check if device with same management IP already exists for this tenant
        const existingIpDevice = await db
            .select()
            .from(firewallDevices)
            .where(
                and(
                    eq(firewallDevices.managementIp, body.managementIp),
                    eq(firewallDevices.tenantId, targetTenantId)
                )
            )
            .limit(1);

        if (existingIpDevice.length > 0) {
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

        // Encrypt API password
        let encryptedPassword: string;
        try {
            encryptedPassword = await FirewallEncryption.encryptPassword(body.apiPassword);
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

        // Create device record
        const newDevice = await db
            .insert(firewallDevices)
            .values({
                tenantId: targetTenantId,
                model: body.model || null,
                firmwareVersion: body.firmwareVersion || null,
                serialNumber: body.serialNumber || null,
                managementIp: body.managementIp,
                apiUsername: body.apiUsername,
                apiPasswordEncrypted: encryptedPassword,
                status: 'active',
                uptimeSeconds: 0,
                lastSeenAt: null,
            })
            .returning();

        // Return device without encrypted password
        const deviceResponse: FirewallDevice = {
            id: newDevice[0].id,
            tenantId: newDevice[0].tenantId,
            model: newDevice[0].model,
            firmwareVersion: newDevice[0].firmwareVersion,
            serialNumber: newDevice[0].serialNumber,
            managementIp: newDevice[0].managementIp,
            apiUsername: newDevice[0].apiUsername,
            apiPasswordEncrypted: null, // Never return encrypted password in API response
            uptimeSeconds: Number(newDevice[0].uptimeSeconds),
            lastSeenAt: newDevice[0].lastSeenAt,
            status: newDevice[0].status as 'active' | 'inactive' | 'offline',
            createdAt: newDevice[0].createdAt,
            updatedAt: newDevice[0].updatedAt,
        };

        return NextResponse.json(
            {
                success: true,
                data: deviceResponse,
                message: 'Firewall device registered successfully',
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error in POST /api/firewall/devices:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to register firewall device',
                },
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/firewall/devices - List all firewall devices for tenant
 * 
 * Requirements: 15.2 - Device Management API
 * - List devices filtered by tenant
 * - Support pagination
 * - Enforce tenant isolation
 */
export async function GET(request: NextRequest) {
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

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const limitParam = searchParams.get('limit') || '50';
        const offsetParam = searchParams.get('offset') || '0';

        // Validate pagination parameters
        const limit = parseInt(limitParam);
        const offset = parseInt(offsetParam);

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

        if (isNaN(offset) || offset < 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Offset must be a non-negative number',
                    },
                },
                { status: 400 }
            );
        }

        // Validate status parameter if provided
        if (status && !['active', 'inactive', 'offline'].includes(status)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Status must be one of: active, inactive, offline',
                    },
                },
                { status: 400 }
            );
        }

        // Build query with filters
        const whereConditions = status
            ? and(
                eq(firewallDevices.tenantId, user.tenant_id),
                eq(firewallDevices.status, status)
            )
            : eq(firewallDevices.tenantId, user.tenant_id);

        // Apply pagination
        const devices = await db
            .select()
            .from(firewallDevices)
            .where(whereConditions)
            .limit(limit)
            .offset(offset);

        // Remove encrypted passwords from response
        const devicesResponse = devices.map((device) => ({
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
        }));

        return NextResponse.json({
            success: true,
            data: devicesResponse,
            meta: {
                total: devicesResponse.length,
                limit,
                offset,
            },
        });
    } catch (error) {
        console.error('Error in GET /api/firewall/devices:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve firewall devices',
                },
            },
            { status: 500 }
        );
    }
}
