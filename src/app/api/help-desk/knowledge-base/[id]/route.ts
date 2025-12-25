import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeBaseService } from '../../../../../services/help-desk/KnowledgeBaseService';
import { getCurrentUser } from '../../../../../lib/auth';

/**
 * GET /api/help-desk/knowledge-base/[id]
 * Get a specific knowledge base article
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const article = await KnowledgeBaseService.getArticleById(user.tenant_id, params.id);

        if (!article) {
            return NextResponse.json({ error: 'Article not found' }, { status: 404 });
        }

        // Check if user can access this article
        // End users can only see approved articles (when feature is enabled)
        if (user.role === 'end_user' && !article.is_approved) {
            return NextResponse.json({ error: 'Article not found' }, { status: 404 });
        }

        return NextResponse.json(article);
    } catch (error) {
        console.error('Error fetching knowledge article:', error);
        return NextResponse.json(
            { error: 'Failed to fetch knowledge article' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/help-desk/knowledge-base/[id]
 * Update knowledge article approval status
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only tenant admins and super admins can approve articles
        if (!['tenant_admin', 'super_admin'].includes(user.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const body = await request.json();
        const { is_approved } = body;

        if (typeof is_approved !== 'boolean') {
            return NextResponse.json(
                { error: 'is_approved must be a boolean value' },
                { status: 400 }
            );
        }

        const article = await KnowledgeBaseService.updateApprovalStatus(
            user.tenant_id,
            params.id,
            is_approved
        );

        if (!article) {
            return NextResponse.json({ error: 'Article not found' }, { status: 404 });
        }

        return NextResponse.json(article);
    } catch (error) {
        console.error('Error updating knowledge article:', error);
        return NextResponse.json(
            { error: 'Failed to update knowledge article' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/help-desk/knowledge-base/[id]
 * Delete a knowledge base article
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only help desk analysts and above can delete articles
        if (!['help_desk_analyst', 'tenant_admin', 'super_admin'].includes(user.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        // Check if article exists first
        const existingArticle = await KnowledgeBaseService.getArticleById(user.tenant_id, params.id);
        if (!existingArticle) {
            return NextResponse.json({ error: 'Article not found' }, { status: 404 });
        }

        await KnowledgeBaseService.deleteArticle(user.tenant_id, params.id);

        return NextResponse.json({ message: 'Article deleted successfully' });
    } catch (error) {
        console.error('Error deleting knowledge article:', error);
        return NextResponse.json(
            { error: 'Failed to delete knowledge article' },
            { status: 500 }
        );
    }
}