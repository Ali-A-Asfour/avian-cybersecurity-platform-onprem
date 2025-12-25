/**
 * POST /api/alerts-incidents/alerts/[id]/resolve
 * Resolve alert with outcome validation
 * Requirements: 6.1, 6.4, 6.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { AlertManager } from '@/services/alerts-incidents/AlertManager';
import { ResolveAlertInput } from '@/types/alerts-incidents';
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

        const body = await request.json();
        const { outcome, notes } = body;

        // Validate required fields (Requirements: 6.1, 6.4, 6.5)
        if (!outcome) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Missing required field: outcome',
                    },
                },
                { status: 400 }
            );
        }

        // Validate outcome values
        if (!['benign', 'false_positive'].includes(outcome)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid outcome. Must be one of: benign, false_positive',
                    },
                },
                { status: 400 }
            );
        }

        // Validate mandatory notes (Requirements: 6.4, 6.5)
        if (!notes || typeof notes !== 'string' || notes.trim().length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Analyst notes are required when resolving an alert',
                    },
                },
                { status: 400 }
            );
        }

        // Prepare resolution input
        const resolveInput: ResolveAlertInput = {
            alertId,
            tenantId: tenantResult.tenant!.id,
            userId: authResult.user!.user_id,
            outcome: outcome as 'benign' | 'false_positive',
            notes: notes.trim(),
        };

        // Resolve alert using AlertManager
        await AlertManager.resolveAlert(resolveInput);

        logger.info('Alert resolved successfully', {
            alertId,
            outcome,
            userId: authResult.user!.user_id,
            tenantId: tenantResult.tenant!.id,
        });

        return NextResponse.json({
            success: true,
            data: {
                message: 'Alert resolved successfully',
                alertId,
                outcome,
                status: outcome === 'benign' ? 'closed_benign' : 'closed_false_positive',
            },
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error('Error in POST /api/alerts-incidents/alerts/[id]/resolve', error instanceof Error ? error : new Error(String(error)), {
            alertId: id,
        });

        // Handle specific business logic errors
        if (errorMessage.includes('not found') || errorMessage.includes('not in resolvable status')) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'RESOLUTION_FAILED',
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