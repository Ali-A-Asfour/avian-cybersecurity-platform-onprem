#!/bin/bash

# Quick restart of just the app container
echo "🔄 Quick restart of app container..."

ssh avian@192.168.1.116 << 'EOF'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "🛑 Stopping app container..."
sudo docker-compose -f docker-compose.prod.yml stop app

echo "🔨 Rebuilding app container..."
sudo docker-compose -f docker-compose.prod.yml build app

echo "🚀 Starting app container..."
sudo docker-compose -f docker-compose.prod.yml start app

echo "⏳ Waiting 10 seconds..."
sleep 10

echo "🔍 Checking app status..."
sudo docker-compose -f docker-compose.prod.yml ps app

echo "✅ App restart complete!"
EOF