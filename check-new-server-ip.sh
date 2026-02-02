#!/bin/bash

echo "🔍 Checking server status at new IP: 192.168.1.116"

# Check connectivity
echo "📡 Testing server connectivity..."
ping -c 3 192.168.1.116

echo ""
echo "🐳 Checking Docker container status..."
ssh avian@192.168.1.116 "cd /home/avian/avian-cybersecurity-platform-onprem && sudo docker-compose -f docker-compose.prod.yml ps"

echo ""
echo "🌐 Testing website accessibility..."
curl -k -I https://192.168.1.116 2>/dev/null | head -1

echo ""
echo "🔧 If website is not accessible, containers may need to be started:"
echo "ssh avian@192.168.1.116"
echo "cd /home/avian/avian-cybersecurity-platform-onprem"
echo "sudo docker-compose -f docker-compose.prod.yml up -d"