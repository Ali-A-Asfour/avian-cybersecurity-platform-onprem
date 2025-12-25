-- Migration: SLA Breach Tracking Tables
-- Requirements: 10.1, 11.4, 11.5
-- Description: Create tables for SLA breach tracking, alerting, and performance metrics

-- ============================================================================
-- SLA Breaches Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "sla_breaches" (
    "id" text PRIMARY KEY NOT NULL,
    "tenant_id" text NOT NULL,
    "incident_id" text NOT NULL,
    "breach_type" text NOT NULL, -- 'acknowledge', 'investigate', 'resolve'
    "severity" text NOT NULL, -- 'critical', 'high', 'medium', 'low'
    "expected_by" timestamp with time zone NOT NULL,
    "actual_time" timestamp with time zone, -- null if still breached
    "breach_duration_minutes" integer NOT NULL,
    "is_resolved" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "resolved_at" timestamp with time zone,
    "metadata" jsonb DEFAULT '{}'::jsonb
);

-- ============================================================================
-- SLA Breach Alerts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "sla_breach_alerts" (
    "id" text PRIMARY KEY NOT NULL,
    "tenant_id" text NOT NULL,
    "incident_id" text NOT NULL,
    "alert_type" text NOT NULL, -- 'approaching_deadline', 'breach_detected'
    "breach_type" text NOT NULL, -- 'acknowledge', 'investigate', 'resolve'
    "severity" text NOT NULL, -- 'critical', 'high', 'medium', 'low'
    "message" text NOT NULL,
    "minutes_until_deadline" integer, -- for approaching alerts
    "minutes_since_breach" integer, -- for breach alerts
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "acknowledged" boolean DEFAULT false NOT NULL,
    "acknowledged_at" timestamp with time zone,
    "acknowledged_by" text,
    "metadata" jsonb DEFAULT '{}'::jsonb
);

-- ============================================================================
-- SLA Performance Metrics Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "sla_performance_metrics" (
    "id" text PRIMARY KEY NOT NULL,
    "tenant_id" text NOT NULL,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "period_type" text NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly'
    "total_incidents" integer DEFAULT 0 NOT NULL,
    "overall_compliance_rate" numeric(5,2) DEFAULT 0 NOT NULL,
    "acknowledge_total" integer DEFAULT 0 NOT NULL,
    "acknowledge_compliant" integer DEFAULT 0 NOT NULL,
    "acknowledge_breached" integer DEFAULT 0 NOT NULL,
    "acknowledge_compliance_rate" numeric(5,2) DEFAULT 0 NOT NULL,
    "acknowledge_avg_time_minutes" numeric(10,2) DEFAULT 0 NOT NULL,
    "investigate_total" integer DEFAULT 0 NOT NULL,
    "investigate_compliant" integer DEFAULT 0 NOT NULL,
    "investigate_breached" integer DEFAULT 0 NOT NULL,
    "investigate_compliance_rate" numeric(5,2) DEFAULT 0 NOT NULL,
    "investigate_avg_time_minutes" numeric(10,2) DEFAULT 0 NOT NULL,
    "resolve_total" integer DEFAULT 0 NOT NULL,
    "resolve_compliant" integer DEFAULT 0 NOT NULL,
    "resolve_breached" integer DEFAULT 0 NOT NULL,
    "resolve_compliance_rate" numeric(5,2) DEFAULT 0 NOT NULL,
    "resolve_avg_time_minutes" numeric(10,2) DEFAULT 0 NOT NULL,
    "severity_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb
);

-- ============================================================================
-- SLA Monitoring Jobs Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "sla_monitoring_jobs" (
    "id" text PRIMARY KEY NOT NULL,
    "tenant_id" text NOT NULL,
    "job_type" text NOT NULL, -- 'breach_monitoring', 'performance_calculation', 'alert_cleanup'
    "status" text NOT NULL, -- 'running', 'completed', 'failed'
    "started_at" timestamp with time zone DEFAULT now() NOT NULL,
    "completed_at" timestamp with time zone,
    "incidents_processed" integer DEFAULT 0,
    "breaches_detected" integer DEFAULT 0,
    "alerts_generated" integer DEFAULT 0,
    "error_message" text,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "max_retries" integer DEFAULT 3 NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb
);
-- ============================================================================
-- Indexes for SLA Breaches Table
-- ============================================================================

