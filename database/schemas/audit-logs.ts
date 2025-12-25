import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    jsonb,
    pgEnum,
    index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants, users } from './main';
import { sql } from 'drizzle-orm';

// ============================================================================
// Enums for Audit Logging
// ============================================================================

export const auditActionEnum = pgEnum('audit_action', [
    // Alert actions
    'alert_created',
    'alert_assigned',
    'alert_investigation_started',
    'alert_resolved',
    'alert_escalated',
    'alert_ownership_transferred',

    // Incident actions
    'incident_created',
    'incident_work_started',
    'incident_resolved',
    'incident_dismissed',
    'incident_ownership_transferred',
    'incident_alert_added',

    // Playbook actions
    'playbook_created',
    'playbook_updated',
    'playbook_status_changed',
    'playbook_classification_linked',
    'playbook_classification_unlinked',
]);

export const auditEntityTypeEnum = pgEnum('audit_entity_type', [
    'security_alert',
    'security_incident',
    'investigation_playbook',
    'playbook_classification_link',
]);

// ============================================================================
// Audit Logs Table
// ============================================================================

/**
 * Alerts Incidents Audit Logs Table
 * Comprehensive audit trail for all alert and incident state changes
 * with tenant isolation and user attribution
 */
export const alertsIncidentsAuditLogs = pgTable(
    'alerts_incidents_audit_logs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        tenantId: uuid('tenant_id')
            .notNull()
            .references(() => tenants.id, { onDelete: 'cascade' }),

        // User attribution
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),

        // Action details
        action: auditActionEnum('action').notNull(),
        entityType: auditEntityTypeEnum('entity_type').notNull(),
        entityId: uuid('entity_id').notNull(), // ID of the affected entity

        // Change details
        description: text('description').notNull(), // Human-readable description
        previousState: jsonb('previous_state'), // State before change (null for creation)
        newState: jsonb('new_state').notNull(), // State after change
        changeDetails: jsonb('change_details').notNull().default('{}'), // Specific fields changed

        // Context information
        userAgent: varchar('user_agent', { length: 500 }),
        ipAddress: varchar('ip_address', { length: 45 }), // IPv6 compatible
        sessionId: varchar('session_id', { length: 255 }),

        // Metadata
        metadata: jsonb('metadata').notNull().default('{}'), // Additional context

        // Timestamps
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => ({
        // Tenant isolation and performance indexes
        tenantIdx: index('alerts_incidents_audit_logs_tenant_idx').on(table.tenantId),
        tenantEntityIdx: index('alerts_incidents_audit_logs_tenant_entity_idx').on(
            table.tenantId,
            table.entityType,
            table.entityId
        ),
        tenantUserIdx: index('alerts_incidents_audit_logs_tenant_user_idx').on(
            table.tenantId,
            table.userId
        ),

        // Action and entity indexes
        actionIdx: index('alerts_incidents_audit_logs_action_idx').on(table.action),
        entityTypeIdx: index('alerts_incidents_audit_logs_entity_type_idx').on(table.entityType),
        entityIdIdx: index('alerts_incidents_audit_logs_entity_id_idx').on(table.entityId),
        userIdx: index('alerts_incidents_audit_logs_user_idx').on(table.userId),

        // Timestamp indexes for chronological queries
        createdAtIdx: index('alerts_incidents_audit_logs_created_at_idx').on(
            sql`${table.createdAt} DESC`
        ),
        tenantCreatedAtIdx: index('alerts_incidents_audit_logs_tenant_created_at_idx').on(
            table.tenantId,
            sql`${table.createdAt} DESC`
        ),

        // Entity-specific chronological indexes
        entityChronologicalIdx: index('alerts_incidents_audit_logs_entity_chronological_idx').on(
            table.entityType,
            table.entityId,
            sql`${table.createdAt} DESC`
        ),

        // User activity indexes
        userActivityIdx: index('alerts_incidents_audit_logs_user_activity_idx').on(
            table.userId,
            sql`${table.createdAt} DESC`
        ),
    })
);

// ============================================================================
// Relations
// ============================================================================

export const alertsIncidentsAuditLogsRelations = relations(alertsIncidentsAuditLogs, ({ one }) => ({
    tenant: one(tenants, {
        fields: [alertsIncidentsAuditLogs.tenantId],
        references: [tenants.id],
    }),
    user: one(users, {
        fields: [alertsIncidentsAuditLogs.userId],
        references: [users.id],
    }),
}));