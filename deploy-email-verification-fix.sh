#!/bin/bash

# Deploy email verification fix to server
SERVER_IP="192.168.1.115"
SERVER_USER="avian"
REMOTE_PATH="/home/avian/avian-cybersecurity-platform-onprem"

echo "🚀 Deploying email verification fix to server..."

# Copy fixed files
echo "📁 Copying fixed authentication files..."
scp src/app/api/auth/login/route.ts $SERVER_USER@$SERVER_IP:$REMOTE_PATH/src/app/api/auth/login/
scp src/services/user.service.ts $SERVER_USER@$SERVER_IP:$REMOTE_PATH/src/services/
scp fix-email-verification.sh $SERVER_USER@$SERVER_IP:$REMOTE_PATH/

# Execute fixes on server
echo "🔧 Executing fixes on server..."
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "🔧 Running database email verification fix..."
chmod +x fix-email-verification.sh
./fix-email-verification.sh

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
    echo "✅ Email verification fix deployed successfully!"
    echo "🌐 Platform should be available at: https://$SERVER_IP"
    echo ""
    echo "🧪 Test login with new accounts:"
    echo "1. Create a new user through admin interface"
    echo "2. Try logging in with the new user"
    echo "3. Should work without email verification requirement"
    echo ""
    echo "📋 Email verification is now disabled for on-premises deployment."
else
    echo "❌ Deployment failed!"
    exit 1
fi