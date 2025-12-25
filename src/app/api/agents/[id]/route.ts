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

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: _id } = await params;
  try {
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
    const _agentId = params.id;

    // Get agent status
    const agent = await agentService.getAgentStatus(agentId);

    if (!agent) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'AGENT_NOT_FOUND',
          message: 'Agent not found',
        },
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Verify agent belongs to the tenant
    if (agent.tenant_id !== tenant.id) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'AGENT_ACCESS_DENIED',
          message: 'Access denied to this agent',
        },
      };
      return NextResponse.json(response, { status: 403 });
    }

    const response: ApiResponse = {
      success: true,
      data: agent,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Failed to get agent', { error, agentId: params.id });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'AGENT_FETCH_ERROR',
        message: 'Failed to retrieve agent',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id: _id } = await params;
  try {
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
    const _agentId = params.id;

    // Only Super Admins and Tenant Admins can update agent configuration
    if (!['super_admin', 'tenant_admin'].includes(user.role)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions to update agent configuration',
        },
      };
      return NextResponse.json(response, { status: 403 });
    }

    const body = await request.json();
    const { configuration } = body;

    if (!configuration) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Configuration is required',
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Update agent configuration
    const updatedConfig = await agentService.updateAgentConfiguration(agentId, configuration);

    const response: ApiResponse = {
      success: true,
      data: updatedConfig,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Failed to update agent configuration', { error, agentId: params.id });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'AGENT_UPDATE_ERROR',
        message: 'Failed to update agent configuration',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}