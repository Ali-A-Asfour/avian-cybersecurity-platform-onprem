import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import { edrDevices, edrRemoteActions } from '../../../../../../database/schemas/edr';
import { eq, and } from 'drizzle-orm';
import { EnvironmentGraphClient } from '@/lib/defender/graph-client';
import { z } from 'zod';

// Request validation schema
const isolateDeviceSchema = z.object({
  deviceId: z.string().uuid('Invalid device ID'),
  comment: z.string().optional().default('Device isolated via AVIAN platform'),
  isolationType: z.enum(['Full', 'Selective']).optional().default('Full'),
});

const releaseDeviceSchema = z.object({
  deviceId: z.string().uuid('Invalid device ID'),
  comment: z.string().optional().default('Device released via AVIAN platform'),
});

/**
 * POST /api/edr/actions/isolate - Isolate device using Microsoft Defender
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
    const validatedData = isolateDeviceSchema.parse(body);

    // Get device from database
    const device = await db
      .select()
      .from(edrDevices)
      .where(and(
        eq(edrDevices.id, validatedData.deviceId),
        eq(edrDevices.tenantId, user.tenant_id)
      ))
      .limit(1);

    if (device.length === 0) {
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

    const targetDevice = device[0];

    // Create Microsoft Graph client
    const graphClient = new EnvironmentGraphClient();

    // Record the action in database first
    const [actionRecord] = await db
      .insert(edrRemoteActions)
      .values({
        tenantId: user.tenant_id,
        deviceId: validatedData.deviceId,
        userId: user.user_id,
        actionType: 'isolate',
        status: 'pending',
        resultMessage: 'Isolation request initiated',
        initiatedAt: new Date(),
        completedAt: null,
        createdAt: new Date(),
      })
      .returning();

    try {
      // Execute isolation via Microsoft Graph API
      const result = await graphClient.isolateDevice(
        targetDevice.microsoftDeviceId,
        validatedData.comment
      );

      // Update action record with success
      await db
        .update(edrRemoteActions)
        .set({
          status: 'completed',
          resultMessage: `Device isolation successful. Action ID: ${result.id}`,
          completedAt: new Date(),
        })
        .where(eq(edrRemoteActions.id, actionRecord.id));

      return NextResponse.json({
        success: true,
        data: {
          actionId: actionRecord.id,
          microsoftActionId: result.id,
          deviceId: validatedData.deviceId,
          deviceName: targetDevice.deviceName,
          status: 'completed',
          message: 'Device isolated successfully',
        },
      });
    } catch (error) {
      // Update action record with failure
      await db
        .update(edrRemoteActions)
        .set({
          status: 'failed',
          resultMessage: `Device isolation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          completedAt: new Date(),
        })
        .where(eq(edrRemoteActions.id, actionRecord.id));

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ISOLATION_FAILED',
            message: `Failed to isolate device: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in POST /api/edr/actions/isolate:', error);

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
          message: 'Failed to process isolation request',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/edr/actions/isolate - Release device from isolation
 */
export async function DELETE(request: NextRequest) {
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
    const validatedData = releaseDeviceSchema.parse(body);

    // Get device from database
    const device = await db
      .select()
      .from(edrDevices)
      .where(and(
        eq(edrDevices.id, validatedData.deviceId),
        eq(edrDevices.tenantId, user.tenant_id)
      ))
      .limit(1);

    if (device.length === 0) {
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

    const targetDevice = device[0];

    // Create Microsoft Graph client
    const graphClient = new EnvironmentGraphClient();

    // Record the action in database first
    const [actionRecord] = await db
      .insert(edrRemoteActions)
      .values({
        tenantId: user.tenant_id,
        deviceId: validatedData.deviceId,
        userId: user.user_id,
        actionType: 'unisolate',
        status: 'pending',
        resultMessage: 'Release request initiated',
        initiatedAt: new Date(),
        completedAt: null,
        createdAt: new Date(),
      })
      .returning();

    try {
      // Execute release via Microsoft Graph API
      const result = await graphClient.releaseDevice(
        targetDevice.microsoftDeviceId,
        validatedData.comment
      );

      // Update action record with success
      await db
        .update(edrRemoteActions)
        .set({
          status: 'completed',
          resultMessage: `Device release successful. Action ID: ${result.id}`,
          completedAt: new Date(),
        })
        .where(eq(edrRemoteActions.id, actionRecord.id));

      return NextResponse.json({
        success: true,
        data: {
          actionId: actionRecord.id,
          microsoftActionId: result.id,
          deviceId: validatedData.deviceId,
          deviceName: targetDevice.deviceName,
          status: 'completed',
          message: 'Device released from isolation successfully',
        },
      });
    } catch (error) {
      // Update action record with failure
      await db
        .update(edrRemoteActions)
        .set({
          status: 'failed',
          resultMessage: `Device release failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          completedAt: new Date(),
        })
        .where(eq(edrRemoteActions.id, actionRecord.id));

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RELEASE_FAILED',
            message: `Failed to release device: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in DELETE /api/edr/actions/isolate:', error);

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
          message: 'Failed to process release request',
        },
      },
      { status: 500 }
    );
  }
}