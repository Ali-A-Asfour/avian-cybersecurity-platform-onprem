import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
// import { logger } from '@/lib/logger';
import { ApiResponse } from '@/types';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Await params in Next.js 16
    const { id } = await params;
    
    // Apply authentication and tenant middleware
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tenantResult = await tenantMiddleware(request, authResult.user);
    if (tenantResult instanceof NextResponse) {
      return tenantResult;
    }

    const { user, tenant } = tenantResult;
    const _agentId = id;

    // Only Super Admins and Tenant Admins can install tools
    if (!['super_admin', 'tenant_admin'].includes(user.role)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions to install tools on agent',
        },
      };
      return NextResponse.json(response, { status: 403 });
    }

    const body = await request.json();
    const { tool_config } = body;

    if (!tool_config || !tool_config.tool_name || !tool_config.vendor) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Tool configuration with tool_name and vendor is required',
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Install tool on agent
    const installedTool = await agentService.installTool(agentId, tool_config);

    const response: ApiResponse = {
      success: true,
      data: installedTool,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error('Failed to install tool on agent', { error, agentId: params.id });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'TOOL_INSTALL_ERROR',
        message: 'Failed to install tool on agent',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}