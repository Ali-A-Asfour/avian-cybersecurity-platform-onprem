/**
 * Database Schema for SLA Breach Tracking
 * 
 * Defines tables for tracking SLA breaches and alerts with:
 * - SLA breach records with tenant isolation
 * - SLA breach alerts and notifications
 * - Performance metrics and reporting data
 * 
 * Requirements: 10.1, 11.4, 11.5
 */

import { pgTable, text, timestamp, boolean, integer, decimal, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';

// ============================================================================
// SLA Breaches Table
// ============================================================================

export const slaBreaches = pgTable('sla_breaches', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    incidentId: text('incident_id').notNull(),
    breachType: text('breach_type').notNull(), // 'acknowledge', 'investigate', 'resolve'
    severity: text('severity').notNull(), // 'critical', 'high', 'medium', 'low'
    expectedBy: timestamp('expected_by', { withTimezone: true }).notNull(),
    actualTime: timestamp('actual_time', { withTimezone: true }), // null if still breached
    breachDurationMinutes: integer('breach_duration_minutes').notNull(),
    isResolved: boolean('is_resolved').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    metadata: jsonb('metadata').default({}),
}, (table) => ({
    // Tenant isolation index
    tenantIdIdx: index('sla_breaches_tenant_id_idx').on(table.tenantId),

    // Incident lookup index
    incidentIdIdx: index('sla_breaches_incident_id_idx').on(table.incidentId),

    // Breach type and severity filtering
    breachTypeIdx: index('sla_breaches_breach_type_idx').on(table.breachType),
    severityIdx: index('sla_breaches_severity_idx').on(table.severity),

    // Time-based queries
    createdAtIdx: index('sla_breaches_created_at_idx').on(table.createdAt),
    expectedByIdx: index('sla_breaches_expected_by_idx').on(table.expectedBy),

    // Resolution status
    isResolvedIdx: index('sla_breaches_is_resolved_idx').on(table.isResolved),

    // Composite indexes for common queries
    tenantIncidentIdx: index('sla_breaches_tenant_incident_idx').on(table.tenantId, table.incidentId),
    tenantBreachTypeIdx: index('sla_breaches_tenant_breach_type_idx').on(table.tenantId, table.breachType),
    tenantSeverityIdx: index('sla_breaches_tenant_severity_idx').on(table.tenantId, table.severity),

    // Unique constraint to prevent duplicate breach records
    uniqueBreachIdx: uniqueIndex('sla_breaches_unique_breach_idx').on(
        table.tenantId,
        table.incidentId,
        table.breachType,
        table.createdAt
    ),
}));

// ============================================================================
// SLA Breach Alerts Table
// ============================================================================

export const slaBreachAlerts = pgTable('sla_breach_alerts', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    incidentId: text('incident_id').notNull(),
    alertType: text('alert_type').notNull(), // 'approaching_deadline', 'breach_detected'
    breachType: text('breach_type').notNull(), // 'acknowledge', 'investigate', 'resolve'
    severity: text('severity').notNull(), // 'critical', 'high', 'medium', 'low'
    message: text('message').notNull(),
    minutesUntilDeadline: integer('minutes_until_deadline'), // for approaching alerts
    minutesSinceBreach: integer('minutes_since_breach'), // for breach alerts
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    acknowledged: boolean('acknowledged').notNull().default(false),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedBy: text('acknowledged_by'),
    metadata: jsonb('metadata').default({}),
}, (table) => ({
    // Tenant isolation index
    tenantIdIdx: index('sla_breach_alerts_tenant_id_idx').on(table.tenantId),

    // Incident lookup index
    incidentIdIdx: index('sla_breach_alerts_incident_id_idx').on(table.incidentId),

    // Alert type and breach type filtering
    alertTypeIdx: index('sla_breach_alerts_alert_type_idx').on(table.alertType),
    breachTypeIdx: index('sla_breach_alerts_breach_type_idx').on(table.breachType),

    // Severity filtering
    severityIdx: index('sla_breach_alerts_severity_idx').on(table.severity),

    // Acknowledgment status
    acknowledgedIdx: index('sla_breach_alerts_acknowledged_idx').on(table.acknowledged),

    // Time-based queries
    createdAtIdx: index('sla_breach_alerts_created_at_idx').on(table.createdAt),
    acknowledgedAtIdx: index('sla_breach_alerts_acknowledged_at_idx').on(table.acknowledgedAt),

    // Composite indexes for common queries
    tenantIncidentIdx: index('sla_breach_alerts_tenant_incident_idx').on(table.tenantId, table.incidentId),
    tenantAlertTypeIdx: index('sla_breach_alerts_tenant_alert_type_idx').on(table.tenantId, table.alertType),
    tenantAcknowledgedIdx: index('sla_breach_alerts_tenant_acknowledged_idx').on(table.tenantId, table.acknowledged),

    // User activity tracking
    acknowledgedByIdx: index('sla_breach_alerts_acknowledged_by_idx').on(table.acknowledgedBy),
}));

// ============================================================================
// SLA Performance Metrics Table (for caching/reporting)
// ============================================================================

