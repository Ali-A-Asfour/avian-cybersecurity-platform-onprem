import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    boolean,
    jsonb,
    pgEnum,
    index,
    integer,
    unique,
    check,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants, users } from './main';
import { sql } from 'drizzle-orm';

// ============================================================================
// Enums for Alerts & Security Incidents Module
// ============================================================================

export const alertStatusEnum = pgEnum('alert_status', [
    'open',
    'assigned',
    'investigating',
    'escalated',
    'closed_benign',
    'closed_false_positive',
]);

export const alertSeverityEnum = pgEnum('alert_severity', [
    'critical',
    'high',
    'medium',
    'low',
]);

export const alertSourceSystemEnum = pgEnum('alert_source_system', [
    'edr',
    'firewall',
    'email',
]);

export const incidentStatusEnum = pgEnum('incident_status', [
    'open',
    'in_progress',
    'resolved',
    'dismissed',
]);

export const playbookStatusEnum = pgEnum('playbook_status', [
    'active',
    'draft',
    'deprecated',
]);

// ============================================================================
// Security Alerts Table
// ============================================================================

/**
 * Security Alerts Table
 * Stores all security alerts from various sources (EDR, Firewall, Email)
 * with tenant isolation and deduplication intelligence
 */
export const securityAlerts = pgTable(
    'security_alerts',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        tenantId: uuid('tenant_id')
            .notNull()
            .references(() => tenants.id, { onDelete: 'cascade' }),
        sourceSystem: alertSourceSystemEnum('source_system').notNull(),
        sourceId: varchar('source_id', { length: 255 }).notNull(), // External system ID

        // Classification
        alertType: varchar('alert_type', { length: 100 }).notNull(),
        classification: varchar('classification', { length: 100 }).notNull(),
        severity: alertSeverityEnum('severity').notNull(),

        // Content
        title: text('title').notNull(),
        description: text('description'),
        metadata: jsonb('metadata').notNull().default('{}'),

        // Deduplication Intelligence (preserves reporting data)
        seenCount: integer('seen_count').notNull().default(1),
        firstSeenAt: timestamp('first_seen_at').notNull().defaultNow(),
        lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),

        // Microsoft Defender Context (if applicable)
        defenderIncidentId: varchar('defender_incident_id', { length: 255 }),
        defenderAlertId: varchar('defender_alert_id', { length: 255 }),
        defenderSeverity: varchar('defender_severity', { length: 50 }),
        threatName: varchar('threat_name', { length: 255 }),
        affectedDevice: varchar('affected_device', { length: 255 }),
        affectedUser: varchar('affected_user', { length: 255 }),

        // Workflow State
        status: alertStatusEnum('status').notNull().default('open'),
        assignedTo: uuid('assigned_to').references(() => users.id, {
            onDelete: 'set null',
        }),
        assignedAt: timestamp('assigned_at'),

        // Timestamps
        detectedAt: timestamp('detected_at').notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => ({
        // Tenant isolation and performance indexes
        tenantIdx: index('security_alerts_tenant_idx').on(table.tenantId),
        tenantStatusIdx: index('security_alerts_tenant_status_idx').on(
            table.tenantId,
            table.status
        ),
        tenantAssignedIdx: index('security_alerts_tenant_assigned_idx').on(
            table.tenantId,
            table.assignedTo
        ),

        // Workflow indexes
        statusIdx: index('security_alerts_status_idx').on(table.status),
        assignedToIdx: index('security_alerts_assigned_to_idx').on(table.assignedTo),
        severityIdx: index('security_alerts_severity_idx').on(table.severity),

        // Ordering indexes for triage queue
        severityCreatedIdx: index('security_alerts_severity_created_idx').on(
            table.severity,
            sql`${table.createdAt} ASC`
        ),
        assignedAtIdx: index('security_alerts_assigned_at_idx').on(
            sql`${table.assignedAt} DESC`
        ),

        // Source system indexes
        sourceSystemIdx: index('security_alerts_source_system_idx').on(
            table.sourceSystem
        ),
        classificationIdx: index('security_alerts_classification_idx').on(
            table.classification
        ),

        // Deduplication index
        uniqueTenantSource: unique('security_alerts_tenant_source_unique').on(
            table.tenantId,
            table.sourceSystem,
            table.sourceId
        ),

        // Timestamps
        detectedAtIdx: index('security_alerts_detected_at_idx').on(
            sql`${table.detectedAt} DESC`
        ),
        createdAtIdx: index('security_alerts_created_at_idx').on(
            sql`${table.createdAt} DESC`
        ),

        // Check constraints
        checkSeenCount: check(
            'security_alerts_seen_count_positive',
            sql`${table.seenCount} >= 1`
        ),
        checkAssignmentConsistency: check(
            'security_alerts_assignment_consistency',
            sql`(${table.status} IN ('open') AND ${table.assignedTo} IS NULL AND ${table.assignedAt} IS NULL) OR (${table.status} IN ('assigned', 'investigating', 'escalated', 'closed_benign', 'closed_false_positive') AND ${table.assignedTo} IS NOT NULL AND ${table.assignedAt} IS NOT NULL)`
        ),
    })
);

