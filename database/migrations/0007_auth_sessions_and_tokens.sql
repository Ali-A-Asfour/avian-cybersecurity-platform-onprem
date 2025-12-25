-- Authentication Sessions and Token Management Migration
-- Adds session tracking, password history, and token management tables

-- Create sessions table for JWT token management
CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" varchar(255) NOT NULL,
  "ip_address" varchar(45),
  "user_agent" text,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);

-- Create password history table to prevent password reuse
CREATE TABLE IF NOT EXISTS "password_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "password_hash" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "password_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);

-- Create email verification tokens table
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token" varchar(255) NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);

-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token" varchar(255) NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);

-- Add email verification columns to users table if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP;

-- Create indexes for sessions table
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "sessions_token_hash_idx" ON "sessions" USING btree ("token_hash");
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");
CREATE INDEX IF NOT EXISTS "sessions_created_at_idx" ON "sessions" USING btree ("created_at");

-- Create indexes for password history
CREATE INDEX IF NOT EXISTS "password_history_user_id_idx" ON "password_history" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "password_history_created_at_idx" ON "password_history" USING btree ("created_at");

-- Create indexes for email verification tokens
CREATE INDEX IF NOT EXISTS "email_verification_tokens_user_id_idx" ON "email_verification_tokens" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "email_verification_tokens_token_idx" ON "email_verification_tokens" USING btree ("token");
CREATE INDEX IF NOT EXISTS "email_verification_tokens_expires_at_idx" ON "email_verification_tokens" USING btree ("expires_at");

-- Create indexes for password reset tokens
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_idx" ON "password_reset_tokens" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_token_idx" ON "password_reset_tokens" USING btree ("token");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_expires_at_idx" ON "password_reset_tokens" USING btree ("expires_at");

-- Create indexes on users table for new columns
CREATE INDEX IF NOT EXISTS "users_email_verified_idx" ON "users" USING btree ("email_verified");
CREATE INDEX IF NOT EXISTS "users_email_verification_token_idx" ON "users" USING btree ("email_verification_token");
CREATE INDEX IF NOT EXISTS "users_password_reset_token_idx" ON "users" USING btree ("password_reset_token");

-- Add comments for documentation
COMMENT ON TABLE sessions IS 'Active user sessions with JWT token tracking';
COMMENT ON TABLE password_history IS 'Historical password hashes to prevent password reuse';
COMMENT ON TABLE email_verification_tokens IS 'Tokens for email verification process';
COMMENT ON TABLE password_reset_tokens IS 'Tokens for password reset process';

COMMENT ON COLUMN users.email_verified IS 'Whether user has verified their email address';
COMMENT ON COLUMN users.email_verification_token IS 'Current email verification token (deprecated - use email_verification_tokens table)';
COMMENT ON COLUMN users.email_verification_expires IS 'Expiration time for email verification token (deprecated)';
COMMENT ON COLUMN users.password_reset_token IS 'Current password reset token (deprecated - use password_reset_tokens table)';
COMMENT ON COLUMN users.password_reset_expires IS 'Expiration time for password reset token (deprecated)';

-- Function to automatically clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$ LANGUAGE plpgsql;

-- Function to automatically clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Clean up expired email verification tokens
    DELETE FROM email_verification_tokens 
    WHERE expires_at < NOW();
    
    -- Clean up expired password reset tokens
    DELETE FROM password_reset_tokens 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$ LANGUAGE plpgsql;

-- Function to store password in history before update
CREATE OR REPLACE FUNCTION store_password_history()
RETURNS TRIGGER AS $
BEGIN
    -- Only store if password is actually changing
    IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
        INSERT INTO password_history (user_id, password_hash)
        VALUES (OLD.id, OLD.password_hash);
    END IF;
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Create trigger to automatically store password history
DROP TRIGGER IF EXISTS trigger_store_password_history ON users;
CREATE TRIGGER trigger_store_password_history
    BEFORE UPDATE ON users
    FOR EACH ROW
    WHEN (OLD.password_hash IS DISTINCT FROM NEW.password_hash)
    EXECUTE FUNCTION store_password_history();

-- Add comments for functions
COMMENT ON FUNCTION cleanup_expired_sessions IS 'Cleanup sessions that have expired';
COMMENT ON FUNCTION cleanup_expired_tokens IS 'Cleanup expired email verification and password reset tokens';
COMMENT ON FUNCTION store_password_history IS 'Automatically store old password in history when changed';