-- Tenant isolation index
CREATE INDEX IF NOT EXISTS "sla_breaches_tenant_id_idx" ON "sla_breaches" ("tenant_id");

-- Incident lookup index
CREATE INDEX IF NOT EXISTS "sla_breaches_incident_id_idx" ON "sla_breaches" ("incident_id");

-- Breach type and severity filtering
CREATE INDEX IF NOT EXISTS "sla_breaches_breach_type_idx" ON "sla_breaches" ("breach_type");
CREATE INDEX IF NOT EXISTS "sla_breaches_severity_idx" ON "sla_breaches" ("severity");

-- Time-based queries
CREATE INDEX IF NOT EXISTS "sla_breaches_created_at_idx" ON "sla_breaches" ("created_at");
CREATE INDEX IF NOT EXISTS "sla_breaches_expected_by_idx" ON "sla_breaches" ("expected_by");

-- Resolution status
CREATE INDEX IF NOT EXISTS "sla_breaches_is_resolved_idx" ON "sla_breaches" ("is_resolved");

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS "sla_breaches_tenant_incident_idx" ON "sla_breaches" ("tenant_id", "incident_id");
CREATE INDEX IF NOT EXISTS "sla_breaches_tenant_breach_type_idx" ON "sla_breaches" ("tenant_id", "breach_type");
CREATE INDEX IF NOT EXISTS "sla_breaches_tenant_severity_idx" ON "sla_breaches" ("tenant_id", "severity");

-- Unique constraint to prevent duplicate breach records
CREATE UNIQUE INDEX IF NOT EXISTS "sla_breaches_unique_breach_idx" ON "sla_breaches" ("tenant_id", "incident_id", "breach_type", "created_at");

-- ============================================================================
-- Indexes for SLA Breach Alerts Table
-- ============================================================================

-- Tenant isolation index
CREATE INDEX IF NOT EXISTS "sla_breach_alerts_tenant_id_idx" ON "sla_breach_alerts" ("tenant_id");

-- Incident lookup index
CREATE INDEX IF NOT EXISTS "sla_breach_alerts_incident_id_idx" ON "sla_breach_alerts" ("incident_id");

-- Alert type and breach type filtering
CREATE INDEX IF NOT EXISTS "sla_breach_alerts_alert_type_idx" ON "sla_breach_alerts" ("alert_type");
CREATE INDEX IF NOT EXISTS "sla_breach_alerts_breach_type_idx" ON "sla_breach_alerts" ("breach_type");

-- Severity filtering
CREATE INDEX IF NOT EXISTS "sla_breach_alerts_severity_idx" ON "sla_breach_alerts" ("severity");

-- Acknowledgment status
CREATE INDEX IF NOT EXISTS "sla_breach_alerts_acknowledged_idx" ON "sla_breach_alerts" ("acknowledged");

-- Time-based queries
CREATE INDEX IF NOT EXISTS "sla_breach_alerts_created_at_idx" ON "sla_breach_alerts" ("created_at");
CREATE INDEX IF NOT EXISTS "sla_breach_alerts_acknowledged_at_idx" ON "sla_breach_alerts" ("acknowledged_at");

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS "sla_breach_alerts_tenant_incident_idx" ON "sla_breach_alerts" ("tenant_id", "incident_id");
CREATE INDEX IF NOT EXISTS "sla_breach_alerts_tenant_alert_type_idx" ON "sla_breach_alerts" ("tenant_id", "alert_type");
CREATE INDEX IF NOT EXISTS "sla_breach_alerts_tenant_acknowledged_idx" ON "sla_breach_alerts" ("tenant_id", "acknowledged");

-- User activity tracking
CREATE INDEX IF NOT EXISTS "sla_breach_alerts_acknowledged_by_idx" ON "sla_breach_alerts" ("acknowledged_by");

