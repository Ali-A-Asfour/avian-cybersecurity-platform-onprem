import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeBaseService } from '../../../../../services/help-desk/KnowledgeBaseService';
import { getCurrentUser } from '../../../../../lib/auth';

/**
 * GET /api/help-desk/knowledge-base/stats
 * Get knowledge base statistics
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only help desk analysts and above can view stats
        if (!['help_desk_analyst', 'tenant_admin', 'super_admin'].includes(user.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const stats = await KnowledgeBaseService.getKnowledgeBaseStats(user.tenant_id);

        return NextResponse.json(stats);
    } catch (error) {
        console.error('Error fetching knowledge base stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch knowledge base statistics' },
            { status: 500 }
        );
    }
}