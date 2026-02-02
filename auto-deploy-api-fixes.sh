#!/bin/bash

# Automated API Fixes Deployment
# Date: January 25, 2026

echo "🚀 Starting automated deployment of API fixes..."

# Deploy to server with automated commands
ssh -o StrictHostKeyChecking=no avian@192.168.1.115 << 'EOF'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "🛑 Stopping containers..."
sudo docker-compose -f docker-compose.prod.yml down

echo "🔨 Rebuilding application with no cache..."
sudo docker-compose -f docker-compose.prod.yml build --no-cache app

echo "🚀 Starting containers..."
sudo docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for services to start..."
sleep 30

echo "✅ Deployment complete!"
echo "🌐 Platform available at: https://192.168.1.115"

echo "🔍 Checking container status..."
sudo docker-compose -f docker-compose.prod.yml ps

EOF

echo ""
echo "🧪 Testing deployed endpoints..."

# Wait a bit more for services to fully start
sleep 10

# Get fresh token and test endpoints
echo "Getting authentication token..."
TOKEN=$(curl -k -s -X POST "https://192.168.1.115/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@avian.local","password":"admin123"}' | jq -r '.token' 2>/dev/null)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo "Trying tadmin account..."
    TOKEN=$(curl -k -s -X POST "https://192.168.1.115/api/auth/login" -H "Content-Type: application/json" -d '{"email":"tadmin@test.com","password":"admin123"}' | jq -r '.token' 2>/dev/null)
fi

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo "✅ Authentication successful"
    
    echo "Testing dashboard widgets API..."
    DASHBOARD_STATUS=$(curl -k -s "https://192.168.1.115/api/dashboard/widgets" -H "Authorization: Bearer $TOKEN" -w "%{http_code}" -o /dev/null)
    if [ "$DASHBOARD_STATUS" = "200" ]; then
        echo "✅ Dashboard widgets API: Working ($DASHBOARD_STATUS)"
    else
        echo "❌ Dashboard widgets API: Failed ($DASHBOARD_STATUS)"
    fi
    
    echo "Testing tickets API..."
    TICKETS_STATUS=$(curl -k -s "https://192.168.1.115/api/tickets?limit=1" -H "Authorization: Bearer $TOKEN" -w "%{http_code}" -o /dev/null)
    if [ "$TICKETS_STATUS" = "200" ]; then
        echo "✅ Tickets API: Working ($TICKETS_STATUS)"
    else
        echo "❌ Tickets API: Failed ($TICKETS_STATUS)"
    fi
    
    echo "Testing team members page..."
    USERS_STATUS=$(curl -k -s "https://192.168.1.115/api/users" -H "Authorization: Bearer $TOKEN" -w "%{http_code}" -o /dev/null)
    if [ "$USERS_STATUS" = "200" ]; then
        echo "✅ Users API: Working ($USERS_STATUS)"
    else
        echo "❌ Users API: Failed ($USERS_STATUS)"
    fi
    
else
    echo "❌ Could not get authentication token"
fi

echo ""
echo "🎉 Deployment completed!"
echo ""
echo "🧪 Test the platform:"
echo "1. Navigate to: https://192.168.1.115"
echo "2. Login with: admin@avian.local / admin123 (or tadmin@test.com / admin123)"
echo "3. Try accessing Team Members page"
echo "4. Check that dashboard loads with widgets"
echo "5. Verify no more 'Application error' messages"