-- ============================================================================
-- Indexes for SLA Performance Metrics Table
-- ============================================================================

-- Tenant isolation index
CREATE INDEX IF NOT EXISTS "sla_performance_metrics_tenant_id_idx" ON "sla_performance_metrics" ("tenant_id");

-- Period-based queries
CREATE INDEX IF NOT EXISTS "sla_performance_metrics_period_start_idx" ON "sla_performance_metrics" ("period_start");
CREATE INDEX IF NOT EXISTS "sla_performance_metrics_period_end_idx" ON "sla_performance_metrics" ("period_end");
CREATE INDEX IF NOT EXISTS "sla_performance_metrics_period_type_idx" ON "sla_performance_metrics" ("period_type");

-- Time-based queries
CREATE INDEX IF NOT EXISTS "sla_performance_metrics_calculated_at_idx" ON "sla_performance_metrics" ("calculated_at");

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS "sla_performance_metrics_tenant_period_idx" ON "sla_performance_metrics" ("tenant_id", "period_start", "period_end");
CREATE INDEX IF NOT EXISTS "sla_performance_metrics_tenant_period_type_idx" ON "sla_performance_metrics" ("tenant_id", "period_type");

-- Unique constraint to prevent duplicate metrics for same period
CREATE UNIQUE INDEX IF NOT EXISTS "sla_performance_metrics_unique_period_idx" ON "sla_performance_metrics" ("tenant_id", "period_start", "period_end", "period_type");

-- ============================================================================
-- Indexes for SLA Monitoring Jobs Table
-- ============================================================================

-- Tenant isolation index
CREATE INDEX IF NOT EXISTS "sla_monitoring_jobs_tenant_id_idx" ON "sla_monitoring_jobs" ("tenant_id");

-- Job type and status filtering
CREATE INDEX IF NOT EXISTS "sla_monitoring_jobs_job_type_idx" ON "sla_monitoring_jobs" ("job_type");
CREATE INDEX IF NOT EXISTS "sla_monitoring_jobs_status_idx" ON "sla_monitoring_jobs" ("status");

-- Time-based queries
CREATE INDEX IF NOT EXISTS "sla_monitoring_jobs_started_at_idx" ON "sla_monitoring_jobs" ("started_at");
CREATE INDEX IF NOT EXISTS "sla_monitoring_jobs_completed_at_idx" ON "sla_monitoring_jobs" ("completed_at");

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS "sla_monitoring_jobs_tenant_job_type_idx" ON "sla_monitoring_jobs" ("tenant_id", "job_type");
CREATE INDEX IF NOT EXISTS "sla_monitoring_jobs_tenant_status_idx" ON "sla_monitoring_jobs" ("tenant_id", "status");

-- Retry tracking
CREATE INDEX IF NOT EXISTS "sla_monitoring_jobs_retry_count_idx" ON "sla_monitoring_jobs" ("retry_count");

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE "sla_breaches" IS 'Records SLA breaches for security incidents with tenant isolation';
COMMENT ON TABLE "sla_breach_alerts" IS 'Stores SLA breach alerts and approaching deadline notifications';
COMMENT ON TABLE "sla_performance_metrics" IS 'Cached SLA performance metrics for reporting and dashboards';
COMMENT ON TABLE "sla_monitoring_jobs" IS 'Tracks automated SLA monitoring job execution and results';

COMMENT ON COLUMN "sla_breaches"."breach_type" IS 'Type of SLA breach: acknowledge, investigate, or resolve';
COMMENT ON COLUMN "sla_breaches"."breach_duration_minutes" IS 'Duration of breach in minutes from expected deadline';
COMMENT ON COLUMN "sla_breach_alerts"."alert_type" IS 'Type of alert: approaching_deadline or breach_detected';
COMMENT ON COLUMN "sla_performance_metrics"."period_type" IS 'Reporting period: daily, weekly, monthly, or quarterly';
COMMENT ON COLUMN "sla_monitoring_jobs"."job_type" IS 'Type of monitoring job: breach_monitoring, performance_calculation, or alert_cleanup';