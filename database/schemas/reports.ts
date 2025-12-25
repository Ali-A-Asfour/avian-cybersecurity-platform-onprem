/**
 * Reports Module Database Schema
 * 
 * Defines database tables for the AVIAN Reports Module including report snapshots,
 * audit trails, and role-based access control.
 * 
 * Requirements: 9.2, audit compliance
 */

import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    boolean,
    jsonb,
    index,
    integer,
    check,
    unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants, users } from './main';
import { sql } from 'drizzle-orm';

// ============================================================================
// Report Snapshots Table
// ============================================================================

/**
 * Report Snapshots Table
 * Stores immutable snapshots of generated reports for audit trails and re-delivery
 * Includes template and data schema versioning for reproducibility
 */
export const reportSnapshots = pgTable(
    'report_snapshots',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        tenantId: uuid('tenant_id')
            .notNull()
            .references(() => tenants.id, { onDelete: 'cascade' }),
        reportId: uuid('report_id').notNull(), // Reference to the original report generation
        reportType: varchar('report_type', { length: 20 }).notNull(), // weekly, monthly, quarterly

        // Date range information
        startDate: timestamp('start_date').notNull(),
        endDate: timestamp('end_date').notNull(),
        timezone: varchar('timezone', { length: 50 }).notNull(), // IANA timezone

        // Generation metadata
        generatedAt: timestamp('generated_at').notNull(),
        generatedBy: uuid('generated_by')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }), // Preserve audit trail

        // Snapshot data
        slideData: jsonb('slide_data').notNull(), // JSON payload of computed metrics
        templateVersion: varchar('template_version', { length: 50 }).notNull(),
        dataSchemaVersion: varchar('data_schema_version', { length: 50 }).notNull(),

        // PDF storage information
        pdfStorageKey: varchar('pdf_storage_key', { length: 500 }), // S3 key or file path
        pdfSize: integer('pdf_size'), // File size in bytes
        pdfChecksum: varchar('pdf_checksum', { length: 64 }), // SHA-256 checksum for integrity

        // Archive status
        isArchived: boolean('is_archived').notNull().default(false),
        archivedAt: timestamp('archived_at'),
        archivedBy: uuid('archived_by').references(() => users.id, { onDelete: 'set null' }),

        // Timestamps
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => ({
        // Indexes for efficient querying
        tenantIdx: index('idx_report_snapshots_tenant').on(
            table.tenantId,
            sql`${table.generatedAt} DESC`
        ),
        reportTypeIdx: index('idx_report_snapshots_type').on(
            table.reportType,
            table.tenantId
        ),
        generatedByIdx: index('idx_report_snapshots_generated_by').on(table.generatedBy),
        dateRangeIdx: index('idx_report_snapshots_date_range').on(
            table.startDate,
            table.endDate
        ),
        archivedIdx: index('idx_report_snapshots_archived').on(
            table.isArchived,
            table.archivedAt
        ),

        // Check constraints
        checkReportType: check(
            'check_report_type_valid',
            sql`${table.reportType} IN ('weekly', 'monthly', 'quarterly')`
        ),
        checkDateRange: check(
            'check_date_range_valid',
            sql`${table.startDate} <= ${table.endDate}`
        ),
        checkPdfSize: check(
            'check_pdf_size_positive',
            sql`${table.pdfSize} IS NULL OR ${table.pdfSize} > 0`
        ),
        checkArchiveConsistency: check(
            'check_archive_consistency',
            sql`(${table.isArchived} = false AND ${table.archivedAt} IS NULL AND ${table.archivedBy} IS NULL) OR (${table.isArchived} = true AND ${table.archivedAt} IS NOT NULL)`
        ),
    })
);

// ============================================================================
// Report Access Log Table
// ============================================================================

/**
 * Report Access Log Table
 * Tracks all access to report snapshots for audit compliance
 * Includes role-based access control validation
 */
export const reportAccessLogs = pgTable(
    'report_access_logs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        snapshotId: uuid('snapshot_id')
            .notNull()
            .references(() => reportSnapshots.id, { onDelete: 'cascade' }),
        tenantId: uuid('tenant_id')
            .notNull()
            .references(() => tenants.id, { onDelete: 'cascade' }),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }), // Preserve audit trail

        // Access details
        accessType: varchar('access_type', { length: 20 }).notNull(), // view, download, export
        userRole: varchar('user_role', { length: 50 }).notNull(), // Role at time of access
        ipAddress: varchar('ip_address', { length: 45 }), // IPv6 support
        userAgent: text('user_agent'),

        // Result
        accessGranted: boolean('access_granted').notNull(),
        denialReason: varchar('denial_reason', { length: 100 }), // If access denied

        // Timestamps
        accessedAt: timestamp('accessed_at').notNull().defaultNow(),
    },
    (table) => ({
        // Indexes for audit queries
        snapshotIdx: index('idx_report_access_snapshot').on(
            table.snapshotId,
            sql`${table.accessedAt} DESC`
        ),
        tenantIdx: index('idx_report_access_tenant').on(
            table.tenantId,
            sql`${table.accessedAt} DESC`
        ),
        userIdx: index('idx_report_access_user').on(
            table.userId,
            sql`${table.accessedAt} DESC`
        ),
        accessTypeIdx: index('idx_report_access_type').on(table.accessType),
        accessedAtIdx: index('idx_report_access_accessed_at').on(
            sql`${table.accessedAt} DESC`
        ),

        // Check constraints
        checkAccessType: check(
            'check_access_type_valid',
            sql`${table.accessType} IN ('view', 'download', 'export', 'list')`
        ),
        checkDenialReason: check(
            'check_denial_reason_consistency',
            sql`(${table.accessGranted} = true AND ${table.denialReason} IS NULL) OR (${table.accessGranted} = false AND ${table.denialReason} IS NOT NULL)`
        ),
    })
);

