import { NextRequest, NextResponse } from 'next/server';
import { PlaybookManager } from '@/services/alerts-incidents/PlaybookManager';
import { logger } from '@/lib/logger';

/**
 * GET /api/alerts-incidents/playbooks/classifications
 * Get all classifications with their primary playbooks
 * Requirements: 9.2, 9.3
 */
export async function GET(request: NextRequest) {
    try {
        // Get user from headers (set by middleware)
        const userHeader = request.headers.get('x-user');
        if (!userHeader) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const summary = await PlaybookManager.getClassificationSummary();

        return NextResponse.json({
            success: true,
            data: summary,
        });
    } catch (error) {
        logger.error('Failed to get classification summary', error instanceof Error ? error : new Error(String(error)));
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}