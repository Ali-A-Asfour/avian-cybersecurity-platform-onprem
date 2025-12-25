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
    const { searchParams } = new URL(request.url);
    const widgetType = searchParams.get('type');

    let data;

    const userRole = authResult.user!.role;

    switch (widgetType) {
      case 'tickets':
        data = await DashboardService.getTicketSummary(tenant!.id, userRole, authResult.user!.user_id);
        break;
      case 'alerts':
        data = await DashboardService.getAlertSummary(tenant!.id);
        break;
      case 'compliance':
        data = await DashboardService.getComplianceSummary(tenant!.id);
        break;
      case 'sla':
        data = await DashboardService.getSLASummary(tenant!.id);
        break;
      case 'activity':
        const limit = parseInt(searchParams.get('limit') || '20');
        data = await DashboardService.getActivityFeed(tenant!.id, limit);
        break;
      default:
        // Get all widget data with role-based filtering
        const [tickets, alerts, compliance, sla, activity] = await Promise.all([
          DashboardService.getTicketSummary(tenant!.id, userRole),
          DashboardService.getAlertSummary(tenant!.id),
          DashboardService.getComplianceSummary(tenant!.id),
          DashboardService.getSLASummary(tenant!.id),
          DashboardService.getActivityFeed(tenant!.id, 10),
        ]);

        data = {
          tickets,
          alerts,
          compliance,
          sla,
          activity,
        };
    }

    const response: ApiResponse = {
      success: true,
      data,
    };

    return NextResponse.json(response);
  } catch {
    console.error('Dashboard widgets API error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'WIDGET_ERROR',
        message: 'Failed to fetch widget data',
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