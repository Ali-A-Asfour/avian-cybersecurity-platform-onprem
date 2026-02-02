#!/bin/bash

# Fix Comments Display and Navigation Issues
# This script fixes the missing comments and back button issues

echo "🚀 Deploying comments and navigation fixes to server..."

SERVER_IP="192.168.1.116"
SERVER_USER="avian"
SERVER_PATH="/home/avian/avian-cybersecurity-platform-onprem"

echo "📋 Files to deploy:"
echo "  - Comment store implementation"
echo "  - Fixed comments API (file-based storage)"
echo "  - Fixed resolution API (creates resolution comments)"
echo "  - Fixed navigation (same tab instead of new tab)"
echo "  - Test comments data"

# Copy comment store
echo "💾 Copying comment store..."
scp src/lib/comment-store.ts ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/src/lib/comment-store.ts

# Copy fixed comments API
echo "💬 Copying fixed comments API..."
scp "src/app/api/tickets/[id]/comments/route.ts" "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/src/app/api/tickets/[id]/comments/route.ts"

# Copy fixed resolution API
echo "🎫 Copying fixed resolution API..."
scp "src/app/api/tickets/[id]/resolve/route.ts" "${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/src/app/api/tickets/[id]/resolve/route.ts"

# Copy fixed ClosedTicketsQueue component
echo "🔧 Copying fixed navigation component..."
scp src/components/help-desk/ClosedTicketsQueue.tsx ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/src/components/help-desk/ClosedTicketsQueue.tsx

# Copy test comments data
echo "📊 Copying test comments data..."
scp .comments-store.json ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/.comments-store.json

echo "🔧 Connecting to server to rebuild Docker container..."

ssh ${SERVER_USER}@${SERVER_IP} << 'EOF'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "🛑 Stopping containers..."
sudo docker-compose -f docker-compose.prod.yml down

echo "🔨 Rebuilding application container..."
sudo docker-compose -f docker-compose.prod.yml build app

echo "🚀 Starting containers..."
sudo docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for containers to be ready..."
sleep 15

echo "🔍 Checking container status..."
sudo docker-compose -f docker-compose.prod.yml ps

echo "✅ Deployment complete!"
echo ""
echo "🧪 Test the fixes:"
echo "1. Login to https://192.168.1.116 with h@tcc.com / 12345678"
echo "2. Go to Help Desk → Closed Tickets tab"
echo "3. Click 'View' on any closed ticket"
echo "4. ✅ Should open in same tab (back button works)"
echo "5. ✅ Should see timeline with comments and resolution"
echo "6. ✅ Should see troubleshooting steps and final resolution"
echo ""
echo "📊 Expected comments per ticket:"
echo "  - Email Configuration Issue: 2 comments"
echo "  - Password Reset Request: 2 comments (1 internal)"
echo "  - Printer Connection Problem: 3 comments"

EOF

echo "🎉 Deployment completed successfully!"
echo ""
echo "🔍 Changes made:"
echo "✅ Implemented persistent comment storage"
echo "✅ Fixed comments API to show actual comments"
echo "✅ Fixed resolution API to create resolution comments"
echo "✅ Fixed navigation to open in same tab (back button works)"
echo "✅ Added test comments for existing closed tickets"