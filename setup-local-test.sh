#!/bin/bash

echo "🔧 Setting up local test environment..."

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

# Create test data
echo "🧪 Creating test data..."
psql -h localhost -U avian -d avian << 'EOF'
-- Create test tenant
INSERT INTO tenants (id, name, domain) 
VALUES ('test-tenant-123', 'Test Company', 'test.com')
ON CONFLICT (domain) DO NOTHING;

-- Create test user with correct role enum
INSERT INTO users (id, tenant_id, email, first_name, last_name, role, password_hash, email_verified)
VALUES (
    'test-user-123',
    'test-tenant-123', 
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

-- Create test tickets
INSERT INTO tickets (id, tenant_id, requester, title, description, severity, priority, status, tags, category)
VALUES 
    ('test-ticket-1', 'test-tenant-123', 'user@company.com', 'Test Assignment Ticket 1', 'This is a test ticket for assignment', 'medium', 'medium', 'new', '[]', 'it_support'),
    ('test-ticket-2', 'test-tenant-123', 'user2@company.com', 'Test Assignment Ticket 2', 'Another test ticket', 'high', 'high', 'new', '[]', 'hardware_issue'),
    ('test-ticket-3', 'test-tenant-123', 'user3@company.com', 'Test Assignment Ticket 3', 'Third test ticket', 'low', 'low', 'new', '[]', 'general_request')
ON CONFLICT (id) DO UPDATE SET
    status = 'new',
    assignee = NULL;

-- Show what we created
SELECT 'USERS:' as table_name;
SELECT id, email, role FROM users WHERE email = 'test@test.com';

SELECT 'TICKETS:' as table_name;
SELECT id, title, status, assignee FROM tickets WHERE tenant_id = 'test-tenant-123';
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
echo "🧪 Test assignment API with:"
echo "  curl -X POST http://localhost:3000/api/tickets/assign-simple \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"ticketId\": \"test-ticket-1\", \"assignee\": \"test-user-123\"}'"