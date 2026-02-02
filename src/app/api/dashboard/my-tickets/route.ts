import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { ApiResponse } from '@/types';
import { UserRole } from '@/types';

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

    const userRole = authResult.user!.role as UserRole;
    
    console.log('=== DASHBOARD MY-TICKETS DEBUG ===');
    console.log('User ID:', authResult.user!.user_id);
    console.log('User Role:', userRole);
    console.log('Tenant ID:', tenantResult.tenant!.id);
    console.log('No tickets returned - mock tickets removed');
    console.log('=== END DASHBOARD MY-TICKETS DEBUG ===');

    // Return empty ticket metrics - no mock tickets
    const response: ApiResponse = {
      success: true,
      data: {
        total: 0,
        open: 0,
        overdue: 0,
        resolved_today: 0,
        in_progress: 0,
        awaiting_response: 0,
        by_severity: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
        recent_tickets: [], // No mock tickets
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching dashboard my tickets data:', error);

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}
