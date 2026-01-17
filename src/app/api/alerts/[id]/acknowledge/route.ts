/**
 * Alert Acknowledgment API Endpoint
 * POST /api/alerts/[id]/acknowledge
 * Acknowledges an alert and tracks who acknowledged it
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { firewallAlerts } from '../../../../../../database/schemas/firewall';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/alerts/[id]/acknowledge
 * Acknowledge an alert
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get user from request (in production, this would come from JWT token)
    // For now, we'll use a mock user ID
    const userId = req.headers.get('x-user-id') || 'mock-user-id';

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Alert ID is required' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Check if alert exists
    const [existingAlert] = await db
      .select()
      .from(firewallAlerts)
      .where(eq(firewallAlerts.id, id))
      .limit(1);

    if (!existingAlert) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Check if already acknowledged
    if (existingAlert.acknowledged) {
      return NextResponse.json(
        {
          success: false,
          error: 'Alert is already acknowledged',
          acknowledgedBy: existingAlert.acknowledgedBy,
          acknowledgedAt: existingAlert.acknowledgedAt,
        },
        { status: 400 }
      );
    }

    // Acknowledge the alert
    const [updatedAlert] = await db
      .update(firewallAlerts)
      .set({
        acknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      })
      .where(eq(firewallAlerts.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Alert acknowledged successfully',
      alert: {
        id: updatedAlert.id,
        acknowledged: updatedAlert.acknowledged,
        acknowledgedBy: updatedAlert.acknowledgedBy,
        acknowledgedAt: updatedAlert.acknowledgedAt,
      },
    });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to acknowledge alert',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/alerts/[id]/acknowledge
 * Un-acknowledge an alert (remove acknowledgment)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Alert ID is required' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Check if alert exists
    const [existingAlert] = await db
      .select()
      .from(firewallAlerts)
      .where(eq(firewallAlerts.id, id))
      .limit(1);

    if (!existingAlert) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Check if not acknowledged
    if (!existingAlert.acknowledged) {
      return NextResponse.json(
        { success: false, error: 'Alert is not acknowledged' },
        { status: 400 }
      );
    }

    // Remove acknowledgment
    const [updatedAlert] = await db
      .update(firewallAlerts)
      .set({
        acknowledged: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
      })
      .where(eq(firewallAlerts.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Alert acknowledgment removed successfully',
      alert: {
        id: updatedAlert.id,
        acknowledged: updatedAlert.acknowledged,
      },
    });
  } catch (error) {
    console.error('Error removing alert acknowledgment:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to remove acknowledgment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/alerts/[id]/acknowledge
 * Get acknowledgment status of an alert
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Alert ID is required' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Get alert
    const [alert] = await db
      .select({
        id: firewallAlerts.id,
        acknowledged: firewallAlerts.acknowledged,
        acknowledgedBy: firewallAlerts.acknowledgedBy,
        acknowledgedAt: firewallAlerts.acknowledgedAt,
      })
      .from(firewallAlerts)
      .where(eq(firewallAlerts.id, id))
      .limit(1);

    if (!alert) {
      return NextResponse.json(
        { success: false, error: 'Alert not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      alert,
    });
  } catch (error) {
    console.error('Error getting alert acknowledgment status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get acknowledgment status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
