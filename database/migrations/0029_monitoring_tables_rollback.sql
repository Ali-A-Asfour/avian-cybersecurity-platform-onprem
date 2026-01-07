-- Rollback Migration: Remove monitoring and metrics tables
-- Created: 2026-01-06
-- Description: Removes tables and functions created for monitoring

-- Drop functions
DROP FUNCTION IF EXISTS clean_old_errors();
DROP FUNCTION IF EXISTS clean_old_metrics();

-- Drop views
DROP VIEW IF EXISTS error_details;
DROP VIEW IF EXISTS recent_errors;
DROP VIEW IF EXISTS recent_metrics;

-- Drop indexes for error_tracking
DROP INDEX IF EXISTS idx_error_tracking_request_id;
DROP INDEX IF EXISTS idx_error_tracking_created_at;
DROP INDEX IF EXISTS idx_error_tracking_tenant_id;
DROP INDEX IF EXISTS idx_error_tracking_user_id;
DROP INDEX IF EXISTS idx_error_tracking_error_type;

-- Drop indexes for metrics
DROP INDEX IF EXISTS idx_metrics_tags;
DROP INDEX IF EXISTS idx_metrics_name_category;
DROP INDEX IF EXISTS idx_metrics_created_at;
DROP INDEX IF EXISTS idx_metrics_category;
DROP INDEX IF EXISTS idx_metrics_name;

-- Drop tables
DROP TABLE IF EXISTS error_tracking;
DROP TABLE IF EXISTS metrics;
