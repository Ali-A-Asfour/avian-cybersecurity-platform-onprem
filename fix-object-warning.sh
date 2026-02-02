#!/bin/bash

# Fix [object Object] Warning in Help Desk
# This script fixes the error handling in MyTicketsQueue.tsx and rebuilds the container

echo "=== FIXING [OBJECT OBJECT] WARNING ==="
echo "Timestamp: $(date)"
echo "Target: Fix error handling in help desk components"
echo

# Copy the fixed file to server
echo "📁 Copying fixed MyTicketsQueue.tsx to server..."
scp src/components/help-desk/MyTicketsQueue.tsx avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/components/help-desk/MyTicketsQueue.tsx

if [ $? -eq 0 ]; then
    echo "✅ File copied successfully"
else
    echo "❌ Failed to copy file"
    exit 1
fi

echo
echo "🔧 Rebuilding Docker container on server..."

# SSH into server and rebuild container
ssh avian@192.168.1.116 << 'EOF'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "Stopping containers..."
sudo docker-compose -f docker-compose.prod.yml down

echo "Rebuilding application with no cache..."
sudo docker-compose -f docker-compose.prod.yml build --no-cache app

echo "Starting containers..."
sudo docker-compose -f docker-compose.prod.yml up -d

echo "Waiting for containers to be ready..."
sleep 30

echo "Checking container status..."
sudo docker-compose -f docker-compose.prod.yml ps
EOF

if [ $? -eq 0 ]; then
    echo "✅ Container rebuild completed successfully"
else
    echo "❌ Container rebuild failed"
    exit 1
fi

echo
echo "🧪 Testing the fix..."
echo "Please test the help desk page at: https://192.168.1.116/help-desk"
echo "The '[object Object]' warning should no longer appear"
echo
echo "=== FIX DEPLOYMENT COMPLETE ==="