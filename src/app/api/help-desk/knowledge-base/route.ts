import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { UserRole } from '@/types';
import { knowledgeBaseStore } from '@/lib/knowledge-base-store';

/**
 * GET /api/help-desk/knowledge-base
 * Search and retrieve knowledge base articles
 */
export async function GET(request: NextRequest) {
    try {
        console.log('📚 Knowledge base search API called');
        
        // Apply authentication middleware
        const authResult = await authMiddleware(request);
        if (!authResult.success) {
            console.log('❌ Auth failed:', authResult.error);
            return NextResponse.json({
                success: false,
                error: 'Authentication failed'
            }, { status: 401 });
        }

        const user = authResult.user!;
        console.log('✅ User authenticated:', user.email, user.role);

        // Get query parameters
        const url = new URL(request.url);
        const searchQuery = url.searchParams.get('q') || '';
        const status = url.searchParams.get('status') as 'draft' | 'approved' | 'archived' | null;
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        // Get tenant filter
        let tenantFilter: string | undefined;
        if ([UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST].includes(user.role)) {
            tenantFilter = request.headers.get('x-selected-tenant-id') || undefined;
        } else if (user.role !== UserRole.SUPER_ADMIN) {
            tenantFilter = user.tenant_id;
        }

        console.log('🔍 Search parameters:', { searchQuery, status, tenantFilter, limit, offset });

        // Search or get all articles
        let articles;
        if (searchQuery) {
            articles = knowledgeBaseStore.searchArticles(searchQuery, tenantFilter, status || undefined);
        } else {
            articles = knowledgeBaseStore.getAllArticles(tenantFilter, status || undefined);
        }

        // Apply pagination
        const total = articles.length;
        const paginatedArticles = articles.slice(offset, offset + limit);

        console.log(`📚 Found ${total} articles, returning ${paginatedArticles.length}`);

        return NextResponse.json({
            success: true,
            data: {
                articles: paginatedArticles,
                total: total,
                limit: limit,
                offset: offset
            }
        });

    } catch (error) {
        console.error('❌ Error searching knowledge base:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error: ' + error.message
        }, { status: 500 });
    }
}

/**
 * POST /api/help-desk/knowledge-base
 * Create a new knowledge base article
 */
export async function POST(request: NextRequest) {
    try {
        console.log('📚 Knowledge base create API called');
        
        // Apply authentication middleware
        const authResult = await authMiddleware(request);
        if (!authResult.success) {
            console.log('❌ Auth failed:', authResult.error);
            return NextResponse.json({
                success: false,
                error: 'Authentication failed'
            }, { status: 401 });
        }

        const user = authResult.user!;
        console.log('✅ User authenticated:', user.email, user.role);

        // Validate user role - only analysts and admins can create articles
        const allowedRoles = [UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST, UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN];
        if (!allowedRoles.includes(user.role)) {
            return NextResponse.json({
                success: false,
                error: 'Access denied - insufficient permissions to create knowledge base articles'
            }, { status: 403 });
        }

        // Parse request body
        const body = await request.json();
        const { title, content, category, tags, status } = body;

        // Validate required fields
        if (!title || !content) {
            return NextResponse.json({
                success: false,
                error: 'Title and content are required'
            }, { status: 400 });
        }

        // Get tenant ID
        let tenantId: string;
        if ([UserRole.IT_HELPDESK_ANALYST, UserRole.SECURITY_ANALYST].includes(user.role)) {
            tenantId = request.headers.get('x-selected-tenant-id') || user.tenant_id;
        } else {
            tenantId = user.tenant_id;
        }

        // Create article
        const articleId = `kb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();

        const article = knowledgeBaseStore.createArticle({
            id: articleId,
            title: title,
            content: content,
            category: category || 'general',
            tags: tags || [],
            status: status || 'draft',
            created_at: now,
            created_by: user.user_id,
            tenant_id: tenantId
        });

        console.log('📚 Knowledge base article created:', article.id);

        return NextResponse.json({
            success: true,
            data: article
        });

    } catch (error) {
        console.error('❌ Error creating knowledge base article:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error: ' + error.message
        }, { status: 500 });
    }
}