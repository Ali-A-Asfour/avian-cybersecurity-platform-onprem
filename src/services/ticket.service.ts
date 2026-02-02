/**
 * Ticket Service - Database-based ticket management using Drizzle ORM
 */

import { getDb } from '@/lib/database';
import { tickets } from '@/../database/schemas/tickets';
import { eq, and, isNull, desc, asc } from 'drizzle-orm';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  contact_method: 'email' | 'phone';
  status: 'new' | 'in_progress' | 'awaiting_response' | 'resolved' | 'closed';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  created_at: string;
  updated_at: string;
  created_by: string;
  assigned_to?: string;
  tenant_id: string;
  category: string;
  requester_email?: string;
  requester: string;
  tags: string[];
  device_name?: string;
  sla_deadline?: string;
  queue_position_updated_at: string;
  phone_number?: string;
}

export class TicketService {
  /**
   * Get ticket by ID
   */
  static async getTicket(id: string): Promise<Ticket | null> {
    try {
      // Use direct postgres connection instead of Drizzle
      const postgres = (await import('postgres')).default;
      const client = postgres(process.env.DATABASE_URL!, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
        ssl: false,
        prepare: true,
        transform: {
          undefined: null,
        },
      });

      const result = await client`
        SELECT * FROM tickets WHERE id = ${id} LIMIT 1
      `;
      
      await client.end();
      
      if (result.length === 0) {
        return null;
      }
      
      return this.mapRowToTicket(result[0]);
    } catch (error) {
      console.error('Error getting ticket:', error);
      throw error;
    }
  }

  /**
   * Get tickets by user (created by user)
   */
  static async getTicketsByUser(userEmail: string, tenantId?: string): Promise<Ticket[]> {
    try {
      // Use direct postgres connection instead of Drizzle
      const postgres = (await import('postgres')).default;
      const client = postgres(process.env.DATABASE_URL!, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
        ssl: false,
        prepare: true,
        transform: {
          undefined: null,
        },
      });

      let query;
      if (tenantId) {
        query = client`
          SELECT * FROM tickets 
          WHERE requester = ${userEmail}
          AND tenant_id = ${tenantId}
          ORDER BY created_at DESC
        `;
      } else {
        query = client`
          SELECT * FROM tickets 
          WHERE requester = ${userEmail}
          ORDER BY created_at DESC
        `;
      }

      const result = await query;
      await client.end();
      
      return result.map(row => this.mapRowToTicket(row));
    } catch (error) {
      console.error('Error getting tickets by user:', error);
      throw error;
    }
  }

  /**
   * Get tickets assigned to user
   */
  static async getAssignedTickets(userId: string, tenantId?: string): Promise<Ticket[]> {
    try {
      // Use direct postgres connection instead of Drizzle
      const postgres = (await import('postgres')).default;
      const client = postgres(process.env.DATABASE_URL!, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
        ssl: false,
        prepare: true,
        transform: {
          undefined: null,
        },
      });

      let query;
      if (tenantId) {
        query = client`
          SELECT * FROM tickets 
          WHERE assignee = ${userId}
          AND tenant_id = ${tenantId}
          ORDER BY created_at DESC
        `;
      } else {
        query = client`
          SELECT * FROM tickets 
          WHERE assignee = ${userId}
          ORDER BY created_at DESC
        `;
      }

      const result = await query;
      await client.end();
      
      return result.map(row => this.mapRowToTicket(row));
    } catch (error) {
      console.error('Error getting assigned tickets:', error);
      throw error;
    }
  }

  /**
   * Get unassigned tickets
   */
  static async getUnassignedTickets(tenantId?: string): Promise<Ticket[]> {
    try {
      // Use direct postgres connection instead of Drizzle
      const postgres = (await import('postgres')).default;
      const client = postgres(process.env.DATABASE_URL!, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
        ssl: false,
        prepare: true,
        transform: {
          undefined: null,
        },
      });

      let query;
      if (tenantId) {
        query = client`
          SELECT * FROM tickets 
          WHERE (assignee IS NULL OR assignee = '')
          AND status = 'new'
          AND tenant_id = ${tenantId}
          ORDER BY 
            CASE priority 
              WHEN 'urgent' THEN 1 
              WHEN 'high' THEN 2 
              WHEN 'medium' THEN 3 
              WHEN 'low' THEN 4 
            END,
            created_at ASC
        `;
      } else {
        query = client`
          SELECT * FROM tickets 
          WHERE (assignee IS NULL OR assignee = '')
          AND status = 'new'
          ORDER BY 
            CASE priority 
              WHEN 'urgent' THEN 1 
              WHEN 'high' THEN 2 
              WHEN 'medium' THEN 3 
              WHEN 'low' THEN 4 
            END,
            created_at ASC
        `;
      }

      const result = await query;
      await client.end();
      
      return result.map(row => this.mapRowToTicket(row));
    } catch (error) {
      console.error('Error getting unassigned tickets:', error);
      throw error;
    }
  }

  /**
   * Assign ticket to user
   */
  static async assignTicket(ticketId: string, userId: string): Promise<Ticket | null> {
    try {
      // Use direct postgres connection instead of Drizzle
      const postgres = (await import('postgres')).default;
      const client = postgres(process.env.DATABASE_URL!, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
        ssl: false,
        prepare: true,
        transform: {
          undefined: null,
        },
      });

      const result = await client`
        UPDATE tickets 
        SET assigned_to = ${userId}, assignee = ${userId}, status = 'in_progress', updated_at = NOW() 
        WHERE id = ${ticketId} 
        RETURNING *
      `;
      
      await client.end();
      
      if (result.length === 0) {
        return null;
      }
      
      console.log(`✅ Ticket ${ticketId} assigned to ${userId}`);
      return this.mapRowToTicket(result[0]);
    } catch (error) {
      console.error('Error assigning ticket:', error);
      throw error;
    }
  }

  /**
   * Create a new ticket
   */
  static async createTicket(ticketData: Omit<Ticket, 'updated_at' | 'queue_position_updated_at'>): Promise<Ticket> {
    try {
      const db = await getDb();
      const result = await db.execute(
        `INSERT INTO tickets (
          id, title, description, severity, contact_method, status, priority,
          created_at, created_by, tenant_id, category, requester_email, requester,
          tags, device_name, sla_deadline, phone_number
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        ) RETURNING *`,
        [
          ticketData.id,
          ticketData.title,
          ticketData.description,
          ticketData.severity,
          ticketData.contact_method,
          ticketData.status,
          ticketData.priority,
          ticketData.created_at,
          ticketData.created_by,
          ticketData.tenant_id,
          ticketData.category,
          ticketData.requester_email,
          ticketData.requester,
          ticketData.tags,
          ticketData.device_name,
          ticketData.sla_deadline,
          ticketData.phone_number
        ]
      );
      
      console.log(`📝 Ticket created: ${ticketData.id}`);
      return this.mapRowToTicket(result.rows[0]);
    } catch (error) {
      console.error('Error creating ticket:', error);
      throw error;
    }
  }

  /**
   * Map database row to Ticket object
   */
  private static mapRowToTicket(row: any): Ticket {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      severity: row.severity,
      contact_method: 'email', // Default since this column doesn't exist in server DB
      status: row.status,
      priority: row.priority,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      created_by: row.requester, // Use requester as created_by since created_by doesn't exist in server DB
      assigned_to: row.assignee, // Server DB uses 'assignee' column, map to assigned_to for compatibility
      tenant_id: row.tenant_id,
      category: row.category,
      requester_email: row.requester, // Use requester as email if separate email field doesn't exist
      requester: row.requester,
      tags: Array.isArray(row.tags) ? row.tags : (row.tags ? JSON.parse(row.tags) : []),
      device_name: row.device_name,
      sla_deadline: row.sla_deadline instanceof Date ? row.sla_deadline.toISOString() : row.sla_deadline,
      queue_position_updated_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at, // Use created_at since queue_position_updated_at doesn't exist in server DB
      phone_number: row.phone_number
    };
  }
}