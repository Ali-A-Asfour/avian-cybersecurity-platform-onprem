import { NextRequest, NextResponse } from 'next/server';
import { SLAMonitorService } from '@/services/sla-monitor.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { ApiResponse, UserRole } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // Apply middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: authResult.error || "Authentication failed" } }, { status: 401 });
    }

    // Only allow admins to trigger SLA monitoring
    if (![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN].includes(authResult.user!.role)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      };
      return NextResponse.json(response, { status: 403 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: tenantResult.error?.message || "Access denied" } }, { status: 403 });
    }

    // Run SLA monitoring for the tenant
    await SLAMonitorService.runForTenant(tenantResult.tenant!.id);

    const response: ApiResponse = {
      success: true,
      data: { message: 'SLA monitoring completed' },
    };

    return NextResponse.json(response);
  } catch {
    console.error('Error running SLA monitoring:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to run SLA monitoring',
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Apply middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: authResult.error || "Authentication failed" } }, { status: 401 });
    }

    // Only allow admins to check SLA monitoring status
    if (![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN].includes(authResult.user!.role)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      };
      return NextResponse.json(response, { status: 403 });
    }

    const status = SLAMonitorService.getStatus();

    const response: ApiResponse = {
      success: true,
      data: status,
    };

    return NextResponse.json(response);
  } catch {
    console.error('Error getting SLA monitoring status:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get SLA monitoring status',
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}