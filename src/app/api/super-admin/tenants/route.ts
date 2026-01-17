/**
 * Super Admin Tenant Management API
 * Handles tenant creation and management for super admins
 */

import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';

/**
 * POST /api/super-admin/tenants
 * Create a new tenant with security monitoring setup
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

    // Check if user is super admin
    if (user.role !== 'super_admin') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only super admins can create tenants',
          },
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { tenantInfo, sonicwallDevices, microsoftCreds } = body;

    // Validate required fields
    if (!tenantInfo?.name || !tenantInfo?.identifier || !tenantInfo?.contact) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Tenant name, identifier, and contact email are required',
          },
        },
        { status: 400 }
      );
    }

    // For demo mode, simulate tenant creation
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      // Import mock tenant store
      const { addMockTenant } = await import('@/lib/mock-tenant-store');
      
      // Create new tenant
      const newTenant = {
        id: `tenant-${Date.now()}`,
        name: tenantInfo.name,
        domain: tenantInfo.domain || '', // Optional domain
        identifier: tenantInfo.identifier, // Required identifier
        industry: tenantInfo.industry || 'Other',
        contact: tenantInfo.contact,
        timezone: tenantInfo.timezone || 'EST',
        is_active: true,
        users_count: 0,
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        sonicwall_devices: sonicwallDevices || [],
        microsoft_integration: microsoftCreds ? {
          tenant_id: microsoftCreds.tenantId,
          client_id: microsoftCreds.clientId,
          configured: true,
        } : null,
      };

      // Add to mock store
      addMockTenant(newTenant);

      return NextResponse.json({
        success: true,
        data: {
          tenant: newTenant,
          message: `Tenant "${tenantInfo.name}" created successfully`,
        },
      });
    }

    // Production mode would use the TenantService
    // const { TenantService } = await import('@/services/tenant.service');
    // const newTenant = await TenantService.createTenant(tenantInfo, user.id, user.role);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Tenant creation not implemented in production mode yet',
      },
    });

  } catch (error) {
    console.error('Error creating tenant:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create tenant',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/super-admin/tenants
 * List all tenants (super admin only)
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

    // Check if user is super admin
    if (user.role !== 'super_admin') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only super admins can list tenants',
          },
        },
        { status: 403 }
      );
    }

    // For demo mode, return mock tenants
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      const { getMockTenants } = await import('@/lib/mock-tenant-store');
      const tenants = getMockTenants();

      return NextResponse.json({
        success: true,
        data: {
          tenants,
          total: tenants.length,
        },
      });
    }

    // Production mode would use the TenantService
    // const { TenantService } = await import('@/services/tenant.service');
    // const tenants = await TenantService.listTenants(user.role, user.tenant_id);

    return NextResponse.json({
      success: true,
      data: {
        tenants: [],
        total: 0,
      },
    });

  } catch (error) {
    console.error('Error listing tenants:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list tenants',
        },
      },
      { status: 500 }
    );
  }
}