import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '../../../middleware/auth.middleware';
import { UserRole, ApiResponse } from '../../../types';
import { TenantService } from '../../../services/tenant.service';

/**
 * GET /api/tenants - List all tenants (Super Admin only)
 */
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const is_active = searchParams.get('is_active') === 'true' ? true : 
                     searchParams.get('is_active') === 'false' ? false : undefined;
    const search = searchParams.get('search') || undefined;

    const filters = {
      page,
      limit,
      is_active,
      search,
    };

    // Get tenants
    const result = await TenantService.listTenants(
      filters,
      user.user_id,
      user.role as UserRole,
      user.tenant_id
    );

    const response: ApiResponse = {
      success: true,
      data: result.tenants,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Error listing tenants:', error);
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'TENANT_LIST_ERROR',
        message: error instanceof Error ? error.message : 'Failed to list tenants',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}/**
 *
 POST /api/tenants - Create a new tenant (Super Admin only)
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { name, domain, logo_url, theme_color, settings } = body;

    // Validate required fields
    if (!name || !domain) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Name and domain are required',
            details: { name: !name ? 'Name is required' : undefined, domain: !domain ? 'Domain is required' : undefined }
          } 
        },
        { status: 400 }
      );
    }

    // Validate domain format (basic validation)
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9.-]{1,61}[a-zA-Z0-9]$/;
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

    // Create tenant
    const tenant = await TenantService.createTenant(
      {
        name,
        domain,
        logo_url,
        theme_color,
        settings,
      },
      user.user_id,
      user.role as UserRole
    );

    const response: ApiResponse = {
      success: true,
      data: tenant,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating tenant:', error);
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'TENANT_CREATE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create tenant',
      },
    };

    const statusCode = error instanceof Error && error.message.includes('permissions') ? 403 : 500;
    return NextResponse.json(response, { status: statusCode });
  }
}