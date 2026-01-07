-- Migration 0027: Tenant Row-Level Security (RLS)
-- Implements database-level tenant isolation using PostgreSQL Row-Level Security
-- Validates Requirement 16.6: Database row-level security policies

-- ============================================================================
-- ENABLE ROW-LEVEL SECURITY ON TENANT-SCOPED TABLES
-- ============================================================================

-- Core tenant-scoped tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Ticket system tables
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Alert and compliance tables
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_evidence ENABLE ROW LEVEL SECURITY;

-- Notification tables
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE HELPER FUNCTIONS FOR RLS POLICIES
-- ============================================================================

-- Function to get current user's tenant_id from session variable
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $
BEGIN
    -- Return tenant_id from session variable set by application
    -- If not set, return NULL (will deny access)
    RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$ LANGUAGE plpgsql STABLE;

-- Function to get current user's role from session variable
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $
BEGIN
    -- Return role from session variable set by application
    -- If not set, return 'user' (most restrictive)
    RETURN COALESCE(current_setting('app.current_user_role', true), 'user');
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'user';
END;
$ LANGUAGE plpgsql STABLE;

-- Function to check if current user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $
BEGIN
    RETURN get_current_user_role() = 'super_admin';
END;
$ LANGUAGE plpgsql STABLE;

-- Add comments for documentation
COMMENT ON FUNCTION get_current_tenant_id IS 'Returns current user tenant_id from session variable app.current_tenant_id';
COMMENT ON FUNCTION get_current_user_role IS 'Returns current user role from session variable app.current_user_role';
COMMENT ON FUNCTION is_super_admin IS 'Returns true if current user has super_admin role';

-- ============================================================================
-- CREATE RLS POLICIES FOR USERS TABLE
-- ============================================================================

-- Policy: super_admin can access all users
CREATE POLICY users_super_admin_all ON users
    FOR ALL
    TO PUBLIC
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Policy: non-super_admin users can only access users in their tenant
CREATE POLICY users_tenant_isolation ON users
    FOR ALL
    TO PUBLIC
    USING (
        NOT is_super_admin() 
        AND tenant_id = get_current_tenant_id()
    )
    WITH CHECK (
        NOT is_super_admin() 
        AND tenant_id = get_current_tenant_id()
    );

-- ============================================================================
-- CREATE RLS POLICIES FOR AUDIT_LOGS TABLE
-- ============================================================================

-- Policy: super_admin can access all audit logs
CREATE POLICY audit_logs_super_admin_all ON audit_logs
    FOR ALL
    TO PUBLIC
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Policy: non-super_admin users can only access audit logs in their tenant
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
    FOR ALL
    TO PUBLIC
    USING (
        NOT is_super_admin() 
        AND tenant_id = get_current_tenant_id()
    )
    WITH CHECK (
        NOT is_super_admin() 
        AND tenant_id = get_current_tenant_id()
    );

-- ============================================================================
-- CREATE RLS POLICIES FOR SESSIONS TABLE
-- ============================================================================

-- Sessions are linked to users, so we need to join to users table for tenant_id
-- Policy: super_admin can access all sessions
CREATE POLICY sessions_super_admin_all ON sessions
    FOR ALL
    TO PUBLIC
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Policy: non-super_admin users can only access sessions for users in their tenant
CREATE POLICY sessions_tenant_isolation ON sessions
    FOR ALL
    TO PUBLIC
    USING (
        NOT is_super_admin() 
        AND user_id IN (
            SELECT id FROM users WHERE tenant_id = get_current_tenant_id()
        )
    )
    WITH CHECK (
        NOT is_super_admin() 
        AND user_id IN (
            SELECT id FROM users WHERE tenant_id = get_current_tenant_id()
        )
    );

-- ============================================================================
-- CREATE RLS POLICIES FOR PASSWORD_HISTORY TABLE
-- ============================================================================

