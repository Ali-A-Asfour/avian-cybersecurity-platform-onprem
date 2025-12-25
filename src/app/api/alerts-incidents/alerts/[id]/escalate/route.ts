/**
 * POST /api/alerts-incidents/alerts/[id]/escalate
 * Escalate alert to security incident
 * Requirements: 6.2, 6.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { validateIncidentWorkflow } from '@/middleware/incident-workflow.middleware';
import { IncidentManager } from '@/services/alerts-incidents/IncidentManager';
import { EscalateAlertInput } from '@/types/alerts-incidents';
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

        // CRITICAL: Validate incident workflow enforcement
        // Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10
        const workflowValidation = await validateIncidentWorkflow(
            request,
            alertId,
            tenantResult.tenant!.id,
            authResult.user!.user_id
        );

        if (!workflowValidation.success) {
            const statusCode = workflowValidation.error?.code === 'INVESTIGATION_REQUIRED' ? 409 : 400;

            return NextResponse.json(
                {
                    success: false,
                    error: workflowValidation.error,
                },
                { status: statusCode }
            );
        }

        const body = await request.json();
        const { incidentTitle, incidentDescription } = body;

        // Validate optional fields
        if (incidentTitle && typeof incidentTitle !== 'string') {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'incidentTitle must be a string',
                    },
                },
                { status: 400 }
            );
        }

        if (incidentDescription && typeof incidentDescription !== 'string') {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'incidentDescription must be a string',
                    },
                },
                { status: 400 }
            );
        }

        // Prepare escalation input
        const escalateInput: EscalateAlertInput = {
            alertId,
            tenantId: tenantResult.tenant!.id,
            incidentTitle: incidentTitle?.trim() || undefined,
            incidentDescription: incidentDescription?.trim() || undefined,
        };

        // Escalate alert using IncidentManager
        const incidentId = await IncidentManager.escalateAlert(escalateInput);

        logger.info('Alert escalated to security incident successfully', {
            alertId,
            incidentId,
            userId: authResult.user!.user_id,
            tenantId: tenantResult.tenant!.id,
        });

        return NextResponse.json({
            success: true,
            data: {
                message: 'Alert escalated to security incident successfully',
                alertId,
                incidentId,
                alertStatus: 'escalated',
            },
        }, { status: 201 });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error('Error in POST /api/alerts-incidents/alerts/[id]/escalate', error instanceof Error ? error : new Error(String(error)), {
            alertId: id,
        });

        // Handle specific business logic errors
        if (errorMessage.includes('not found') || errorMessage.includes('not assigned') || errorMessage.includes('not in escalatable status')) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'ESCALATION_FAILED',
                        message: errorMessage,
                    },
                },
                { status: 409 } // Conflict
            );
        }

        if (errorMessage.includes('must be assigned before escalation')) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'ESCALATION_FAILED',
                        message: 'Alert must be assigned to an analyst before escalation',
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