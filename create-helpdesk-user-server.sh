#!/bin/bash

# Create Helpdesk User on Server Database
# This script creates the h@tcc.com user in the server's PostgreSQL database

echo "👤 Creating helpdesk user h@tcc.com in server database..."

# Get the first available tenant ID
TENANT_ID=$(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c "SELECT id FROM tenants LIMIT 1;" | tr -d ' ')

echo "Using tenant ID: $TENANT_ID"

# Create the user with bcrypt hash for "admin123"
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "
INSERT INTO users (
  id, email, password_hash, role, tenant_id, first_name, last_name,
  email_verified, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'h@tcc.com',
  '\$2b\$12\$uNOQs5sDEJ.ovn8c5/bUYuet9GJ2xZGp1a9lfVIxYJOpEjlY0HJDy',
  'it_helpdesk_analyst',
  '$TENANT_ID',
  'Helpdesk',
  'Analyst',
  true,
  NOW(),
  NOW()
);
"

echo "✅ User created"

# Now test the ticket assignment
echo "🧪 Testing ticket assignment..."
./test-ticket-assignment-server.sh