import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { logger } from '@/lib/logger';
import { ApiResponse } from '@/types';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const agentId = params.id;
  try {
    // Apply authentication and tenant middleware
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

    const tenantResult = await tenantMiddleware(request, authResult.user);
    if (!tenantResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: tenantResult.error || {
            code: 'TENANT_ERROR',
            message: 'Failed to process tenant context',
          },
        },
        { status: 500 }
      );
    }

    const user = authResult.user;
    const { tenant } = tenantResult;

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
    logger.error('Failed to install tool on agent', { error, agentId });
    
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