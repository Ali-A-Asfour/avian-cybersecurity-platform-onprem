import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums for tenant-specific data
export const ticketStatusEnum = pgEnum('ticket_status', [
  'new',
  'in_progress',
  'awaiting_response',
  'resolved',
  'closed',
]);

export const ticketSeverityEnum = pgEnum('ticket_severity', [
  'low',
  'medium',
  'high',
  'critical',
]);

export const ticketPriorityEnum = pgEnum('ticket_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

export const ticketCategoryEnum = pgEnum('ticket_category', [
  // Security-related categories (Security Analysts only)
  'security_incident',
  'vulnerability',
  'malware_detection',
  'phishing_attempt',
  'data_breach',
  'policy_violation',
  'compliance',

  // IT Support categories (IT Helpdesk Analysts only)
  'it_support',
  'hardware_issue',
  'software_issue',
  'network_issue',
  'access_request',
  'account_setup',

  // General categories (all roles)
  'general_request',
  'other',
]);

export const alertSeverityEnum = pgEnum('alert_severity', [
  'info',
  'low',
  'medium',
  'high',
  'critical',
]);

export const alertCategoryEnum = pgEnum('alert_category', [
  'malware',
  'phishing',
  'intrusion',
  'data_breach',
  'policy_violation',
  'anomaly',
  'other',
]);

export const alertStatusEnum = pgEnum('alert_status', [
  'open',
  'investigating',
  'resolved',
  'false_positive',
]);

export const complianceStatusEnum = pgEnum('compliance_status', [
  'not_started',
  'in_progress',
  'completed',
  'non_compliant',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'info',
  'warning',
  'error',
  'success',
]);

// Tenant-specific tables (these will be created per tenant schema)

// Tickets table
export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id').notNull(), // Reference to main.tenants
    requester: varchar('requester', { length: 255 }).notNull(),
    assignee: varchar('assignee', { length: 255 }),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description').notNull(),
    category: ticketCategoryEnum('category').notNull(),
    severity: ticketSeverityEnum('severity').notNull(),
    priority: ticketPriorityEnum('priority').notNull(),
    status: ticketStatusEnum('status').notNull().default('new'),
    tags: jsonb('tags').notNull().default('[]'), // Array of strings
    created_by: uuid('created_by').notNull(), // Reference to main.users - ticket creator
    sla_deadline: timestamp('sla_deadline'),
    queue_position_updated_at: timestamp('queue_position_updated_at').notNull().defaultNow(), // For deterministic queue ordering
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('tickets_tenant_idx').on(table.tenant_id),
    statusIdx: index('tickets_status_idx').on(table.status),
    severityIdx: index('tickets_severity_idx').on(table.severity),
    priorityIdx: index('tickets_priority_idx').on(table.priority),
    assigneeIdx: index('tickets_assignee_idx').on(table.assignee),
    requesterIdx: index('tickets_requester_idx').on(table.requester),
    createdByIdx: index('tickets_created_by_idx').on(table.created_by),
    createdAtIdx: index('tickets_created_at_idx').on(table.created_at),
    slaIdx: index('tickets_sla_deadline_idx').on(table.sla_deadline),
    queuePositionIdx: index('tickets_queue_position_idx').on(table.queue_position_updated_at),
  })
);

// Ticket comments table
export const ticketComments = pgTable(
  'ticket_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticket_id: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id').notNull(), // Reference to main.users
    content: text('content').notNull(),
    is_internal: boolean('is_internal').notNull().default(false),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    ticketIdx: index('ticket_comments_ticket_idx').on(table.ticket_id),
    userIdx: index('ticket_comments_user_idx').on(table.user_id),
    createdAtIdx: index('ticket_comments_created_at_idx').on(table.created_at),
  })
);

// Ticket attachments table
export const ticketAttachments = pgTable(
  'ticket_attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticket_id: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    filename: varchar('filename', { length: 255 }).notNull(),
    original_filename: varchar('original_filename', { length: 255 }).notNull(),
    file_size: integer('file_size').notNull(),
    mime_type: varchar('mime_type', { length: 100 }).notNull(),
    file_path: text('file_path').notNull(),
    uploaded_by: uuid('uploaded_by').notNull(), // Reference to main.users
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    ticketIdx: index('ticket_attachments_ticket_idx').on(table.ticket_id),
    uploaderIdx: index('ticket_attachments_uploader_idx').on(
      table.uploaded_by
    ),
  })
);

// Alerts table
export const alerts = pgTable(
  'alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id').notNull(), // Reference to main.tenants
    source: varchar('source', { length: 255 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description').notNull(),
    severity: alertSeverityEnum('severity').notNull(),
    category: alertCategoryEnum('category').notNull(),
    status: alertStatusEnum('status').notNull().default('open'),
    metadata: jsonb('metadata').notNull().default('{}'),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('alerts_tenant_idx').on(table.tenant_id),
    severityIdx: index('alerts_severity_idx').on(table.severity),
    categoryIdx: index('alerts_category_idx').on(table.category),
    statusIdx: index('alerts_status_idx').on(table.status),
    sourceIdx: index('alerts_source_idx').on(table.source),
    createdAtIdx: index('alerts_created_at_idx').on(table.created_at),
  })
);

