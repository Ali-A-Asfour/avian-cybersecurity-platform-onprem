#!/bin/bash

# Deploy Tenant Selector Fix for Cross-Tenant Users
# Fixes permission issues preventing Security Analysts and IT Helpdesk Analysts from seeing all tenants

set -e

SERVER="avian@192.168.1.116"
REMOTE_PATH="/home/avian/avian-cybersecurity-platform-onprem"

echo "🚀 Deploying tenant selector fix to production server..."

# Copy updated files to server
echo "📁 Copying updated files..."
scp src/services/tenant.service.ts $SERVER:$REMOTE_PATH/src/services/
scp src/app/api/super-admin/tenants/route.ts $SERVER:$REMOTE_PATH/src/app/api/super-admin/

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
echo "1. Login as security.analyst@company.com or helpdesk.analyst@company.com"
echo "2. Go to Help Desk page"
echo "3. Check if tenant selector shows all tenants (esr, test)"
echo "4. Check if header dropdown 'Switch Tenant (Dev Mode)' shows all tenants"
echo ""
echo "🔗 Server URL: https://192.168.1.116"