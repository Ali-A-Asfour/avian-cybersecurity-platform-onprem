#!/bin/bash

echo "🔧 SIMPLE FIX: Make assignment work with displayed tickets"
echo "========================================================"

echo "Problem: Web shows ticket IDs like 'ticket-esr-test-12345'"
echo "         But assignment API expects database UUIDs"
echo ""
echo "Solution: Create assignment API that works with ANY ticket ID"
echo ""

# Test what tickets are actually shown
TOKEN=$(curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"h@tcc.com","password":"12345678"}' \
  -k | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

echo "1. What tickets does the web interface show?"
TICKETS=$(curl -s -X GET 'https://localhost/api/help-desk/queue/unassigned' \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-selected-tenant-id: 85cfd918-8558-4baa-9534-25454aea76a8" \
  -k | grep -o '"id":"[^"]*"' | head -3)

echo "Web interface shows these tickets:"
echo "$TICKETS"

echo ""
echo "2. Testing assignment with one of these tickets..."
FIRST_TICKET=$(echo "$TICKETS" | head -1 | cut -d'"' -f4)

if [ -n "$FIRST_TICKET" ]; then
    echo "Testing assignment of: $FIRST_TICKET"
    
    # Test the direct assignment API
    RESULT=$(curl -s -X POST 'https://localhost/api/tickets/assign-direct' \
      -H 'Content-Type: application/json' \
      -H "Authorization: Bearer $TOKEN" \
      -d "{\"ticketId\":\"$FIRST_TICKET\",\"assignee\":\"h@tcc.com\"}" \
      -k)
    
    echo "Assignment result: $RESULT"
    
    if echo "$RESULT" | grep -q '"success":true'; then
        echo "✅ SUCCESS! Assignment works!"
    else
        echo "❌ Assignment failed - need to fix the API"
    fi
else
    echo "No tickets found"
fi

echo ""
echo "Next step: Fix the assignment API to handle the ticket IDs that are actually displayed"