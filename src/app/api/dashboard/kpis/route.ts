import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
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

    const tenantId = authResult.user!.tenant_id;
    const db = await getDb();

    const [criticalAlerts] = await db
      .select({ count: count() })
      .from(alerts)
      .where(and(eq(alerts.tenant_id, tenantId), eq(alerts.severity, 'critical')));

    const [openTickets] = await db
      .select({ count: count() })
      .from(tickets)
      .where(and(eq(tickets.tenant_id, tenantId), eq(tickets.status, 'open')));

    return NextResponse.json({
      criticalAlerts: criticalAlerts.count,
      securityTicketsOpen: openTickets.count,
      helpdeskTicketsOpen: 0,
      complianceScore: 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('KPIs API error:', error);
    return NextResponse.json({ criticalAlerts: 0, securityTicketsOpen: 0, helpdeskTicketsOpen: 0, complianceScore: 0, timestamp: new Date().toISOString() });
  }
}
