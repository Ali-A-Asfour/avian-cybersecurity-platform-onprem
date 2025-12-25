-- Migration: Update user roles to include specific analyst types
-- Date: 2024-01-01
-- Description: Replace generic 'analyst' role with 'security_analyst' and 'it_helpdesk_analyst'

-- First, update existing 'analyst' users to 'security_analyst' (default migration)
UPDATE users SET role = 'security_analyst' WHERE role = 'analyst';

-- Drop and recreate the enum with new values
-- Note: In production, this would need to be done more carefully to avoid downtime
ALTER TYPE user_role RENAME TO user_role_old;

CREATE TYPE user_role AS ENUM (
  'super_admin',
  'tenant_admin', 
  'security_analyst',
  'it_helpdesk_analyst',
  'user'
);

-- Update the users table to use the new enum
ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::text::user_role;

-- Drop the old enum
DROP TYPE user_role_old;

-- Update any existing data if needed
-- (All existing 'analyst' users are now 'security_analyst' from the first UPDATE)

-- Add indexes for the new role types
CREATE INDEX IF NOT EXISTS users_security_analyst_idx ON users(tenant_id) WHERE role = 'security_analyst';
CREATE INDEX IF NOT EXISTS users_it_helpdesk_analyst_idx ON users(tenant_id) WHERE role = 'it_helpdesk_analyst';