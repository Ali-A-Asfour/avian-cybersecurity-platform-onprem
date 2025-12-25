import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { AlertManager } from '@/lib/alert-manager';
import { db } from '@/lib/database';
import { firewallAlerts } from '@/../database/schemas/firewall';
import { eq, and } from 'drizzle-orm';

/**
 * PUT /api/firewall/alerts/:id/acknowledge - Acknowledge alert
 * 
 * Requirements: 15.8 - Alert Management API
 * - Acknowledge an alert
 * - Validate user can acknowledge (tenant match)
 * - Update acknowledged status, acknowledgedBy, and acknowledgedAt
 * - Return 404 if alert not found
 * - Return 403 if user doesn't have access to alert (wrong tenant)
 * 
 * Path Parameters:
 * - id: Alert ID (UUID)
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
    // Await params in Next.js 16
    const { id } = await params;
        // Apply authentication middleware
        const authResult = await authMiddleware(request);
        if (!authResult.success || !authResult.user) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: authResult.error || 'Authentication required',
                    },
                },
                { status: 401 }
            );
        }

        const { user } = authResult;

        // Apply tenant middleware
        const tenantResult = await tenantMiddleware(request, user);
        if (!tenantResult.success || !tenantResult.tenant) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'TENANT_ERROR',
                        message: tenantResult.error?.message || 'Tenant validation failed',
                    },
                },
                { status: 403 }
            );
        }

        const alertId = id;

        // Validate alert ID format (UUID)
        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(alertId)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid alert ID format',
                    },
                },
                { status: 400 }
            );
        }

        // Check if alert exists and belongs to user's tenant
        if (!db) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'DATABASE_ERROR',
                        message: 'Database connection not available',
                    },
                },
                { status: 500 }
            );
        }

        const alert = await db.query.firewallAlerts.findFirst({
            where: and(
                eq(firewallAlerts.id, alertId),
                eq(firewallAlerts.tenantId, user.tenant_id)
            ),
        });

        if (!alert) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Alert not found or access denied',
                    },
                },
                { status: 404 }
            );
        }

        // Check if alert is already acknowledged
        if (alert.acknowledged) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'ALREADY_ACKNOWLEDGED',
                        message: 'Alert has already been acknowledged',
                    },
                },
                { status: 400 }
            );
        }

        // Acknowledge the alert using AlertManager
        await AlertManager.acknowledgeAlert(alertId, user.id);

        // Fetch updated alert
        const updatedAlert = await db.query.firewallAlerts.findFirst({
            where: eq(firewallAlerts.id, alertId),
        });

        return NextResponse.json({
            success: true,
            data: updatedAlert,
            message: 'Alert acknowledged successfully',
        });
    } catch (error) {
        console.error('Error in PUT /api/firewall/alerts/:id/acknowledge:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to acknowledge alert',
                },
            },
            { status: 500 }
        );
    }
}
