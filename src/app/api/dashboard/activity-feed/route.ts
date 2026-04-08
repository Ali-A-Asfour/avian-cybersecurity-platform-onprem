import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { getDb } from '@/lib/database';
import { tickets } from '@/../database/schemas/main';
import { alerts } from '@/../database/schemas/tenant';
import { eq, desc, count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
    }

    const tenantId = authResult.user!.tenant_id;
    const db = await getDb();

    // Get recent alerts as activity
    const recentAlerts = await db
      .select()
      .from(alerts)
      .where(eq(alerts.tenant_id, tenantId))
      .orderBy(desc(alerts.created_at))
      .limit(10);

    const activities = recentAlerts.map((alert: any) => ({
      id: alert.id,
      timestamp: alert.created_at,
      description: alert.title || alert.message || 'Security alert',
      type: 'alert' as const,
      severity: alert.severity,
      icon: 'shield-alert',
    }));

    return NextResponse.json({
      activities,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Activity feed API error:', error);
    return NextResponse.json({ activities: [], timestamp: new Date().toISOString() });
  }
}
