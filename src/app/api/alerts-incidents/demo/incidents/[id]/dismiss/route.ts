/**
 * Demo API endpoint for dismissing security incidents
 * 
 * Provides:
 * - POST /api/alerts-incidents/demo/incidents/[id]/dismiss - Dismiss incident with justification (demo mode)
 * 
 * Requirements: 7.4, 7.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/alerts-incidents/demo/incidents/[id]/dismiss
 * Dismiss incident with justification (demo mode)
 * Requirements: 7.4, 7.5
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: incidentId } = await params;

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

        // Validate required fields for dismissal
        const { justification } = body;

        if (!justification || typeof justification !== 'string' || justification.trim().length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Justification is required when dismissing an incident',
                    },
                },
                { status: 400 }
            );
        }

        // In demo mode, we just simulate successful dismissal
        logger.info('Demo incident dismissed', {
            incidentId,
            outcome: 'dismissed',
            justification: justification.trim(),
        });

        return NextResponse.json({
            success: true,
            data: {
                message: 'Incident dismissed successfully (demo mode)',
                incidentId,
                outcome: 'dismissed',
            },
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error('Error in POST /api/alerts-incidents/demo/incidents/[id]/dismiss', error instanceof Error ? error : new Error(String(error)), {
            incidentId: params.id,
        });

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