-- Policy: super_admin can access all password history
CREATE POLICY password_history_super_admin_all ON password_history
    FOR ALL
    TO PUBLIC
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Policy: non-super_admin users can only access password history for users in their tenant
CREATE POLICY password_history_tenant_isolation ON password_history
    FOR ALL
    TO PUBLIC
    USING (
        NOT is_super_admin() 
        AND user_id IN (
            SELECT id FROM users WHERE tenant_id = get_current_tenant_id()
        )
    )
    WITH CHECK (
        NOT is_super_admin() 
        AND user_id IN (
            SELECT id FROM users WHERE tenant_id = get_current_tenant_id()
        )
    );

-- ============================================================================
-- CREATE RLS POLICIES FOR AUTH_AUDIT_LOGS TABLE
-- ============================================================================

-- Policy: super_admin can access all auth audit logs
CREATE POLICY auth_audit_logs_super_admin_all ON auth_audit_logs
    FOR ALL
    TO PUBLIC
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Policy: non-super_admin users can only access auth audit logs for users in their tenant
-- Note: auth_audit_logs doesn't have tenant_id, so we join through users table
CREATE POLICY auth_audit_logs_tenant_isolation ON auth_audit_logs
    FOR ALL
    TO PUBLIC
    USING (
        NOT is_super_admin() 
        AND (
            user_id IS NULL 
            OR user_id IN (
                SELECT id FROM users WHERE tenant_id = get_current_tenant_id()
            )
        )
    )
    WITH CHECK (
        NOT is_super_admin() 
        AND (
            user_id IS NULL 
            OR user_id IN (
                SELECT id FROM users WHERE tenant_id = get_current_tenant_id()
            )
        )
    );

-- ============================================================================
-- CREATE RLS POLICIES FOR EMAIL_VERIFICATION_TOKENS TABLE
-- ============================================================================

-- Policy: super_admin can access all email verification tokens
CREATE POLICY email_verification_tokens_super_admin_all ON email_verification_tokens
    FOR ALL
    TO PUBLIC
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Policy: non-super_admin users can only access tokens for users in their tenant
CREATE POLICY email_verification_tokens_tenant_isolation ON email_verification_tokens
    FOR ALL
    TO PUBLIC
    USING (
        NOT is_super_admin() 
        AND user_id IN (
            SELECT id FROM users WHERE tenant_id = get_current_tenant_id()
        )
    )
    WITH CHECK (
        NOT is_super_admin() 
        AND user_id IN (
            SELECT id FROM users WHERE tenant_id = get_current_tenant_id()
        )
    );

-- ============================================================================
-- CREATE RLS POLICIES FOR PASSWORD_RESET_TOKENS TABLE
-- ============================================================================

-- Policy: super_admin can access all password reset tokens
CREATE POLICY password_reset_tokens_super_admin_all ON password_reset_tokens
    FOR ALL
    TO PUBLIC
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Policy: non-super_admin users can only access tokens for users in their tenant
CREATE POLICY password_reset_tokens_tenant_isolation ON password_reset_tokens
    FOR ALL
    TO PUBLIC
    USING (
        NOT is_super_admin() 
        AND user_id IN (
            SELECT id FROM users WHERE tenant_id = get_current_tenant_id()
        )
    )
    WITH CHECK (
        NOT is_super_admin() 
        AND user_id IN (
            SELECT id FROM users WHERE tenant_id = get_current_tenant_id()
        )
    );

-- ============================================================================
-- CREATE RLS POLICIES FOR TICKETS TABLE
-- ============================================================================

-- Policy: super_admin can access all tickets
CREATE POLICY tickets_super_admin_all ON tickets
    FOR ALL
    TO PUBLIC
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Policy: non-super_admin users can only access tickets in their tenant
CREATE POLICY tickets_tenant_isolation ON tickets
    FOR ALL
    TO PUBLIC
    USING (
        NOT is_super_admin() 
        AND tenant_id = get_current_tenant_id()
    )
    WITH CHECK (
        NOT is_super_admin() 
        AND tenant_id = get_current_tenant_id()
    );

