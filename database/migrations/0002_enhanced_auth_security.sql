-- Enhanced Authentication Security Migration
-- Adds backup codes, account locking, and failed attempt tracking

-- Add new columns to users table for enhanced security
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS mfa_backup_codes JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS mfa_setup_completed BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS account_locked BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_failed_login TIMESTAMP;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS users_mfa_setup_idx ON users(mfa_setup_completed);
CREATE INDEX IF NOT EXISTS users_account_locked_idx ON users(account_locked);
CREATE INDEX IF NOT EXISTS users_failed_attempts_idx ON users(failed_login_attempts);
CREATE INDEX IF NOT EXISTS users_last_failed_login_idx ON users(last_failed_login);

-- Update existing users to have MFA setup completed if they have MFA enabled
UPDATE users 
SET mfa_setup_completed = true 
WHERE mfa_enabled = true AND mfa_secret IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.mfa_backup_codes IS 'Array of hashed backup codes for MFA recovery';
COMMENT ON COLUMN users.mfa_setup_completed IS 'Whether user has completed mandatory MFA setup';
COMMENT ON COLUMN users.account_locked IS 'Whether account is locked due to security events';
COMMENT ON COLUMN users.failed_login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN users.last_failed_login IS 'Timestamp of last failed login attempt';

-- Create a function to automatically lock accounts after too many failed attempts
CREATE OR REPLACE FUNCTION check_failed_login_attempts()
RETURNS TRIGGER AS $$
BEGIN
    -- Lock account if failed attempts exceed threshold (5 attempts)
    IF NEW.failed_login_attempts >= 5 THEN
        NEW.account_locked = true;
    END IF;
    
    -- Update last failed login timestamp
    IF NEW.failed_login_attempts > OLD.failed_login_attempts THEN
        NEW.last_failed_login = NOW();
    END IF;
    
    -- Reset failed attempts on successful login (when last_login is updated)
    IF NEW.last_login IS DISTINCT FROM OLD.last_login AND NEW.last_login IS NOT NULL THEN
        NEW.failed_login_attempts = 0;
        NEW.last_failed_login = NULL;
        NEW.account_locked = false;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic account locking
DROP TRIGGER IF EXISTS trigger_check_failed_login_attempts ON users;
CREATE TRIGGER trigger_check_failed_login_attempts
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION check_failed_login_attempts();

-- Add enhanced audit log fields for better security tracking
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS session_id UUID,
ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;

-- Create indexes for audit log performance
CREATE INDEX IF NOT EXISTS audit_logs_session_id_idx ON audit_logs(session_id);
CREATE INDEX IF NOT EXISTS audit_logs_risk_score_idx ON audit_logs(risk_score);
CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx ON audit_logs(action, created_at);

-- Add comments for audit log enhancements
COMMENT ON COLUMN audit_logs.session_id IS 'Session ID associated with the audit event';
COMMENT ON COLUMN audit_logs.risk_score IS 'Risk score (0-100) calculated for the event';

-- Create a view for security monitoring
CREATE OR REPLACE VIEW security_events AS
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
    al.session_id,
    al.risk_score,
    al.created_at,
    u.email,
    u.first_name,
    u.last_name,
    u.role,
    u.account_locked,
    u.failed_login_attempts,
    t.name as tenant_name
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
LEFT JOIN tenants t ON al.tenant_id = t.id
WHERE al.action LIKE 'auth.%' OR al.action LIKE 'security.%'
ORDER BY al.created_at DESC;

-- Grant appropriate permissions
GRANT SELECT ON security_events TO PUBLIC;

-- Create indexes for common security queries
CREATE INDEX IF NOT EXISTS audit_logs_auth_actions_idx ON audit_logs(action) 
WHERE action LIKE 'auth.%' OR action LIKE 'security.%';

CREATE INDEX IF NOT EXISTS audit_logs_high_risk_idx ON audit_logs(risk_score, created_at) 
WHERE risk_score >= 50;

-- Add a function to clean up old audit logs (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs 
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment for cleanup function
COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Cleanup audit logs older than specified days (default: 365 days)';