// Compliance frameworks table
export const complianceFrameworks = pgTable(
  'compliance_frameworks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id').notNull(), // Reference to main.tenants
    name: varchar('name', { length: 255 }).notNull(),
    version: varchar('version', { length: 50 }).notNull(),
    description: text('description'),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('compliance_frameworks_tenant_idx').on(table.tenant_id),
    activeIdx: index('compliance_frameworks_active_idx').on(table.is_active),
  })
);

// Compliance controls table
export const complianceControls = pgTable(
  'compliance_controls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    framework_id: uuid('framework_id')
      .notNull()
      .references(() => complianceFrameworks.id, { onDelete: 'cascade' }),
    control_id: varchar('control_id', { length: 100 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description').notNull(),
    status: complianceStatusEnum('status').notNull().default('not_started'),
    last_reviewed: timestamp('last_reviewed'),
    next_review_date: timestamp('next_review_date'),
    assigned_to: uuid('assigned_to'), // Reference to main.users
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    frameworkIdx: index('compliance_controls_framework_idx').on(
      table.framework_id
    ),
    statusIdx: index('compliance_controls_status_idx').on(table.status),
    assignedIdx: index('compliance_controls_assigned_idx').on(
      table.assigned_to
    ),
    reviewDateIdx: index('compliance_controls_review_date_idx').on(
      table.next_review_date
    ),
  })
);

// Compliance evidence table
export const complianceEvidence = pgTable(
  'compliance_evidence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    control_id: uuid('control_id')
      .notNull()
      .references(() => complianceControls.id, { onDelete: 'cascade' }),
    filename: varchar('filename', { length: 255 }).notNull(),
    original_filename: varchar('original_filename', { length: 255 }).notNull(),
    file_size: integer('file_size').notNull(),
    mime_type: varchar('mime_type', { length: 100 }).notNull(),
    file_path: text('file_path').notNull(),
    description: text('description'),
    uploaded_by: uuid('uploaded_by').notNull(), // Reference to main.users
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    controlIdx: index('compliance_evidence_control_idx').on(table.control_id),
    uploaderIdx: index('compliance_evidence_uploader_idx').on(
      table.uploaded_by
    ),
  })
);

// Knowledge base articles table
export const knowledgeArticles = pgTable(
  'knowledge_articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id').notNull(), // Reference to main.tenants
    title: varchar('title', { length: 500 }).notNull(),
    problem_description: text('problem_description').notNull(),
    resolution: text('resolution').notNull(),
    source_ticket_id: uuid('source_ticket_id').references(() => tickets.id), // Optional reference to originating ticket
    created_by: uuid('created_by').notNull(), // Reference to main.users
    is_approved: boolean('is_approved').notNull().default(false), // For future end-user visibility
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('knowledge_articles_tenant_idx').on(table.tenant_id),
    createdByIdx: index('knowledge_articles_created_by_idx').on(table.created_by),
    sourceTicketIdx: index('knowledge_articles_source_ticket_idx').on(table.source_ticket_id),
    approvedIdx: index('knowledge_articles_approved_idx').on(table.is_approved),
    createdAtIdx: index('knowledge_articles_created_at_idx').on(table.created_at),
  })
);

// Notifications table
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: uuid('tenant_id').notNull(), // Reference to main.tenants
    user_id: uuid('user_id').notNull(), // Reference to main.users
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    type: notificationTypeEnum('type').notNull().default('info'),
    is_read: boolean('is_read').notNull().default(false),
    metadata: jsonb('metadata').default('{}'),
    created_at: timestamp('created_at').notNull().defaultNow(),
    read_at: timestamp('read_at'),
  },
  (table) => ({
    tenantIdx: index('notifications_tenant_idx').on(table.tenant_id),
    userIdx: index('notifications_user_idx').on(table.user_id),
    readIdx: index('notifications_read_idx').on(table.is_read),
    createdAtIdx: index('notifications_created_at_idx').on(table.created_at),
  })
);

// Relations
export const ticketsRelations = relations(tickets, ({ many }) => ({
  comments: many(ticketComments),
  attachments: many(ticketAttachments),
}));

export const ticketCommentsRelations = relations(ticketComments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketComments.ticket_id],
    references: [tickets.id],
  }),
}));

export const ticketAttachmentsRelations = relations(
  ticketAttachments,
  ({ one }) => ({
    ticket: one(tickets, {
      fields: [ticketAttachments.ticket_id],
      references: [tickets.id],
    }),
  })
);

export const complianceFrameworksRelations = relations(
  complianceFrameworks,
  ({ many }) => ({
    controls: many(complianceControls),
  })
);

export const complianceControlsRelations = relations(
  complianceControls,
  ({ one, many }) => ({
    framework: one(complianceFrameworks, {
      fields: [complianceControls.framework_id],
      references: [complianceFrameworks.id],
    }),
    evidence: many(complianceEvidence),
  })
);

export const complianceEvidenceRelations = relations(
  complianceEvidence,
  ({ one }) => ({
    control: one(complianceControls, {
      fields: [complianceEvidence.control_id],
      references: [complianceControls.id],
    }),
  })
);

export const knowledgeArticlesRelations = relations(
  knowledgeArticles,
  ({ one }) => ({
    sourceTicket: one(tickets, {
      fields: [knowledgeArticles.source_ticket_id],
      references: [tickets.id],
    }),
  })
);