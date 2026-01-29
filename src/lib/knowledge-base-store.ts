/**
 * Simple persistent knowledge base store for development/demo purposes
 * Uses file system for persistence across API calls
 */

import fs from 'fs';
import path from 'path';

interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  status: 'draft' | 'approved' | 'archived';
  created_at: string;
  updated_at: string;
  created_by: string;
  tenant_id: string;
  ticket_id?: string; // Reference to the original ticket
  resolution?: string; // The resolution from the ticket
  views: number;
  helpful_votes: number;
  not_helpful_votes: number;
}

class KnowledgeBaseStore {
  private articles: Map<string, KnowledgeArticle> = new Map();
  private dataFile: string;

  constructor() {
    // Store articles in a temporary file for persistence
    this.dataFile = path.join(process.cwd(), '.knowledge-base-store.json');
    this.loadFromFile();
  }

  /**
   * Load articles from file
   */
  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, 'utf8');
        const articlesArray = JSON.parse(data);
        this.articles = new Map(articlesArray);
        console.log(`📚 Loaded ${this.articles.size} knowledge base articles from file`);
      }
    } catch (error) {
      console.error('Error loading knowledge base articles from file:', error);
      this.articles = new Map();
    }
  }

  /**
   * Save articles to file
   */
  private saveToFile(): void {
    try {
      const articlesArray = Array.from(this.articles.entries());
      fs.writeFileSync(this.dataFile, JSON.stringify(articlesArray, null, 2));
      console.log(`💾 Saved ${this.articles.size} knowledge base articles to file`);
    } catch (error) {
      console.error('Error saving knowledge base articles to file:', error);
    }
  }

  /**
   * Create a new knowledge base article
   */
  createArticle(articleData: Omit<KnowledgeArticle, 'updated_at' | 'views' | 'helpful_votes' | 'not_helpful_votes'>): KnowledgeArticle {
    const now = new Date().toISOString();
    const article: KnowledgeArticle = {
      ...articleData,
      updated_at: now,
      views: 0,
      helpful_votes: 0,
      not_helpful_votes: 0
    };
    
    this.articles.set(article.id, article);
    this.saveToFile(); // Persist to file
    console.log(`📚 Knowledge base article created: ${article.id} - "${article.title}"`);
    return article;
  }

  /**
   * Create article from ticket resolution
   */
  createArticleFromTicket(ticketId: string, ticketTitle: string, ticketDescription: string, resolution: string, createdBy: string, tenantId: string): KnowledgeArticle {
    const now = new Date().toISOString();
    const articleId = `kb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const article: KnowledgeArticle = {
      id: articleId,
      title: `Solution: ${ticketTitle}`,
      content: `## Problem\n\n${ticketDescription}\n\n## Solution\n\n${resolution}`,
      category: 'ticket_resolution',
      tags: ['resolved_ticket', 'solution'],
      status: 'approved', // Auto-approve articles from ticket resolutions
      created_at: now,
      updated_at: now,
      created_by: createdBy,
      tenant_id: tenantId,
      ticket_id: ticketId,
      resolution: resolution,
      views: 0,
      helpful_votes: 0,
      not_helpful_votes: 0
    };
    
    this.articles.set(article.id, article);
    this.saveToFile(); // Persist to file
    console.log(`📚 Knowledge base article created from ticket: ${article.id} - "${article.title}"`);
    return article;
  }

  /**
   * Get article by ID
   */
  getArticle(id: string): KnowledgeArticle | null {
    return this.articles.get(id) || null;
  }

  /**
   * Get all articles for tenant
   */
  getAllArticles(tenantId?: string, status?: 'draft' | 'approved' | 'archived'): KnowledgeArticle[] {
    const allArticles = Array.from(this.articles.values()).filter(article => {
      const matchesTenant = !tenantId || article.tenant_id === tenantId;
      const matchesStatus = !status || article.status === status;
      return matchesTenant && matchesStatus;
    });

    return allArticles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Search articles
   */
  searchArticles(query: string, tenantId?: string, status?: 'draft' | 'approved' | 'archived'): KnowledgeArticle[] {
    const searchTerm = query.toLowerCase();
    const allArticles = this.getAllArticles(tenantId, status);
    
    return allArticles.filter(article => {
      return article.title.toLowerCase().includes(searchTerm) ||
             article.content.toLowerCase().includes(searchTerm) ||
             article.tags.some(tag => tag.toLowerCase().includes(searchTerm));
    });
  }

  /**
   * Update article
   */
  updateArticle(id: string, updates: Partial<KnowledgeArticle>): KnowledgeArticle | null {
    const article = this.articles.get(id);
    if (!article) {
      return null;
    }

    const updatedArticle: KnowledgeArticle = {
      ...article,
      ...updates,
      updated_at: new Date().toISOString()
    };

    this.articles.set(id, updatedArticle);
    this.saveToFile(); // Persist to file
    console.log(`📚 Knowledge base article updated: ${id}`);
    return updatedArticle;
  }

  /**
   * Delete article
   */
  deleteArticle(id: string): boolean {
    const deleted = this.articles.delete(id);
    if (deleted) {
      this.saveToFile(); // Persist to file
      console.log(`📚 Knowledge base article deleted: ${id}`);
    }
    return deleted;
  }

  /**
   * Increment article views
   */
  incrementViews(id: string): KnowledgeArticle | null {
    const article = this.articles.get(id);
    if (!article) {
      return null;
    }

    article.views += 1;
    this.articles.set(id, article);
    this.saveToFile(); // Persist to file
    return article;
  }

  /**
   * Vote on article helpfulness
   */
  voteOnArticle(id: string, helpful: boolean): KnowledgeArticle | null {
    const article = this.articles.get(id);
    if (!article) {
      return null;
    }

    if (helpful) {
      article.helpful_votes += 1;
    } else {
      article.not_helpful_votes += 1;
    }

    this.articles.set(id, article);
    this.saveToFile(); // Persist to file
    return article;
  }

  /**
   * Get article statistics
   */
  getStats(tenantId?: string): {
    total: number;
    approved: number;
    draft: number;
    archived: number;
    by_category: Record<string, number>;
  } {
    const articles = this.getAllArticles(tenantId);
    
    const stats = {
      total: articles.length,
      approved: 0,
      draft: 0,
      archived: 0,
      by_category: {} as Record<string, number>
    };

    articles.forEach(article => {
      // Count by status
      if (article.status === 'approved') stats.approved++;
      else if (article.status === 'draft') stats.draft++;
      else if (article.status === 'archived') stats.archived++;
      
      // Count by category
      if (article.category in stats.by_category) {
        stats.by_category[article.category]++;
      } else {
        stats.by_category[article.category] = 1;
      }
    });

    return stats;
  }

  /**
   * Clear all articles (for testing)
   */
  clear(): void {
    this.articles.clear();
    this.saveToFile(); // Persist to file
    console.log('🗑️ All knowledge base articles cleared');
  }

  /**
   * Get total count
   */
  getCount(): number {
    return this.articles.size;
  }
}

// Export singleton instance
export const knowledgeBaseStore = new KnowledgeBaseStore();