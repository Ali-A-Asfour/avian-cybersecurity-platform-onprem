-- Password History Migration
-- Creates password_history table to prevent password reuse
-- Supports security requirement: users cannot reuse their last 5 passwords
-- Part of production authentication system implementation

-- Create password_history table
CREATE TABLE IF NOT EXISTS "password_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "password_hash" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "password_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);

-- Create index for efficient querying by user
CREATE INDEX IF NOT EXISTS "password_history_user_id_idx" ON "password_history" USING btree ("user_id");

-- Create composite index for user + created_at (for ordering and limiting queries)
CREATE INDEX IF NOT EXISTS "password_history_user_created_idx" ON "password_history" USING btree ("user_id", "created_at" DESC);

-- Add table comment for documentation
COMMENT ON TABLE password_history IS 'Historical record of user passwords to prevent reuse of recent passwords';

-- Add column comments
COMMENT ON COLUMN password_history.user_id IS 'Reference to the user who owns this password history entry';
COMMENT ON COLUMN password_history.password_hash IS 'Bcrypt hash of the historical password';
COMMENT ON COLUMN password_history.created_at IS 'Timestamp when this password was set';

-- Create function to check if a password was recently used
CREATE OR REPLACE FUNCTION is_password_recently_used(
    p_user_id uuid,
    p_password_hash varchar(255),
    p_history_limit integer DEFAULT 5
)
RETURNS boolean AS $$
DECLARE
    v_match_count integer;
BEGIN
    -- Check if the password hash exists in the user's recent password history
    SELECT COUNT(*)
    INTO v_match_count
    FROM (
        SELECT password_hash
        FROM password_history
        WHERE user_id = p_user_id
        ORDER BY created_at DESC
        LIMIT p_history_limit
    ) recent_passwords
    WHERE password_hash = p_password_hash;
    
    RETURN v_match_count > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_password_recently_used IS 'Check if a password hash exists in the user''s recent password history (default: last 5 passwords)';

-- Create function to add password to history
CREATE OR REPLACE FUNCTION add_password_to_history(
    p_user_id uuid,
    p_password_hash varchar(255)
)
RETURNS uuid AS $$
DECLARE
    history_id uuid;
BEGIN
    -- Insert the new password into history
    INSERT INTO password_history (user_id, password_hash)
    VALUES (p_user_id, p_password_hash)
    RETURNING id INTO history_id;
    
    RETURN history_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_password_to_history IS 'Add a password hash to the user''s password history';

-- Create function to clean up old password history (keep only last N passwords)
CREATE OR REPLACE FUNCTION cleanup_old_password_history(
    p_user_id uuid,
    p_keep_count integer DEFAULT 10
)
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- Delete password history entries beyond the keep count
    WITH ranked_passwords AS (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
        FROM password_history
        WHERE user_id = p_user_id
    )
    DELETE FROM password_history
    WHERE id IN (
        SELECT id FROM ranked_passwords WHERE rn > p_keep_count
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_password_history IS 'Remove old password history entries, keeping only the most recent N passwords (default: 10)';

-- Create trigger function to automatically add password to history on user password change
CREATE OR REPLACE FUNCTION trigger_add_password_to_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Only add to history if password_hash actually changed
    IF NEW.password_hash IS DISTINCT FROM OLD.password_hash AND NEW.password_hash IS NOT NULL THEN
        -- Add the new password to history
        PERFORM add_password_to_history(NEW.id, NEW.password_hash);
        
        -- Clean up old history entries (keep last 10)
        PERFORM cleanup_old_password_history(NEW.id, 10);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_add_password_to_history IS 'Automatically add password to history when user password changes';

-- Create trigger on users table to track password changes
DROP TRIGGER IF EXISTS trigger_track_password_history ON users;
CREATE TRIGGER trigger_track_password_history
    AFTER UPDATE ON users
    FOR EACH ROW
    WHEN (NEW.password_hash IS DISTINCT FROM OLD.password_hash)
    EXECUTE FUNCTION trigger_add_password_to_history();

-- Create view to see password history statistics per user
CREATE OR REPLACE VIEW password_history_stats AS
SELECT 
    u.id as user_id,
    u.email,
    u.name,
    COUNT(ph.id) as total_password_changes,
    MIN(ph.created_at) as first_password_change,
    MAX(ph.created_at) as last_password_change,
    CASE 
        WHEN MAX(ph.created_at) IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (NOW() - MAX(ph.created_at))) / 86400
        ELSE NULL
    END as days_since_last_change
