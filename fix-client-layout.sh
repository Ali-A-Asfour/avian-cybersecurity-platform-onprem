#!/bin/bash

# Fix ClientLayout Component - Context Conflict Resolution
# This script fixes the team members page client-side exception
# Issue: ClientLayout was using DemoContext instead of AuthContext for production auth

echo "🔧 Fixing ClientLayout component context conflict..."

# Copy the fixed ClientLayout to server
echo "📁 Copying fixed ClientLayout component..."
scp src/components/layout/ClientLayout.tsx avian@192.168.1.115:/home/avian/avian-cybersecurity-platform-onprem/src/components/layout/ClientLayout.tsx

# Execute fixes on server
echo "🔧 Executing fixes on server..."
ssh avian@192.168.1.115 << 'EOF'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "🔄 Rebuilding and restarting application..."
docker-compose -f docker-compose.prod.yml build --no-cache app
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for services to start..."
sleep 30

echo "🏥 Checking service health..."
docker-compose -f docker-compose.prod.yml ps

echo "📋 Checking application logs..."
docker-compose -f docker-compose.prod.yml logs app | tail -10

echo "✅ ClientLayout fix deployment complete!"
EOF

echo "🎉 ClientLayout fix deployed successfully!"
echo ""
echo "🧪 Test the fix:"
echo "1. Navigate to https://192.168.1.115"
echo "2. Login with tadmin@test.com / admin123"
echo "3. Click 'Team Members' in the sidebar"
echo "4. Verify the page loads without client-side exceptions"