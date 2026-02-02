/**
 * Simple persistent ticket store for development/demo purposes
 * Uses file system for persistence across API calls
 */

import fs from 'fs';
import path from 'path';

interface Ticket {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  phoneNumber?: string;
  contactMethod: 'email' | 'phone';
  status: 'new' | 'in_progress' | 'resolved' | 'closed';
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
}

class TicketStore {
  private tickets: Map<string, Ticket> = new Map();
  private dataFile: string;

  constructor() {
    // Store tickets in a temporary file for persistence
    this.dataFile = path.join(process.cwd(), '.tickets-store.json');
    this.loadFromFile();
  }

  /**
   * Load tickets from file
   */
  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, 'utf8');
        const ticketsArray = JSON.parse(data);
        this.tickets = new Map(ticketsArray);
        console.log(`📂 Loaded ${this.tickets.size} tickets from file`);
      }
    } catch (error) {
      console.error('Error loading tickets from file:', error);
      this.tickets = new Map();
    }
  }

  /**
   * Save tickets to file
   */
  private saveToFile(): void {
    try {
      const ticketsArray = Array.from(this.tickets.entries());
      fs.writeFileSync(this.dataFile, JSON.stringify(ticketsArray, null, 2));
      console.log(`💾 Saved ${this.tickets.size} tickets to file`);
    } catch (error) {
      console.error('Error saving tickets to file:', error);
    }
  }

  /**
   * Create a new ticket
   */
  createTicket(ticketData: Omit<Ticket, 'updated_at' | 'queue_position_updated_at'>): Ticket {
    const now = new Date().toISOString();
    const ticket: Ticket = {
      ...ticketData,
      updated_at: now,
      queue_position_updated_at: now,
      requester: ticketData.requester_email || ticketData.created_by,
      tags: ticketData.tags || [],
      device_name: ticketData.device_name || undefined,
      sla_deadline: ticketData.sla_deadline || undefined
    };
    
    this.tickets.set(ticket.id, ticket);
    this.saveToFile(); // Persist to file
    console.log(`📝 Ticket created: ${ticket.id} - "${ticket.title}"`);
    return ticket;
  }

  /**
   * Get ticket by ID
   */
  getTicket(id: string): Ticket | null {
    return this.tickets.get(id) || null;
  }

  /**
   * Get tickets by user (created by user)
   */
  getTicketsByUser(userId: string, tenantId?: string): Ticket[] {
    const userTickets = Array.from(this.tickets.values()).filter(ticket => {
      const matchesUser = ticket.created_by === userId;
      const matchesTenant = !tenantId || ticket.tenant_id === tenantId;
      return matchesUser && matchesTenant;
    });

    return userTickets.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Get tickets assigned to user
   */
  getAssignedTickets(userId: string, tenantId?: string): Ticket[] {
    const assignedTickets = Array.from(this.tickets.values()).filter(ticket => {
      const matchesAssigned = ticket.assigned_to === userId;
      const matchesTenant = !tenantId || ticket.tenant_id === tenantId;
      return matchesAssigned && matchesTenant;
    });

    return assignedTickets.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Get unassigned tickets
   */
  getUnassignedTickets(tenantId?: string): Ticket[] {
    const unassignedTickets = Array.from(this.tickets.values()).filter(ticket => {
      const isUnassigned = !ticket.assigned_to;
      const matchesTenant = !tenantId || ticket.tenant_id === tenantId;
      const isOpen = ticket.status === 'new';
      return isUnassigned && matchesTenant && isOpen;
    });

    return unassignedTickets.sort((a, b) => {
      // Sort by priority first (urgent > high > medium > low), then by creation date
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 1;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 1;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  /**
   * Get all tickets for tenant
   */
  getAllTickets(tenantId?: string): Ticket[] {
    const allTickets = Array.from(this.tickets.values()).filter(ticket => {
      return !tenantId || ticket.tenant_id === tenantId;
    });

    return allTickets.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Update ticket
   */
  updateTicket(id: string, updates: Partial<Ticket>): Ticket | null {
    const ticket = this.tickets.get(id);
    if (!ticket) {
      return null;
    }

    const updatedTicket: Ticket = {
      ...ticket,
      ...updates,
      updated_at: new Date().toISOString()
    };

    this.tickets.set(id, updatedTicket);
    this.saveToFile(); // Persist to file
    console.log(`📝 Ticket updated: ${id}`);
    return updatedTicket;
  }

  /**
   * Assign ticket to user
   */
  assignTicket(ticketId: string, userId: string): Ticket | null {
    return this.updateTicket(ticketId, {
      assigned_to: userId,
      status: 'in_progress'
    });
  }

  /**
   * Get ticket statistics
   */
  getStats(tenantId?: string): {
    total: number;
    new: number;
    in_progress: number;
    resolved: number;
    closed: number;
    unassigned: number;
    by_priority: Record<string, number>;
  } {
    const tickets = this.getAllTickets(tenantId);
    
    const stats = {
      total: tickets.length,
      new: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
      unassigned: 0,
      by_priority: { urgent: 0, high: 0, medium: 0, low: 0 }
    };

    tickets.forEach(ticket => {
      // Count by status
      if (ticket.status === 'new') stats.new++;
      else if (ticket.status === 'in_progress') stats.in_progress++;
      else if (ticket.status === 'resolved') stats.resolved++;
      else if (ticket.status === 'closed') stats.closed++;
      
      // Count unassigned
      if (!ticket.assigned_to) {
        stats.unassigned++;
      }
      
      // Count by priority
      if (ticket.priority in stats.by_priority) {
        stats.by_priority[ticket.priority]++;
      }
    });

    return stats;
  }

  /**
   * Clear all tickets (for testing)
   */
  clear(): void {
    this.tickets.clear();
    this.saveToFile(); // Persist to file
    console.log('🗑️ All tickets cleared');
  }

  /**
   * Get total count
   */
  getCount(): number {
    return this.tickets.size;
  }
}

// Export singleton instance
export const ticketStore = new TicketStore();