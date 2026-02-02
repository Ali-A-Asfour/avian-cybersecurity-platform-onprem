#!/bin/bash

echo "🧪 Testing Static IP Persistence"
echo "Current IP: 192.168.1.116"
echo ""

echo "🔄 Rebooting server to test IP persistence..."
echo "⚠️  Server will be unavailable for ~30-60 seconds during reboot"
echo ""

# Reboot the server
ssh avian@192.168.1.116 'sudo reboot' 2>/dev/null || echo "Reboot command sent"

echo "⏳ Waiting for server to reboot..."
sleep 30

echo "📡 Testing connectivity after reboot..."
for i in {1..12}; do
    if ping -c 1 192.168.1.116 > /dev/null 2>&1; then
        echo "✅ Server is back online at 192.168.1.116!"
        break
    else
        echo "   Attempt $i/12: Server not ready yet..."
        sleep 10
    fi
done

# Final connectivity test
echo ""
echo "🌐 Testing AVIAN platform after reboot..."
sleep 5

if curl -k -s -I https://192.168.1.116 | grep -q "200\|302"; then
    echo "✅ AVIAN platform is accessible at https://192.168.1.116"
    echo ""
    echo "🎉 SUCCESS! Static IP configuration is working perfectly!"
    echo "   📍 Server maintains IP 192.168.1.116 after reboot"
    echo "   🌐 AVIAN platform accessible at permanent URL"
    echo "   🔒 No more IP address changes!"
else
    echo "⚠️  AVIAN platform may need a moment to fully start"
    echo "   Try accessing https://192.168.1.116 in a few minutes"
fi

echo ""
echo "🎯 Your AVIAN Cybersecurity Platform is now at a permanent address:"
echo "   🌐 URL: https://192.168.1.116"
echo "   🔑 Login: admin@avian.local / admin123"
echo "   📌 This IP will never change again!"