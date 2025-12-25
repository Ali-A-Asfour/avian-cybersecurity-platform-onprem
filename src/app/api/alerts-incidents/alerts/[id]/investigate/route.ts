/**
 * POST /api/alerts-incidents/alerts/[id]/investigate
 * Start investigation (status transition from assigned to investigating)
 * Requirements: 4.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { AlertManager } from '@/services/alerts-incidents/AlertManager';
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

        // Start investigation (change status from assigned to investigating)
        // This endpoint should only be called from My Alerts tab for assigned alerts
        await AlertManager.startInvestigation({
            alertId,
            tenantId: tenantResult.tenant!.id,
            userId: authResult.user!.user_id,
        });

        logger.info('Alert investigation started successfully', {
            alertId,
            userId: authResult.user!.user_id,
            tenantId: tenantResult.tenant!.id,
        });

        return NextResponse.json({
            success: true,
            data: {
                message: 'Investigation started successfully',
                alertId,
                status: 'investigating',
            },
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error('Error in POST /api/alerts-incidents/alerts/[id]/investigate', error instanceof Error ? error : new Error(String(error)), {
            alertId: id,
        });

        // Handle specific business logic errors
        if (errorMessage.includes('not found') || errorMessage.includes('not assigned to user') || errorMessage.includes('not in assigned status')) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVESTIGATION_FAILED',
                        message: errorMessage,
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