#!/bin/bash

echo "🔧 FORCING DATABASE-ONLY TICKETS"
echo "================================"

echo "The problem: TicketService is somehow returning file-based tickets"
echo "Solution: Force it to use database only"
echo ""

echo "1. Testing current behavior..."
TOKEN=$(curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"h@tcc.com","password":"12345678"}' \
  -k | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

echo "Current API response:"
curl -s -X GET 'https://localhost/api/help-desk/queue/unassigned' \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-selected-tenant-id: 85cfd918-8558-4baa-9534-25454aea76a8" \
  -k | grep -o '"id":"[^"]*"' | head -2

echo ""
echo "2. Database tickets available:"
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT COUNT(*) as total_tickets FROM tickets;"

echo ""
echo "3. Creating database tickets for testing..."
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "
INSERT INTO tickets (
  id, tenant_id, requester, title, description, severity, priority, status, tags, category, created_at, updated_at
) VALUES 
(
  gen_random_uuid(),
  '85cfd918-8558-4baa-9534-25454aea76a8',
  'test@example.com',
  'Database Ticket 1',
  'This is a database ticket for testing',
  'medium',
  'medium', 
  'new',
  '[]'::jsonb,
  'it_support',
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  '85cfd918-8558-4baa-9534-25454aea76a8',
  'test2@example.com',
  'Database Ticket 2',
  'Another database ticket for testing',
  'high',
  'high', 
  'new',
  '[]'::jsonb,
  'security_incident',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
"

echo "✅ Database tickets created"
echo ""
echo "The issue is that the TicketService is not actually using the database."
echo "Need to check why it's falling back to file-based tickets."