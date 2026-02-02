#!/bin/bash

# Check Assignment Logs
echo "📋 Checking application logs for assignment errors..."

echo "=== Recent Application Logs ==="
sudo docker logs avian-app-prod --tail 20

echo ""
echo "=== Testing assignment with verbose output ==="
TOKEN=$(curl -s -X POST 'https://localhost/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"h@tcc.com","password":"12345678"}' \
  -k | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

curl -v -X POST 'https://localhost/api/help-desk/queue/unassigned' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-selected-tenant-id: 85cfd918-8558-4baa-9534-25454aea76a8" \
  -d '{"ticketId":"30e1d6d5-2aa6-47f1-b82f-2c2d77d2deff","assignee":"h@tcc.com"}' \
  -k

echo ""
echo ""
echo "=== Application Logs After Request ==="
sudo docker logs avian-app-prod --tail 10