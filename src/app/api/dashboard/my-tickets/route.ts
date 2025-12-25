import { NextRequest, NextResponse } from 'next/server';
import { TicketService } from '@/services/ticket.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { UserRole, ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    // Apply middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: authResult.error || 'Authentication failed'
        }
      }, { status: 401 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: tenantResult.error?.message || "Access denied"
        }
      }, { status: 403 });
    }

    // Verify user has analyst role or higher
    const userRole = authResult.user!.role;
    if (userRole !== UserRole.SECURITY_ANALYST &&
      userRole !== UserRole.IT_HELPDESK_ANALYST &&
      userRole !== UserRole.TENANT_ADMIN &&
      userRole !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only analysts and admins can access dashboard metrics',
        },
      }, { status: 403 });
    }

    // Get tickets assigned to the current user for dashboard metrics
    const result = await TicketService.getMyTickets(
      tenantResult.tenant!.id,
      authResult.user!.user_id,
      userRole,
      { limit: 100 } // Get more tickets for accurate metrics
    );

    // Calculate dashboard metrics
    const tickets = result.tickets;
    const total = tickets.length;
    const open = tickets.filter(t => ['new', 'in_progress', 'awaiting_response'].includes(t.status)).length;
    const overdue = tickets.filter(t =>
      t.sla_deadline &&
      new Date() > new Date(t.sla_deadline) &&
      !['resolved', 'closed'].includes(t.status)
    ).length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const resolvedToday = tickets.filter(t =>
      t.status === 'resolved' &&
      new Date(t.updated_at) >= today
    ).length;

    const inProgress = tickets.filter(t => t.status === 'in_progress').length;
    const awaitingResponse = tickets.filter(t => t.status === 'awaiting_response').length;

    // Severity breakdown
    const bySeverity = {
      critical: tickets.filter(t => t.severity === 'critical').length,
      high: tickets.filter(t => t.severity === 'high').length,
      medium: tickets.filter(t => t.severity === 'medium').length,
      low: tickets.filter(t => t.severity === 'low').length,
    };

    const dashboardData = {
      total,
      open,
      overdue,
      resolved_today: resolvedToday,
      in_progress: inProgress,
      awaiting_response: awaitingResponse,
      by_severity: bySeverity,
    };

    const response: ApiResponse = {
      success: true,
      data: dashboardData,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching dashboard my tickets data:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch dashboard metrics',
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}