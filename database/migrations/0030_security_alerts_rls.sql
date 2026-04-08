-- Migration 0030: Row-Level Security for security_alerts table
-- The security_alerts table was created manually during deployment (outside the migration chain).
-- This migration adds RLS policies consistent with migration 0027.

ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

-- Super admin can access all security alerts
CREATE POLICY security_alerts_super_admin_all ON security_alerts
    FOR ALL
    TO PUBLIC
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Non-super_admin users can only access alerts in their tenant
CREATE POLICY security_alerts_tenant_isolation ON security_alerts
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

-- Index to support RLS policy performance
CREATE INDEX IF NOT EXISTS idx_security_alerts_tenant_id ON security_alerts(tenant_id);
