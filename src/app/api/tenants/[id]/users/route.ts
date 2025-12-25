import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '../../../../../middleware/auth.middleware';
import { UserRole, ApiResponse } from '../../../../../types';

/**
 * GET /api/tenants/[id]/users - Get tenant users with role management
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const role = searchParams.get('role') as UserRole | undefined;
    const is_active = searchParams.get('is_active') === 'true' ? true : 
                     searchParams.get('is_active') === 'false' ? false : undefined;

    const filters = {
      page,
      limit,
      role,
      is_active,
    };

    // Get tenant users
    const _result = await TenantService.getTenantUsers(
      tenantId,
      filters,
      user.user_id,
      user.role as UserRole,
      user.tenant_id
    );

    const response: ApiResponse = {
      success: true,
      data: result.users,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Error getting tenant users:', error);
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'TENANT_USERS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get tenant users',
      },
    };

    const statusCode = error instanceof Error && error.message.includes('permissions') ? 403 : 500;
    return NextResponse.json(response, { status: statusCode });
  }
}