import { NextRequest, NextResponse } from 'next/server';
import { PlaybookManager, UserRole } from '@/services/alerts-incidents/PlaybookManager';
import { logger } from '@/lib/logger';

/**
 * GET /api/alerts-incidents/playbooks/[id]
 * Get playbook by ID with classification links
 * Requirements: 5.3, 9.4
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
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

        const result = await PlaybookManager.getPlaybookById(params.id);

        if (!result) {
            return NextResponse.json(
                { error: 'Playbook not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        logger.error('Failed to get playbook', error instanceof Error ? error : new Error(String(error)));
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/alerts-incidents/playbooks/[id]
 * Update playbook
 * Requirements: 9.1, 9.2, 9.3
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
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

        // Only Super Admins can update playbooks
        if (userRole !== 'super_admin') {
            return NextResponse.json(
                { error: 'Insufficient permissions. Only Super Admins can update playbooks.' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { playbook, classifications } = body;

        await PlaybookManager.updatePlaybook(
            params.id,
            playbook,
            classifications,
            userRole
        );

        return NextResponse.json({
            success: true,
            message: 'Playbook updated successfully',
        });
    } catch (error) {
        logger.error('Failed to update playbook', error instanceof Error ? error : new Error(String(error)));

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
            if (error.message.includes('already exists') || error.message.includes('already has an active')) {
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

/**
 * DELETE /api/alerts-incidents/playbooks/[id]
 * Delete playbook
 * Requirements: 9.1
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
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

        // Only Super Admins can delete playbooks
        if (userRole !== 'super_admin') {
            return NextResponse.json(
                { error: 'Insufficient permissions. Only Super Admins can delete playbooks.' },
                { status: 403 }
            );
        }

        await PlaybookManager.deletePlaybook(params.id, userRole);

        return NextResponse.json({
            success: true,
            message: 'Playbook deleted successfully',
        });
    } catch (error) {
        logger.error('Failed to delete playbook', error instanceof Error ? error : new Error(String(error)));

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
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}