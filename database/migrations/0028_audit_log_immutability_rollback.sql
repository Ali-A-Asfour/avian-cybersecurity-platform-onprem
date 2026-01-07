-- Rollback Migration: Audit Log Immutability and Retention
-- Purpose: Remove immutability constraints and retention policy
-- Date: 2026-01-05

-- ============================================================================
-- PART 1: Remove Triggers
-- ============================================================================

DROP TRIGGER IF EXISTS prevent_auth_audit_log_modification ON auth_audit_logs;
DROP TRIGGER IF EXISTS prevent_audit_log_modification_trigger ON audit_logs;

-- ============================================================================
-- PART 2: Remove Functions
-- ============================================================================

DROP FUNCTION IF EXISTS prevent_audit_log_modification();
DROP FUNCTION IF EXISTS archive_old_audit_logs();

-- ============================================================================
-- PART 3: Remove Views
-- ============================================================================

DROP VIEW IF EXISTS recent_auth_audit_logs;
DROP VIEW IF EXISTS recent_audit_logs;

-- ============================================================================
-- PART 4: Remove Retention Policy Table
-- ============================================================================

DROP TABLE IF EXISTS audit_log_retention_policy;

-- ============================================================================
-- PART 5: Remove Additional Indexes
-- ============================================================================

DROP INDEX IF EXISTS auth_audit_logs_user_created_idx;
DROP INDEX IF EXISTS auth_audit_logs_action_created_idx;
DROP INDEX IF EXISTS audit_logs_tenant_created_idx;
DROP INDEX IF EXISTS audit_logs_resource_created_idx;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify triggers are removed
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers
WHERE event_object_table IN ('auth_audit_logs', 'audit_logs')
    AND trigger_name LIKE '%prevent%';

-- Should return no rows
