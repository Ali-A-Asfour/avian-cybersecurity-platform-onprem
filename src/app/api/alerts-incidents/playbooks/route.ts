import { NextRequest, NextResponse } from 'next/server';
import { PlaybookManager, UserRole } from '@/services/alerts-incidents/PlaybookManager';
import { logger } from '@/lib/logger';

/**
 * GET /api/alerts-incidents/playbooks
 * List playbooks with filtering
 * Requirements: 5.3, 9.4
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

        const user = JSON.parse(userHeader);
        const { searchParams } = new URL(request.url);

        // Parse filters
        const filters = {
            status: searchParams.get('status') || undefined,
            classification: searchParams.get('classification') || undefined,
            createdBy: searchParams.get('createdBy') || undefined,
            limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
            offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
        };

        const playbooks = await PlaybookManager.getPlaybooks(filters);

        return NextResponse.json({
            success: true,
            data: playbooks,
        });
    } catch (error) {
        logger.error('Failed to get playbooks', error instanceof Error ? error : new Error(String(error)));
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/alerts-incidents/playbooks
 * Create new playbook
 * Requirements: 9.1, 9.2, 9.3
 */
export async function POST(request: NextRequest) {
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

        // Only Super Admins can create playbooks
        if (userRole !== 'super_admin') {
            return NextResponse.json(
                { error: 'Insufficient permissions. Only Super Admins can create playbooks.' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { playbook, classifications } = body;

        // Validate required fields
        if (!playbook || !classifications) {
            return NextResponse.json(
                { error: 'Playbook data and classifications are required' },
                { status: 400 }
            );
        }

        // Add createdBy to playbook data
        const playbookData = {
            ...playbook,
            createdBy: user.id,
        };

        const playbookId = await PlaybookManager.createPlaybook(
            playbookData,
            classifications,
            userRole
        );

        return NextResponse.json({
            success: true,
            data: { id: playbookId },
        }, { status: 201 });
    } catch (error) {
        logger.error('Failed to create playbook', error instanceof Error ? error : new Error(String(error)));

        if (error instanceof Error) {
            if (error.message.includes('Insufficient permissions')) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 403 }
                );
            }
            if (error.message.includes('already exists') || error.message.includes('already has an active')) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 409 }
                );
            }
            if (error.message.includes('required') || error.message.includes('must be')) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 400 }
                );
            }
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}