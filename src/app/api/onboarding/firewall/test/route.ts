import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { SonicWallAPIClient } from '@/lib/sonicwall/api-client';
import { z } from 'zod';

const testConnectionSchema = z.object({
  managementIp: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 'Invalid IP address'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /api/onboarding/firewall/test
 * Test SonicWall device connection during onboarding
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

    // Create API client and test connection
    const apiClient = new SonicWallAPIClient({
      baseUrl: `https://${validatedData.managementIp}`,
      username: validatedData.username,
      password: validatedData.password,
      timeout: 15000, // 15 second timeout for onboarding
    });

    // Test connection and get basic device info
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

    // Get device information for verification
    let deviceInfo = null;
    try {
      const systemHealth = await apiClient.getSystemHealth();
      deviceInfo = {
        model: systemHealth.model,
        firmwareVersion: systemHealth.firmware_version,
        serialNumber: systemHealth.serial_number,
        uptime: systemHealth.uptime_seconds,
      };
    } catch (error) {
      // Connection works but couldn't get detailed info - still success
      console.warn('Could not retrieve device details:', error);
    }

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        deviceInfo,
        message: 'Successfully connected to SonicWall device',
      },
    });

  } catch (error) {
    console.error('Error in POST /api/onboarding/firewall/test:', error);

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

    // Handle specific SonicWall API errors
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'TIMEOUT',
              message: 'Connection timeout. Please check if the device is reachable and try again.',
            },
          },
          { status: 408 }
        );
      }

      if (error.message.includes('Authentication failed')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'AUTH_FAILED',
              message: 'Authentication failed. Please check username and password.',
            },
          },
          { status: 401 }
        );
      }

      if (error.message.includes('Network')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NETWORK_ERROR',
              message: 'Network error. Please check if the device IP is correct and reachable.',
            },
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to test SonicWall connection',
        },
      },
      { status: 500 }
    );
  }
}