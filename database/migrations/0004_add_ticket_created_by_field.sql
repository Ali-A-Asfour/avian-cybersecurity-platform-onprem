-- Migration: Add created_by field to tickets table for field-level access control
-- This field tracks who created the ticket to restrict title/description editing

-- Add created_by column to tickets table
ALTER TABLE tickets ADD COLUMN created_by UUID;

-- Create index for performance
CREATE INDEX tickets_created_by_idx ON tickets(created_by);

-- Update existing tickets to set created_by to requester (best effort migration)
-- In a real scenario, you might want to map requester emails to user IDs
UPDATE tickets SET created_by = (
  SELECT id FROM main.users WHERE email = tickets.requester LIMIT 1
) WHERE created_by IS NULL;

-- For tickets where we can't find a matching user, set to a system user or first admin
UPDATE tickets SET created_by = (
  SELECT id FROM main.users WHERE role = 'super_admin' LIMIT 1
) WHERE created_by IS NULL;

-- Make the column NOT NULL after setting values
ALTER TABLE tickets ALTER COLUMN created_by SET NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN tickets.created_by IS 'User ID of ticket creator - used for field-level access control on title and description';