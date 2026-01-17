import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import { firewallDevices } from '../../../../../database/schemas/firewall';
import { eq, and, desc } from 'drizzle-orm';
import { SonicWallAPIClient } from '@/lib/sonicwall/api-client';
import { EnvironmentCredentialManager } from '@/lib/sonicwall/encryption';
import { sonicWallPollingEngine } from '@/lib/sonicwall/polling-engine';
import { z } from 'zod';

// Request validation schemas
const registerDeviceSchema = z.object({
  model: z.string().optional(),
  firmwareVersion: z.string().optional(),
  serialNumber: z.string().optional(),
  managementIp: z.string().ip('Invalid IP address'),
  apiUsername: z.string().min(1, 'API username is required'),
  apiPassword: z.string().min(1, 'API password is required'),
});

const updateDeviceSchema = z.object({
  model: z.string().optional(),
  firmwareVersion: z.string().optional(),
  serialNumber: z.string().optional(),
  managementIp: z.string().ip('Invalid IP address').optional(),
  apiUsername: z.string().min(1).optional(),
  apiPassword: z.string().min(1).optional(),
  status: z.enum(['active', 'inactive', 'offline']).optional(),
});

/**
 * GET /api/firewall/devices - List all firewall devices for tenant
 */
export async function GET(request: NextRequest) {
  try {
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

    // Get devices for tenant
    const devices = await db
      .select({
        id: firewallDevices.id,
        tenantId: firewallDevices.tenantId,
        model: firewallDevices.model,
        firmwareVersion: firewallDevices.firmwareVersion,
        serialNumber: firewallDevices.serialNumber,
        managementIp: firewallDevices.managementIp,
        apiUsername: firewallDevices.apiUsername,
        // Don't return encrypted password
        uptimeSeconds: firewallDevices.uptimeSeconds,
        lastSeenAt: firewallDevices.lastSeenAt,
        status: firewallDevices.status,
        createdAt: firewallDevices.createdAt,
        updatedAt: firewallDevices.updatedAt,
      })
      .from(firewallDevices)
      .where(eq(firewallDevices.tenantId, user.tenant_id))
      .orderBy(desc(firewallDevices.createdAt));

    // Add polling status for each device
    const devicesWithStatus = devices.map(device => ({
      ...device,
      pollingStatus: sonicWallPollingEngine.getPollingStatus(device.id),
    }));

    return NextResponse.json({
      success: true,
      data: devicesWithStatus,
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

/**
 * POST /api/firewall/devices - Register new SonicWall device
 */
export async function POST(request: NextRequest) {
  try {
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

    // Parse and validate request body
    const body = await request.json();
    const validatedData = registerDeviceSchema.parse(body);

    // Check if device with same IP already exists for tenant
    const existingDevice = await db
      .select()
      .from(firewallDevices)
      .where(and(
        eq(firewallDevices.tenantId, user.tenant_id),
        eq(firewallDevices.managementIp, validatedData.managementIp)
      ))
      .limit(1);

    if (existingDevice.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DEVICE_EXISTS',
            message: 'A device with this management IP already exists',
          },
        },
        { status: 400 }
      );
    }

    // Test connection to SonicWall device
    const apiClient = new SonicWallAPIClient({
      baseUrl: `https://${validatedData.managementIp}`,
      username: validatedData.apiUsername,
      password: validatedData.apiPassword,
    });

    const connectionTest = await apiClient.testConnection();
    if (!connectionTest) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONNECTION_FAILED',
            message: 'Failed to connect to SonicWall device. Please check IP address and credentials.',
          },
        },
        { status: 400 }
      );
    }

    // Get device information from API
    let systemHealth;
    try {
      systemHealth = await apiClient.getSystemHealth();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'API_ERROR',
            message: 'Connected to device but failed to retrieve system information',
          },
        },
        { status: 400 }
      );
    }

    // Encrypt credentials
    const credentialManager = new EnvironmentCredentialManager();
    const encryptedCredentials = credentialManager.encryptCredentials(
      validatedData.apiUsername,
      validatedData.apiPassword
    );

    // Create device record
    const [newDevice] = await db
      .insert(firewallDevices)
      .values({
        tenantId: user.tenant_id,
        model: validatedData.model || systemHealth.model,
        firmwareVersion: validatedData.firmwareVersion || systemHealth.firmware_version,
        serialNumber: validatedData.serialNumber || systemHealth.serial_number,
        managementIp: validatedData.managementIp,
        apiUsername: encryptedCredentials.iv, // Store IV in username field
        apiPasswordEncrypted: encryptedCredentials.encrypted,
        uptimeSeconds: systemHealth.uptime_seconds,
        lastSeenAt: new Date(),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Start polling for this device
    try {
      await sonicWallPollingEngine.startPolling(newDevice.id);
    } catch (error) {
      console.error(`Failed to start polling for device ${newDevice.id}:`, error);
      // Don't fail the registration if polling fails
    }

    // Return device without sensitive data
    const deviceResponse = {
      id: newDevice.id,
      tenantId: newDevice.tenantId,
      model: newDevice.model,
      firmwareVersion: newDevice.firmwareVersion,
      serialNumber: newDevice.serialNumber,
      managementIp: newDevice.managementIp,
      apiUsername: validatedData.apiUsername, // Return original username
      uptimeSeconds: newDevice.uptimeSeconds,
      lastSeenAt: newDevice.lastSeenAt,
      status: newDevice.status,
      createdAt: newDevice.createdAt,
      updatedAt: newDevice.updatedAt,
      pollingStatus: sonicWallPollingEngine.getPollingStatus(newDevice.id),
    };

    return NextResponse.json({
      success: true,
      data: deviceResponse,
      message: 'SonicWall device registered successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/firewall/devices:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.issues,
          },
        },
        { status: 400 }
      );
    }

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
 * PUT /api/firewall/devices - Update firewall device (requires device ID in query params)
 */
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('id');

    if (!deviceId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Device ID is required',
          },
        },
        { status: 400 }
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

    // Get existing device
    const existingDevice = await db
      .select()
      .from(firewallDevices)
      .where(and(
        eq(firewallDevices.id, deviceId),
        eq(firewallDevices.tenantId, user.tenant_id)
      ))
      .limit(1);

    if (existingDevice.length === 0) {
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

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateDeviceSchema.parse(body);

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Add fields that are being updated
    if (validatedData.model !== undefined) updateData.model = validatedData.model;
    if (validatedData.firmwareVersion !== undefined) updateData.firmwareVersion = validatedData.firmwareVersion;
    if (validatedData.serialNumber !== undefined) updateData.serialNumber = validatedData.serialNumber;
    if (validatedData.managementIp !== undefined) updateData.managementIp = validatedData.managementIp;
    if (validatedData.status !== undefined) updateData.status = validatedData.status;

    // Handle credential updates
    if (validatedData.apiUsername || validatedData.apiPassword) {
      if (!validatedData.apiUsername || !validatedData.apiPassword) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Both username and password are required when updating credentials',
            },
          },
          { status: 400 }
        );
      }

      // Test new credentials if provided
      const testIp = validatedData.managementIp || existingDevice[0].managementIp;
      const apiClient = new SonicWallAPIClient({
        baseUrl: `https://${testIp}`,
        username: validatedData.apiUsername,
        password: validatedData.apiPassword,
      });

      const connectionTest = await apiClient.testConnection();
      if (!connectionTest) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CONNECTION_FAILED',
              message: 'Failed to connect with new credentials',
            },
          },
          { status: 400 }
        );
      }

      // Encrypt new credentials
      const credentialManager = new EnvironmentCredentialManager();
      const encryptedCredentials = credentialManager.encryptCredentials(
        validatedData.apiUsername,
        validatedData.apiPassword
      );

      updateData.apiUsername = encryptedCredentials.iv;
      updateData.apiPasswordEncrypted = encryptedCredentials.encrypted;

      // Restart polling with new credentials
      sonicWallPollingEngine.stopPolling(deviceId);
    }

    // Update device
    const [updatedDevice] = await db
      .update(firewallDevices)
      .set(updateData)
      .where(eq(firewallDevices.id, deviceId))
      .returning();

    // Restart polling if credentials or IP changed
    if (validatedData.apiUsername || validatedData.managementIp) {
      try {
        await sonicWallPollingEngine.startPolling(deviceId);
      } catch (error) {
        console.error(`Failed to restart polling for device ${deviceId}:`, error);
      }
    }

    // Return updated device without sensitive data
    const deviceResponse = {
      id: updatedDevice.id,
      tenantId: updatedDevice.tenantId,
      model: updatedDevice.model,
      firmwareVersion: updatedDevice.firmwareVersion,
      serialNumber: updatedDevice.serialNumber,
      managementIp: updatedDevice.managementIp,
      apiUsername: validatedData.apiUsername || 'configured',
      uptimeSeconds: updatedDevice.uptimeSeconds,
      lastSeenAt: updatedDevice.lastSeenAt,
      status: updatedDevice.status,
      createdAt: updatedDevice.createdAt,
      updatedAt: updatedDevice.updatedAt,
      pollingStatus: sonicWallPollingEngine.getPollingStatus(updatedDevice.id),
    };

    return NextResponse.json({
      success: true,
      data: deviceResponse,
      message: 'Firewall device updated successfully',
    });
  } catch (error) {
    console.error('Error in PUT /api/firewall/devices:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.issues,
          },
        },
        { status: 400 }
      );
    }

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
 * DELETE /api/firewall/devices - Delete firewall device (requires device ID in query params)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('id');

    if (!deviceId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Device ID is required',
          },
        },
        { status: 400 }
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

    // Check if device exists and belongs to tenant
    const existingDevice = await db
      .select()
      .from(firewallDevices)
      .where(and(
        eq(firewallDevices.id, deviceId),
        eq(firewallDevices.tenantId, user.tenant_id)
      ))
      .limit(1);

    if (existingDevice.length === 0) {
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

    // Stop polling for this device
    sonicWallPollingEngine.stopPolling(deviceId);

    // Delete device (cascade will handle related records)
    await db
      .delete(firewallDevices)
      .where(eq(firewallDevices.id, deviceId));

    return NextResponse.json({
      success: true,
      message: 'Firewall device deleted successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/firewall/devices:', error);
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