// ============================================================================
// Security Incidents Table
// ============================================================================

/**
 * Security Incidents Table
 * Stores security incidents escalated from alerts with SLA tracking
 */
export const securityIncidents = pgTable(
    'security_incidents',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        tenantId: uuid('tenant_id')
            .notNull()
            .references(() => tenants.id, { onDelete: 'cascade' }),

        // Ownership (preserved from primary alert)
        ownerId: uuid('owner_id')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),

        // Content
        title: text('title').notNull(),
        description: text('description'),
        severity: alertSeverityEnum('severity').notNull(),

        // Workflow State
        status: incidentStatusEnum('status').notNull().default('open'),

        // Resolution
        resolutionSummary: text('resolution_summary'),
        dismissalJustification: text('dismissal_justification'),

        // SLA Tracking
        slaAcknowledgeBy: timestamp('sla_acknowledge_by').notNull(),
        slaInvestigateBy: timestamp('sla_investigate_by').notNull(),
        slaResolveBy: timestamp('sla_resolve_by').notNull(),
        acknowledgedAt: timestamp('acknowledged_at'), // Set when analyst clicks "Start Work" (first time only)
        investigationStartedAt: timestamp('investigation_started_at'), // Set when analyst clicks "Start Work" (first time only)
        resolvedAt: timestamp('resolved_at'), // Set when status changes to 'resolved' or 'dismissed'

        // Timestamps
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => ({
        // Tenant isolation and performance indexes
        tenantIdx: index('security_incidents_tenant_idx').on(table.tenantId),
        tenantOwnerIdx: index('security_incidents_tenant_owner_idx').on(
            table.tenantId,
            table.ownerId
        ),
        tenantStatusIdx: index('security_incidents_tenant_status_idx').on(
            table.tenantId,
            table.status
        ),

        // Workflow indexes
        ownerIdx: index('security_incidents_owner_idx').on(table.ownerId),
        statusIdx: index('security_incidents_status_idx').on(table.status),
        severityIdx: index('security_incidents_severity_idx').on(table.severity),

        // SLA tracking indexes
        slaAcknowledgeIdx: index('security_incidents_sla_acknowledge_idx').on(
            table.slaAcknowledgeBy
        ),
        slaInvestigateIdx: index('security_incidents_sla_investigate_idx').on(
            table.slaInvestigateBy
        ),
        slaResolveIdx: index('security_incidents_sla_resolve_idx').on(
            table.slaResolveBy
        ),

        // Timestamps
        createdAtIdx: index('security_incidents_created_at_idx').on(
            sql`${table.createdAt} DESC`
        ),

        // Check constraints
        checkResolutionConsistency: check(
            'security_incidents_resolution_consistency',
            sql`(${table.status} = 'resolved' AND ${table.resolutionSummary} IS NOT NULL AND ${table.dismissalJustification} IS NULL) OR (${table.status} = 'dismissed' AND ${table.dismissalJustification} IS NOT NULL AND ${table.resolutionSummary} IS NULL) OR (${table.status} IN ('open', 'in_progress') AND ${table.resolutionSummary} IS NULL AND ${table.dismissalJustification} IS NULL)`
        ),
        checkSlaOrder: check(
            'security_incidents_sla_order',
            sql`${table.slaAcknowledgeBy} <= ${table.slaInvestigateBy} AND ${table.slaInvestigateBy} <= ${table.slaResolveBy}`
        ),
        checkWorkflowTimestamps: check(
            'security_incidents_workflow_timestamps',
            sql`(${table.acknowledgedAt} IS NULL OR ${table.acknowledgedAt} >= ${table.createdAt}) AND (${table.investigationStartedAt} IS NULL OR ${table.investigationStartedAt} >= ${table.createdAt}) AND (${table.resolvedAt} IS NULL OR ${table.resolvedAt} >= ${table.createdAt})`
        ),
    })
);

// ============================================================================
// Investigation Playbooks Table
// ============================================================================

/**
 * Investigation Playbooks Table
 * Stores investigation playbooks with version control
 */
