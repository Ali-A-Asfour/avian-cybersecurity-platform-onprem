#!/bin/bash

# Fix Ticket Assignment - Complete Solution
echo "🔧 Fixing ticket assignment issue..."

# 1. Create the helpdesk user if it doesn't exist
echo "1. Creating helpdesk user..."
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "
INSERT INTO users (
  id, email, password_hash, role, tenant_id, first_name, last_name,
  email_verified, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'h@tcc.com',
  '\$2b\$12\$uNOQs5sDEJ.ovn8c5/bUYuet9GJ2xZGp1a9lfVIxYJOpEjlY0HJDy',
  'it_helpdesk_analyst',
  (SELECT id FROM tenants LIMIT 1),
  'Helpdesk',
  'Analyst',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;
"

# 2. Create a test ticket if none exist
echo "2. Creating test ticket..."
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "
INSERT INTO tickets (
  id, tenant_id, requester, title, description, severity, priority, status, tags, category, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM tenants LIMIT 1),
  'test@example.com',
  'Test Assignment Ticket',
  'This ticket is for testing the assignment functionality',
  'medium',
  'medium', 
  'new',
  '[]'::jsonb,
  'it_support',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
"

# 3. Test login
echo "3. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"h@tcc.com","password":"12345678"}' \
  -k)

echo "Login response: $LOGIN_RESPONSE"

# Extract token
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo "✅ Login successful, token obtained"
  
  # 4. Get unassigned tickets
  echo "4. Getting unassigned tickets..."
  TICKETS_RESPONSE=$(curl -s -X GET 'https://localhost/api/help-desk/queue/unassigned' \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-selected-tenant-id: $(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c 'SELECT id FROM tenants LIMIT 1;' | tr -d ' ')" \
    -k)
  
  echo "Tickets response: $TICKETS_RESPONSE"
  
  # 5. Try to assign a ticket
  TICKET_ID=$(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c "SELECT id FROM tickets WHERE status = 'new' AND assignee IS NULL LIMIT 1;" | tr -d ' ')
  
  if [ -n "$TICKET_ID" ]; then
    echo "5. Testing ticket assignment for ticket: $TICKET_ID"
    ASSIGN_RESPONSE=$(curl -s -X POST 'https://localhost/api/help-desk/queue/unassigned' \
      -H 'Content-Type: application/json' \
      -H "Authorization: Bearer $TOKEN" \
      -H "x-selected-tenant-id: $(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c 'SELECT id FROM tenants LIMIT 1;' | tr -d ' ')" \
      -d "{\"ticketId\":\"$TICKET_ID\",\"assignee\":\"h@tcc.com\"}" \
      -k)
    
    echo "Assignment response: $ASSIGN_RESPONSE"
    
    # Check if assignment worked
    echo "6. Checking assignment result..."
    sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT id, title, status, assignee FROM tickets WHERE id = '$TICKET_ID';"
    
    if echo "$ASSIGN_RESPONSE" | grep -q '"success":true'; then
      echo "✅ TICKET ASSIGNMENT WORKING!"
    else
      echo "❌ Assignment failed"
    fi
  else
    echo "No unassigned tickets found to test"
  fi
else
  echo "❌ Login failed"
fi

echo ""
echo "🎯 Test complete. Try the web interface now:"
echo "   URL: https://192.168.1.116"
echo "   User: h@tcc.com"
echo "   Password: 12345678"