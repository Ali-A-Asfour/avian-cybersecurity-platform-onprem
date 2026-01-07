-- Rollback Migration 0027: Tenant Row-Level Security (RLS)
-- This script removes all RLS policies and disables RLS on tables

-- ============================================================================
-- DROP RLS POLICIES
-- ============================================================================

-- Users table policies
DROP POLICY IF EXISTS users_super_admin_all ON users;
DROP POLICY IF EXISTS users_tenant_isolation ON users;

-- Audit logs table policies
DROP POLICY IF EXISTS audit_logs_super_admin_all ON audit_logs;
DROP POLICY IF EXISTS audit_logs_tenant_isolation ON audit_logs;

-- Sessions table policies
DROP POLICY IF EXISTS sessions_super_admin_all ON sessions;
DROP POLICY IF EXISTS sessions_tenant_isolation ON sessions;

-- Password history table policies
DROP POLICY IF EXISTS password_history_super_admin_all ON password_history;
DROP POLICY IF EXISTS password_history_tenant_isolation ON password_history;

-- Auth audit logs table policies
DROP POLICY IF EXISTS auth_audit_logs_super_admin_all ON auth_audit_logs;
DROP POLICY IF EXISTS auth_audit_logs_tenant_isolation ON auth_audit_logs;

-- Email verification tokens table policies
DROP POLICY IF EXISTS email_verification_tokens_super_admin_all ON email_verification_tokens;
DROP POLICY IF EXISTS email_verification_tokens_tenant_isolation ON email_verification_tokens;

-- Password reset tokens table policies
DROP POLICY IF EXISTS password_reset_tokens_super_admin_all ON password_reset_tokens;
DROP POLICY IF EXISTS password_reset_tokens_tenant_isolation ON password_reset_tokens;

-- Tickets table policies
DROP POLICY IF EXISTS tickets_super_admin_all ON tickets;
DROP POLICY IF EXISTS tickets_tenant_isolation ON tickets;

-- Ticket comments table policies
DROP POLICY IF EXISTS ticket_comments_super_admin_all ON ticket_comments;
DROP POLICY IF EXISTS ticket_comments_tenant_isolation ON ticket_comments;

-- Ticket attachments table policies
DROP POLICY IF EXISTS ticket_attachments_super_admin_all ON ticket_attachments;
DROP POLICY IF EXISTS ticket_attachments_tenant_isolation ON ticket_attachments;

-- Alerts table policies
DROP POLICY IF EXISTS alerts_super_admin_all ON alerts;
DROP POLICY IF EXISTS alerts_tenant_isolation ON alerts;

-- Compliance frameworks table policies
DROP POLICY IF EXISTS compliance_frameworks_super_admin_all ON compliance_frameworks;
DROP POLICY IF EXISTS compliance_frameworks_tenant_isolation ON compliance_frameworks;

-- Compliance controls table policies
DROP POLICY IF EXISTS compliance_controls_super_admin_all ON compliance_controls;
DROP POLICY IF EXISTS compliance_controls_tenant_isolation ON compliance_controls;

-- Compliance evidence table policies
DROP POLICY IF EXISTS compliance_evidence_super_admin_all ON compliance_evidence;
DROP POLICY IF EXISTS compliance_evidence_tenant_isolation ON compliance_evidence;

-- Notifications table policies
DROP POLICY IF EXISTS notifications_super_admin_all ON notifications;
DROP POLICY IF EXISTS notifications_tenant_isolation ON notifications;

-- ============================================================================
-- DISABLE ROW-LEVEL SECURITY ON TABLES
-- ============================================================================

-- Core tenant-scoped tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE password_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens DISABLE ROW LEVEL SECURITY;

-- Ticket system tables
ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments DISABLE ROW LEVEL SECURITY;

-- Alert and compliance tables
ALTER TABLE alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_frameworks DISABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_controls DISABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_evidence DISABLE ROW LEVEL SECURITY;

-- Notification tables
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DROP HELPER FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS is_super_admin();
DROP FUNCTION IF EXISTS get_current_user_role();
DROP FUNCTION IF EXISTS get_current_tenant_id();

-- ============================================================================
-- DROP RLS PERFORMANCE INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_users_tenant_id_id;
DROP INDEX IF EXISTS idx_tickets_tenant_id_id;
DROP INDEX IF EXISTS idx_compliance_frameworks_tenant_id_id;

-- ============================================================================
-- REMOVE TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE users IS NULL;
COMMENT ON TABLE audit_logs IS NULL;
COMMENT ON TABLE tickets IS NULL;
COMMENT ON TABLE alerts IS NULL;
