#!/bin/bash

# Test Ticket Assignment on Server
# Run this script on the server after deploying the fix

echo "🧪 Testing ticket assignment functionality on server..."

# Test login first
echo "1. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"h@tcc.com","password":"admin123"}' \
  -k)

echo "Login response: $LOGIN_RESPONSE"

# Extract token (if login successful)
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo "✅ Login successful"
  echo ""
  
  echo "2. Testing unassigned tickets API..."
  UNASSIGNED_RESPONSE=$(curl -s -X GET 'https://localhost/api/help-desk/queue/unassigned' \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-selected-tenant-id: 85cfd918-8558-4baa-9534-25454aea76a8" \
    -k)
  
  echo "Unassigned tickets: $UNASSIGNED_RESPONSE"
  echo ""
  
  echo "3. Testing ticket assignment..."
  ASSIGN_RESPONSE=$(curl -s -X POST 'https://localhost/api/tickets/assign' \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"ticketId":"test-ticket-1","assignee":"h@tcc.com"}' \
    -k)
  
  echo "Assignment response: $ASSIGN_RESPONSE"
  echo ""
  
  echo "4. Testing my tickets API..."
  MY_TICKETS_RESPONSE=$(curl -s -X GET 'https://localhost/api/help-desk/queue/my-tickets' \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-selected-tenant-id: 85cfd918-8558-4baa-9534-25454aea76a8" \
    -k)
  
  echo "My tickets response: $MY_TICKETS_RESPONSE"
  echo ""
  
  # Check if assignment was successful
  if echo "$ASSIGN_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Ticket assignment test PASSED"
  else
    echo "❌ Ticket assignment test FAILED"
  fi
  
  # Check if my tickets shows assigned tickets
  if echo "$MY_TICKETS_RESPONSE" | grep -q '"total":[1-9]'; then
    echo "✅ My tickets API test PASSED"
  else
    echo "❌ My tickets API test FAILED"
  fi
  
else
  echo "❌ Login failed, cannot test ticket assignment"
  echo "Please check if the user h@tcc.com exists in the database"
fi

echo ""
echo "🎯 Test complete. If all tests passed, the web interface should work correctly."