#!/bin/bash

echo "🔄 Force rebuilding server application..."

ssh avian@192.168.1.116 << 'EOF'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "🛑 Stopping all containers..."
sudo docker-compose -f docker-compose.prod.yml down

echo "🧹 Removing old app image..."
sudo docker rmi avian-cybersecurity-platform-onprem-app:latest || true

echo "🔨 Building fresh app container..."
sudo docker-compose -f docker-compose.prod.yml build --no-cache app

echo "🚀 Starting all containers..."
sudo docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting 15 seconds for startup..."
sleep 15

echo "🔍 Checking container status..."
sudo docker-compose -f docker-compose.prod.yml ps

echo "📋 Checking app logs..."
sudo docker-compose -f docker-compose.prod.yml logs app --tail=20

echo "✅ Force rebuild complete!"
EOF