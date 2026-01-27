import { NextRequest, NextResponse } from 'next/server';
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

    // Simplified mock data with NO TICKETS
    const mockData = {
      tickets: {
        total: 0,
        open: 0,
        in_progress: 0,
        awaiting_response: 0,
        overdue: 0,
        resolved_today: 0,
        by_severity: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
        recent: [], // No mock tickets
      },
      alerts: {
        total: 1247,
        critical: 7,
        high: 23,
        medium: 89,
        low: 156,
        info: 972,
        unresolved: 119,
        recent: [
          {
            id: 'ALT-001',
            title: 'Multiple failed login attempts',
            severity: 'high',
            created_at: new Date(Date.now() - 5 * 60 * 1000),
          },
          {
            id: 'ALT-002',
            title: 'Unusual network traffic pattern',
            severity: 'medium',
            created_at: new Date(Date.now() - 12 * 60 * 1000),
          },
        ],
      },
      compliance: {
        overall_score: 87.5,
        frameworks_count: 3,
        controls_total: 245,
        controls_completed: 214,
        controls_in_progress: 23,
        controls_not_started: 8,
        frameworks: [
          {
            id: 'hipaa',
            name: 'HIPAA',
            score: 92.3,
            controls_completed: 89,
            controls_total: 96,
          },
          {
            id: 'iso27001',
            name: 'ISO 27001',
            score: 85.7,
            controls_completed: 96,
            controls_total: 112,
          },
        ],
      },
      sla: {
        response_rate: 94.2,
        resolution_rate: 89.7,
        average_response_time: 2.3,
        average_resolution_time: 18.7,
        breached_tickets: 0, // No tickets = no breaches
        at_risk_tickets: 0,  // No tickets = no at-risk
      },
      activity: [
        {
          id: 'act-001',
          type: 'alert',
          title: 'New critical alert',
          description: 'Suspicious login attempt detected from unknown IP',
          severity: 'critical',
          timestamp: new Date(Date.now() - 2 * 60 * 1000),
        },
        {
          id: 'act-002',
          type: 'compliance',
          title: 'Compliance check completed',
          description: 'HIPAA compliance framework review completed',
          severity: 'info',
          user: 'system',
          timestamp: new Date(Date.now() - 8 * 60 * 1000),
        },
      ],
    };

    let data;

    switch (widgetType) {
      case 'tickets':
        data = mockData.tickets;
        break;
      case 'alerts':
        data = mockData.alerts;
        break;
      case 'compliance':
        data = mockData.compliance;
        break;
      case 'sla':
        data = mockData.sla;
        break;
      case 'activity':
        const limit = parseInt(searchParams.get('limit') || '20');
        data = mockData.activity.slice(0, limit);
        break;
      default:
        // Get all widget data
        data = {
          tickets: mockData.tickets,
          alerts: mockData.alerts,
          compliance: mockData.compliance,
          sla: mockData.sla,
          activity: mockData.activity.slice(0, 10),
        };
    }

    const response: ApiResponse = {
      success: true,
      data,
    };

    return NextResponse.json(response);
  } catch (error) {
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
  } catch (error) {
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
