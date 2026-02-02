#!/bin/bash

echo "🎉 Server accessible at 192.168.1.116!"
echo ""

# Test login API
echo "🔐 Testing login API..."
LOGIN_RESPONSE=$(curl -k -s -X POST "https://192.168.1.116/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@avian.local","password":"admin123"}')

echo "Login response: $LOGIN_RESPONSE"

# Extract token if login successful
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty' 2>/dev/null)

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
  echo "✅ Login successful! Token obtained."
  
  echo ""
  echo "🧪 Testing API endpoints..."
  
  # Test users API
  echo "👥 Testing users API..."
  curl -k -s "https://192.168.1.116/api/users" -H "Authorization: Bearer $TOKEN" | jq '.success // "No success field"'
  
  # Test dashboard widgets API
  echo "📊 Testing dashboard widgets API..."
  curl -k -s "https://192.168.1.116/api/dashboard/widgets" -H "Authorization: Bearer $TOKEN" | jq '.success // "No success field"'
  
  # Test tickets API
  echo "🎫 Testing tickets API..."
  curl -k -s "https://192.168.1.116/api/tickets?limit=1" -H "Authorization: Bearer $TOKEN" | jq '.success // "No success field"'
  
else
  echo "❌ Login failed or no token received"
fi

echo ""
echo "🌐 Platform should be accessible at: https://192.168.1.116"
echo "🔑 Login credentials: admin@avian.local / admin123"