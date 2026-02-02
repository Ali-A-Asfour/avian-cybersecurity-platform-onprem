#!/bin/bash

# Deploy Ticket Creation Fix
# Fixes JSON parsing errors when creating tickets

set -e

SERVER="avian@192.168.1.116"
REMOTE_PATH="/home/avian/avian-cybersecurity-platform-onprem"

echo "🚀 Deploying ticket creation fix to production server..."

# SSH into server and rebuild container
echo "🔧 Rebuilding Docker container on server..."
ssh $SERVER << 'EOF'
cd /home/avian/avian-cybersecurity-platform-onprem

# Stop containers
echo "⏹️ Stopping containers..."
sudo docker-compose -f docker-compose.prod.yml down

# Remove old image to force rebuild
echo "🗑️ Removing old image..."
sudo docker rmi avian-cybersecurity-platform-onprem-app || true

# Rebuild with no cache
echo "🔨 Building new image..."
sudo docker-compose -f docker-compose.prod.yml build --no-cache app

# Start containers
echo "▶️ Starting containers..."
sudo docker-compose -f docker-compose.prod.yml up -d

# Wait for containers to be ready
echo "⏳ Waiting for containers to start..."
sleep 10

# Check container status
echo "📊 Container status:"
sudo docker-compose -f docker-compose.prod.yml ps
EOF

echo "✅ Deployment complete!"
echo ""
echo "🧪 Test the fix:"
echo "1. Login to the platform"
echo "2. Go to Help Desk page"
echo "3. Click 'New Ticket' button"
echo "4. Fill out the form and submit"
echo "5. Should see success confirmation instead of JSON error"
echo ""
echo "🔗 Server URL: https://192.168.1.116"