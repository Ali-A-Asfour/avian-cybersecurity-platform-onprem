#!/bin/bash

echo "🔧 Setting up local test environment (fixed)..."

# Check if we can connect to PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL client (psql) not found"
    echo "Please install PostgreSQL client"
    exit 1
fi

# Try to connect and create database if needed
echo "📊 Setting up database..."

# Create database if it doesn't exist
createdb -h localhost -U postgres avian 2>/dev/null || echo "Database might already exist"

# Create user if needed
psql -h localhost -U postgres -c "CREATE USER avian WITH PASSWORD 'avian_dev_password';" 2>/dev/null || echo "User might already exist"
psql -h localhost -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE avian TO avian;" 2>/dev/null

# Apply schema
echo "📋 Applying database schema..."
psql -h localhost -U avian -d avian -f complete_schema.sql

# Create test data with proper UUIDs and JSON
echo "🧪 Creating test data with proper format..."
psql -h localhost -U avian -d avian << 'EOF'
-- Create test tenant with proper UUID
INSERT INTO tenants (id, name, domain) 
VALUES (gen_random_uuid(), 'Test Company', 'test.com')
ON CONFLICT (domain) DO NOTHING;

-- Create test user and tickets with proper UUIDs
DO $$
DECLARE
    test_tenant_id UUID;
    test_user_id UUID;
    ticket1_id UUID := gen_random_uuid();
    ticket2_id UUID := gen_random_uuid();
    ticket3_id UUID := gen_random_uuid();
BEGIN
    -- Get the tenant ID
    SELECT id INTO test_tenant_id FROM tenants WHERE domain = 'test.com';
    
    -- Create test user with proper UUID and role enum
    INSERT INTO users (id, tenant_id, email, first_name, last_name, role, password_hash, email_verified)
    VALUES (
        gen_random_uuid(),
        test_tenant_id, 
        'test@test.com',
        'Test',
        'User',
        'analyst',
        '$2b$12$uNOQs5sDEJ.ovn8c5/bUYuet9GJ2xZGp1a9lfVIxYJOpEjlY0HJDy',
        true
    )
    ON CONFLICT (email) DO UPDATE SET
        password_hash = '$2b$12$uNOQs5sDEJ.ovn8c5/bUYuet9GJ2xZGp1a9lfVIxYJOpEjlY0HJDy',
        role = 'analyst';

    -- Get the user ID
    SELECT id INTO test_user_id FROM users WHERE email = 'test@test.com';

    -- Create test tickets with proper JSON format
    INSERT INTO tickets (id, tenant_id, requester, title, description, severity, priority, status, tags, category)
    VALUES 
        (ticket1_id, test_tenant_id, 'user@company.com', 'Test Assignment Ticket 1', 'This is a test ticket for assignment', 'medium', 'medium', 'new', '[]'::jsonb, 'it_support'),
        (ticket2_id, test_tenant_id, 'user2@company.com', 'Test Assignment Ticket 2', 'Another test ticket', 'high', 'high', 'new', '[]'::jsonb, 'hardware_issue'),
        (ticket3_id, test_tenant_id, 'user3@company.com', 'Test Assignment Ticket 3', 'Third test ticket', 'low', 'low', 'new', '[]'::jsonb, 'general_request')
    ON CONFLICT (id) DO NOTHING;

    -- Store the IDs for testing
    RAISE NOTICE 'Test data created successfully';
    RAISE NOTICE 'User ID: %', test_user_id;
    RAISE NOTICE 'Ticket 1 ID: %', ticket1_id;
    RAISE NOTICE 'Ticket 2 ID: %', ticket2_id;
    RAISE NOTICE 'Ticket 3 ID: %', ticket3_id;
END $$;

-- Show what we created
\echo 'USERS:'
SELECT id, email, role FROM users WHERE email = 'test@test.com';

\echo 'TICKETS:'
SELECT id, title, status, assignee FROM tickets ORDER BY created_at DESC LIMIT 5;
EOF

echo "✅ Local test environment ready!"
echo ""
echo "🎯 Test credentials:"
echo "  Email: test@test.com"
echo "  Password: password"
echo ""
echo "🚀 Start the development server with:"
echo "  npm run dev"
echo ""
echo "🧪 Get ticket IDs for testing with:"
echo "  psql -h localhost -U avian -d avian -c \"SELECT id, title FROM tickets ORDER BY created_at DESC LIMIT 3;\""