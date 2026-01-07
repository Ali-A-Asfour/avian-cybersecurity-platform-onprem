/**
 * API endpoint for resolving incidents in Alerts & Security Incidents Module
 * 
 * Provides:
 * - POST /api/alerts-incidents/incidents/[id]/resolve - Resolve incident with summary
 * 
 * Requirements: 7.4, 7.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { IncidentManager } from '@/services/alerts-incidents/IncidentManager';
import { ResolveIncidentInput } from '@/types/alerts-incidents';
import { logger } from '@/lib/logger';

/**
 * POST /api/alerts-incidents/incidents/[id]/resolve
 * Resolve incident with summary
 * Requirements: 7.4, 7.5
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

        const body = await request.json();

        // Validate required fields for resolution
        const { summary } = body;

        if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Summary is required when resolving an incident',
                    },
                },
                { status: 400 }
            );
        }

        // Prepare resolve incident input
        const resolveInput: ResolveIncidentInput = {
            incidentId,
            tenantId: tenantResult.tenant!.id,
            ownerId: authResult.user!.user_id,
            outcome: 'resolved',
            summary: summary.trim(),
        };

        // Resolve incident using IncidentManager
        await IncidentManager.resolveIncident(resolveInput);

        logger.info('Incident resolved', {
            incidentId,
            tenantId: tenantResult.tenant!.id,
            userId: authResult.user!.user_id,
            outcome: 'resolved',
        });

        return NextResponse.json({
            success: true,
            data: {
                message: 'Incident resolved successfully',
                incidentId,
                outcome: 'resolved',
            },
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error('Error in POST /api/alerts-incidents/incidents/[id]/resolve', error instanceof Error ? error : new Error(String(error)), {
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

        if (errorMessage.includes('not in resolvable status')) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_STATUS',
                        message: 'Incident is not in a status that allows resolution',
                    },
                },
                { status: 409 }
            );
        }

        if (errorMessage.includes('Summary is required')) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: errorMessage,
                    },
                },
                { status: 400 }
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