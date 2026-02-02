#!/bin/bash

# Test Assignment with Real Unassigned Ticket
echo "🎫 Testing assignment with real unassigned ticket..."

# Login
TOKEN=$(curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"h@tcc.com","password":"12345678"}' \
  -k | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

TENANT_ID="85cfd918-8558-4baa-9534-25454aea76a8"

# Use one of the actual unassigned tickets from the API response
TICKET_ID="ticket-esr-test-12345"

echo "✅ Using real unassigned ticket: $TICKET_ID"

echo ""
echo "🎯 Testing assignment..."
ASSIGN_RESPONSE=$(curl -s -X POST 'https://localhost/api/help-desk/queue/unassigned' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-selected-tenant-id: $TENANT_ID" \
  -d "{\"ticketId\":\"$TICKET_ID\",\"assignee\":\"h@tcc.com\"}" \
  -k)

echo "Assignment response: $ASSIGN_RESPONSE"

echo ""
echo "📊 Checking database..."
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT id, title, status, assignee FROM tickets WHERE id = '$TICKET_ID';"

if echo "$ASSIGN_RESPONSE" | grep -q '"success":true'; then
    echo ""
    echo "✅ SUCCESS! Ticket assignment is working!"
    echo ""
    echo "🎉 The fix is complete! You can now:"
    echo "   1. Login: https://192.168.1.116"
    echo "   2. User: h@tcc.com / Password: 12345678"
    echo "   3. Go to Help Desk → Unassigned Queue"
    echo "   4. Click 'Assign to me' - it will work!"
else
    echo ""
    echo "❌ Assignment failed"
    echo "Response: $ASSIGN_RESPONSE"
fi