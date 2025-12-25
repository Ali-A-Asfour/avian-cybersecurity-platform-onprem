-- Authentication Audit Logs Migration
-- Creates comprehensive audit logging for all authentication and authorization events
-- Supports security monitoring, compliance requirements (HIPAA, SOC2), and forensic analysis

-- Create auth_audit_logs table
CREATE TABLE IF NOT EXISTS "auth_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "email" varchar(255),
  "action" varchar(100) NOT NULL,
  "result" varchar(50) NOT NULL,
  "ip_address" varchar(45),
  "user_agent" text,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "auth_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "auth_audit_logs_user_id_idx" ON "auth_audit_logs" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "auth_audit_logs_email_idx" ON "auth_audit_logs" USING btree ("email");
CREATE INDEX IF NOT EXISTS "auth_audit_logs_action_idx" ON "auth_audit_logs" USING btree ("action");
CREATE INDEX IF NOT EXISTS "auth_audit_logs_result_idx" ON "auth_audit_logs" USING btree ("result");
CREATE INDEX IF NOT EXISTS "auth_audit_logs_created_at_idx" ON "auth_audit_logs" USING btree ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "auth_audit_logs_ip_address_idx" ON "auth_audit_logs" USING btree ("ip_address");

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "auth_audit_logs_user_action_idx" ON "auth_audit_logs" USING btree ("user_id", "action", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "auth_audit_logs_action_result_idx" ON "auth_audit_logs" USING btree ("action", "result", "created_at" DESC);

-- Create GIN index for JSONB metadata queries
CREATE INDEX IF NOT EXISTS "auth_audit_logs_metadata_idx" ON "auth_audit_logs" USING gin ("metadata");

-- Add table comment for documentation
COMMENT ON TABLE auth_audit_logs IS 'Immutable audit log of all authentication and authorization events for security monitoring and compliance';

-- Add column comments
COMMENT ON COLUMN auth_audit_logs.user_id IS 'Reference to user who performed the action (NULL for failed login attempts with invalid email)';
COMMENT ON COLUMN auth_audit_logs.email IS 'Email address used in the action (stored separately to track failed attempts with non-existent emails)';
COMMENT ON COLUMN auth_audit_logs.action IS 'Type of action performed (e.g., login, logout, password_change, mfa_enable, permission_change)';
COMMENT ON COLUMN auth_audit_logs.result IS 'Result of the action (e.g., success, failure, error, blocked)';
COMMENT ON COLUMN auth_audit_logs.ip_address IS 'IP address from which the action was performed';
COMMENT ON COLUMN auth_audit_logs.user_agent IS 'Browser/client user agent string';
COMMENT ON COLUMN auth_audit_logs.metadata IS 'Additional context data in JSON format (e.g., failure reason, changed fields, session info)';
COMMENT ON COLUMN auth_audit_logs.created_at IS 'Timestamp when the event occurred (immutable)';

-- Create function to log authentication events
CREATE OR REPLACE FUNCTION log_auth_event(
    p_user_id uuid,
    p_email varchar(255),
    p_action varchar(100),
    p_result varchar(50),
    p_ip_address varchar(45) DEFAULT NULL,
    p_user_agent text DEFAULT NULL,
    p_metadata jsonb DEFAULT NULL
)
RETURNS uuid AS $
DECLARE
    log_id uuid;
BEGIN
    INSERT INTO auth_audit_logs (
        user_id,
        email,
        action,
        result,
        ip_address,
        user_agent,
        metadata
    ) VALUES (
        p_user_id,
        p_email,
        p_action,
        p_result,
        p_ip_address,
        p_user_agent,
        p_metadata
    )
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_auth_event IS 'Helper function to create audit log entries for authentication events';

-- Create function to prevent modification of audit logs (immutability)
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
    RETURN NULL;
END;
$ LANGUAGE plpgsql;

-- Create triggers to enforce immutability
DROP TRIGGER IF EXISTS prevent_audit_log_update ON auth_audit_logs;
CREATE TRIGGER prevent_audit_log_update
    BEFORE UPDATE ON auth_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

DROP TRIGGER IF EXISTS prevent_audit_log_delete ON auth_audit_logs;
CREATE TRIGGER prevent_audit_log_delete
    BEFORE DELETE ON auth_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

COMMENT ON FUNCTION prevent_audit_log_modification IS 'Enforces immutability of audit logs by preventing updates and deletes';

-- Create view for failed login analysis
CREATE OR REPLACE VIEW failed_login_attempts AS
SELECT 
    email,
    ip_address,
    COUNT(*) as attempt_count,
    MAX(created_at) as last_attempt,
    MIN(created_at) as first_attempt,
    array_agg(DISTINCT user_agent) as user_agents,
    jsonb_agg(
        jsonb_build_object(
            'timestamp', created_at,
            'metadata', metadata
        ) ORDER BY created_at DESC
    ) as attempts
FROM auth_audit_logs
WHERE action = 'login' 
  AND result IN ('failure', 'blocked')
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY email, ip_address
HAVING COUNT(*) >= 3
ORDER BY attempt_count DESC, last_attempt DESC;

COMMENT ON VIEW failed_login_attempts IS 'Aggregated view of failed login attempts in the last 24 hours for security monitoring';

-- Create view for user activity summary
CREATE OR REPLACE VIEW user_auth_activity AS
SELECT 
    u.id as user_id,
    u.email,
    u.name,
    u.tenant_id,
    COUNT(*) FILTER (WHERE a.action = 'login' AND a.result = 'success') as successful_logins,
    COUNT(*) FILTER (WHERE a.action = 'login' AND a.result = 'failure') as failed_logins,
    COUNT(*) FILTER (WHERE a.action = 'password_change') as password_changes,
    COUNT(*) FILTER (WHERE a.action = 'mfa_enable') as mfa_enables,
    COUNT(*) FILTER (WHERE a.action = 'mfa_disable') as mfa_disables,
    MAX(a.created_at) FILTER (WHERE a.action = 'login' AND a.result = 'success') as last_successful_login,
    MAX(a.created_at) FILTER (WHERE a.action = 'login' AND a.result = 'failure') as last_failed_login,
    COUNT(DISTINCT a.ip_address) as unique_ip_addresses,
    array_agg(DISTINCT a.ip_address) FILTER (WHERE a.ip_address IS NOT NULL) as ip_addresses
FROM users u
LEFT JOIN auth_audit_logs a ON u.id = a.user_id
WHERE a.created_at > NOW() - INTERVAL '30 days' OR a.created_at IS NULL
GROUP BY u.id, u.email, u.name, u.tenant_id;

COMMENT ON VIEW user_auth_activity IS 'Summary of user authentication activity over the last 30 days';

-- Create view for security events requiring attention
CREATE OR REPLACE VIEW security_events AS
SELECT 
    id,
    user_id,
    email,
    action,
    result,
    ip_address,
    user_agent,
    metadata,
    created_at,
    CASE 
        WHEN action = 'login' AND result = 'blocked' THEN 'high'
        WHEN action = 'login' AND result = 'failure' THEN 'medium'
        WHEN action = 'account_unlock' THEN 'medium'
        WHEN action = 'mfa_disable' THEN 'medium'
        WHEN action = 'permission_change' THEN 'low'
        ELSE 'info'
    END as severity
FROM auth_audit_logs
WHERE 
    (action = 'login' AND result IN ('failure', 'blocked'))
    OR action IN ('account_unlock', 'mfa_disable', 'permission_change', 'role_change')
ORDER BY created_at DESC;

COMMENT ON VIEW security_events IS 'Security-relevant authentication events that may require investigation';

-- Create function to get audit logs for a specific user
CREATE OR REPLACE FUNCTION get_user_audit_logs(
    p_user_id uuid,
    p_limit integer DEFAULT 100,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    action varchar(100),
    result varchar(50),
    ip_address varchar(45),
    user_agent text,
    metadata jsonb,
    created_at timestamp
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.action,
        a.result,
        a.ip_address,
        a.user_agent,
        a.metadata,
        a.created_at
    FROM auth_audit_logs a
    WHERE a.user_id = p_user_id
    ORDER BY a.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_audit_logs IS 'Retrieve paginated audit logs for a specific user';

-- Create function to detect suspicious activity patterns
CREATE OR REPLACE FUNCTION detect_suspicious_activity(
    p_time_window interval DEFAULT '1 hour'
)
RETURNS TABLE (
    email varchar(255),
    ip_address varchar(45),
    failed_attempts bigint,
    unique_user_agents bigint,
    first_attempt timestamp,
    last_attempt timestamp,
    risk_score integer
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        a.email,
        a.ip_address,
        COUNT(*) as failed_attempts,
        COUNT(DISTINCT a.user_agent) as unique_user_agents,
        MIN(a.created_at) as first_attempt,
        MAX(a.created_at) as last_attempt,
        -- Simple risk scoring: more attempts + more user agents = higher risk
        (COUNT(*) * 10 + COUNT(DISTINCT a.user_agent) * 5)::integer as risk_score
    FROM auth_audit_logs a
    WHERE 
        a.action = 'login' 
        AND a.result IN ('failure', 'blocked')
        AND a.created_at > NOW() - p_time_window
    GROUP BY a.email, a.ip_address
    HAVING COUNT(*) >= 3
    ORDER BY risk_score DESC, failed_attempts DESC;
END;
$ LANGUAGE plpgsql;

COMMENT ON FUNCTION detect_suspicious_activity IS 'Detect potentially suspicious authentication activity patterns within a time window';

-- Create function to archive old audit logs (for data retention policies)
CREATE OR REPLACE FUNCTION archive_old_audit_logs(
    p_retention_days integer DEFAULT 365
)
RETURNS TABLE (
    archived_count bigint,
    oldest_archived timestamp,
    newest_archived timestamp
) AS $
DECLARE
    v_archived_count bigint;
    v_oldest timestamp;
    v_newest timestamp;
BEGIN
    -- In a real implementation, this would move data to an archive table or S3
    -- For now, we just return statistics about what would be archived
    SELECT 
        COUNT(*),
        MIN(created_at),
        MAX(created_at)
    INTO v_archived_count, v_oldest, v_newest
    FROM auth_audit_logs
    WHERE created_at < NOW() - (p_retention_days || ' days')::interval;
    
    RETURN QUERY SELECT v_archived_count, v_oldest, v_newest;
END;
$ LANGUAGE plpgsql;

COMMENT ON FUNCTION archive_old_audit_logs IS 'Identify audit logs older than retention period for archival (does not delete)';

-- Grant appropriate permissions
GRANT SELECT ON auth_audit_logs TO PUBLIC;
GRANT SELECT ON failed_login_attempts TO PUBLIC;
GRANT SELECT ON user_auth_activity TO PUBLIC;
GRANT SELECT ON security_events TO PUBLIC;

-- Prevent direct INSERT/UPDATE/DELETE on audit logs table (use log_auth_event function instead)
-- This ensures all audit log entries go through the proper function
REVOKE INSERT, UPDATE, DELETE ON auth_audit_logs FROM PUBLIC;

-- Create a role for audit log management (if needed)
DO $ BEGIN
    CREATE ROLE audit_admin;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $;

GRANT INSERT ON auth_audit_logs TO audit_admin;
GRANT EXECUTE ON FUNCTION log_auth_event TO PUBLIC;

-- Add check constraint to ensure valid action types
ALTER TABLE auth_audit_logs
ADD CONSTRAINT auth_audit_logs_action_check
CHECK (action IN (
    'login',
    'logout',
    'register',
    'password_change',
    'password_reset_request',
    'password_reset_complete',
    'email_verification',
    'mfa_enable',
    'mfa_disable',
    'mfa_verify',
    'session_create',
    'session_revoke',
    'account_lock',
    'account_unlock',
    'role_change',
    'permission_change',
    'profile_update',
    'api_key_create',
    'api_key_revoke'
));

-- Add check constraint to ensure valid result types
ALTER TABLE auth_audit_logs
ADD CONSTRAINT auth_audit_logs_result_check
CHECK (result IN (
    'success',
    'failure',
    'error',
    'blocked',
    'pending'
));

-- Add check constraint to ensure email is provided
ALTER TABLE auth_audit_logs
ADD CONSTRAINT auth_audit_logs_email_required
CHECK (email IS NOT NULL AND email != '');
