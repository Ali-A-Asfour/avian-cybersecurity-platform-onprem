#!/bin/bash

# Complete Help Desk Fix
# Fixes [object Object] errors and 500 API errors

echo "=== COMPLETE HELP DESK FIX ==="
echo "Timestamp: $(date)"
echo "Target: Fix all help desk errors and [object Object] warnings"
echo

# List of files to copy
FILES=(
    "src/components/help-desk/UnassignedTicketQueue.tsx"
    "src/components/help-desk/MyTicketsQueue.tsx"
    "src/components/help-desk/TenantAdminQueue.tsx"
    "src/components/help-desk/GeneralTicketQueue.tsx"
    "src/components/help-desk/CreateKnowledgeArticle.tsx"
    "src/app/api/help-desk/queue/unassigned/route.ts"
    "src/app/api/help-desk/queue/my-tickets/route.ts"
)

echo "📁 Copying fixed files to server..."
for file in "${FILES[@]}"; do
    echo "  Copying $file..."
    scp "$file" "avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/$file"
    if [ $? -ne 0 ]; then
        echo "❌ Failed to copy $file"
        exit 1
    fi
done

echo "✅ All files copied successfully"
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
echo "🧪 Testing the fixes..."
echo "1. Help desk page: https://192.168.1.116/help-desk"
echo "2. Expected results:"
echo "   - No '[object Object]' warnings"
echo "   - No 500 API errors"
echo "   - Empty ticket queues (no mock data)"
echo "   - Proper error messages if any issues occur"
echo
echo "=== COMPLETE FIX DEPLOYMENT COMPLETE ==="