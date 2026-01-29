/**
 * Simple persistent comment store for development/demo purposes
 * Uses file system for persistence across API calls
 */

import fs from 'fs';
import path from 'path';

interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
  author_name?: string;
  author_email?: string;
}

class CommentStore {
  private comments: Map<string, TicketComment> = new Map();
  private dataFile: string;

  constructor() {
    // Store comments in a temporary file for persistence
    this.dataFile = path.join(process.cwd(), '.comments-store.json');
    this.loadFromFile();
  }

  /**
   * Load comments from file
   */
  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, 'utf8');
        const commentsArray = JSON.parse(data);
        this.comments = new Map(commentsArray);
        console.log(`📂 Loaded ${this.comments.size} comments from file`);
      }
    } catch (error) {
      console.error('Error loading comments from file:', error);
      this.comments = new Map();
    }
  }

  /**
   * Save comments to file
   */
  private saveToFile(): void {
    try {
      const commentsArray = Array.from(this.comments.entries());
      fs.writeFileSync(this.dataFile, JSON.stringify(commentsArray, null, 2));
      console.log(`💾 Saved ${this.comments.size} comments to file`);
    } catch (error) {
      console.error('Error saving comments to file:', error);
    }
  }

  /**
   * Create a new comment
   */
  createComment(commentData: Omit<TicketComment, 'updated_at'>): TicketComment {
    const now = new Date().toISOString();
    const comment: TicketComment = {
      ...commentData,
      updated_at: now,
    };
    
    this.comments.set(comment.id, comment);
    this.saveToFile(); // Persist to file
    console.log(`💬 Comment created: ${comment.id} for ticket ${comment.ticket_id}`);
    return comment;
  }

  /**
   * Get comments for a ticket
   */
  getCommentsByTicket(ticketId: string): TicketComment[] {
    const ticketComments = Array.from(this.comments.values()).filter(comment => 
      comment.ticket_id === ticketId
    );

    return ticketComments.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  /**
   * Get comment by ID
   */
  getComment(id: string): TicketComment | null {
    return this.comments.get(id) || null;
  }

  /**
   * Update comment
   */
  updateComment(id: string, updates: Partial<TicketComment>): TicketComment | null {
    const comment = this.comments.get(id);
    if (!comment) {
      return null;
    }

    const updatedComment: TicketComment = {
      ...comment,
      ...updates,
      updated_at: new Date().toISOString()
    };

    this.comments.set(id, updatedComment);
    this.saveToFile(); // Persist to file
    console.log(`💬 Comment updated: ${id}`);
    return updatedComment;
  }

  /**
   * Delete comment
   */
  deleteComment(id: string): boolean {
    const deleted = this.comments.delete(id);
    if (deleted) {
      this.saveToFile(); // Persist to file
      console.log(`💬 Comment deleted: ${id}`);
    }
    return deleted;
  }

  /**
   * Get all comments
   */
  getAllComments(): TicketComment[] {
    return Array.from(this.comments.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  /**
   * Clear all comments (for testing)
   */
  clear(): void {
    this.comments.clear();
    this.saveToFile(); // Persist to file
    console.log('🗑️ All comments cleared');
  }

  /**
   * Get total count
   */
  getCount(): number {
    return this.comments.size;
  }
}

// Export singleton instance
export const commentStore = new CommentStore();