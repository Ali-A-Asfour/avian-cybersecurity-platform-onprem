/**
 * Bulk Alert Acknowledgment API Endpoint
 * POST /api/alerts/acknowledge-bulk
 * Acknowledges multiple alerts at once
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { firewallAlerts } from '../../../../../database/schemas/firewall';
import { inArray } from 'drizzle-orm';

interface BulkAcknowledgeRequest {
  alertIds: string[];
}

/**
 * POST /api/alerts/acknowledge-bulk
 * Acknowledge multiple alerts at once
 */
export async function POST(req: NextRequest) {
  try {
    const body: BulkAcknowledgeRequest = await req.json();
    const { alertIds } = body;

    // Get user from request (in production, this would come from JWT token)
    const userId = req.headers.get('x-user-id') || 'mock-user-id';

    if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Alert IDs array is required' },
        { status: 400 }
      );
    }

    // Limit bulk operations to 100 alerts at a time
    if (alertIds.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Cannot acknowledge more than 100 alerts at once' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Acknowledge all alerts
    const updatedAlerts = await db
      .update(firewallAlerts)
      .set({
        acknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      })
      .where(inArray(firewallAlerts.id, alertIds))
      .returning();

    return NextResponse.json({
      success: true,
      message: `Successfully acknowledged ${updatedAlerts.length} alert(s)`,
      acknowledgedCount: updatedAlerts.length,
      alerts: updatedAlerts.map(alert => ({
        id: alert.id,
        acknowledged: alert.acknowledged,
        acknowledgedBy: alert.acknowledgedBy,
        acknowledgedAt: alert.acknowledgedAt,
      })),
    });
  } catch (error) {
    console.error('Error bulk acknowledging alerts:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to acknowledge alerts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
