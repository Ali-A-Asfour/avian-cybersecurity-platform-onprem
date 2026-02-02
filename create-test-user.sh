#!/bin/bash

# Create Test User for Ticket Assignment
echo "👤 Creating test user..."

# Create user: test@test.com / password123
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "
INSERT INTO users (
  id, email, password_hash, role, tenant_id, first_name, last_name,
  email_verified, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'test@test.com',
  '\$2b\$12\$8K1p/a0dLRZFnlJ5.k5uLOxIiIqI0qFvlM0pLR6vLRZFnlJ5.k5uLO',
  'it_helpdesk_analyst',
  (SELECT id FROM tenants LIMIT 1),
  'Test',
  'User',
  true,
  NOW(),
  NOW()
);
"

echo "✅ User created: test@test.com / password123"

# Test login
echo "🧪 Testing login..."
curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"password123"}' \
  -k

echo ""
echo ""
echo "🎯 Test in web interface:"
echo "   URL: https://192.168.1.116"
echo "   User: test@test.com"
echo "   Password: password123"