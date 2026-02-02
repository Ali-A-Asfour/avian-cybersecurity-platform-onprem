#!/bin/bash

echo "🔍 Getting server MAC address for DHCP reservation..."
echo ""

# Get MAC address from server
echo "📡 Connecting to server to get MAC address..."
MAC_INFO=$(ssh avian@192.168.1.116 "ip addr show | grep -A 1 'state UP' | grep 'link/ether'" 2>/dev/null)

if [ -n "$MAC_INFO" ]; then
    echo "✅ Found network interface information:"
    echo "$MAC_INFO"
    echo ""
    
    # Extract just the MAC address
    MAC_ADDRESS=$(echo "$MAC_INFO" | awk '{print $2}' | head -1)
    echo "🏷️  MAC Address: $MAC_ADDRESS"
    echo ""
    echo "📋 DHCP Reservation Settings:"
    echo "   Device Name: AVIAN-Server"
    echo "   MAC Address: $MAC_ADDRESS"
    echo "   Reserved IP: 192.168.1.116"
    echo ""
    echo "🌐 Use these settings in your router's DHCP reservation configuration"
else
    echo "❌ Could not connect to server or get MAC address"
    echo ""
    echo "🔧 Manual method:"
    echo "1. SSH to server: ssh avian@192.168.1.116"
    echo "2. Run command: ip addr show | grep -A 1 'state UP'"
    echo "3. Look for 'link/ether XX:XX:XX:XX:XX:XX'"
fi

echo ""
echo "📖 See dhcp-reservation-guide.md for detailed router configuration steps"