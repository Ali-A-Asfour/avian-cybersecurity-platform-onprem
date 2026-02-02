#!/bin/bash

echo "🔄 Restarting Application Container"
echo "=================================="
echo ""

# Prompt for password
echo -n "Enter your server password for user 'avian': "
read -s SERVER_PASSWORD
echo ""
echo ""

echo "🔄 Restarting container..."
./restart-app.exp "$SERVER_PASSWORD"

echo ""
echo "⏳ Waiting for application to start..."
sleep 15

echo "🧪 Testing the fix..."

# Test authentication
TOKEN=$(curl -k -s -X POST "https://192.168.1.115/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@avian.local","password":"admin123"}' | jq -r '.token' 2>/dev/null)

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo "✅ Authentication: WORKING"
    
    # Test tenants API
    echo "Testing tenants API..."
    TENANTS_RESULT=$(curl -k -s "https://192.168.1.115/api/tenants" -H "Authorization: Bearer $TOKEN")
    TENANTS_COUNT=$(echo "$TENANTS_RESULT" | jq -r '.meta.total' 2>/dev/null)
    
    if [ "$TENANTS_COUNT" != "null" ] && [ "$TENANTS_COUNT" -gt 0 ]; then
        echo "✅ Tenants API: WORKING! Found $TENANTS_COUNT tenants"
        echo "Tenant names:"
        echo "$TENANTS_RESULT" | jq -r '.data[].name' 2>/dev/null | sed 's/^/  - /'
    else
        echo "❌ Tenants API: Failed"
        echo "Response: $TENANTS_RESULT"
    fi
    
else
    echo "❌ Authentication failed"
fi

echo ""
echo "🎉 Restart completed!"
echo ""
echo "Next steps:"
echo "1. Open https://192.168.1.115 in your browser"
echo "2. Login with admin@avian.local / admin123"
echo "3. Look for the tenant switcher in the top right"
echo "4. You should now see all your test clients!"