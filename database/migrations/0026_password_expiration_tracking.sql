-- Migration: Add password expiration tracking fields
-- Requirements: 6.5 (Password expiration after 90 days)
-- Date: 2026-01-04

-- Add password_changed_at and password_expires_at columns to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '90 days');

-- Update existing users to have proper expiration dates
UPDATE users 
SET 
  password_changed_at = COALESCE(updated_at, created_at, NOW()),
  password_expires_at = COALESCE(updated_at, created_at, NOW()) + INTERVAL '90 days'
WHERE password_changed_at IS NULL OR password_expires_at IS NULL;

-- Create index for password expiration queries
CREATE INDEX IF NOT EXISTS idx_users_password_expires_at ON users(password_expires_at);

-- Add comment to document the purpose
COMMENT ON COLUMN users.password_changed_at IS 'Timestamp when password was last changed';
COMMENT ON COLUMN users.password_expires_at IS 'Timestamp when password expires (90 days from password_changed_at)';
