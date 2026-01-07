import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { logger } from '@/lib/logger';
import { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
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

    // Get agents for the tenant
    const agents = await agentService.getAgentsByTenant(tenant!.id);

    const response: ApiResponse = {
      success: true,
      data: agents,
      meta: {
        total: agents.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Failed to get agents', { error });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'AGENTS_FETCH_ERROR',
        message: 'Failed to retrieve agents',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    // Only Super Admins and Tenant Admins can create agent deployments
    if (!['super_admin', 'tenant_admin'].includes(user.role)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions to create agent deployment',
        },
      };
      return NextResponse.json(response, { status: 403 });
    }

    const body = await request.json();
    const { deployment_name, deployment_config } = body;

    if (!deployment_name || !deployment_config) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Deployment name and configuration are required',
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Create agent deployment
    const deployment = await agentService.createDeployment(
      tenant!.id,
      deployment_name,
      deployment_config,
      user.user_id
    );

    const response: ApiResponse = {
      success: true,
      data: deployment,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error('Failed to create agent deployment', { error });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'DEPLOYMENT_CREATE_ERROR',
        message: 'Failed to create agent deployment',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}