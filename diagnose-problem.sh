#!/bin/bash

echo "🔍 DIAGNOSING THE TICKET ASSIGNMENT PROBLEM"
echo "=========================================="

echo ""
echo "1. CHECKING WEB INTERFACE ACCESS"
echo "Login: https://192.168.1.116"
echo "User: h@tcc.com / Password: 12345678"

echo ""
echo "2. CHECKING WHAT THE WEB INTERFACE CALLS"
echo "When you click 'Assign to me', what API does it call?"

# Check the frontend component
echo ""
echo "3. FRONTEND COMPONENT CHECK"
echo "The UnassignedTicketQueue component should call:"
echo "POST /api/help-desk/queue/unassigned"

echo ""
echo "4. TESTING THE ACTUAL API CALL"
TOKEN=$(curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"h@tcc.com","password":"12345678"}' \
  -k | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

if [ -n "$TOKEN" ]; then
    echo "✅ Login works, got token"
    
    echo ""
    echo "5. TESTING GET UNASSIGNED TICKETS"
    GET_RESPONSE=$(curl -s -X GET 'https://localhost/api/help-desk/queue/unassigned' \
      -H "Authorization: Bearer $TOKEN" \
      -H "x-selected-tenant-id: 85cfd918-8558-4baa-9534-25454aea76a8" \
      -k)
    
    if echo "$GET_RESPONSE" | grep -q '"success":true'; then
        echo "✅ GET unassigned tickets works"
        echo "Tickets found: $(echo "$GET_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2)"
    else
        echo "❌ GET unassigned tickets fails"
        echo "Response: $GET_RESPONSE"
    fi
    
    echo ""
    echo "6. TESTING POST ASSIGNMENT"
    POST_RESPONSE=$(curl -s -X POST 'https://localhost/api/help-desk/queue/unassigned' \
      -H 'Content-Type: application/json' \
      -H "Authorization: Bearer $TOKEN" \
      -H "x-selected-tenant-id: 85cfd918-8558-4baa-9534-25454aea76a8" \
      -d '{"ticketId":"test","assignee":"h@tcc.com"}' \
      -k)
    
    if [ -n "$POST_RESPONSE" ]; then
        echo "✅ POST endpoint responds"
        echo "Response: $POST_RESPONSE"
    else
        echo "❌ POST endpoint returns empty response"
        echo "This is the problem!"
    fi
else
    echo "❌ Login fails"
fi

echo ""
echo "7. SUMMARY"
echo "The problem is likely:"
echo "- POST method not implemented on /api/help-desk/queue/unassigned"
echo "- OR server error in the POST handler"
echo "- OR routing issue"