-- Update Ticket Categories Migration
-- Adds comprehensive ticket categories for role-based access control

-- Drop the existing enum and recreate with expanded categories
-- Note: This requires careful handling in production to avoid data loss

-- First, add a temporary column with the new enum type
CREATE TYPE ticket_category_new AS ENUM (
  -- Security-related categories (Security Analysts only)
  'security_incident',
  'vulnerability', 
  'malware_detection',
  'phishing_attempt',
  'data_breach',
  'policy_violation',
  'compliance',
  
  -- IT Support categories (IT Helpdesk Analysts only)
  'it_support',
  'hardware_issue',
  'software_issue', 
  'network_issue',
  'access_request',
  'account_setup',
  
  -- General categories (all roles)
  'general_request',
  'other'
);

-- Add temporary column with new enum type
ALTER TABLE tickets ADD COLUMN category_new ticket_category_new;

-- Migrate existing data to new categories
UPDATE tickets SET category_new = 
  CASE 
    WHEN category = 'security_incident' THEN 'security_incident'::ticket_category_new
    WHEN category = 'vulnerability' THEN 'vulnerability'::ticket_category_new
    WHEN category = 'compliance' THEN 'compliance'::ticket_category_new
    WHEN category = 'access_request' THEN 'access_request'::ticket_category_new
    WHEN category = 'policy_violation' THEN 'policy_violation'::ticket_category_new
    WHEN category = 'other' THEN 'other'::ticket_category_new
    ELSE 'general_request'::ticket_category_new
  END;

-- Make the new column not null
ALTER TABLE tickets ALTER COLUMN category_new SET NOT NULL;

-- Drop the old column and enum
ALTER TABLE tickets DROP COLUMN category;
DROP TYPE ticket_category;

-- Rename the new column and enum
ALTER TABLE tickets RENAME COLUMN category_new TO category;
ALTER TYPE ticket_category_new RENAME TO ticket_category;

-- Recreate the index on the category column
DROP INDEX IF EXISTS tickets_category_idx;
CREATE INDEX tickets_category_idx ON tickets(category);

-- Add comments for documentation
COMMENT ON COLUMN tickets.category IS 'Ticket category with role-based access control';

-- Create a view for role-based ticket access
CREATE OR REPLACE VIEW security_tickets AS
SELECT * FROM tickets 
WHERE category IN (
  'security_incident',
  'vulnerability', 
  'malware_detection',
  'phishing_attempt',
  'data_breach',
  'policy_violation',
  'compliance'
);

CREATE OR REPLACE VIEW it_support_tickets AS  
SELECT * FROM tickets
WHERE category IN (
  'it_support',
  'hardware_issue',
  'software_issue',
  'network_issue', 
  'access_request',
  'account_setup'
);

CREATE OR REPLACE VIEW general_tickets AS
SELECT * FROM tickets
WHERE category IN (
  'general_request',
  'other'
);

-- Grant appropriate permissions on views
GRANT SELECT ON security_tickets TO PUBLIC;
GRANT SELECT ON it_support_tickets TO PUBLIC;
GRANT SELECT ON general_tickets TO PUBLIC;

-- Add indexes for performance on category-based queries
CREATE INDEX IF NOT EXISTS tickets_security_category_idx ON tickets(category) 
WHERE category IN ('security_incident', 'vulnerability', 'malware_detection', 'phishing_attempt', 'data_breach', 'policy_violation', 'compliance');

CREATE INDEX IF NOT EXISTS tickets_it_category_idx ON tickets(category)
WHERE category IN ('it_support', 'hardware_issue', 'software_issue', 'network_issue', 'access_request', 'account_setup');

CREATE INDEX IF NOT EXISTS tickets_general_category_idx ON tickets(category)
WHERE category IN ('general_request', 'other');

-- Create a function to validate category access based on user role
CREATE OR REPLACE FUNCTION validate_ticket_category_access(
  user_role TEXT,
  ticket_category ticket_category
) RETURNS BOOLEAN AS $
BEGIN
  CASE user_role
    WHEN 'security_analyst' THEN
      RETURN ticket_category IN (
        'security_incident', 'vulnerability', 'malware_detection', 
        'phishing_attempt', 'data_breach', 'policy_violation', 
        'compliance', 'general_request', 'other'
      );
    WHEN 'it_helpdesk_analyst' THEN  
      RETURN ticket_category IN (
        'it_support', 'hardware_issue', 'software_issue',
        'network_issue', 'access_request', 'account_setup',
        'general_request', 'other'
      );
    WHEN 'tenant_admin', 'super_admin' THEN
      RETURN TRUE; -- Admins can access all categories
    WHEN 'user' THEN
      RETURN ticket_category IN ('general_request', 'other');
    ELSE
      RETURN FALSE;
  END CASE;
END;
$ LANGUAGE plpgsql;

-- Add comment for the validation function
COMMENT ON FUNCTION validate_ticket_category_access IS 'Validates if a user role can access tickets in a specific category';