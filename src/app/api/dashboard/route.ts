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

    // Get dashboard metrics
    const [tickets, alerts, compliance, sla, activity] = await Promise.all([
      DashboardService.getTicketSummary(tenant!.id),
      DashboardService.getAlertSummary(tenant!.id),
      DashboardService.getComplianceSummary(tenant!.id),
      DashboardService.getSLASummary(tenant!.id),
      DashboardService.getActivityFeed(tenant!.id, 10),
    ]);

    const metrics = {
      tickets,
      alerts,
      compliance,
      sla,
      activity,
    };

    const response: ApiResponse = {
      success: true,
      data: metrics,
    };

    return NextResponse.json(response);
  } catch {
    console.error('Dashboard API error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'DASHBOARD_ERROR',
        message: 'Failed to fetch dashboard data',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}