export const slaPerformanceMetrics = pgTable('sla_performance_metrics', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    periodType: text('period_type').notNull(), // 'daily', 'weekly', 'monthly', 'quarterly'

    // Overall metrics
    totalIncidents: integer('total_incidents').notNull().default(0),
    overallComplianceRate: decimal('overall_compliance_rate', { precision: 5, scale: 2 }).notNull().default('0'),

    // Acknowledge SLA metrics
    acknowledgeTotal: integer('acknowledge_total').notNull().default(0),
    acknowledgeCompliant: integer('acknowledge_compliant').notNull().default(0),
    acknowledgeBreached: integer('acknowledge_breached').notNull().default(0),
    acknowledgeComplianceRate: decimal('acknowledge_compliance_rate', { precision: 5, scale: 2 }).notNull().default('0'),
    acknowledgeAvgTimeMinutes: decimal('acknowledge_avg_time_minutes', { precision: 10, scale: 2 }).notNull().default('0'),

    // Investigate SLA metrics
    investigateTotal: integer('investigate_total').notNull().default(0),
    investigateCompliant: integer('investigate_compliant').notNull().default(0),
    investigateBreached: integer('investigate_breached').notNull().default(0),
    investigateComplianceRate: decimal('investigate_compliance_rate', { precision: 5, scale: 2 }).notNull().default('0'),
    investigateAvgTimeMinutes: decimal('investigate_avg_time_minutes', { precision: 10, scale: 2 }).notNull().default('0'),

    // Resolve SLA metrics
    resolveTotal: integer('resolve_total').notNull().default(0),
    resolveCompliant: integer('resolve_compliant').notNull().default(0),
    resolveBreached: integer('resolve_breached').notNull().default(0),
    resolveComplianceRate: decimal('resolve_compliance_rate', { precision: 5, scale: 2 }).notNull().default('0'),
    resolveAvgTimeMinutes: decimal('resolve_avg_time_minutes', { precision: 10, scale: 2 }).notNull().default('0'),

    // Severity breakdown (JSON for flexibility)
    severityBreakdown: jsonb('severity_breakdown').notNull().default({}),

    // Metadata and timestamps
    calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').default({}),
}, (table) => ({
    // Tenant isolation index
    tenantIdIdx: index('sla_performance_metrics_tenant_id_idx').on(table.tenantId),

    // Period-based queries
    periodStartIdx: index('sla_performance_metrics_period_start_idx').on(table.periodStart),
    periodEndIdx: index('sla_performance_metrics_period_end_idx').on(table.periodEnd),
    periodTypeIdx: index('sla_performance_metrics_period_type_idx').on(table.periodType),

    // Time-based queries
    calculatedAtIdx: index('sla_performance_metrics_calculated_at_idx').on(table.calculatedAt),

    // Composite indexes for common queries
    tenantPeriodIdx: index('sla_performance_metrics_tenant_period_idx').on(table.tenantId, table.periodStart, table.periodEnd),
    tenantPeriodTypeIdx: index('sla_performance_metrics_tenant_period_type_idx').on(table.tenantId, table.periodType),

    // Unique constraint to prevent duplicate metrics for same period
    uniquePeriodIdx: uniqueIndex('sla_performance_metrics_unique_period_idx').on(
        table.tenantId,
        table.periodStart,
        table.periodEnd,
        table.periodType
    ),
}));

// ============================================================================
// SLA Monitoring Jobs Table (for tracking automated monitoring)
// ============================================================================

export const slaMonitoringJobs = pgTable('sla_monitoring_jobs', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    jobType: text('job_type').notNull(), // 'breach_monitoring', 'performance_calculation', 'alert_cleanup'
    status: text('status').notNull(), // 'running', 'completed', 'failed'
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // Job results
    incidentsProcessed: integer('incidents_processed').default(0),
    breachesDetected: integer('breaches_detected').default(0),
    alertsGenerated: integer('alerts_generated').default(0),

    // Error handling
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').notNull().default(0),
    maxRetries: integer('max_retries').notNull().default(3),

    // Metadata
    metadata: jsonb('metadata').default({}),
}, (table) => ({
    // Tenant isolation index
    tenantIdIdx: index('sla_monitoring_jobs_tenant_id_idx').on(table.tenantId),

    // Job type and status filtering
    jobTypeIdx: index('sla_monitoring_jobs_job_type_idx').on(table.jobType),
    statusIdx: index('sla_monitoring_jobs_status_idx').on(table.status),

    // Time-based queries
    startedAtIdx: index('sla_monitoring_jobs_started_at_idx').on(table.startedAt),
    completedAtIdx: index('sla_monitoring_jobs_completed_at_idx').on(table.completedAt),

    // Composite indexes for common queries
    tenantJobTypeIdx: index('sla_monitoring_jobs_tenant_job_type_idx').on(table.tenantId, table.jobType),
    tenantStatusIdx: index('sla_monitoring_jobs_tenant_status_idx').on(table.tenantId, table.status),

    // Retry tracking
    retryCountIdx: index('sla_monitoring_jobs_retry_count_idx').on(table.retryCount),
}));