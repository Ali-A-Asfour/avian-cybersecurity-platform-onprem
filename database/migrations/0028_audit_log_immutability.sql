-- Migration: Audit Log Immutability and Retention
-- Purpose: Implement immutability for audit logs and set up retention policy
-- Requirements: 9.7, 9.8
-- Date: 2026-01-05

-- ============================================================================
-- PART 1: Audit Log Immutability
-- ============================================================================

-- Create function to prevent audit log modifications
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent UPDATE operations
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Audit logs are immutable and cannot be modified';
    END IF;
    
    -- Prevent DELETE operations
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Audit logs are immutable and cannot be deleted';
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply immutability trigger to auth_audit_logs
DROP TRIGGER IF EXISTS prevent_auth_audit_log_modification ON auth_audit_logs;
CREATE TRIGGER prevent_auth_audit_log_modification
    BEFORE UPDATE OR DELETE ON auth_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

-- Apply immutability trigger to audit_logs
DROP TRIGGER IF EXISTS prevent_audit_log_modification_trigger ON audit_logs;
CREATE TRIGGER prevent_audit_log_modification_trigger
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

-- ============================================================================
-- PART 2: Audit Log Retention Policy
-- ============================================================================

-- Create table to track retention policy settings
CREATE TABLE IF NOT EXISTS audit_log_retention_policy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL UNIQUE,
    retention_days INTEGER NOT NULL DEFAULT 365, -- 1 year minimum
    last_cleanup_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert default retention policies
INSERT INTO audit_log_retention_policy (table_name, retention_days)
VALUES 
    ('auth_audit_logs', 365),
    ('audit_logs', 365)
ON CONFLICT (table_name) DO NOTHING;

-- Create function to archive old audit logs (soft delete approach)
-- Note: We don't actually delete, we just mark for archival
-- This maintains immutability while allowing retention management
CREATE OR REPLACE FUNCTION archive_old_audit_logs()
RETURNS TABLE (
    table_name VARCHAR,
    archived_count BIGINT,
    cutoff_date TIMESTAMP
) AS $$
DECLARE
    policy RECORD;
    cutoff TIMESTAMP;
    count BIGINT;
BEGIN
    -- Process each retention policy
    FOR policy IN SELECT * FROM audit_log_retention_policy LOOP
        -- Calculate cutoff date
        cutoff := NOW() - (policy.retention_days || ' days')::INTERVAL;
        
        -- For now, we just count what would be archived
        -- In production, you might move to an archive table
        IF policy.table_name = 'auth_audit_logs' THEN
            SELECT COUNT(*) INTO count
            FROM auth_audit_logs
            WHERE created_at < cutoff;
        ELSIF policy.table_name = 'audit_logs' THEN
            SELECT COUNT(*) INTO count
            FROM audit_logs
            WHERE created_at < cutoff;
        END IF;
        
        -- Update last cleanup timestamp
        UPDATE audit_log_retention_policy
        SET last_cleanup_at = NOW(),
            updated_at = NOW()
        WHERE id = policy.id;
        
        -- Return results
        table_name := policy.table_name;
        archived_count := count;
        cutoff_date := cutoff;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 3: Audit Log Query Views
-- ============================================================================

-- Create view for recent authentication events (last 30 days)
CREATE OR REPLACE VIEW recent_auth_audit_logs AS
SELECT 
    aal.id,
    aal.user_id,
    aal.email,
    aal.action,
    aal.result,
    aal.ip_address,
    aal.user_agent,
    aal.metadata,
    aal.created_at,
    u.first_name,
    u.last_name,
    u.role,
    t.name as tenant_name
FROM auth_audit_logs aal
LEFT JOIN users u ON aal.user_id = u.id
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE aal.created_at >= NOW() - INTERVAL '30 days'
ORDER BY aal.created_at DESC;

-- Create view for recent general audit logs (last 30 days)
CREATE OR REPLACE VIEW recent_audit_logs AS
SELECT 
    al.id,
    al.tenant_id,
    al.user_id,
    al.action,
    al.resource_type,
    al.resource_id,
    al.details,
    al.ip_address,
    al.user_agent,
    al.created_at,
    u.email,
    u.first_name,
    u.last_name,
    u.role,
    t.name as tenant_name
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
LEFT JOIN tenants t ON al.tenant_id = t.id
WHERE al.created_at >= NOW() - INTERVAL '30 days'
ORDER BY al.created_at DESC;

-- ============================================================================
-- PART 4: Indexes for Query Performance
-- ============================================================================

-- Additional indexes for common query patterns
CREATE INDEX IF NOT EXISTS auth_audit_logs_user_created_idx 
    ON auth_audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS auth_audit_logs_action_created_idx 
    ON auth_audit_logs(action, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_idx 
    ON audit_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_resource_created_idx 
    ON audit_logs(resource_type, resource_id, created_at DESC);

-- ============================================================================
-- PART 5: Grant Permissions
-- ============================================================================

-- Grant SELECT on views to application role
-- Note: Adjust role name based on your setup
GRANT SELECT ON recent_auth_audit_logs TO PUBLIC;
GRANT SELECT ON recent_audit_logs TO PUBLIC;

-- Grant SELECT on retention policy table (read-only for monitoring)
GRANT SELECT ON audit_log_retention_policy TO PUBLIC;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify triggers are in place
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers
WHERE event_object_table IN ('auth_audit_logs', 'audit_logs')
    AND trigger_name LIKE '%prevent%'
ORDER BY event_object_table, trigger_name;

-- Verify retention policies
SELECT * FROM audit_log_retention_policy;

-- Verify views exist
SELECT 
    table_name,
    view_definition IS NOT NULL as has_definition
FROM information_schema.views
WHERE table_name IN ('recent_auth_audit_logs', 'recent_audit_logs');
