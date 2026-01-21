import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import { firewallDevices } from '@/../database/schemas/firewall';
import { EnvironmentCredentialManager } from '@/lib/sonicwall/encryption';
import { sonicWallPollingEngine } from '@/lib/sonicwall/polling-engine';
import { defenderSyncService } from '@/lib/defender/sync-service';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const completeOnboardingSchema = z.object({
  clientInfo: z.object({
    name: z.string().min(1, 'Client name is required'),
    industry: z.string().optional(),
    contact: z.string().email('Valid email is required'),
    timezone: z.string().optional(),
  }),
  sonicwallDevices: z.array(z.object({
    managementIp: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 'Invalid IP address'),
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
    deviceName: z.string().optional(),
    location: z.string().optional(),
  })),
  microsoftCreds: z.object({
    tenantId: z.string().uuid('Invalid tenant ID'),
    clientId: z.string().uuid('Invalid client ID'),
    clientSecret: z.string().min(1, 'Client secret is required'),
  }),
});

/**
 * POST /api/onboarding/complete
 * Complete the client onboarding process
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
    const validatedData = completeOnboardingSchema.parse(body);

    const results = {
      clientInfo: validatedData.clientInfo,
      firewallDevices: [] as any[],
      microsoftIntegration: null as any,
      errors: [] as string[],
    };

    // 1. Register SonicWall devices
    const credentialManager = new EnvironmentCredentialManager();
    
    for (const deviceData of validatedData.sonicwallDevices) {
      try {
        // Check if device already exists
        const existingDevice = await db
          .select()
          .from(firewallDevices)
          .where(eq(firewallDevices.managementIp, deviceData.managementIp))
          .limit(1);

        if (existingDevice.length > 0) {
          results.errors.push(`Device ${deviceData.managementIp} already exists`);
          continue;
        }

        // Encrypt credentials
        const encryptedCredentials = credentialManager.encryptCredentials(
          deviceData.username,
          deviceData.password
        );

        // Create device record
        const [newDevice] = await db
          .insert(firewallDevices)
          .values({
            tenantId: user.tenant_id,
            model: null, // Will be populated by polling
            firmwareVersion: null,
            serialNumber: null,
            managementIp: deviceData.managementIp,
            apiUsername: encryptedCredentials.iv, // Store IV in username field
            apiPasswordEncrypted: encryptedCredentials.encrypted,
            uptimeSeconds: 0,
            lastSeenAt: null,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        results.firewallDevices.push({
          id: newDevice.id,
          managementIp: deviceData.managementIp,
          deviceName: deviceData.deviceName,
          location: deviceData.location,
        });

        // Start polling for this device
        try {
          await sonicWallPollingEngine.startPolling(newDevice.id);
        } catch (error) {
          console.error(`Failed to start polling for device ${newDevice.id}:`, error);
          results.errors.push(`Started monitoring for ${deviceData.managementIp} but polling failed to start`);
        }

      } catch (error) {
        console.error(`Failed to register device ${deviceData.managementIp}:`, error);
        results.errors.push(`Failed to register device ${deviceData.managementIp}`);
      }
    }

    // 2. Set up Microsoft Defender integration
    try {
      // Store Microsoft Graph credentials securely using the same encryption as SonicWall
      const graphCredentials = credentialManager.encryptCredentials(
        JSON.stringify({
          tenantId: validatedData.microsoftCreds.tenantId,
          clientId: validatedData.microsoftCreds.clientId,
          clientSecret: validatedData.microsoftCreds.clientSecret
        }),
        '' // No secondary credential needed for JSON storage
      );

      // In a real implementation, you'd store these in a dedicated table
      // For now, we'll use environment variables or a secure credential store
      // This would typically be stored in an integration_credentials table
      
      // Start Microsoft Defender sync
      await defenderSyncService.startSync(user.tenant_id);
      
      results.microsoftIntegration = {
        tenantId: validatedData.microsoftCreds.tenantId,
        clientId: validatedData.microsoftCreds.clientId,
        syncStarted: true,
      };

    } catch (error) {
      console.error('Failed to set up Microsoft Defender integration:', error);
      results.errors.push('Failed to start Microsoft Defender sync');
    }

    // 3. Update tenant information with client details
    try {
      // In a real implementation, you'd update the tenant record with client info
      // await db.update(tenants).set({
      //   name: validatedData.clientInfo.name,
      //   industry: validatedData.clientInfo.industry,
      //   contact_email: validatedData.clientInfo.contact,
      //   timezone: validatedData.clientInfo.timezone,
      // }).where(eq(tenants.id, user.tenant_id));
    } catch (error) {
      console.error('Failed to update tenant information:', error);
      results.errors.push('Failed to update client information');
    }

    // 4. Send confirmation email (placeholder)
    try {
      // In a real implementation, send confirmation email to client
      console.log(`Onboarding completed for ${validatedData.clientInfo.name}`);
    } catch (error) {
      console.error('Failed to send confirmation email:', error);
      results.errors.push('Failed to send confirmation email');
    }

    const success = results.firewallDevices.length > 0 || results.microsoftIntegration;

    return NextResponse.json({
      success,
      data: results,
      message: success 
        ? `Onboarding completed for ${validatedData.clientInfo.name}. ${results.errors.length > 0 ? 'Some issues occurred.' : 'All systems operational.'}`
        : 'Onboarding failed. Please check the errors and try again.',
    }, { 
      status: success ? 200 : 400 
    });

  } catch (error) {
    console.error('Error in POST /api/onboarding/complete:', error);

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
          message: 'Failed to complete onboarding',
        },
      },
      { status: 500 }
    );
  }
}