#!/bin/bash

echo "🔧 FIXING DATA SOURCE MISMATCH"
echo "=============================="

echo "Problem: Web interface shows file-based tickets but APIs expect database tickets"
echo ""

echo "1. What tickets does the web interface show?"
TOKEN=$(curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"h@tcc.com","password":"12345678"}' \
  -k | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

TICKETS_RESPONSE=$(curl -s -X GET 'https://localhost/api/help-desk/queue/unassigned' \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-selected-tenant-id: 85cfd918-8558-4baa-9534-25454aea76a8" \
  -k)

echo "API returns these ticket IDs:"
echo "$TICKETS_RESPONSE" | grep -o '"id":"[^"]*"' | head -3

echo ""
echo "2. What tickets are in the database?"
echo "Database has these ticket IDs:"
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT id FROM tickets LIMIT 3;"

echo ""
echo "3. THE PROBLEM:"
echo "   - API returns: ticket-esr-test-12345 (file-based)"
echo "   - Database has: UUID tickets"
echo "   - Assignment API expects database UUIDs"
echo ""
echo "4. SOLUTION:"
echo "   The TicketService.getUnassignedTickets() is returning file-based tickets"
echo "   instead of database tickets. Need to fix this."