#!/bin/bash

# Test Assignment with Clean UUID Extraction
echo "🎫 Testing assignment with clean UUID extraction..."

# Login
TOKEN=$(curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"h@tcc.com","password":"12345678"}' \
  -k | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

TENANT_ID="85cfd918-8558-4baa-9534-25454aea76a8"

echo "1. Creating a clean test ticket..."
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "
INSERT INTO tickets (
  id, tenant_id, requester, title, description, severity, priority, status, tags, category, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '$TENANT_ID',
  'test@example.com',
  'Clean Test Ticket',
  'Testing assignment with clean UUID',
  'medium',
  'medium', 
  'new',
  '[]'::jsonb,
  'it_support',
  NOW(),
  NOW()
);
"

echo "2. Getting the ticket ID properly..."
DB_TICKET_ID=$(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c "SELECT id FROM tickets WHERE title = 'Clean Test Ticket' ORDER BY created_at DESC LIMIT 1;" | tr -d ' \n\r')

echo "✅ Clean ticket ID: '$DB_TICKET_ID'"

echo ""
echo "3. Testing assignment..."
ASSIGN_RESPONSE=$(curl -s -X POST 'https://localhost/api/help-desk/queue/unassigned' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-selected-tenant-id: $TENANT_ID" \
  -d "{\"ticketId\":\"$DB_TICKET_ID\",\"assignee\":\"h@tcc.com\"}" \
  -k)

echo "Assignment response: $ASSIGN_RESPONSE"

echo ""
echo "4. Checking result..."
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT id, title, status, assignee FROM tickets WHERE title = 'Clean Test Ticket';"

if echo "$ASSIGN_RESPONSE" | grep -q '"success":true'; then
    echo ""
    echo "✅ SUCCESS! Ticket assignment is working!"
    echo ""
    echo "🎉 The fix is complete!"
    echo "   Login: https://192.168.1.116"
    echo "   User: h@tcc.com / Password: 12345678"
    echo "   The 'Assign to me' button should work now!"
else
    echo ""
    echo "❌ Assignment failed"
    echo "Full response: '$ASSIGN_RESPONSE'"
    
    # Debug the API call
    echo ""
    echo "5. Debug info:"
    echo "Token length: ${#TOKEN}"
    echo "Ticket ID length: ${#DB_TICKET_ID}"
    echo "Tenant ID: $TENANT_ID"
fi