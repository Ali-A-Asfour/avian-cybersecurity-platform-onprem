#!/bin/bash

echo "🔧 Fixing Nginx Container"
echo "========================"
echo ""

echo -n "Enter your server password: "
read -s PASSWORD
echo ""

echo "Restarting nginx container..."
./restart-nginx.exp "$PASSWORD"

echo ""
echo "Testing after nginx restart..."
sleep 5

echo "Testing main page..."
MAIN_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://192.168.1.115/")
echo "Main page status: $MAIN_STATUS"

echo "Testing login page..."
LOGIN_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://192.168.1.115/login")
echo "Login page status: $LOGIN_STATUS"

if [ "$MAIN_STATUS" = "200" ] && [ "$LOGIN_STATUS" = "200" ]; then
    echo "✅ Nginx is working properly!"
    echo ""
    echo "Now try:"
    echo "1. Go to https://192.168.1.115"
    echo "2. Clear your browser cache (Ctrl+Shift+R or Cmd+Shift+R)"
    echo "3. Login with admin@avian.local / admin123"
    echo "4. Check browser console for [Header] debug logs"
else
    echo "❌ Still having issues. Status codes: Main=$MAIN_STATUS, Login=$LOGIN_STATUS"
fi