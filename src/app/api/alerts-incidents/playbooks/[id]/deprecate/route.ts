import { NextRequest, NextResponse } from 'next/server';
import { PlaybookManager, UserRole } from '@/services/alerts-incidents/PlaybookManager';
import { logger } from '@/lib/logger';

/**
 * POST /api/alerts-incidents/playbooks/[id]/deprecate
 * Deprecate playbook (change status to deprecated)
 * Requirements: 9.3, 9.5
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Get user from headers (set by middleware)
        const userHeader = request.headers.get('x-user');
        if (!userHeader) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const user = JSON.parse(userHeader);
        const userRole: UserRole = user.role === 'super_admin' ? 'super_admin' : 'security_analyst';

        // Only Super Admins can deprecate playbooks
        if (userRole !== 'super_admin') {
            return NextResponse.json(
                { error: 'Insufficient permissions. Only Super Admins can deprecate playbooks.' },
                { status: 403 }
            );
        }

        await PlaybookManager.deprecatePlaybook(params.id, userRole);

        return NextResponse.json({
            success: true,
            message: 'Playbook deprecated successfully',
        });
    } catch (error) {
        logger.error('Failed to deprecate playbook', error instanceof Error ? error : new Error(String(error)));

        if (error instanceof Error) {
            if (error.message.includes('Insufficient permissions')) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 403 }
                );
            }
            if (error.message.includes('not found')) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 404 }
                );
            }
            if (error.message.includes('already deprecated')) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 409 }
                );
            }
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}