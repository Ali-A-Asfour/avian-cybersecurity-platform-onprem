import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import { edrDevices, edrRemoteActions } from '../../../../../../database/schemas/edr';
import { eq, and } from 'drizzle-orm';
import { EnvironmentGraphClient } from '@/lib/defender/graph-client';
import { z } from 'zod';

// Request validation schema
const scanDeviceSchema = z.object({
  deviceId: z.string().uuid('Invalid device ID'),
  scanType: z.enum(['Quick', 'Full']).optional().default('Quick'),
  comment: z.string().optional().default('Antivirus scan initiated via AVIAN platform'),
});

/**
 * POST /api/edr/actions/scan - Run antivirus scan on device
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
    const validatedData = scanDeviceSchema.parse(body);

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
        actionType: 'scan',
        status: 'pending',
        resultMessage: `${validatedData.scanType} antivirus scan initiated`,
        initiatedAt: new Date(),
        completedAt: null,
        createdAt: new Date(),
      })
      .returning();

    try {
      // Execute scan via Microsoft Graph API
      const result = await graphClient.runAntivirusScan(
        targetDevice.microsoftDeviceId,
        validatedData.scanType
      );

      // Update action record with success
      await db
        .update(edrRemoteActions)
        .set({
          status: 'in_progress',
          resultMessage: `${validatedData.scanType} antivirus scan started successfully. Action ID: ${result.id}`,
        })
        .where(eq(edrRemoteActions.id, actionRecord.id));

      return NextResponse.json({
        success: true,
        data: {
          actionId: actionRecord.id,
          microsoftActionId: result.id,
          deviceId: validatedData.deviceId,
          deviceName: targetDevice.deviceName,
          scanType: validatedData.scanType,
          status: 'in_progress',
          message: `${validatedData.scanType} antivirus scan started successfully`,
        },
      });
    } catch (error) {
      // Update action record with failure
      await db
        .update(edrRemoteActions)
        .set({
          status: 'failed',
          resultMessage: `Antivirus scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          completedAt: new Date(),
        })
        .where(eq(edrRemoteActions.id, actionRecord.id));

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SCAN_FAILED',
            message: `Failed to start antivirus scan: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in POST /api/edr/actions/scan:', error);

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
          message: 'Failed to process scan request',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/edr/actions/scan - Get scan action status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const actionId = searchParams.get('actionId');
    const microsoftActionId = searchParams.get('microsoftActionId');

    if (!actionId && !microsoftActionId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Either actionId or microsoftActionId is required',
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

    let actionRecord = null;

    // Get action record from database if actionId provided
    if (actionId) {
      const actions = await db
        .select()
        .from(edrRemoteActions)
        .where(and(
          eq(edrRemoteActions.id, actionId),
          eq(edrRemoteActions.tenantId, user.tenant_id)
        ))
        .limit(1);

      if (actions.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Action not found',
            },
          },
          { status: 404 }
        );
      }

      actionRecord = actions[0];
    }

    // Get status from Microsoft Graph API if microsoftActionId provided
    let microsoftStatus = null;
    if (microsoftActionId) {
      try {
        const graphClient = new EnvironmentGraphClient();
        microsoftStatus = await graphClient.getActionStatus(microsoftActionId);
      } catch (error) {
        console.error('Failed to get Microsoft action status:', error);
        // Continue without Microsoft status if API call fails
      }
    }

    // Update local action record if we have both and Microsoft status is different
    if (actionRecord && microsoftStatus && actionRecord.status !== microsoftStatus.status) {
      try {
        await db
          .update(edrRemoteActions)
          .set({
            status: microsoftStatus.status as any,
            resultMessage: microsoftStatus.message || actionRecord.resultMessage,
            completedAt: microsoftStatus.status === 'completed' || microsoftStatus.status === 'failed' 
              ? new Date() 
              : actionRecord.completedAt,
          })
          .where(eq(edrRemoteActions.id, actionRecord.id));

        // Refresh action record
        const updatedActions = await db
          .select()
          .from(edrRemoteActions)
          .where(eq(edrRemoteActions.id, actionRecord.id))
          .limit(1);

        if (updatedActions.length > 0) {
          actionRecord = updatedActions[0];
        }
      } catch (error) {
        console.error('Failed to update action record:', error);
      }
    }

    // Prepare response
    const response: any = {
      success: true,
      data: {},
    };

    if (actionRecord) {
      response.data.actionId = actionRecord.id;
      response.data.deviceId = actionRecord.deviceId;
      response.data.actionType = actionRecord.actionType;
      response.data.status = actionRecord.status;
      response.data.resultMessage = actionRecord.resultMessage;
      response.data.initiatedAt = actionRecord.initiatedAt;
      response.data.completedAt = actionRecord.completedAt;
    }

    if (microsoftStatus) {
      response.data.microsoftActionId = microsoftActionId;
      response.data.microsoftStatus = microsoftStatus.status;
      response.data.microsoftMessage = microsoftStatus.message;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/edr/actions/scan:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get scan status',
        },
      },
      { status: 500 }
    );
  }
}