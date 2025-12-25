/**
 * API endpoint for starting work on incidents in Alerts & Security Incidents Module
 * 
 * Provides:
 * - POST /api/alerts-incidents/incidents/[id]/start-work - Start work on incident (SLA tracking)
 * 
 * Requirements: 7.1, 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { IncidentManager } from '@/services/alerts-incidents/IncidentManager';
import { StartWorkInput } from '@/types/alerts-incidents';
import { logger } from '@/lib/logger';

/**
 * POST /api/alerts-incidents/incidents/[id]/start-work
 * Start work on incident (SLA tracking)
 * Requirements: 7.1, 10.1, 10.2, 10.3, 10.4, 10.5
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
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

        const incidentId = params.id;

        // Validate incident ID
        if (!incidentId) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Incident ID is required',
                    },
                },
                { status: 400 }
            );
        }

        // Prepare start work input
        const startWorkInput: StartWorkInput = {
            incidentId,
            tenantId: tenantResult.tenant!.id,
            ownerId: authResult.user!.user_id,
        };

        // Start work on incident using IncidentManager
        await IncidentManager.startWork(startWorkInput);

        logger.info('Work started on incident', {
            incidentId,
            tenantId: tenantResult.tenant!.id,
            userId: authResult.user!.user_id,
        });

        return NextResponse.json({
            success: true,
            data: {
                message: 'Work started on incident successfully',
                incidentId,
            },
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error('Error in POST /api/alerts-incidents/incidents/[id]/start-work', error instanceof Error ? error : new Error(String(error)), {
            incidentId: params.id,
        });

        // Handle specific business logic errors
        if (errorMessage.includes('not found') || errorMessage.includes('not owned by user')) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Incident not found or not owned by user',
                    },
                },
                { status: 404 }
            );
        }

        if (errorMessage.includes('not in startable status')) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_STATUS',
                        message: 'Incident is not in a status that allows starting work',
                    },
                },
                { status: 409 }
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