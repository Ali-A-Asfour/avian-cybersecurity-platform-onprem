#!/bin/bash

# Test Assignment with Actual Database Ticket
echo "🎫 Testing assignment with actual database ticket..."

# Login
TOKEN=$(curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"h@tcc.com","password":"12345678"}' \
  -k | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

TENANT_ID="85cfd918-8558-4baa-9534-25454aea76a8"

echo "1. Getting actual database tickets..."
DB_TICKET_ID=$(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c "SELECT id FROM tickets WHERE status = 'new' AND assignee IS NULL AND tenant_id = '$TENANT_ID' LIMIT 1;" | tr -d ' ')

if [ -z "$DB_TICKET_ID" ]; then
    echo "No unassigned tickets in database. Creating one..."
    DB_TICKET_ID=$(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c "
    INSERT INTO tickets (
      id, tenant_id, requester, title, description, severity, priority, status, tags, category, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      '$TENANT_ID',
      'test@example.com',
      'Database Test Ticket',
      'Testing assignment with database ticket',
      'medium',
      'medium', 
      'new',
      '[]'::jsonb,
      'it_support',
      NOW(),
      NOW()
    ) RETURNING id;
    " | tr -d ' ')
fi

echo "✅ Using database ticket: $DB_TICKET_ID"

echo ""
echo "2. Testing assignment..."
ASSIGN_RESPONSE=$(curl -s -X POST 'https://localhost/api/help-desk/queue/unassigned' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-selected-tenant-id: $TENANT_ID" \
  -d "{\"ticketId\":\"$DB_TICKET_ID\",\"assignee\":\"h@tcc.com\"}" \
  -k)

echo "Assignment response: $ASSIGN_RESPONSE"

echo ""
echo "3. Checking result..."
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT id, title, status, assignee FROM tickets WHERE id = '$DB_TICKET_ID';"

if echo "$ASSIGN_RESPONSE" | grep -q '"success":true'; then
    echo ""
    echo "✅ SUCCESS! Database ticket assignment works!"
    echo ""
    echo "🎉 The issue is that the web interface shows file-based tickets"
    echo "   but the assignment API expects database tickets."
    echo "   Need to fix the API to use the same ticket source."
else
    echo ""
    echo "❌ Assignment failed"
    echo "Response: $ASSIGN_RESPONSE"
fi