-- Create tickets table for help desk functionality
CREATE TABLE IF NOT EXISTS tickets (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    contact_method VARCHAR(50) NOT NULL CHECK (contact_method IN ('email', 'phone')),
    status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'awaiting_response', 'resolved', 'closed')),
    priority VARCHAR(50) NOT NULL CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,
    assigned_to VARCHAR(255),
    tenant_id VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    requester_email VARCHAR(255),
    requester VARCHAR(255) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    device_name VARCHAR(255),
    sla_deadline TIMESTAMP WITH TIME ZONE,
    queue_position_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    phone_number VARCHAR(50)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_id ON tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);

-- Insert test tickets
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