-- ============================================================================
-- CREATE RLS POLICIES FOR TICKET_COMMENTS TABLE
-- ============================================================================

-- Policy: super_admin can access all ticket comments
CREATE POLICY ticket_comments_super_admin_all ON ticket_comments
    FOR ALL
    TO PUBLIC
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Policy: non-super_admin users can only access comments for tickets in their tenant
CREATE POLICY ticket_comments_tenant_isolation ON ticket_comments
    FOR ALL
    TO PUBLIC
    USING (
        NOT is_super_admin() 
        AND ticket_id IN (
            SELECT id FROM tickets WHERE tenant_id = get_current_tenant_id()
        )
    )
    WITH CHECK (
        NOT is_super_admin() 
        AND ticket_id IN (
            SELECT id FROM tickets WHERE tenant_id = get_current_tenant_id()
        )
    );

-- ============================================================================
-- CREATE RLS POLICIES FOR TICKET_ATTACHMENTS TABLE
-- ============================================================================

-- Policy: super_admin can access all ticket attachments
CREATE POLICY ticket_attachments_super_admin_all ON ticket_attachments
    FOR ALL
    TO PUBLIC
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Policy: non-super_admin users can only access attachments for tickets in their tenant
CREATE POLICY ticket_attachments_tenant_isolation ON ticket_attachments
    FOR ALL
    TO PUBLIC
    USING (
        NOT is_super_admin() 
        AND ticket_id IN (
            SELECT id FROM tickets WHERE tenant_id = get_current_tenant_id()
        )
    )
    WITH CHECK (
        NOT is_super_admin() 
        AND ticket_id IN (
            SELECT id FROM tickets WHERE tenant_id = get_current_tenant_id()
        )
    );

-- ============================================================================
-- CREATE RLS POLICIES FOR ALERTS TABLE
-- ============================================================================

-- Policy: super_admin can access all alerts
CREATE POLICY alerts_super_admin_all ON alerts
    FOR ALL
    TO PUBLIC
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Policy: non-super_admin users can only access alerts in their tenant
CREATE POLICY alerts_tenant_isolation ON alerts
    FOR ALL
    TO PUBLIC
    USING (
        NOT is_super_admin() 
        AND tenant_id = get_current_tenant_id()
    )
    WITH CHECK (
        NOT is_super_admin() 
        AND tenant_id = get_current_tenant_id()
    );

-- ============================================================================
-- CREATE RLS POLICIES FOR COMPLIANCE_FRAMEWORKS TABLE
-- ============================================================================

-- Policy: super_admin can access all compliance frameworks
CREATE POLICY compliance_frameworks_super_admin_all ON compliance_frameworks
    FOR ALL
    TO PUBLIC
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Policy: non-super_admin users can only access frameworks in their tenant
CREATE POLICY compliance_frameworks_tenant_isolation ON compliance_frameworks
    FOR ALL
    TO PUBLIC
    USING (
        NOT is_super_admin() 
        AND tenant_id = get_current_tenant_id()
    )
    WITH CHECK (
        NOT is_super_admin() 
        AND tenant_id = get_current_tenant_id()
    );

-- ============================================================================
-- CREATE RLS POLICIES FOR COMPLIANCE_CONTROLS TABLE
-- ============================================================================

-- Policy: super_admin can access all compliance controls
CREATE POLICY compliance_controls_super_admin_all ON compliance_controls
    FOR ALL
    TO PUBLIC
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Policy: non-super_admin users can only access controls for frameworks in their tenant
CREATE POLICY compliance_controls_tenant_isolation ON compliance_controls
    FOR ALL
    TO PUBLIC
    USING (
        NOT is_super_admin() 
        AND framework_id IN (
            SELECT id FROM compliance_frameworks WHERE tenant_id = get_current_tenant_id()
        )
    )
    WITH CHECK (
        NOT is_super_admin() 
        AND framework_id IN (
            SELECT id FROM compliance_frameworks WHERE tenant_id = get_current_tenant_id()
        )
    );

