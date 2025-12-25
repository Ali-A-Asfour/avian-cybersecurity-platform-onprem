import { NextRequest, NextResponse } from 'next/server';
import { DashboardService } from '@/services/dashboard.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    // Apply authentication and tenant middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      return NextResponse.json(
        { success: false, error: tenantResult.error },
        { status: 403 }
      );
    }

    const { tenant } = tenantResult;

    // Get dashboard configuration
    const config = await DashboardService.getDashboardConfig(
      tenant!.id,
      authResult.user!.user_id
    );

    const response: ApiResponse = {
      success: true,
      data: config,
    };

    return NextResponse.json(response);
  } catch {
    console.error('Dashboard config API error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'CONFIG_ERROR',
        message: 'Failed to fetch dashboard configuration',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Apply authentication and tenant middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      return NextResponse.json(
        { success: false, error: tenantResult.error },
        { status: 403 }
      );
    }

    const { tenant } = tenantResult;
    const configUpdate = await request.json();

    // Update dashboard configuration
    const updatedConfig = await DashboardService.updateDashboardConfig(
      tenant!.id,
      configUpdate,
      authResult.user!.user_id
    );

    const response: ApiResponse = {
      success: true,
      data: updatedConfig,
    };

    return NextResponse.json(response);
  } catch {
    console.error('Dashboard config update error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'CONFIG_UPDATE_ERROR',
        message: 'Failed to update dashboard configuration',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}