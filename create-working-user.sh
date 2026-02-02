#!/bin/bash

# Create Working Test User
echo "👤 Creating working test user..."

# Delete existing test user if exists
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "DELETE FROM users WHERE email = 'test@test.com';"

# Create user with correct bcrypt hash for "password123"
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "
INSERT INTO users (
  id, email, password_hash, role, tenant_id, first_name, last_name,
  email_verified, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'test@test.com',
  '\$2b\$12\$LQv3c1yqBwlVHpPx7fgHNO7eGJqxgJVeQstSX.fQ2NFFz6h4GhVqW',
  'it_helpdesk_analyst',
  (SELECT id FROM tenants LIMIT 1),
  'Test',
  'User',
  true,
  NOW(),
  NOW()
);
"

echo "✅ User created with correct hash"

# Test login
echo "🧪 Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"password123"}' \
  -k)

echo "Response: $LOGIN_RESPONSE"

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
    echo "✅ LOGIN WORKS!"
    
    # Test ticket assignment
    TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    TENANT_ID=$(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c 'SELECT id FROM tenants LIMIT 1;' | tr -d ' ')
    TICKET_ID=$(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c "SELECT id FROM tickets WHERE status = 'new' AND assignee IS NULL LIMIT 1;" | tr -d ' ')
    
    if [ -n "$TICKET_ID" ]; then
        echo "🎫 Testing assignment..."
        ASSIGN_RESPONSE=$(curl -s -X POST 'https://localhost/api/help-desk/queue/unassigned' \
          -H 'Content-Type: application/json' \
          -H "Authorization: Bearer $TOKEN" \
          -H "x-selected-tenant-id: $TENANT_ID" \
          -d "{\"ticketId\":\"$TICKET_ID\",\"assignee\":\"test@test.com\"}" \
          -k)
        
        echo "Assignment: $ASSIGN_RESPONSE"
        
        if echo "$ASSIGN_RESPONSE" | grep -q '"success":true'; then
            echo "✅ ASSIGNMENT WORKS!"
        fi
    fi
else
    echo "❌ Login failed"
fi

echo ""
echo "🎯 Ready to test:"
echo "   URL: https://192.168.1.116"
echo "   User: test@test.com"
echo "   Password: password123"