-- ============================================================================
-- CREATE RLS POLICIES FOR COMPLIANCE_EVIDENCE TABLE
-- ============================================================================

-- Policy: super_admin can access all compliance evidence
CREATE POLICY compliance_evidence_super_admin_all ON compliance_evidence
    FOR ALL
    TO PUBLIC
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Policy: non-super_admin users can only access evidence for controls in their tenant
CREATE POLICY compliance_evidence_tenant_isolation ON compliance_evidence
    FOR ALL
    TO PUBLIC
    USING (
        NOT is_super_admin() 
        AND control_id IN (
            SELECT cc.id 
            FROM compliance_controls cc
            JOIN compliance_frameworks cf ON cc.framework_id = cf.id
            WHERE cf.tenant_id = get_current_tenant_id()
        )
    )
    WITH CHECK (
        NOT is_super_admin() 
        AND control_id IN (
            SELECT cc.id 
            FROM compliance_controls cc
            JOIN compliance_frameworks cf ON cc.framework_id = cf.id
            WHERE cf.tenant_id = get_current_tenant_id()
        )
    );

-- ============================================================================
-- CREATE RLS POLICIES FOR NOTIFICATIONS TABLE
-- ============================================================================

-- Policy: super_admin can access all notifications
CREATE POLICY notifications_super_admin_all ON notifications
    FOR ALL
    TO PUBLIC
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Policy: non-super_admin users can only access notifications in their tenant
CREATE POLICY notifications_tenant_isolation ON notifications
    FOR ALL
    TO PUBLIC
    USING (
        NOT is_super_admin() 
        AND tenant_id = get_current_tenant_id()
    )
    WITH CHECK (
        NOT is_super_admin() 
        AND tenant_id = get_current_tenant_id()
    );

-- ============================================================================
-- CREATE INDEXES FOR RLS PERFORMANCE
-- ============================================================================

-- These indexes improve RLS policy performance by optimizing the subquery lookups
CREATE INDEX IF NOT EXISTS idx_users_tenant_id_id ON users(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_id_id ON tickets(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_compliance_frameworks_tenant_id_id ON compliance_frameworks(tenant_id, id);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on helper functions to all users
GRANT EXECUTE ON FUNCTION get_current_tenant_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_current_user_role() TO PUBLIC;
GRANT EXECUTE ON FUNCTION is_super_admin() TO PUBLIC;

-- ============================================================================
-- DOCUMENTATION AND USAGE
-- ============================================================================

-- To use RLS policies, the application must set session variables before queries:
-- 
-- Example usage in application code:
-- 
-- // Set session variables for the current request
-- await db.execute(sql`SET LOCAL app.current_tenant_id = ${user.tenantId}`);
-- await db.execute(sql`SET LOCAL app.current_user_role = ${user.role}`);
-- 
-- // Now all queries will be automatically filtered by RLS policies
-- const users = await db.select().from(usersTable);
-- 
-- // For super_admin, all rows are returned
-- // For other roles, only rows matching their tenant_id are returned
--
-- Note: Session variables are automatically cleared at the end of each transaction

COMMENT ON TABLE users IS 'RLS enabled: Enforces tenant isolation. Set app.current_tenant_id and app.current_user_role session variables.';
COMMENT ON TABLE audit_logs IS 'RLS enabled: Enforces tenant isolation. Set app.current_tenant_id and app.current_user_role session variables.';
COMMENT ON TABLE tickets IS 'RLS enabled: Enforces tenant isolation. Set app.current_tenant_id and app.current_user_role session variables.';
COMMENT ON TABLE alerts IS 'RLS enabled: Enforces tenant isolation. Set app.current_tenant_id and app.current_user_role session variables.';
