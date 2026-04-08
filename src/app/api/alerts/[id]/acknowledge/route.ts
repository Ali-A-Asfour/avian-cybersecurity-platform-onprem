/**
 * Alert Acknowledgment API Endpoint
 * POST /api/alerts/[id]/acknowledge
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/database';
import { firewallAlerts } from '../../../../../../database/schemas/firewall';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

async function getAuthContext(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (!authResult.success) return { success: false as const, status: 401, message: authResult.error || 'Authentication failed' };

  const tenantResult = await tenantMiddleware(req, authResult.user!);
  if (!tenantResult.success) return { success: false as const, status: 403, message: tenantResult.error?.message || 'Access denied' };

  return { success: true as const, user: authResult.user!, tenantId: tenantResult.tenant!.id };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext(req);
  if (!ctx.success) return NextResponse.json({ success: false, error: ctx.message }, { status: ctx.status });

  const { id } = params;
  if (!id) return NextResponse.json({ success: false, error: 'Alert ID is required' }, { status: 400 });

  try {
    const result = await withTenantContext(ctx.tenantId, ctx.user.role, async (db) => {
      const [existing] = await db.select().from(firewallAlerts)
        .where(and(eq(firewallAlerts.id, id)))
        .limit(1);

      if (!existing) return { notFound: true };
      if (existing.acknowledged) return { alreadyAcknowledged: true, existing };

      const [updated] = await db.update(firewallAlerts)
        .set({ acknowledged: true, acknowledgedBy: ctx.user.user_id, acknowledgedAt: new Date() })
        .where(eq(firewallAlerts.id, id))
        .returning();

      return { updated };
    });

    if (result.notFound) return NextResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
    if (result.alreadyAcknowledged) return NextResponse.json({ success: false, error: 'Alert is already acknowledged' }, { status: 400 });

    return NextResponse.json({ success: true, message: 'Alert acknowledged successfully', alert: result.updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to acknowledge alert' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext(req);
  if (!ctx.success) return NextResponse.json({ success: false, error: ctx.message }, { status: ctx.status });

  const { id } = params;
  if (!id) return NextResponse.json({ success: false, error: 'Alert ID is required' }, { status: 400 });

  try {
    const result = await withTenantContext(ctx.tenantId, ctx.user.role, async (db) => {
      const [existing] = await db.select().from(firewallAlerts).where(eq(firewallAlerts.id, id)).limit(1);
      if (!existing) return { notFound: true };
      if (!existing.acknowledged) return { notAcknowledged: true };

      const [updated] = await db.update(firewallAlerts)
        .set({ acknowledged: false, acknowledgedBy: null, acknowledgedAt: null })
        .where(eq(firewallAlerts.id, id))
        .returning();

      return { updated };
    });

    if (result.notFound) return NextResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
    if (result.notAcknowledged) return NextResponse.json({ success: false, error: 'Alert is not acknowledged' }, { status: 400 });

    return NextResponse.json({ success: true, message: 'Alert acknowledgment removed', alert: result.updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to remove acknowledgment' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getAuthContext(req);
  if (!ctx.success) return NextResponse.json({ success: false, error: ctx.message }, { status: ctx.status });

  const { id } = params;
  if (!id) return NextResponse.json({ success: false, error: 'Alert ID is required' }, { status: 400 });

  try {
    const alert = await withTenantContext(ctx.tenantId, ctx.user.role, async (db) => {
      const [row] = await db.select({
        id: firewallAlerts.id,
        acknowledged: firewallAlerts.acknowledged,
        acknowledgedBy: firewallAlerts.acknowledgedBy,
        acknowledgedAt: firewallAlerts.acknowledgedAt,
      }).from(firewallAlerts).where(eq(firewallAlerts.id, id)).limit(1);
      return row;
    });

    if (!alert) return NextResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
    return NextResponse.json({ success: true, alert });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to get acknowledgment status' }, { status: 500 });
  }
}
