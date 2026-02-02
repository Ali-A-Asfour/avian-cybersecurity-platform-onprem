#!/bin/bash

# Debug User Creation Issue
# This script helps diagnose the user creation database error

echo "🔍 Debugging user creation issue..."

# Test API directly to see the exact error
echo "📡 Testing user creation API..."
curl -k "https://192.168.1.116/api/users" -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(curl -k -s -X POST "https://192.168.1.116/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@avian.local","password":"admin123"}' | jq -r '.token')" \
  -d '{
    "email": "test.user@test.com",
    "first_name": "Test",
    "last_name": "User", 
    "password": "admin123",
    "role": "security_analyst",
    "tenant_id": "85cfd918-8558-4baa-9534-25454aea76a8"
  }' | jq '.'

echo ""
echo "🗄️ Checking database schema..."
echo "User role enum values:"
curl -k -s "https://192.168.1.116" > /dev/null && echo "Server is accessible" || echo "Server not accessible"