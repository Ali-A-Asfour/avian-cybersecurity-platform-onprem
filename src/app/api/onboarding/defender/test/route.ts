import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { MicrosoftGraphClient } from '@/lib/defender/graph-client';
import { z } from 'zod';

const testConnectionSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID format'),
  clientId: z.string().uuid('Invalid client ID format'),
  clientSecret: z.string().min(1, 'Client secret is required'),
});

/**
 * POST /api/onboarding/defender/test
 * Test Microsoft Graph API connection during onboarding
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

    // Check if user has permission to access client onboarding
    const allowedRoles = ['super_admin'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to access client onboarding',
          },
        },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = testConnectionSchema.parse(body);

    // Create Graph API client and test connection
    const graphClient = new MicrosoftGraphClient({
      clientId: validatedData.clientId,
      clientSecret: validatedData.clientSecret,
      tenantId: validatedData.tenantId,
    });

    // Test authentication by getting access token
    let accessToken;
    try {
      accessToken = await graphClient.getAccessToken();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_FAILED',
            message: 'Failed to authenticate with Microsoft Graph. Please check your credentials.',
          },
        },
        { status: 401 }
      );
    }

    // Test basic API access
    const connectionTest = await graphClient.testConnection();
    if (!connectionTest) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONNECTION_FAILED',
            message: 'Authentication successful but API access failed. Please check permissions.',
          },
        },
        { status: 403 }
      );
    }

    // Get sample data to verify permissions
    let deviceCount = 0;
    let alertCount = 0;
    let permissionIssues = [];

    try {
      // Test Defender devices access
      const defenderDevices = await graphClient.getDefenderDevices();
      deviceCount = defenderDevices.length;
    } catch (error) {
      permissionIssues.push('SecurityEvents.Read.All or Device.Read.All permission may be missing');
    }

    try {
      // Test alerts access
      const alerts = await graphClient.getDefenderAlerts();
      alertCount = alerts.length;
    } catch (error) {
      permissionIssues.push('SecurityEvents.Read.All permission may be missing');
    }

    // Test Intune access
    let intuneDeviceCount = 0;
    try {
      const intuneDevices = await graphClient.getIntuneDevices();
      intuneDeviceCount = intuneDevices.length;
    } catch (error) {
      permissionIssues.push('DeviceManagementManagedDevices.Read.All permission may be missing');
    }

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        tenantInfo: {
          tenantId: validatedData.tenantId,
          defenderDevices: deviceCount,
          intuneDevices: intuneDeviceCount,
          recentAlerts: alertCount,
        },
        permissions: {
          issues: permissionIssues,
          hasBasicAccess: true,
          canReadDevices: deviceCount > 0 || intuneDeviceCount > 0,
          canReadAlerts: alertCount >= 0, // 0 alerts is still valid
        },
        message: permissionIssues.length > 0 
          ? 'Connected with limited permissions. Some features may not work.'
          : 'Successfully connected to Microsoft Graph with full permissions',
      },
    });

  } catch (error) {
    console.error('Error in POST /api/onboarding/defender/test:', error);

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

    // Handle specific Microsoft Graph errors
    if (error instanceof Error) {
      if (error.message.includes('invalid_client')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_CLIENT',
              message: 'Invalid client ID or secret. Please check your Azure app registration.',
            },
          },
          { status: 401 }
        );
      }

      if (error.message.includes('invalid_tenant')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_TENANT',
              message: 'Invalid tenant ID. Please check your Azure tenant ID.',
            },
          },
          { status: 401 }
        );
      }

      if (error.message.includes('insufficient_claims')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message: 'Insufficient permissions. Please grant the required API permissions in Azure.',
            },
          },
          { status: 403 }
        );
      }

      if (error.message.includes('timeout')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'TIMEOUT',
              message: 'Connection timeout. Please try again.',
            },
          },
          { status: 408 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to test Microsoft Graph connection',
        },
      },
      { status: 500 }
    );
  }
}