#!/bin/bash

# Fix Login Account Active Check
# Bypasses account active check for production deployment

echo "=== FIXING LOGIN ACCOUNT ACTIVE CHECK ==="
echo "Timestamp: $(date)"
echo "Target: Bypass account active check for production"
echo

echo "📁 Copying fixed login API to server..."
scp src/app/api/auth/login/route.ts avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/app/api/auth/login/route.ts

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
echo "🧪 Testing login..."
echo "Try logging in with admin@avian.local / admin123"
echo "The account active check is now bypassed for production"
echo
echo "=== LOGIN FIX DEPLOYMENT COMPLETE ==="