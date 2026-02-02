import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeBaseService } from '../../../../services/help-desk/KnowledgeBaseService';
import { getCurrentUser } from '../../../../lib/auth';

/**
 * GET /api/help-desk/knowledge-base
 * Search knowledge base articles
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get('query') || undefined;
        const approvedOnly = searchParams.get('approved_only') === 'true';
        const createdBy = searchParams.get('created_by') || undefined;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');

        const result = await KnowledgeBaseService.searchArticles(user.tenant_id, {
            query,
            approved_only: approvedOnly,
            created_by: createdBy,
            page,
            limit,
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error searching knowledge base:', error);
        return NextResponse.json(
            { error: 'Failed to search knowledge base' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/help-desk/knowledge-base
 * Create a new knowledge base article
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user has help desk analyst role or higher
        if (!['help_desk_analyst', 'tenant_admin', 'super_admin'].includes(user.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const body = await request.json();
        const { title, problemDescription, resolution, sourceTicketId } = body;

        if (!title || !problemDescription || !resolution) {
            return NextResponse.json(
                { error: 'Title, problem description, and resolution are required' },
                { status: 400 }
            );
        }

        const article = await KnowledgeBaseService.createArticle(
            user.tenant_id,
            user.id,
            {
                title,
                problemDescription,
                resolution,
                sourceTicketId,
            }
        );

        return NextResponse.json(article, { status: 201 });
    } catch (error) {
        console.error('Error creating knowledge article:', error);
        return NextResponse.json(
            { error: 'Failed to create knowledge article' },
            { status: 500 }
        );
    }
}