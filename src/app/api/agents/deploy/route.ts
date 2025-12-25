import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
// import { logger } from '@/lib/logger';
import { ApiResponse } from '@/types';

export async function POST(request: NextRequest) {
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

    // Only Super Admins and Tenant Admins can deploy agents
    if (!['super_admin', 'tenant_admin'].includes(user.role)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions to deploy agents',
        },
      };
      return NextResponse.json(response, { status: 403 });
    }

    const body = await request.json();
    const { os_type, deployment_id } = body;

    if (!os_type || !['windows', 'linux', 'macos'].includes(os_type)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_OS_TYPE',
          message: 'Valid OS type (windows, linux, macos) is required',
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Generate installation script
    const script = await agentService.generateInstallationScript(
      tenant.id,
      os_type,
      deployment_id
    );

    const response: ApiResponse = {
      success: true,
      data: {
        script_id: script.id,
        script_content: script.script_content,
        deployment_key: script.deployment_key,
        expires_at: script.expires_at,
        download_instructions: {
          windows: 'Save as .bat file and run as Administrator',
          linux: 'Save as .sh file and run with sudo',
          macos: 'Save as .sh file and run with sudo',
        }[os_type],
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch {
    logger.error('Failed to generate deployment script', { error });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'DEPLOYMENT_SCRIPT_ERROR',
        message: 'Failed to generate deployment script',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}