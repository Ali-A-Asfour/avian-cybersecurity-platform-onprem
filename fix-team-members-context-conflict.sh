#!/bin/bash

# Fix Team Members Page Context Conflict
# Date: January 25, 2026
# Issue: Client-side exception due to useRequireRole conflicts with ProtectedRoute

echo "🔧 Fixing team members page context conflicts..."

# Copy the fixed team members page to server
echo "📁 Copying fixed team members page..."
scp -o StrictHostKeyChecking=no src/app/admin/users/page.tsx avian@192.168.1.115:/home/avian/avian-cybersecurity-platform-onprem/src/app/admin/users/page.tsx

# SSH to server and rebuild
echo "🚀 Rebuilding application on server..."
ssh -o StrictHostKeyChecking=no avian@192.168.1.115 << 'EOF'
cd /home/avian/avian-cybersecurity-platform-onprem

echo "🛑 Stopping containers..."
sudo docker-compose -f docker-compose.prod.yml down

echo "🔨 Rebuilding with no cache..."
sudo docker-compose -f docker-compose.prod.yml build --no-cache app

echo "🚀 Starting containers..."
sudo docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Waiting for services to start..."
sleep 30

echo "✅ Deployment complete!"
echo "🌐 Platform available at: https://192.168.1.115"
echo "👤 Test with: tadmin@test.com / admin123"
EOF

echo "✅ Team members page context conflict fix deployed!"
echo ""
echo "🧪 Testing Instructions:"
echo "1. Navigate to: https://192.168.1.115"
echo "2. Login with: tadmin@test.com / admin123"
echo "3. Click 'Team Members' in sidebar"
echo "4. Expected: Page loads without 'Application error: a client-side exception has occurred'"
echo ""
echo "🔍 If still failing, check browser console for specific JavaScript errors"