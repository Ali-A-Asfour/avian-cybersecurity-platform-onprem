/**
 * POST /api/alerts-incidents/alerts/[id]/assign
 * Assign alert to current analyst
 * Requirements: 1.4, 2.1, 2.2, 2.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { AlertManager } from '@/services/alerts-incidents/AlertManager';
import { AssignAlertInput } from '@/types/alerts-incidents';
import { logger } from '@/lib/logger';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
    // Await params in Next.js 16
    const { id } = await params;
        // Apply authentication middleware
        const authResult = await authMiddleware(request);
        if (!authResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: authResult.error || 'Authentication required'
                    }
                },
                { status: 401 }
            );
        }

        // Apply tenant middleware
        const tenantResult = await tenantMiddleware(request, authResult.user!);
        if (!tenantResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: tenantResult.error || { code: 'TENANT_ERROR', message: 'Tenant validation failed' }
                },
                { status: 403 }
            );
        }

        const alertId = id;

        // Validate alert ID format (UUID)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

        // Prepare assignment input
        const assignInput: AssignAlertInput = {
            alertId,
            assignedTo: authResult.user!.user_id,
            tenantId: tenantResult.tenant!.id,
        };

        // Assign alert using AlertManager
        await AlertManager.assignAlert(assignInput);

        logger.info('Alert assigned successfully', {
            alertId,
            assignedTo: authResult.user!.user_id,
            tenantId: tenantResult.tenant!.id,
        });

        return NextResponse.json({
            success: true,
            data: {
                message: 'Alert assigned successfully',
                alertId,
                assignedTo: authResult.user!.user_id,
            },
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error('Error in POST /api/alerts-incidents/alerts/[id]/assign', error instanceof Error ? error : new Error(String(error)), {
            alertId: id,
        });

        // Handle specific business logic errors
        if (errorMessage.includes('not found') || errorMessage.includes('already assigned') || errorMessage.includes('not in open status')) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'ASSIGNMENT_FAILED',
                        message: errorMessage,
                    },
                },
                { status: 409 } // Conflict
            );
        }

        if (errorMessage.includes('assigned by another user')) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'ASSIGNMENT_CONFLICT',
                        message: 'Alert was assigned by another user',
                    },
                },
                { status: 409 } // Conflict
            );
        }

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Internal server error',
                },
            },
            { status: 500 }
        );
    }
}