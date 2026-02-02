-- Fix tickets table structure to match our Drizzle schema
-- Add missing columns if they don't exist

-- Add missing columns
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS contact_method VARCHAR(50) DEFAULT 'email';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS requester VARCHAR(255);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS requester_email VARCHAR(255);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS device_name VARCHAR(255);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMP WITH TIME ZONE;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS queue_position_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Update existing records to have required values
UPDATE tickets SET 
    created_by = COALESCE(created_by, 'system'),
    contact_method = COALESCE(contact_method, 'email'),
    requester = COALESCE(requester, requester_email, 'unknown'),
    queue_position_updated_at = COALESCE(queue_position_updated_at, created_at, NOW())
WHERE created_by IS NULL OR contact_method IS NULL OR requester IS NULL;

-- Create indexes for better performance (ignore if they already exist)
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_id ON tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);

-- Insert test tickets if they don't exist
INSERT INTO tickets (
    id, title, description, severity, contact_method, status, priority,
    created_by, tenant_id, category, requester_email, requester
) VALUES 
(
    'ticket-esr-test-12345',
    'ESR Tenant Test Ticket',
    'This ticket should be visible when ESR tenant is selected',
    'medium',
    'email',
    'new',
    'medium',
    '40c747b5-c1ab-458f-a5e1-12c972b29f3a',
    '85cfd918-8558-4baa-9534-25454aea76a8',
    'it_support',
    'helpdesk.analyst@company.com',
    'helpdesk.analyst@company.com'
),
(
    'ticket-default-test-67890',
    'Default Tenant Test Ticket',
    'This ticket should be visible in the default tenant',
    'high',
    'email',
    'new',
    'high',
    'c8dc5000-5240-41be-b0d0-d1ae6d71f852',
    '1f9656a9-1d4a-4ebf-94db-45427789ba24',
    'it_support',
    'admin@avian.local',
    'admin@avian.local'
) ON CONFLICT (id) DO NOTHING;