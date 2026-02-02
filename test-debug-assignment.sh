#!/bin/bash

# Test Debug Assignment on Server
echo "🔧 Testing debug ticket assignment..."

# Get the test ticket ID
TICKET_ID=$(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c "SELECT id FROM tickets WHERE title = 'Test Ticket Assignment' ORDER BY created_at DESC LIMIT 1;" | tr -d ' ')

echo "Test ticket ID: $TICKET_ID"

echo ""
echo "1. Testing debug GET endpoint..."
curl -X GET 'https://localhost/api/debug-ticket' -k -s | jq . 2>/dev/null || curl -X GET 'https://localhost/api/debug-ticket' -k -s

echo ""
echo ""
echo "2. Testing debug POST assignment..."
curl -X POST 'https://localhost/api/debug-ticket' \
  -H 'Content-Type: application/json' \
  -d "{\"ticketId\":\"$TICKET_ID\",\"assignee\":\"debug@example.com\"}" \
  -k -s | jq . 2>/dev/null || curl -X POST 'https://localhost/api/debug-ticket' \
  -H 'Content-Type: application/json' \
  -d "{\"ticketId\":\"$TICKET_ID\",\"assignee\":\"debug@example.com\"}" \
  -k -s

echo ""
echo ""
echo "3. Checking database after debug assignment..."
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT id, title, status, assignee FROM tickets WHERE id = '$TICKET_ID';"