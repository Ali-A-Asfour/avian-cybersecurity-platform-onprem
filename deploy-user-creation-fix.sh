#!/bin/bash

# Deploy User Creation Fix for Cross-Tenant Roles
# This script deploys the fixes for Security Analyst and IT Helpdesk Analyst user creation

set -e

SERVER_IP="192.168.1.116"
SERVER_USER="avian"

echo "🚀 Deploying user creation fix to server..."

# Copy updated files to server
echo "📁 Copying updated files..."
scp src/components/admin/users/UserManagement.tsx $SERVER_USER@$SERVER_IP:/home/$SERVER_USER/avian-cybersecurity-platform-onprem/src/components/admin/users/
scp src/app/api/users/route.ts $SERVER_USER@$SERVER_IP:/home/$SERVER_USER/avian-cybersecurity-platform-onprem/src/app/api/users/
scp src/services/user.service.ts $SERVER_USER@$SERVER_IP:/home/$SERVER_USER/avian-cybersecurity-platform-onprem/src/services/
scp fix-user-roles-enum.sh $SERVER_USER@$SERVER_IP:/home/$SERVER_USER/avian-cybersecurity-platform-onprem/

echo "🔧 Updating database enum on server..."
ssh $SERVER_USER@$SERVER_IP "cd /home/$SERVER_USER/avian-cybersecurity-platform-onprem && chmod +x fix-user-roles-enum.sh && ./fix-user-roles-enum.sh"

echo "🐳 Rebuilding Docker container..."
ssh $SERVER_USER@$SERVER_IP "cd /home/$SERVER_USER/avian-cybersecurity-platform-onprem && sudo docker-compose -f docker-compose.prod.yml down && sudo docker-compose -f docker-compose.prod.yml build --no-cache app && sudo docker-compose -f docker-compose.prod.yml up -d"

echo "⏳ Waiting for services to start..."
sleep 30

echo "🔍 Checking container status..."
ssh $SERVER_USER@$SERVER_IP "cd /home/$SERVER_USER/avian-cybersecurity-platform-onprem && sudo docker-compose -f docker-compose.prod.yml ps"

echo "✅ User creation fix deployment complete!"
echo ""
echo "🧪 Test user creation:"
echo "1. Login to https://192.168.1.116"
echo "2. Go to Super Admin > User Management"
echo "3. Try creating Security Analyst and IT Helpdesk Analyst users"
echo "4. These roles should now auto-assign to the default tenant"