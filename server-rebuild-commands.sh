#!/bin/bash

# Commands to run on the server to rebuild the Docker container
# Run this script on the server at 192.168.1.116

echo "🔧 Rebuilding Docker container with TenantSwitcher fixes..."

cd /home/avian/avian-cybersecurity-platform-onprem

echo "📦 Stopping current containers..."
sudo docker-compose -f docker-compose.prod.yml down

echo "🏗️ Building new container (this may take a few minutes)..."
sudo docker-compose -f docker-compose.prod.yml build --no-cache app

echo "🚀 Starting updated containers..."
sudo docker-compose -f docker-compose.prod.yml up -d

echo "✅ Container rebuild complete!"
echo ""
echo "🧪 Test the fix:"
echo "1. Open https://192.168.1.116 in browser"
echo "2. Login as u@esr.com / admin123"
echo "3. Check browser console (F12) - should be clean"
echo "4. Verify tenant name shows 'esr' in header"
echo "5. Create a test ticket and check queues"