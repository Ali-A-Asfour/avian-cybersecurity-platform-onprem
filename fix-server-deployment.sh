#!/bin/bash

# Fix AVIAN Platform Server Deployment
# This script fixes the authentication issues and redeploys the application

set -e

echo "🔧 Fixing AVIAN Platform Server Deployment..."

# Server details
SERVER_IP="192.168.1.115"
SERVER_USER="avian"
PROJECT_DIR="/home/avian/avian-cybersecurity-platform-onprem"

echo "📋 Step 1: Copying fixed files to server..."

# Copy the fixed alert service
scp src/services/alert.service.ts ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/src/services/

# Copy the updated production environment file
scp .env.production ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/

echo "📋 Step 2: Rebuilding and restarting application on server..."

ssh ${SERVER_USER}@${SERVER_IP} << 'EOF'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "🛑 Stopping current application..."
docker-compose -f docker-compose.prod.yml down

echo "🔨 Rebuilding application with fixes..."
docker-compose -f docker-compose.prod.yml build --no-cache app

echo "🚀 Starting application..."
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

echo "📊 Checking service status..."
docker-compose -f docker-compose.prod.yml ps

echo "📋 Checking application logs..."
docker-compose -f docker-compose.prod.yml logs app | tail -20

echo "✅ Deployment complete!"
echo "🌐 Application should be available at: https://192.168.1.115"
echo "🔑 Login credentials:"
echo "   Email: admin@avian.local"
echo "   Password: admin123"
EOF

echo "🎉 Server deployment fix completed!"
echo ""
echo "🔍 To verify the fix:"
echo "1. Open https://192.168.1.115 in your browser"
echo "2. Try logging in with admin@avian.local / admin123"
echo "3. Check that you can access the dashboard"
echo ""
echo "📊 To monitor logs:"
echo "ssh ${SERVER_USER}@${SERVER_IP} 'cd ${PROJECT_DIR} && docker-compose -f docker-compose.prod.yml logs -f app'"