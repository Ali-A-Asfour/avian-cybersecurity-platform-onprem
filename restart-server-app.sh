#!/bin/bash

# Restart Server Application
# Run this to restart the application after applying the fix

SERVER_IP="192.168.1.116"
SERVER_USER="avian"

echo "🔄 Restarting application on server..."

ssh $SERVER_USER@$SERVER_IP "
    cd /home/avian/avian-cybersecurity-platform-onprem
    echo '🛑 Stopping application...'
    sudo docker-compose down
    echo '🚀 Starting application...'
    sudo docker-compose up -d --build
    echo '✅ Application restarted'
"

echo "⏳ Waiting 30 seconds for application to start..."
sleep 30

echo "🧪 Testing the application..."

# Test login
LOGIN_RESPONSE=$(ssh $SERVER_USER@$SERVER_IP "
    curl -s -X POST http://localhost:3000/api/auth/login \
      -H 'Content-Type: application/json' \
      -d '{\"email\": \"h@tcc.com\", \"password\": \"12345678\"}'
")

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Login test: SUCCESS"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
    echo "❌ Login test: FAILED"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

# Test my tickets API
MY_TICKETS_RESPONSE=$(ssh $SERVER_USER@$SERVER_IP "
    curl -s -X GET 'http://localhost:3000/api/help-desk/queue/my-tickets' \
      -H 'Authorization: Bearer $TOKEN'
")

if echo "$MY_TICKETS_RESPONSE" | grep -q '"success":true'; then
    TICKET_COUNT=$(echo "$MY_TICKETS_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    echo "✅ My Tickets API: SUCCESS (found $TICKET_COUNT assigned tickets)"
else
    echo "❌ My Tickets API: FAILED"
    echo "Response: $MY_TICKETS_RESPONSE"
    exit 1
fi

echo ""
echo "🎉 Server application restarted and tested successfully!"
echo "🌐 Ready for testing at: http://$SERVER_IP:3000"
echo "🔑 Login: h@tcc.com / 12345678"