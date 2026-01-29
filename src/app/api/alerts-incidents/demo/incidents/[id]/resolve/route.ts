/**
 * Demo API endpoint for resolving security incidents
 * 
 * Provides:
 * - POST /api/alerts-incidents/demo/incidents/[id]/resolve - Resolve incident with summary (demo mode)
 * 
 * Requirements: 7.4, 7.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/alerts-incidents/demo/incidents/[id]/resolve
 * Resolve incident with summary (demo mode)
 * Requirements: 7.4, 7.5
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: incidentId } = await params;
        
        console.log('Demo resolve endpoint called with incident ID:', incidentId);

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

        // In demo mode, we just simulate successful resolution
        logger.info('Demo incident resolved', {
            incidentId,
            outcome: 'resolved',
            summary: summary.trim(),
        });

        return NextResponse.json({
            success: true,
            data: {
                message: 'Incident resolved successfully (demo mode)',
                incidentId,
                outcome: 'resolved',
            },
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error('Error in POST /api/alerts-incidents/demo/incidents/[id]/resolve', error instanceof Error ? error : new Error(String(error)), {
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