import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '../../../../middleware/auth.middleware';
import { UserRole, ApiResponse } from '../../../../types';

/**
 * GET /api/tenants/[id] - Get tenant by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate and authorize
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const resolvedParams = await params;
    const _tenantId = resolvedParams.id;

    // Get tenant
    const _tenant = await TenantService.getTenantById(
      tenantId,
      user.user_id,
      user.role as UserRole,
      user.tenant_id
    );

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } },
        { status: 404 }
      );
    }

    const response: ApiResponse = {
      success: true,
      data: tenant,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Error getting tenant:', error);
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'TENANT_GET_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get tenant',
      },
    };

    const statusCode = error instanceof Error && error.message.includes('permissions') ? 403 : 500;
    return NextResponse.json(response, { status: statusCode });
  }
}/**
 
* PUT /api/tenants/[id] - Update tenant
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate and authorize
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const resolvedParams = await params;
    const _tenantId = resolvedParams.id;

    // Parse request body
    const body = await request.json();
    const { name, domain, logo_url, theme_color, settings, is_active } = body;

    // Validate domain format if provided
    if (domain) {
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]$/;
      if (!domainRegex.test(domain)) {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'VALIDATION_ERROR', 
              message: 'Invalid domain format',
              details: { domain: 'Domain must be alphanumeric with hyphens, 2-63 characters' }
            } 
          },
          { status: 400 }
        );
      }
    }

    // Update tenant
    const _tenant = await TenantService.updateTenant(
      tenantId,
      {
        name,
        domain,
        logo_url,
        theme_color,
        settings,
        is_active,
      },
      user.user_id,
      user.role as UserRole,
      user.tenant_id
    );

    const response: ApiResponse = {
      success: true,
      data: tenant,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Error updating tenant:', error);
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'TENANT_UPDATE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update tenant',
      },
    };

    const statusCode = error instanceof Error && error.message.includes('permissions') ? 403 : 500;
    return NextResponse.json(response, { status: statusCode });
  }
}

/**
 * DELETE /api/tenants/[id] - Delete (deactivate) tenant
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate and authorize
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const resolvedParams = await params;
    const _tenantId = resolvedParams.id;

    // Delete tenant
    await TenantService.deleteTenant(
      tenantId,
      user.user_id,
      user.role as UserRole
    );

    const response: ApiResponse = {
      success: true,
      data: { message: 'Tenant deleted successfully' },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Error deleting tenant:', error);
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'TENANT_DELETE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to delete tenant',
      },
    };

    const statusCode = error instanceof Error && error.message.includes('permissions') ? 403 : 500;
    return NextResponse.json(response, { status: statusCode });
  }
}