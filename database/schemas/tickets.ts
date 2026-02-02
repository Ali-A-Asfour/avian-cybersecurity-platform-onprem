import { pgTable, varchar, text, timestamp, uuid, jsonb, pgEnum } from 'drizzle-orm/pg-core';

// Define the enums that exist in the server database
export const ticketSeverity = pgEnum('ticket_severity', ['low', 'medium', 'high', 'critical']);
export const ticketPriority = pgEnum('ticket_priority', ['low', 'medium', 'high', 'urgent']);
export const ticketStatus = pgEnum('ticket_status', ['new', 'in_progress', 'awaiting_response', 'resolved', 'closed']);
export const ticketCategory = pgEnum('ticket_category', [
  'general_request', 'other', 'it_support', 'hardware_issue', 'software_issue', 
  'network_issue', 'access_request', 'account_setup', 'security_incident', 
  'vulnerability', 'malware_detection', 'phishing_attempt', 'data_breach', 
  'policy_violation', 'compliance'
]);

export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull(),
  requester: varchar('requester', { length: 255 }).notNull(),
  assignee: varchar('assignee', { length: 255 }), // Server uses 'assignee' not 'assigned_to'
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description').notNull(),
  severity: ticketSeverity('severity').notNull(),
  priority: ticketPriority('priority').notNull(),
  status: ticketStatus('status').notNull().default('new'),
  tags: jsonb('tags').notNull().default('[]'),
  sla_deadline: timestamp('sla_deadline', { withTimezone: false }),
  created_at: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow(),
  category: ticketCategory('category').notNull()
});