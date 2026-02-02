#!/bin/bash

# Test Assignment Using Working API Endpoint
echo "🎫 Testing ticket assignment using existing working API..."

# Get the test ticket ID
TICKET_ID=$(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c "SELECT id FROM tickets WHERE title = 'Test Ticket Assignment' ORDER BY created_at DESC LIMIT 1;" | tr -d ' ')

echo "Test ticket ID: $TICKET_ID"

echo ""
echo "1. Testing GET unassigned tickets (should work)..."
curl -X GET 'https://localhost/api/help-desk/queue/unassigned' \
  -H 'Authorization: Bearer fake-token-for-testing' \
  -k -s | head -c 200

echo ""
echo ""
echo "2. Testing POST assignment to same endpoint..."
curl -X POST 'https://localhost/api/help-desk/queue/unassigned' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer fake-token-for-testing' \
  -d "{\"ticketId\":\"$TICKET_ID\",\"assignee\":\"test@example.com\"}" \
  -k -s | head -c 200

echo ""
echo ""
echo "3. Checking database after assignment..."
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT id, title, status, assignee FROM tickets WHERE id = '$TICKET_ID';"