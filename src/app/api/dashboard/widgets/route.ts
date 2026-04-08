import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { ApiResponse } from '@/types';
import { getDb } from '@/lib/database';
import { tickets } from '@/../database/schemas/main';
import { alerts } from '@/../database/schemas/tenant';
import { eq, and, count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
    }

    const { user } = authResult;
    const tenantId = user!.tenant_id;
    const { searchParams } = new URL(request.url);
    const widgetType = searchParams.get('type');

    const db = await getDb();

    // Real ticket counts
    const ticketRows = await db
      .select({ status: tickets.status, priority: tickets.priority, count: count() })
      .from(tickets)
      .where(eq(tickets.tenant_id, tenantId))
      .groupBy(tickets.status, tickets.priority);

    const ticketStats = {
      total: 0, open: 0, in_progress: 0, awaiting_response: 0,
      overdue: 0, resolved_today: 0,
      by_severity: { critical: 0, high: 0, medium: 0, low: 0 },
      recent: [],
    };
    for (const row of ticketRows) {
      ticketStats.total += row.count;
      if (row.status === 'open') ticketStats.open += row.count;
      if (row.status === 'in_progress') ticketStats.in_progress += row.count;
      if (row.priority === 'critical') ticketStats.by_severity.critical += row.count;
      if (row.priority === 'high') ticketStats.by_severity.high += row.count;
      if (row.priority === 'medium') ticketStats.by_severity.medium += row.count;
      if (row.priority === 'low') ticketStats.by_severity.low += row.count;
    }

    // Real alert counts
    const alertRows = await db
      .select({ severity: alerts.severity, status: alerts.status, count: count() })
      .from(alerts)
      .where(eq(alerts.tenant_id, tenantId))
      .groupBy(alerts.severity, alerts.status);

    const alertStats = {
      total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0,
      unresolved: 0, recent: [],
    };
    for (const row of alertRows) {
      alertStats.total += row.count;
      if (row.severity === 'critical') alertStats.critical += row.count;
      if (row.severity === 'high') alertStats.high += row.count;
      if (row.severity === 'medium') alertStats.medium += row.count;
      if (row.severity === 'low') alertStats.low += row.count;
      if (row.severity === 'info') alertStats.info += row.count;
      if (row.status !== 'resolved' && row.status !== 'closed') alertStats.unresolved += row.count;
    }

    const emptyCompliance = {
      overall_score: 0, frameworks_count: 0, controls_total: 0,
      controls_completed: 0, controls_in_progress: 0, controls_not_started: 0,
      frameworks: [],
    };

    const emptySla = {
      response_rate: 0, resolution_rate: 0,
      average_response_time: 0, average_resolution_time: 0,
      breached_tickets: 0, at_risk_tickets: 0,
    };

    const data: Record<string, any> = {
      tickets: ticketStats,
      alerts: alertStats,
      compliance: emptyCompliance,
      sla: emptySla,
      activity: [],
    };

    const response: ApiResponse = {
      success: true,
      data: widgetType ? data[widgetType] ?? data : data,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Dashboard widgets API error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'WIDGET_ERROR', message: 'Failed to fetch widget data' } },
      { status: 500 }
    );
  }
}