FROM users u
LEFT JOIN password_history ph ON u.id = ph.user_id
GROUP BY u.id, u.email, u.name;

COMMENT ON VIEW password_history_stats IS 'Statistics about password change history for each user';

-- Create function to get password history for a user (for admin/audit purposes)
CREATE OR REPLACE FUNCTION get_user_password_history(
    p_user_id uuid,
    p_limit integer DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    created_at timestamp,
    days_ago numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ph.id,
        ph.created_at,
        ROUND(EXTRACT(EPOCH FROM (NOW() - ph.created_at)) / 86400, 1) as days_ago
    FROM password_history ph
    WHERE ph.user_id = p_user_id
    ORDER BY ph.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_password_history IS 'Retrieve password change history for a user (hashes not included for security)';

-- Create function to enforce password history policy
CREATE OR REPLACE FUNCTION enforce_password_history_policy(
    p_user_id uuid,
    p_new_password_hash varchar(255),
    p_history_limit integer DEFAULT 5
)
RETURNS boolean AS $$
DECLARE
    v_is_reused boolean;
BEGIN
    -- Check if the password was recently used
    v_is_reused := is_password_recently_used(p_user_id, p_new_password_hash, p_history_limit);
    
    IF v_is_reused THEN
        RAISE EXCEPTION 'Password has been used recently. Please choose a different password.'
            USING ERRCODE = 'check_violation',
                  HINT = 'You cannot reuse your last ' || p_history_limit || ' passwords';
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enforce_password_history_policy IS 'Enforce password history policy by raising an exception if password was recently used';

-- Grant appropriate permissions
GRANT SELECT ON password_history TO PUBLIC;
GRANT SELECT ON password_history_stats TO PUBLIC;
GRANT EXECUTE ON FUNCTION is_password_recently_used TO PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_password_history TO PUBLIC;
GRANT EXECUTE ON FUNCTION enforce_password_history_policy TO PUBLIC;

-- Restrict direct manipulation of password_history table
-- Applications should use the provided functions instead
REVOKE INSERT, UPDATE, DELETE ON password_history FROM PUBLIC;

-- Create a role for password management (if needed)
DO $$ BEGIN
    CREATE ROLE password_admin;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

GRANT INSERT, DELETE ON password_history TO password_admin;

-- Add constraint to ensure password_hash is never empty
ALTER TABLE password_history
ADD CONSTRAINT password_history_hash_not_empty
CHECK (password_hash IS NOT NULL AND password_hash != '');

-- Populate password_history with current user passwords (one-time migration)
-- This ensures existing users have their current password in history
INSERT INTO password_history (user_id, password_hash, created_at)
SELECT 
    id,
    password_hash,
    COALESCE(updated_at, created_at) as created_at
FROM users
WHERE password_hash IS NOT NULL 
  AND password_hash != ''
  AND NOT EXISTS (
      SELECT 1 FROM password_history ph WHERE ph.user_id = users.id
  )
ON CONFLICT DO NOTHING;

-- Create a maintenance function to clean up all users' old password history
CREATE OR REPLACE FUNCTION cleanup_all_password_history(
    p_keep_count integer DEFAULT 10
)
RETURNS TABLE (
    user_id uuid,
    deleted_count integer
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        cleanup_old_password_history(u.id, p_keep_count)
    FROM users u
    WHERE EXISTS (
        SELECT 1 FROM password_history ph WHERE ph.user_id = u.id
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_all_password_history IS 'Clean up old password history for all users (maintenance function)';
