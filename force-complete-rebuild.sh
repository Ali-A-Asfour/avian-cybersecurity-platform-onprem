#!/bin/bash

echo "🔧 Force Complete Rebuild with All Fixes"
echo "========================================"
echo ""

echo -n "Enter your server password: "
read -s PASSWORD
echo ""

# Create expect script for complete rebuild
cat > /tmp/complete_rebuild.exp << EOF
#!/usr/bin/expect -f

set timeout 600
set server_password "$PASSWORD"

spawn ssh avian@192.168.1.115

expect "password:"
send "\$server_password\r"

expect "$ "
send "cd /home/avian/avian-cybersecurity-platform-onprem\r"

expect "$ "
send "echo 'Step 1: Stopping all containers...'\r"

expect "$ "
send "sudo docker-compose -f docker-compose.prod.yml down\r"

expect "password for avian:"
send "\$server_password\r"

expect "$ "
send "echo 'Step 2: Removing old app image...'\r"

expect "$ "
send "sudo docker rmi avian-cybersecurity-platform-onprem-app || true\r"

expect "password for avian:"
send "\$server_password\r"

expect "$ "
send "echo 'Step 3: Building fresh app container (this will take 3-4 minutes)...'\r"

expect "$ "
send "sudo docker-compose -f docker-compose.prod.yml build --no-cache app\r"

expect "password for avian:"
send "\$server_password\r"

expect "$ "
send "echo 'Step 4: Starting all containers...'\r"

expect "$ "
send "sudo docker-compose -f docker-compose.prod.yml up -d\r"

expect "password for avian:"
send "\$server_password\r"

expect "$ "
send "echo 'Step 5: Waiting for services to be ready...'\r"

expect "$ "
send "sleep 30\r"

expect "$ "
send "echo 'Step 6: Checking container status...'\r"

expect "$ "
send "sudo docker-compose -f docker-compose.prod.yml ps\r"

expect "password for avian:"
send "\$server_password\r"

expect "$ "
send "echo 'Rebuild complete!'\r"

expect "$ "
send "exit\r"
expect eof
EOF

chmod +x /tmp/complete_rebuild.exp

echo "🔄 Running complete rebuild (this will take 4-5 minutes)..."
/tmp/complete_rebuild.exp

rm -f /tmp/complete_rebuild.exp

echo ""
echo "⏳ Waiting for services to fully start..."
sleep 30

echo "🧪 Testing the fixes..."

# Test login
echo "Testing login API..."
LOGIN_RESULT=$(curl -k -s -X POST "https://192.168.1.115/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@avian.local","password":"admin123"}')
LOGIN_SUCCESS=$(echo "$LOGIN_RESULT" | jq -r '.success // false')

if [ "$LOGIN_SUCCESS" = "true" ]; then
    echo "✅ Login API: Working"
    
    # Get token and test tenants API
    TOKEN=$(echo "$LOGIN_RESULT" | jq -r '.token')
    echo "Testing tenants API with auth..."
    TENANTS_RESULT=$(curl -k -s "https://192.168.1.115/api/tenants" -H "Authorization: Bearer $TOKEN")
    TENANTS_SUCCESS=$(echo "$TENANTS_RESULT" | jq -r '.success // false')
    
    if [ "$TENANTS_SUCCESS" = "true" ]; then
        echo "✅ Tenants API: Working with authentication"
        TENANT_COUNT=$(echo "$TENANTS_RESULT" | jq -r '.meta.total // 0')
        echo "   Found $TENANT_COUNT tenants"
    else
        echo "❌ Tenants API: Still failing"
        echo "   Response: $TENANTS_RESULT"
    fi
    
    # Test dashboard API
    echo "Testing dashboard API..."
    DASHBOARD_RESULT=$(curl -k -s "https://192.168.1.115/api/dashboard" -H "Authorization: Bearer $TOKEN")
    DASHBOARD_SUCCESS=$(echo "$DASHBOARD_RESULT" | jq -r '.success // false')
    
    if [ "$DASHBOARD_SUCCESS" = "true" ]; then
        echo "✅ Dashboard API: Working"
    else
        echo "❌ Dashboard API: Still failing"
        echo "   Response: $DASHBOARD_RESULT"
    fi
    
else
    echo "❌ Login API: Failed"
    echo "   Response: $LOGIN_RESULT"
fi

echo ""
echo "🎉 Complete rebuild finished!"
echo ""
echo "Now try:"
echo "1. Clear your browser cache completely (Ctrl+Shift+Delete)"
echo "2. Go to https://192.168.1.115/login"
echo "3. Login with admin@avian.local / admin123"
echo "4. The 401 errors and dashboard errors should be fixed!"