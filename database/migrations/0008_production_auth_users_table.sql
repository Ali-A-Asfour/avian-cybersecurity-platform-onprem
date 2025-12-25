-- Production Authentication Users Table Enhancement
-- Adds missing fields required for production authentication system
-- This migration aligns the users table with the production auth design specification

-- Add locked_until column for time-based account unlocking
-- This replaces the boolean account_locked with a more flexible timestamp approach
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

-- Add name column as a computed/virtual column combining first_name and last_name
-- This provides backward compatibility while supporting the new auth system
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS name VARCHAR(255) GENERATED ALWAYS AS (
  CASE 
    WHEN first_name IS NOT NULL AND last_name IS NOT NULL 
    THEN first_name || ' ' || last_name
    WHEN first_name IS NOT NULL 
    THEN first_name
    WHEN last_name IS NOT NULL 
    THEN last_name
    ELSE ''
  END
) STORED;

-- Create index for locked_until to efficiently query locked accounts
CREATE INDEX IF NOT EXISTS users_locked_until_idx ON users(locked_until) 
WHERE locked_until IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.locked_until IS 'Timestamp until which the account is locked (NULL = not locked)';
COMMENT ON COLUMN users.name IS 'Full name computed from first_name and last_name for auth compatibility';

-- Update the account locking trigger to use locked_until instead of account_locked
CREATE OR REPLACE FUNCTION check_failed_login_attempts()
RETURNS TRIGGER AS $
BEGIN
    -- Lock account for 15 minutes if failed attempts exceed threshold (5 attempts)
    IF NEW.failed_login_attempts >= 5 THEN
        NEW.locked_until = NOW() + INTERVAL '15 minutes';
        NEW.account_locked = true; -- Keep for backward compatibility
    END IF;
    
    -- Update last failed login timestamp
    IF NEW.failed_login_attempts > OLD.failed_login_attempts THEN
        NEW.last_failed_login = NOW();
    END IF;
    
    -- Reset failed attempts on successful login (when last_login is updated)
    IF NEW.last_login IS DISTINCT FROM OLD.last_login AND NEW.last_login IS NOT NULL THEN
        NEW.failed_login_attempts = 0;
        NEW.last_failed_login = NULL;
        NEW.locked_until = NULL;
        NEW.account_locked = false;
    END IF;
    
    -- Auto-unlock if locked_until has passed
    IF NEW.locked_until IS NOT NULL AND NEW.locked_until < NOW() THEN
        NEW.locked_until = NULL;
        NEW.account_locked = false;
        NEW.failed_login_attempts = 0;
    END IF;
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Recreate the trigger with the updated function
DROP TRIGGER IF EXISTS trigger_check_failed_login_attempts ON users;
CREATE TRIGGER trigger_check_failed_login_attempts
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION check_failed_login_attempts();

-- Create a function to check if an account is currently locked
CREATE OR REPLACE FUNCTION is_account_locked(user_id_param UUID)
RETURNS BOOLEAN AS $
DECLARE
    lock_time TIMESTAMP;
BEGIN
    SELECT locked_until INTO lock_time
    FROM users
    WHERE id = user_id_param;
    
    -- Account is locked if locked_until is in the future
    RETURN lock_time IS NOT NULL AND lock_time > NOW();
END;
$ LANGUAGE plpgsql;

-- Create a function to unlock an account (for admin use)
CREATE OR REPLACE FUNCTION unlock_account(user_id_param UUID)
RETURNS BOOLEAN AS $
BEGIN
    UPDATE users
    SET 
        locked_until = NULL,
        account_locked = false,
        failed_login_attempts = 0,
        last_failed_login = NULL
    WHERE id = user_id_param;
    
    RETURN FOUND;
END;
$ LANGUAGE plpgsql;

-- Add comments for new functions
COMMENT ON FUNCTION is_account_locked IS 'Check if a user account is currently locked based on locked_until timestamp';
COMMENT ON FUNCTION unlock_account IS 'Manually unlock a user account and reset failed login attempts';

-- Create a view for easy querying of locked accounts
CREATE OR REPLACE VIEW locked_accounts AS
SELECT 
    u.id,
    u.email,
    u.name,
    u.first_name,
    u.last_name,
    u.tenant_id,
    u.failed_login_attempts,
    u.last_failed_login,
    u.locked_until,
    u.account_locked,
    t.name as tenant_name,
    CASE 
        WHEN u.locked_until > NOW() THEN true
        ELSE false
    END as is_currently_locked,
    CASE 
        WHEN u.locked_until > NOW() THEN u.locked_until - NOW()
        ELSE INTERVAL '0'
    END as time_until_unlock
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE u.locked_until IS NOT NULL OR u.account_locked = true
ORDER BY u.locked_until DESC NULLS LAST;

-- Grant appropriate permissions
GRANT SELECT ON locked_accounts TO PUBLIC;

-- Ensure email is unique (required by production auth design)
-- This may already exist, but we ensure it here
DO $ BEGIN
    ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $;

-- Update existing locked accounts to use locked_until
-- Convert account_locked boolean to locked_until timestamp
UPDATE users
SET locked_until = NOW() + INTERVAL '15 minutes'
WHERE account_locked = true AND locked_until IS NULL;

-- Add validation to ensure email format is valid
ALTER TABLE users 
ADD CONSTRAINT users_email_format_check 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Ensure password_hash is never null for active users
ALTER TABLE users 
ADD CONSTRAINT users_password_hash_not_null_when_active 
CHECK (NOT is_active OR password_hash IS NOT NULL);
