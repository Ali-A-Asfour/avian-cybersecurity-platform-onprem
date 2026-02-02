#!/bin/bash

# Test Ticket Assignment - Fixed Token Handling
echo "🎫 Testing ticket assignment with proper token handling..."

# Login and get full response
echo "1. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"h@tcc.com","password":"12345678"}' \
  -k)

echo "Login response: $LOGIN_RESPONSE"

# Extract token properly
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Failed to extract token"
    exit 1
fi

echo "✅ Token extracted: ${TOKEN:0:50}..."

# Test with the token
TENANT_ID="85cfd918-8558-4baa-9534-25454aea76a8"
TICKET_ID="21ca7233-5cf3-49d8-9013-6dc444d8a6f4"

echo ""
echo "2. Testing GET unassigned tickets..."
curl -s -X GET 'https://localhost/api/help-desk/queue/unassigned' \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-selected-tenant-id: $TENANT_ID" \
  -k

echo ""
echo ""
echo "3. Testing POST assignment..."
ASSIGN_RESPONSE=$(curl -s -X POST 'https://localhost/api/help-desk/queue/unassigned' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-selected-tenant-id: $TENANT_ID" \
  -d "{\"ticketId\":\"$TICKET_ID\",\"assignee\":\"h@tcc.com\"}" \
  -k)

echo "Assignment response: $ASSIGN_RESPONSE"

echo ""
echo "4. Checking database..."
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT id, title, status, assignee FROM tickets WHERE id = '$TICKET_ID';"

if echo "$ASSIGN_RESPONSE" | grep -q '"success":true'; then
    echo ""
    echo "✅ SUCCESS! Ticket assignment is working!"
    echo "🎉 You can now test in the web interface:"
    echo "   URL: https://192.168.1.116"
    echo "   User: h@tcc.com"
    echo "   Password: 12345678"
else
    echo ""
    echo "❌ Assignment failed"
fi