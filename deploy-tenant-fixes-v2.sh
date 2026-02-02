#!/bin/bash

# Deploy tenant service fixes to server (v2)
SERVER_IP="192.168.1.115"
SERVER_USER="avian"
REMOTE_PATH="/home/avian/avian-cybersecurity-platform-onprem"

echo "🚀 Deploying tenant service fixes to server (v2)..."

# Copy fixed tenant service
echo "📁 Copying fixed tenant service..."
scp src/services/tenant.service.ts $SERVER_USER@$SERVER_IP:$REMOTE_PATH/src/services/

# Copy Docker database fix script
echo "📁 Copying Docker database fix script..."
scp fix-tenant-database-docker.sh $SERVER_USER@$SERVER_IP:$REMOTE_PATH/

# Execute fixes on server
echo "🔧 Executing fixes on server..."
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "🔄 Rebuilding and restarting application..."
docker-compose -f docker-compose.prod.yml down
docker system prune -f
docker-compose -f docker-compose.prod.yml up -d --build

echo "⏳ Waiting for services to start..."
sleep 15

echo "🏥 Checking service health..."
docker-compose -f docker-compose.prod.yml ps

echo "🔧 Running database schema fix..."
chmod +x fix-tenant-database-docker.sh
./fix-tenant-database-docker.sh

echo "📋 Checking application logs..."
docker-compose -f docker-compose.prod.yml logs --tail=10 app

ENDSSH

if [ $? -eq 0 ]; then
    echo "✅ Tenant service fixes deployed successfully!"
    echo "🌐 Platform should be available at: https://$SERVER_IP"
    echo ""
    echo "🧪 Test tenant creation by:"
    echo "1. Login to the platform"
    echo "2. Go to Platform Admin"
    echo "3. Try creating a new tenant"
else
    echo "❌ Deployment failed!"
    exit 1
fi