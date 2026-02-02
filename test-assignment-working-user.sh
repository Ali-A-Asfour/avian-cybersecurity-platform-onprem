#!/bin/bash

# Test Ticket Assignment with Working User
echo "🎫 Testing ticket assignment with h@tcc.com..."

# Login and get token
TOKEN=$(curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"h@tcc.com","password":"12345678"}' \
  -k | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

echo "✅ Got token: ${TOKEN:0:20}..."

# Get tenant ID
TENANT_ID="85cfd918-8558-4baa-9534-25454aea76a8"

# Get unassigned tickets
echo "📋 Getting unassigned tickets..."
TICKETS_RESPONSE=$(curl -s -X GET 'https://localhost/api/help-desk/queue/unassigned' \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-selected-tenant-id: $TENANT_ID" \
  -k)

echo "Tickets response: $TICKETS_RESPONSE"

# Get a ticket ID to assign
TICKET_ID=$(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c "SELECT id FROM tickets WHERE status = 'new' AND assignee IS NULL LIMIT 1;" | tr -d ' ')

if [ -n "$TICKET_ID" ]; then
    echo "🎯 Testing assignment of ticket: $TICKET_ID"
    
    ASSIGN_RESPONSE=$(curl -s -X POST 'https://localhost/api/help-desk/queue/unassigned' \
      -H 'Content-Type: application/json' \
      -H "Authorization: Bearer $TOKEN" \
      -H "x-selected-tenant-id: $TENANT_ID" \
      -d "{\"ticketId\":\"$TICKET_ID\",\"assignee\":\"h@tcc.com\"}" \
      -k)
    
    echo "Assignment response: $ASSIGN_RESPONSE"
    
    # Check database
    echo "📊 Checking database result..."
    sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT id, title, status, assignee FROM tickets WHERE id = '$TICKET_ID';"
    
    if echo "$ASSIGN_RESPONSE" | grep -q '"success":true'; then
        echo "✅ TICKET ASSIGNMENT IS WORKING!"
        echo ""
        echo "🎉 SUCCESS! The fix is working."
        echo "   Login: h@tcc.com / 12345678"
        echo "   Go to Help Desk → Unassigned Queue"
        echo "   Click 'Assign to me' - it should work now!"
    else
        echo "❌ Assignment failed"
        echo "Error details: $ASSIGN_RESPONSE"
    fi
else
    echo "❌ No unassigned tickets found to test"
    echo "Creating a test ticket..."
    
    sudo docker exec avian-postgres-prod psql -U avian -d avian -c "
    INSERT INTO tickets (
      id, tenant_id, requester, title, description, severity, priority, status, tags, category, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      '$TENANT_ID',
      'test@example.com',
      'Test Assignment Ticket',
      'This ticket is for testing assignment',
      'medium',
      'medium', 
      'new',
      '[]'::jsonb,
      'it_support',
      NOW(),
      NOW()
    ) RETURNING id, title;
    "
    
    echo "Test ticket created. Run the script again."
fi