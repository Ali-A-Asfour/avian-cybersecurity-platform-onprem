#!/bin/bash

# Deploy tenant schema fix to server
SERVER_IP="192.168.1.115"
SERVER_USER="avian"
REMOTE_PATH="/home/avian/avian-cybersecurity-platform-onprem"

echo "🚀 Deploying tenant schema fix to server..."

# Copy fixed tenant schema manager
echo "📁 Copying fixed tenant schema manager..."
scp src/lib/tenant-schema.ts $SERVER_USER@$SERVER_IP:$REMOTE_PATH/src/lib/

# Execute fixes on server
echo "🔧 Executing fixes on server..."
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "🔄 Rebuilding and restarting application..."
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build

echo "⏳ Waiting for services to start..."
sleep 15

echo "🏥 Checking service health..."
docker-compose -f docker-compose.prod.yml ps

echo "📋 Checking application logs..."
docker-compose -f docker-compose.prod.yml logs --tail=10 app

ENDSSH

if [ $? -eq 0 ]; then
    echo "✅ Tenant schema fix deployed successfully!"
    echo "🌐 Platform should be available at: https://$SERVER_IP"
    echo ""
    echo "🧪 Test tenant creation by:"
    echo "1. Login to the platform"
    echo "2. Go to Platform Admin"
    echo "3. Try creating a new tenant"
    echo ""
    echo "📋 The schema creation error should now be resolved."
else
    echo "❌ Deployment failed!"
    exit 1
fi