export const investigationPlaybooks = pgTable(
    'investigation_playbooks',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: varchar('name', { length: 255 }).notNull(),
        version: varchar('version', { length: 50 }).notNull(),
        status: playbookStatusEnum('status').notNull().default('draft'),

        // Content
        purpose: text('purpose').notNull(),
        initialValidationSteps: jsonb('initial_validation_steps')
            .notNull()
            .default('[]'),
        sourceInvestigationSteps: jsonb('source_investigation_steps')
            .notNull()
            .default('[]'),
        containmentChecks: jsonb('containment_checks').notNull().default('[]'),
        decisionGuidance: jsonb('decision_guidance').notNull(),

        // Metadata
        createdBy: uuid('created_by')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => ({
        // Performance indexes
        statusIdx: index('investigation_playbooks_status_idx').on(table.status),
        nameIdx: index('investigation_playbooks_name_idx').on(table.name),
        createdByIdx: index('investigation_playbooks_created_by_idx').on(
            table.createdBy
        ),
        createdAtIdx: index('investigation_playbooks_created_at_idx').on(
            sql`${table.createdAt} DESC`
        ),

        // Unique constraint for name + version
        nameVersionUnique: unique('investigation_playbooks_name_version_unique').on(
            table.name,
            table.version
        ),
    })
);

// ============================================================================
// Junction Tables
// ============================================================================

/**
 * Incident Alert Links Table
 * Junction table for incident-alert relationships with primary alert constraints
 */
export const incidentAlertLinks = pgTable(
    'incident_alert_links',
    {
        incidentId: uuid('incident_id')
            .notNull()
            .references(() => securityIncidents.id, { onDelete: 'cascade' }),
        alertId: uuid('alert_id')
            .notNull()
            .references(() => securityAlerts.id, { onDelete: 'cascade' }),
        isPrimary: boolean('is_primary').notNull().default(false),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => ({
        // Primary key
        primaryKey: { name: 'incident_alert_links_pkey', columns: [table.incidentId, table.alertId] },

        // Indexes
        incidentIdx: index('incident_alert_links_incident_idx').on(table.incidentId),
        alertIdx: index('incident_alert_links_alert_idx').on(table.alertId),
        primaryIdx: index('incident_alert_links_primary_idx').on(table.isPrimary),

        // Ensure only one primary alert per incident
        onePrimaryPerIncident: unique('incident_alert_links_one_primary_per_incident').on(
            table.incidentId
        ).where(sql`${table.isPrimary} = true`),
    })
);

/**
 * Playbook Classification Links Table
 * Junction table for playbook-classification relationships with denormalized status enforcement
 */
export const playbookClassificationLinks = pgTable(
    'playbook_classification_links',
    {
        playbookId: uuid('playbook_id')
            .notNull()
            .references(() => investigationPlaybooks.id, { onDelete: 'cascade' }),
        classification: varchar('classification', { length: 100 }).notNull(),
        isPrimary: boolean('is_primary').notNull().default(false),
        playbookStatus: playbookStatusEnum('playbook_status').notNull(), // Denormalized from investigation_playbooks.status
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => ({
        // Primary key
        primaryKey: { name: 'playbook_classification_links_pkey', columns: [table.playbookId, table.classification] },

        // Indexes
        playbookIdx: index('playbook_classification_links_playbook_idx').on(
            table.playbookId
        ),
        classificationIdx: index('playbook_classification_links_classification_idx').on(
            table.classification
        ),
        primaryIdx: index('playbook_classification_links_primary_idx').on(
            table.isPrimary
        ),
        statusIdx: index('playbook_classification_links_status_idx').on(
            table.playbookStatus
        ),

        // Ensure exactly one active primary playbook per classification
        oneActivePrimaryPerClassification: unique(
            'playbook_classification_links_one_active_primary_per_classification'
        ).on(table.classification).where(
            sql`${table.isPrimary} = true AND ${table.playbookStatus} = 'active'`
        ),
    })
);

// ============================================================================
// Relations
// ============================================================================

export const securityAlertsRelations = relations(securityAlerts, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [securityAlerts.tenantId],
        references: [tenants.id],
    }),
    assignedToUser: one(users, {
        fields: [securityAlerts.assignedTo],
        references: [users.id],
    }),
    incidentLinks: many(incidentAlertLinks),
}));

export const securityIncidentsRelations = relations(securityIncidents, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [securityIncidents.tenantId],
        references: [tenants.id],
    }),
    owner: one(users, {
        fields: [securityIncidents.ownerId],
        references: [users.id],
    }),
    alertLinks: many(incidentAlertLinks),
}));

export const investigationPlaybooksRelations = relations(
    investigationPlaybooks,
    ({ one, many }) => ({
        createdByUser: one(users, {
            fields: [investigationPlaybooks.createdBy],
            references: [users.id],
        }),
        classificationLinks: many(playbookClassificationLinks),
    })
);

export const incidentAlertLinksRelations = relations(incidentAlertLinks, ({ one }) => ({
    incident: one(securityIncidents, {
        fields: [incidentAlertLinks.incidentId],
        references: [securityIncidents.id],
    }),
    alert: one(securityAlerts, {
        fields: [incidentAlertLinks.alertId],
        references: [securityAlerts.id],
    }),
}));

export const playbookClassificationLinksRelations = relations(
    playbookClassificationLinks,
    ({ one }) => ({
        playbook: one(investigationPlaybooks, {
            fields: [playbookClassificationLinks.playbookId],
            references: [investigationPlaybooks.id],
        }),
    })
);