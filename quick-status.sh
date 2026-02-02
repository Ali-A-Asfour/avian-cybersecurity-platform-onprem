#!/bin/bash

echo "🔍 Quick Status Check"
echo "===================="
echo ""

echo -n "Enter your server password: "
read -s PASSWORD
echo ""

echo "Checking container status..."
./check-status.exp "$PASSWORD"

echo ""
echo "Testing login API..."
curl -k -s -X POST "https://192.168.1.115/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@avian.local","password":"admin123"}' | jq -r '.success // "failed"'

echo ""
echo "Testing main page..."
curl -k -s -o /dev/null -w "HTTP Status: %{http_code}\n" "https://192.168.1.115/"