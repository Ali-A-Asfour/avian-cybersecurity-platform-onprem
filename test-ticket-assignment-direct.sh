#!/bin/bash

# Test Ticket Assignment Directly on Server
echo "🎫 Testing ticket assignment on server..."

# Create a test ticket in the database
echo "1. Creating test ticket..."
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "
INSERT INTO tickets (
  id, tenant_id, requester, title, description, severity, priority, status, tags, category, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM tenants LIMIT 1),
  'test@example.com',
  'Test Ticket Assignment',
  'Testing the assign to me functionality',
  'medium',
  'medium', 
  'new',
  '[]'::jsonb,
  'it_support',
  NOW(),
  NOW()
) RETURNING id, title, status, assignee;
"

echo ""
echo "2. Testing assignment API directly..."

# Test the assignment API with a simple curl call
TICKET_ID=$(sudo docker exec avian-postgres-prod psql -U avian -d avian -t -c "SELECT id FROM tickets WHERE title = 'Test Ticket Assignment' ORDER BY created_at DESC LIMIT 1;" | tr -d ' ')

echo "Test ticket ID: $TICKET_ID"

# Test assignment without authentication first to see the API response
curl -X POST 'https://localhost/api/tickets/assign' \
  -H 'Content-Type: application/json' \
  -d "{\"ticketId\":\"$TICKET_ID\",\"assignee\":\"test@example.com\"}" \
  -k -v

echo ""
echo "3. Checking ticket after assignment attempt..."
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT id, title, status, assignee FROM tickets WHERE id = '$TICKET_ID';"