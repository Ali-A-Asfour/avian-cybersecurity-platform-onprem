#!/bin/bash

echo "🔧 Checking and Restarting Server"
echo "================================="
echo ""

echo -n "Enter your server password: "
read -s PASSWORD
echo ""

echo "🔍 Checking server status..."
./check-server-status.exp "$PASSWORD"

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 15

echo "🧪 Testing server response..."
for i in {1..5}; do
    STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://192.168.1.115/" 2>/dev/null)
    echo "Attempt $i: HTTP $STATUS"
    
    if [ "$STATUS" = "200" ]; then
        echo "✅ Server is back online!"
        echo ""
        echo "You can now:"
        echo "1. Go to https://192.168.1.115"
        echo "2. Clear your browser cache (Ctrl+Shift+R)"
        echo "3. Login and test the fixes"
        exit 0
    fi
    
    if [ $i -lt 5 ]; then
        echo "   Waiting 10 seconds..."
        sleep 10
    fi
done

echo "❌ Server still not responding after 5 attempts"
echo "The containers might need more time to start or there could be an issue"