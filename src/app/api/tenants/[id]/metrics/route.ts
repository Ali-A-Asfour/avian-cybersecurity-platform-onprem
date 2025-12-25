import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '../../../../../middleware/auth.middleware';
import { UserRole, ApiResponse } from '../../../../../types';

/**
 * GET /api/tenants/[id]/metrics - Get tenant usage metrics
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

    // Get tenant metrics
    const metrics = await TenantService.getTenantMetrics(
      tenantId,
      user.user_id,
      user.role as UserRole,
      user.tenant_id
    );

    const response: ApiResponse = {
      success: true,
      data: metrics,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Error getting tenant metrics:', error);
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'TENANT_METRICS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get tenant metrics',
      },
    };

    const statusCode = error instanceof Error && error.message.includes('permissions') ? 403 : 500;
    return NextResponse.json(response, { status: statusCode });
  }
}