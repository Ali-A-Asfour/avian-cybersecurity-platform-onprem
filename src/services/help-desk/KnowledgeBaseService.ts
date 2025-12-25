import { eq, and, desc, asc, sql, count, or, like } from 'drizzle-orm';
import { knowledgeArticles } from '../../../database/schemas/tenant';
import { getTenantDatabase } from '../../lib/tenant-schema';

export interface KnowledgeArticle {
    id: string;
    tenant_id: string;
    title: string;
    problem_description: string;
    resolution: string;
    source_ticket_id?: string;
    created_by: string;
    is_approved: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface CreateKnowledgeArticleRequest {
    title: string;
    problemDescription: string;
    resolution: string;
    sourceTicketId?: string;
}

export interface KnowledgeArticleValidation {
    valid: boolean;
    errors: string[];
}

export interface SearchFilters {
    query?: string;
    approved_only?: boolean;
    created_by?: string;
    page?: number;
    limit?: number;
}

export class KnowledgeBaseService {
    /**
     * Validate knowledge article creation data
     */
    static validateArticleCreation(data: CreateKnowledgeArticleRequest): KnowledgeArticleValidation {
        const errors: string[] = [];

        if (!data.title || data.title.trim().length === 0) {
            errors.push('Title is required');
        }

        if (!data.problemDescription || data.problemDescription.trim().length === 0) {
            errors.push('Problem description is required');
        }

        if (!data.resolution || data.resolution.trim().length === 0) {
            errors.push('Resolution is required');
        }

        if (data.title && data.title.length > 500) {
            errors.push('Title must be 500 characters or less');
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Create a new knowledge base article
     */
    static async createArticle(
        tenantId: string,
        userId: string,
        data: CreateKnowledgeArticleRequest
    ): Promise<KnowledgeArticle> {
        // Validate input
        const validation = this.validateArticleCreation(data);
        if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const db = await getTenantDatabase(tenantId);

        const [article] = await db
            .insert(knowledgeArticles)
            .values({
                tenant_id: tenantId,
                title: data.title.trim(),
                problem_description: data.problemDescription.trim(),
                resolution: data.resolution.trim(),
                source_ticket_id: data.sourceTicketId,
                created_by: userId,
                is_approved: false, // Default to not approved
            })
            .returning();

        return this.formatArticle(article);
    }

    /**
     * Create knowledge article from ticket resolution
     */
    static async createArticleFromTicketResolution(
        tenantId: string,
        ticketId: string,
        userId: string,
        title: string,
        problemDescription: string,
        resolution: string
    ): Promise<KnowledgeArticle> {
        return this.createArticle(tenantId, userId, {
            title,
            problemDescription,
            resolution,
            sourceTicketId: ticketId,
        });
    }

    /**
     * Search knowledge base articles
     */
    static async searchArticles(
        tenantId: string,
        filters: SearchFilters = {}
    ): Promise<{ articles: KnowledgeArticle[]; total: number }> {
        const db = await getTenantDatabase(tenantId);

        const {
            query,
            approved_only = false,
            created_by,
            page = 1,
            limit = 20,
        } = filters;

        // Build where conditions
        const conditions = [eq(knowledgeArticles.tenant_id, tenantId)];

        if (approved_only) {
            conditions.push(eq(knowledgeArticles.is_approved, true));
        }

        if (created_by) {
            conditions.push(eq(knowledgeArticles.created_by, created_by));
        }

        if (query && query.trim().length > 0) {
            const searchTerm = `%${query.trim()}%`;
            conditions.push(
                or(
                    like(knowledgeArticles.title, searchTerm),
                    like(knowledgeArticles.problem_description, searchTerm),
                    like(knowledgeArticles.resolution, searchTerm)
                )!
            );
        }

        const whereClause = and(...conditions);

        // Get total count
        const [{ count: totalCount }] = await db
            .select({ count: count() })
            .from(knowledgeArticles)
            .where(whereClause);

        // Get articles with pagination
        const offset = (page - 1) * limit;

        const articleResults = await db
            .select()
            .from(knowledgeArticles)
            .where(whereClause)
            .orderBy(desc(knowledgeArticles.created_at))
            .limit(limit)
            .offset(offset);

        return {
            articles: articleResults.map(this.formatArticle),
            total: totalCount,
        };
    }

    /**
     * Get a single knowledge article by ID
     */
    static async getArticleById(tenantId: string, articleId: string): Promise<KnowledgeArticle | null> {
        const db = await getTenantDatabase(tenantId);

        const [article] = await db
            .select()
            .from(knowledgeArticles)
            .where(and(eq(knowledgeArticles.id, articleId), eq(knowledgeArticles.tenant_id, tenantId)));

        return article ? this.formatArticle(article) : null;
    }

    /**
     * Update knowledge article approval status
     */
    static async updateApprovalStatus(
        tenantId: string,
        articleId: string,
        isApproved: boolean
    ): Promise<KnowledgeArticle | null> {
        const db = await getTenantDatabase(tenantId);

        const [updatedArticle] = await db
            .update(knowledgeArticles)
            .set({
                is_approved: isApproved,
                updated_at: new Date(),
            })
            .where(and(eq(knowledgeArticles.id, articleId), eq(knowledgeArticles.tenant_id, tenantId)))
            .returning();

        return updatedArticle ? this.formatArticle(updatedArticle) : null;
    }

    /**
     * Delete a knowledge article
     */
    static async deleteArticle(tenantId: string, articleId: string): Promise<boolean> {
        const db = await getTenantDatabase(tenantId);

        const result = await db
            .delete(knowledgeArticles)
            .where(and(eq(knowledgeArticles.id, articleId), eq(knowledgeArticles.tenant_id, tenantId)));

        return true; // Assume success for now
    }

    /**
     * Get articles created from a specific ticket
     */
    static async getArticlesBySourceTicket(
        tenantId: string,
        ticketId: string
    ): Promise<KnowledgeArticle[]> {
        const db = await getTenantDatabase(tenantId);

        const articles = await db
            .select()
            .from(knowledgeArticles)
            .where(
                and(
                    eq(knowledgeArticles.tenant_id, tenantId),
                    eq(knowledgeArticles.source_ticket_id, ticketId)
                )
            )
            .orderBy(desc(knowledgeArticles.created_at));

        return articles.map(this.formatArticle);
    }

    /**
     * Get knowledge base statistics
     */
    static async getKnowledgeBaseStats(tenantId: string): Promise<{
        total: number;
        approved: number;
        pending_approval: number;
        created_this_month: number;
    }> {
        const db = await getTenantDatabase(tenantId);

        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);

        // Get total count
        const [{ count: totalCount }] = await db
            .select({ count: count() })
            .from(knowledgeArticles)
            .where(eq(knowledgeArticles.tenant_id, tenantId));

        // Get approved count
        const [{ count: approvedCount }] = await db
            .select({ count: count() })
            .from(knowledgeArticles)
            .where(
                and(
                    eq(knowledgeArticles.tenant_id, tenantId),
                    eq(knowledgeArticles.is_approved, true)
                )
            );

        // Get created this month count
        const [{ count: thisMonthCount }] = await db
            .select({ count: count() })
            .from(knowledgeArticles)
            .where(
                and(
                    eq(knowledgeArticles.tenant_id, tenantId),
                    sql`${knowledgeArticles.created_at} >= ${thisMonth}`
                )
            );

        return {
            total: totalCount,
            approved: approvedCount,
            pending_approval: totalCount - approvedCount,
            created_this_month: thisMonthCount,
        };
    }

    /**
     * Format article data for API response
     */
    private static formatArticle(article: any): KnowledgeArticle {
        return {
            id: article.id,
            tenant_id: article.tenant_id,
            title: article.title,
            problem_description: article.problem_description,
            resolution: article.resolution,
            source_ticket_id: article.source_ticket_id,
            created_by: article.created_by,
            is_approved: article.is_approved,
            created_at: article.created_at,
            updated_at: article.updated_at,
        };
    }
}