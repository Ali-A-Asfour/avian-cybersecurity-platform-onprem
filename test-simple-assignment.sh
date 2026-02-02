#!/bin/bash

# Test Simple Assignment on Server
echo "🧪 Testing simple ticket assignment..."

# Get the test ticket ID
TICKET_ID=$(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c "SELECT id FROM tickets WHERE title = 'Test Ticket Assignment' ORDER BY created_at DESC LIMIT 1;" | tr -d ' ')

echo "Test ticket ID: $TICKET_ID"

echo ""
echo "1. Testing GET endpoint..."
curl -X GET 'https://localhost/api/tickets/test-assign' -k -s

echo ""
echo ""
echo "2. Testing POST assignment..."
curl -X POST 'https://localhost/api/tickets/test-assign' \
  -H 'Content-Type: application/json' \
  -d "{\"ticketId\":\"$TICKET_ID\",\"assignee\":\"test@example.com\"}" \
  -k -s

echo ""
echo ""
echo "3. Checking database after assignment..."
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT id, title, status, assignee FROM tickets WHERE id = '$TICKET_ID';"