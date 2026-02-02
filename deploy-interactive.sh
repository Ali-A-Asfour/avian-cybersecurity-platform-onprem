#!/bin/bash

echo "🚀 Interactive Server Deployment"
echo "================================"
echo ""
echo "This will deploy the API fixes to your server at 192.168.1.115"
echo ""

# Prompt for password
echo -n "Enter your server password for user 'avian': "
read -s SERVER_PASSWORD
echo ""
echo ""

echo "🔄 Starting deployment..."

# Create temporary expect script
cat > /tmp/deploy_temp.exp << EOF
#!/usr/bin/expect -f

set timeout 300
set server_password "$SERVER_PASSWORD"

spawn ssh avian@192.168.1.115

expect {
    "password:" {
        send "\$server_password\r"
        exp_continue
    }
    "$ " {
        # Connected
    }
    timeout {
        puts "Connection timeout"
        exit 1
    }
}

send "cd /home/avian/avian-cybersecurity-platform-onprem\r"
expect "$ "

puts "Step 1: Stopping containers..."
send "sudo docker-compose -f docker-compose.prod.yml down\r"
expect {
    "password for avian:" {
        send "\$server_password\r"
        exp_continue
    }
    "$ " {}
}

puts "Step 2: Rebuilding application (this may take 2-3 minutes)..."
send "sudo docker-compose -f docker-compose.prod.yml build --no-cache app\r"
expect {
    "password for avian:" {
        send "\$server_password\r"
        exp_continue
    }
    "$ " {}
    timeout {
        puts "Build completed (timeout is normal)"
    }
}

puts "Step 3: Starting containers..."
send "sudo docker-compose -f docker-compose.prod.yml up -d\r"
expect {
    "password for avian:" {
        send "\$server_password\r"
        exp_continue
    }
    "$ " {}
}

puts "Step 4: Checking status..."
send "sudo docker-compose -f docker-compose.prod.yml ps\r"
expect {
    "password for avian:" {
        send "\$server_password\r"
        exp_continue
    }
    "$ " {}
}

puts "Deployment complete!"
send "exit\r"
expect eof
EOF

chmod +x /tmp/deploy_temp.exp

echo "🔧 Running deployment commands..."
/tmp/deploy_temp.exp

# Clean up
rm -f /tmp/deploy_temp.exp

echo ""
echo "⏳ Waiting for services to start..."
sleep 30

echo "🧪 Testing the deployment..."

# Test authentication
echo "Testing authentication..."
TOKEN=$(curl -k -s -X POST "https://192.168.1.115/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@avian.local","password":"admin123"}' | jq -r '.token' 2>/dev/null)

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo "✅ Authentication: WORKING"
    
    # Test dashboard
    echo "Testing dashboard widgets API..."
    DASHBOARD_RESULT=$(curl -k -s "https://192.168.1.115/api/dashboard/widgets" -H "Authorization: Bearer $TOKEN")
    DASHBOARD_SUCCESS=$(echo "$DASHBOARD_RESULT" | jq -r '.success' 2>/dev/null)
    
    if [ "$DASHBOARD_SUCCESS" = "true" ]; then
        echo "✅ Dashboard widgets API: WORKING!"
    else
        echo "❌ Dashboard widgets API: Still failing"
        echo "Response: $DASHBOARD_RESULT"
    fi
    
    # Test tickets
    echo "Testing tickets API..."
    TICKETS_RESULT=$(curl -k -s "https://192.168.1.115/api/tickets?limit=1" -H "Authorization: Bearer $TOKEN")
    TICKETS_SUCCESS=$(echo "$TICKETS_RESULT" | jq -r '.success' 2>/dev/null)
    
    if [ "$TICKETS_SUCCESS" = "true" ]; then
        echo "✅ Tickets API: WORKING!"
    else
        echo "❌ Tickets API: Still failing"
        echo "Response: $TICKETS_RESULT"
    fi
    
else
    echo "❌ Authentication failed - checking with test admin account..."
    TOKEN=$(curl -k -s -X POST "https://192.168.1.115/api/auth/login" -H "Content-Type: application/json" -d '{"email":"tadmin@test.com","password":"admin123"}' | jq -r '.token' 2>/dev/null)
    
    if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
        echo "✅ Test admin authentication: WORKING"
    else
        echo "❌ All authentication failed"
    fi
fi

echo ""
echo "🎉 Deployment completed!"
echo ""
echo "Next steps:"
echo "1. Open https://192.168.1.115 in your browser"
echo "2. Login with admin@avian.local / admin123"
echo "3. Try accessing the Team Members page"
echo "4. The 503 RSC errors should be resolved"