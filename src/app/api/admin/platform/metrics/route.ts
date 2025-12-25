import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '../../../../../lib/auth';
import { UserRole } from '../../../../../types';

export async function GET(request: NextRequest) {
  try {
    // Authenticate and authorize
    const authResult = await AuthService.authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Only super admins can access platform metrics
    if (authResult.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    // In a real implementation, these would be calculated from actual data
    // For now, return mock data that represents realistic platform metrics
    const metrics = {
      totalTickets: 1247,
      totalAlerts: 3892,
      systemUptime: '99.9%',
      avgResponseTime: 120,
      apiRequestsToday: 45678,
      storageUsedGB: 234.5,
      activeConnections: 156,
      errorRate: 0.02,
    };

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Platform metrics error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to fetch platform metrics' 
        } 
      },
      { status: 500 }
    );
  }
}