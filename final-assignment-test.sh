#!/bin/bash

# Final Assignment Test with Fixed Token
echo "🎫 Final assignment test..."

echo "1. Login and get token..."
LOGIN_RESPONSE=$(curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"h@tcc.com","password":"12345678"}' \
  -k)

echo "Login response: $LOGIN_RESPONSE"

# Extract token properly
TOKEN=$(echo "$LOGIN_RESPONSE" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

if [ -z "$TOKEN" ]; then
    echo "❌ Failed to get token"
    exit 1
fi

echo "✅ Token: ${TOKEN:0:50}..."

TENANT_ID="85cfd918-8558-4baa-9534-25454aea76a8"
TICKET_ID="30e1d6d5-2aa6-47f1-b82f-2c2d77d2deff"

echo ""
echo "2. Testing assignment..."
ASSIGN_RESPONSE=$(curl -s -X POST 'https://localhost/api/help-desk/queue/unassigned' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-selected-tenant-id: $TENANT_ID" \
  -d "{\"ticketId\":\"$TICKET_ID\",\"assignee\":\"h@tcc.com\"}" \
  -k)

echo "Assignment response: $ASSIGN_RESPONSE"

echo ""
echo "3. Checking database..."
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT id, title, status, assignee FROM tickets WHERE id = '$TICKET_ID';"

if echo "$ASSIGN_RESPONSE" | grep -q '"success":true'; then
    echo ""
    echo "🎉 SUCCESS! TICKET ASSIGNMENT IS WORKING!"
    echo ""
    echo "✅ The fix is complete. You can now test in the web interface:"
    echo "   URL: https://192.168.1.116"
    echo "   User: h@tcc.com"
    echo "   Password: 12345678"
    echo "   Go to Help Desk → Unassigned Queue"
    echo "   Click 'Assign to me' - it will work!"
else
    echo ""
    echo "❌ Still failing. Response: '$ASSIGN_RESPONSE'"
    
    # Check if it's an auth issue
    if echo "$ASSIGN_RESPONSE" | grep -q "UNAUTHORIZED"; then
        echo "Auth issue detected"
    elif [ -z "$ASSIGN_RESPONSE" ]; then
        echo "Empty response - possible server error"
    fi
fi