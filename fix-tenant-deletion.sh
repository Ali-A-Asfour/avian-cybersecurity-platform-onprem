#!/bin/bash

# Fix Tenant Deletion Issue
# Fixes the tenant deletion to properly hide deleted tenants

echo "=== FIXING TENANT DELETION ISSUE ==="
echo "Timestamp: $(date)"
echo "Target: Fix tenant deletion to properly filter out deleted tenants"
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
    echo "✅ Deployment completed successfully"
else
    echo "❌ Deployment failed"
    exit 1
fi

echo
echo "🧪 Testing the fix..."
echo "1. Go to: https://192.168.1.116/super-admin/tenants"
echo "2. Try deleting a tenant"
echo "3. Expected results:"
echo "   - Tenant shows 'deleted successfully' message"
echo "   - Tenant disappears from the list (filtered out)"
echo "   - Only active tenants are shown"
echo
echo "=== TENANT DELETION FIX COMPLETE ==="