// ============================================================================
// Report Generation Queue Table
// ============================================================================

/**
 * Report Generation Queue Table
 * Tracks report generation requests and their status
 * Supports async report generation with status tracking
 */
export const reportGenerationQueue = pgTable(
    'report_generation_queue',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        tenantId: uuid('tenant_id')
            .notNull()
            .references(() => tenants.id, { onDelete: 'cascade' }),
        requestedBy: uuid('requested_by')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),

        // Request details
        reportType: varchar('report_type', { length: 20 }).notNull(),
        startDate: timestamp('start_date').notNull(),
        endDate: timestamp('end_date').notNull(),
        timezone: varchar('timezone', { length: 50 }).notNull(),

        // Processing status
        status: varchar('status', { length: 20 }).notNull().default('pending'),
        priority: integer('priority').notNull().default(5), // 1-10, lower is higher priority

        // Results
        snapshotId: uuid('snapshot_id').references(() => reportSnapshots.id, { onDelete: 'set null' }),
        errorMessage: text('error_message'),
        processingStartedAt: timestamp('processing_started_at'),
        processingCompletedAt: timestamp('processing_completed_at'),

        // Timestamps
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => ({
        // Indexes for queue processing
        statusIdx: index('idx_report_queue_status').on(
            table.status,
            table.priority,
            sql`${table.createdAt} ASC`
        ),
        tenantIdx: index('idx_report_queue_tenant').on(table.tenantId),
        requestedByIdx: index('idx_report_queue_requested_by').on(table.requestedBy),

        // Check constraints
        checkReportType: check(
            'check_queue_report_type_valid',
            sql`${table.reportType} IN ('weekly', 'monthly', 'quarterly')`
        ),
        checkStatus: check(
            'check_queue_status_valid',
            sql`${table.status} IN ('pending', 'processing', 'completed', 'failed', 'cancelled')`
        ),
        checkPriority: check(
            'check_priority_range',
            sql`${table.priority} >= 1 AND ${table.priority} <= 10`
        ),
        checkDateRange: check(
            'check_queue_date_range_valid',
            sql`${table.startDate} <= ${table.endDate}`
        ),
        checkCompletionConsistency: check(
            'check_completion_consistency',
            sql`(${table.status} = 'completed' AND ${table.snapshotId} IS NOT NULL AND ${table.processingCompletedAt} IS NOT NULL) OR (${table.status} != 'completed')`
        ),
        checkErrorConsistency: check(
            'check_error_consistency',
            sql`(${table.status} = 'failed' AND ${table.errorMessage} IS NOT NULL) OR (${table.status} != 'failed')`
        ),
    })
);

// ============================================================================
// Relations
// ============================================================================

export const reportSnapshotsRelations = relations(reportSnapshots, ({ one, many }) => ({
    tenant: one(tenants, {
        fields: [reportSnapshots.tenantId],
        references: [tenants.id],
    }),
    generatedByUser: one(users, {
        fields: [reportSnapshots.generatedBy],
        references: [users.id],
    }),
    archivedByUser: one(users, {
        fields: [reportSnapshots.archivedBy],
        references: [users.id],
    }),
    accessLogs: many(reportAccessLogs),
    queueEntries: many(reportGenerationQueue),
}));

export const reportAccessLogsRelations = relations(reportAccessLogs, ({ one }) => ({
    snapshot: one(reportSnapshots, {
        fields: [reportAccessLogs.snapshotId],
        references: [reportSnapshots.id],
    }),
    tenant: one(tenants, {
        fields: [reportAccessLogs.tenantId],
        references: [tenants.id],
    }),
    user: one(users, {
        fields: [reportAccessLogs.userId],
        references: [users.id],
    }),
}));

export const reportGenerationQueueRelations = relations(reportGenerationQueue, ({ one }) => ({
    tenant: one(tenants, {
        fields: [reportGenerationQueue.tenantId],
        references: [tenants.id],
    }),
    requestedByUser: one(users, {
        fields: [reportGenerationQueue.requestedBy],
        references: [users.id],
    }),
    snapshot: one(reportSnapshots, {
        fields: [reportGenerationQueue.snapshotId],
        references: [reportSnapshots.id],
    }),
}));