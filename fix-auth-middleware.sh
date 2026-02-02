#!/bin/bash

# Fix Authentication Middleware - JWT Token Verification Error Handling
# This script fixes the 503 errors on /assets and /dashboard routes after login
# Issue: AuthService.verifyAccessToken() throws errors instead of returning null

echo "🔧 Fixing authentication middleware JWT token verification..."

# Copy the fixed auth middleware to server
echo "📁 Copying fixed authentication middleware..."
scp src/middleware/auth.middleware.ts avian@192.168.1.115:/home/avian/avian-cybersecurity-platform-onprem/src/middleware/auth.middleware.ts

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

echo "✅ Authentication middleware fix deployment complete!"
EOF

echo "🎉 Authentication middleware fix deployed successfully!"
echo ""
echo "🧪 Test the fix:"
echo "1. Navigate to https://192.168.1.115"
echo "2. Login with admin@avian.local / admin123"
echo "3. Verify no 503 errors on /assets and /dashboard routes"
echo "4. Check browser console for any remaining errors"