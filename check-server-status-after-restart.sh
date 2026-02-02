#!/bin/bash

echo "🔍 Checking server status after restart..."

# Check if we can reach the server
echo "📡 Testing server connectivity..."
ping -c 3 192.168.1.115

echo ""
echo "🐳 Checking Docker container status..."
ssh avian@192.168.1.115 "cd /home/avian/avian-cybersecurity-platform-onprem && sudo docker-compose -f docker-compose.prod.yml ps"

echo ""
echo "🌐 Testing website accessibility..."
curl -k -I https://192.168.1.115 2>/dev/null | head -1

echo ""
echo "🔧 If containers are down, run this to start them:"
echo "ssh avian@192.168.1.115"
echo "cd /home/avian/avian-cybersecurity-platform-onprem"
echo "sudo docker-compose -f docker-compose.prod.yml up -d"