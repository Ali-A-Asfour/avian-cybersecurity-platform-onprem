/**
 * Bulk Alert Acknowledgment API Endpoint
 * POST /api/alerts/acknowledge-bulk
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/database';
import { firewallAlerts } from '../../../../../database/schemas/firewall';
import { inArray, and, eq } from 'drizzle-orm';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

export async function POST(req: NextRequest) {
  const authResult = await authMiddleware(req);
  if (!authResult.success) {
    return NextResponse.json({ success: false, error: authResult.error || 'Authentication failed' }, { status: 401 });
  }

  const tenantResult = await tenantMiddleware(req, authResult.user!);
  if (!tenantResult.success) {
    return NextResponse.json({ success: false, error: tenantResult.error?.message || 'Access denied' }, { status: 403 });
  }

  const { alertIds } = await req.json() as { alertIds: string[] };

  if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
    return NextResponse.json({ success: false, error: 'Alert IDs array is required' }, { status: 400 });
  }

  if (alertIds.length > 100) {
    return NextResponse.json({ success: false, error: 'Cannot acknowledge more than 100 alerts at once' }, { status: 400 });
  }

  try {
    const updatedAlerts = await withTenantContext(tenantResult.tenant!.id, authResult.user!.role, async (db) => {
      return db.update(firewallAlerts)
        .set({ acknowledged: true, acknowledgedBy: authResult.user!.user_id, acknowledgedAt: new Date() })
        .where(inArray(firewallAlerts.id, alertIds))
        .returning();
    });

    return NextResponse.json({
      success: true,
      message: `Successfully acknowledged ${updatedAlerts.length} alert(s)`,
      acknowledgedCount: updatedAlerts.length,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to acknowledge alerts' }, { status: 500 });
  }
}
