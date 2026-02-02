#!/bin/bash

# Debug Ticket Source Issue
echo "🔍 Debugging ticket source..."

echo "1. Checking database tickets..."
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT id, title, status, assignee FROM tickets LIMIT 5;"

echo ""
echo "2. Checking what API returns..."
TOKEN=$(curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"h@tcc.com","password":"12345678"}' \
  -k | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

curl -s -X GET 'https://localhost/api/help-desk/queue/unassigned' \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-selected-tenant-id: 85cfd918-8558-4baa-9534-25454aea76a8" \
  -k | head -c 500

echo ""
echo ""
echo "🔧 The issue: API returns file-based tickets, but database has UUID tickets"
echo "Need to fix TicketService to use database instead of files"